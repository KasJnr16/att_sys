import json
from datetime import datetime, timedelta, timezone
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.attendance import AttendanceCodeAttempt, AttendanceSession
from app.models.academic import ClassSession, Class
from app.models.enrollment import AttendanceRecord
from app.schemas.attendance import (
    AttendanceSessionCreate, AttendanceSession as AttendanceSessionSchema,
    AttendanceJoinRequest, AttendanceVerifyRequest
)
from app.api import deps
from app.models.user import User
from app.services.attendance_service import AttendanceService
from app.services.webauthn_service import WebAuthnService

router = APIRouter()

CODE_MAX_FAILED_ATTEMPTS = 5
CODE_FAILURE_WINDOW_MINUTES = 10
CODE_LOCKOUT_MINUTES = 15
SESSION_FREEZE_THRESHOLD = 20
SESSION_FREEZE_MINUTES = 2


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _build_client_fingerprint(request: Request) -> str:
    client_ip = request.headers.get("x-attendance-client") or _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")
    return AttendanceService.build_client_fingerprint(client_ip, user_agent)


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip
    return request.client.host if request.client else "unknown"


def _seconds_until(target: datetime, now: datetime) -> int:
    return max(1, int((target - now).total_seconds()))


async def _require_verified_code(
    db: AsyncSession,
    session: AttendanceSession,
    request: Request
) -> None:
    client_fingerprint = _build_client_fingerprint(request)
    attempt = await AttendanceService.get_code_attempt(db, session.id, client_fingerprint)
    if not attempt or not attempt.code_verified_at:
        raise HTTPException(
            status_code=403,
            detail="Please verify the lecturer's 6-digit code before continuing.",
        )

@router.post("/attendance-sessions", response_model=Any)
async def create_attendance_session(
    *,
    db: AsyncSession = Depends(get_db),
    session_in: AttendanceSessionCreate,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    db_obj, token = await AttendanceService.create_session(
        db,
        session_in.class_session_id,
        current_user.id,
        session_in.latitude,
        session_in.longitude,
        session_in.radius_meters,
        session_in.expires_in_minutes,
        session_in.max_uses,
    )
    return {
        "session_id": db_obj.id,
        "token": token,
        "expires_at": db_obj.expires_at,
        "radius_meters": db_obj.attendance_radius_meters,
    }

@router.get("/attendance-sessions/{session_id}/status")
async def get_attendance_session_status(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    result = await db.execute(
        select(AttendanceSession)
        .where(AttendanceSession.id == session_id)
        .options(selectinload(AttendanceSession.class_session))
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "id": session.id,
        "class_session_id": session.class_session_id,
        "class_id": session.class_session.class_id if session.class_session else None,
        "is_active": session.is_active,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        "usage_count": session.usage_count,
        "verification_code": session.verification_code,
        "radius_meters": session.attendance_radius_meters,
    }

@router.post("/attendance-sessions/{session_id}/close")
async def close_attendance_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    result = await db.execute(
        select(AttendanceSession)
        .where(AttendanceSession.id == session_id)
        .options(selectinload(AttendanceSession.class_session))
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.is_active = False
    session.expires_at = datetime.now(timezone.utc)
    await db.commit()
    
    return {
        "status": "closed",
        "session_id": session_id,
        "class_session_id": session.class_session_id,
        "class_id": session.class_session.class_id if session.class_session else None,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
    }

@router.post("/attendance-sessions/join")
async def join_attendance_session(
    *,
    db: AsyncSession = Depends(get_db),
    join_in: AttendanceJoinRequest,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    # 1. Fetch the attendance session by token
    result = await db.execute(
        select(AttendanceSession)
        .where(AttendanceSession.token_hash == join_in.token) # Token stored as hash or direct
        .options(selectinload(AttendanceSession.class_session).selectinload(ClassSession.parent_class).selectinload(Class.course))
    )
    session = result.scalars().first()
    
    # If not found, try direct token comparison (in case not hashed)
    if not session:
        result = await db.execute(
            select(AttendanceSession)
            .where(AttendanceSession.token_hash == join_in.token)
            .options(selectinload(AttendanceSession.class_session).selectinload(ClassSession.parent_class).selectinload(Class.course))
        )
        session = result.scalars().first()

    if not session or not session.is_active or session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Invalid or expired session")
    
    # Check if student already marked attendance for this session
    result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.student_id == current_user.student.id,
            AttendanceRecord.class_session_id == session.class_session_id
        )
    )
    if result.scalars().first():
        raise HTTPException(status_code=409, detail="Attendance already recorded")

    # 2. Generate WebAuthn options for the student to confirm identity
    options_json = await WebAuthnService.get_authentication_options(db, current_user)
    
    return {
        "session_id": session.id,
        "webauthn_options": json.loads(options_json),
        "class_info": {
            "course_name": session.class_session.parent_class.course.course_name,
            "course_code": session.class_session.parent_class.course.course_code,
            "lecturer_name": "Faculty Assigned"
        },
        "session_info": {
            "date": session.class_session.session_date.isoformat()
        }
    }

@router.post("/attendance-sessions/{session_id}/verify")
async def verify_attendance(
    *,
    db: AsyncSession = Depends(get_db),
    session_id: int,
    http_request: Request,
    verify_in: AttendanceVerifyRequest,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    # 1. Verify WebAuthn
    try:
        user, credential = await WebAuthnService.verify_authentication(
            db, verify_in.authentication_response, verify_in.challenge, current_user
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Identity verification failed: {str(e)}")
    
    # 2. Check session
    result = await db.execute(select(AttendanceSession).where(AttendanceSession.id == session_id))
    session = result.scalars().first()
    if not session or not session.is_active or session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Session no longer active")

    is_within_radius, distance = AttendanceService.validate_session_radius(
        session,
        verify_in.latitude,
        verify_in.longitude,
    )
    if not is_within_radius:
        rounded_distance = int(round(distance or 0))
        raise HTTPException(
            status_code=403,
            detail=(
                f"You are {rounded_distance} meters away from the attendance point. "
                "Please enter the classroom for attendance."
            ),
        )

    client_ip = _get_client_ip(http_request)
    user_agent = http_request.headers.get("user-agent", "unknown")
    result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.class_session_id == session.class_session_id,
            AttendanceRecord.ip_address == client_ip,
            AttendanceRecord.user_agent == user_agent,
            AttendanceRecord.student_id != current_user.student.id,
        )
    )
    if result.scalars().first():
        raise HTTPException(
            status_code=409,
            detail="This device has already been used to record attendance for another student in this session.",
        )
    
    # 3. Create attendance record
    result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.student_id == current_user.student.id,
            AttendanceRecord.class_session_id == session.class_session_id
        )
    )
    existing_record = result.scalars().first()
    if existing_record:
        return {"status": "already_present", "record_id": existing_record.id}

    db_record = AttendanceRecord(
        student_id=current_user.student.id,
        class_session_id=session.class_session_id,
        status="present",
        verification_method="webauthn",
        credential_id=credential.credential_id,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(db_record)
    
    # Update session usage
    session.usage_count += 1
    if session.usage_count >= session.max_uses:
        # For individual tokens, we might disable them.
        # But if it's a general QR for a class, max_uses should be large.
        pass
        
    await db.commit()
    await db.refresh(db_record)
    
    return {"status": "present", "record_id": db_record.id}

@router.get("/attendance-records", response_model=List[Any])
async def read_attendance_records(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    result = await db.execute(select(AttendanceRecord).offset(skip).limit(limit))
    return result.scalars().all()


class TokenValidationRequest(BaseModel):
    token: str


class StudentInfoRequest(BaseModel):
    student_id: int


class StudentVerificationOptionsRequest(BaseModel):
    student_index: str
    token: str


class WebAuthnChallengeRequest(BaseModel):
    challenge: str


@router.post("/validate-token")
async def validate_session_token(
    request: TokenValidationRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    from app.services.attendance_service import AttendanceService

    session = await AttendanceService.get_session_by_token(db, request.token)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session token")

    if session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Session has expired")

    if not session.is_active:
        raise HTTPException(status_code=410, detail="Session is no longer active")

    result = await db.execute(
        select(ClassSession)
        .where(ClassSession.id == session.class_session_id)
        .options(
            selectinload(ClassSession.parent_class).selectinload(Class.course),
            selectinload(ClassSession.parent_class).selectinload(Class.lecturer)
        )
    )
    class_session = result.scalars().first()

    return {
        "valid": True,
        "session_id": session.id,
        "class_session_id": class_session.id,
        "course_name": class_session.parent_class.course.course_name if class_session.parent_class and class_session.parent_class.course else None,
        "course_code": class_session.parent_class.course.course_code if class_session.parent_class and class_session.parent_class.course else None,
        "session_date": class_session.session_date.isoformat() if class_session.session_date else None,
        "expires_at": session.expires_at.isoformat() if session.expires_at else None,
        "requires_verification_code": True
    }


@router.post("/get-student-webauthn-options")
async def get_student_webauthn_options(
    request: StudentVerificationOptionsRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
) -> Any:
    from app.models.user import Student

    session = await AttendanceService.get_session_by_token(db, request.token)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired session token")
    await _require_verified_code(db, session, http_request)

    result = await db.execute(
        select(Student).where(Student.student_index == request.student_index)
        .options(selectinload(Student.programme))
    )
    student = result.scalars().first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student_id = student.id
    student_index = student.student_index
    full_name = student.full_name
    programme_name = student.programme.name if student.programme else None

    options_json = await WebAuthnService.get_student_authentication_options(db, student)

    return {
        "webauthn_options": json.loads(options_json),
        "student": {
            "id": student_id,
            "student_index": student_index,
            "full_name": full_name,
            "programme_name": programme_name
        }
    }


@router.post("/get-student-registration-options")
async def get_student_registration_options(
    request: StudentInfoRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    from app.models.user import Student

    result = await db.execute(
        select(Student).where(Student.id == request.student_id)
        .options(selectinload(Student.programme))
    )
    student = result.scalars().first()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student_id = student.id
    student_index = student.student_index
    full_name = student.full_name
    programme_name = student.programme.name if student.programme else None

    options_json = await WebAuthnService.get_student_registration_options(db, student)

    return {
        "webauthn_options": json.loads(options_json),
        "student": {
            "id": student_id,
            "student_index": student_index,
            "full_name": full_name,
            "programme_name": programme_name
        }
    }


class VerifyStudentAttendanceRequest(BaseModel):
    student_id: int
    authentication_response: dict
    challenge: str
    token: str
    latitude: float
    longitude: float


@router.post("/verify-student")
async def verify_student_attendance(
    request: VerifyStudentAttendanceRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
) -> Any:
    from app.models.user import Student

    session = await AttendanceService.get_session_by_token(db, request.token)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session token")

    if session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Session has expired")

    if not session.is_active:
        raise HTTPException(status_code=410, detail="Session is no longer active")
    await _require_verified_code(db, session, http_request)

    is_within_radius, distance = AttendanceService.validate_session_radius(
        session,
        request.latitude,
        request.longitude,
    )
    if not is_within_radius:
        rounded_distance = int(round(distance or 0))
        raise HTTPException(
            status_code=403,
            detail=(
                f"You are {rounded_distance} meters away from the attendance point. "
                "Please enter the classroom for attendance."
            ),
        )

    try:
        student_id, credential = await WebAuthnService.verify_student_authentication(
            db, request.authentication_response, request.challenge
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Identity verification failed: {str(e)}")

    if student_id != request.student_id:
        raise HTTPException(status_code=403, detail="Student ID mismatch")

    client_ip = _get_client_ip(http_request)
    user_agent = http_request.headers.get("user-agent", "unknown")
    device_record = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.class_session_id == session.class_session_id,
            AttendanceRecord.ip_address == client_ip,
            AttendanceRecord.user_agent == user_agent,
            AttendanceRecord.student_id != student_id,
        )
    )
    if device_record.scalars().first():
        raise HTTPException(
            status_code=409,
            detail="This device has already been used to record attendance for another student in this session.",
        )

    existing = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.class_session_id == session.class_session_id
        )
    )
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Attendance already recorded")

    db_record = AttendanceRecord(
        student_id=student_id,
        class_session_id=session.class_session_id,
        status="present",
        verification_method="webauthn",
        credential_id=credential.credential_id,
        ip_address=client_ip,
        user_agent=user_agent,
    )
    db.add(db_record)

    session.usage_count += 1

    await db.commit()
    await db.refresh(db_record)

    result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = result.scalars().first()

    return {
        "success": True,
        "student": {
            "full_name": student.full_name,
            "student_index": student.student_index
        },
        "message": "Attendance marked successfully"
    }


@router.get("/check-attendance")
async def check_attendance(
    token: str,
    student_id: int,
    db: AsyncSession = Depends(get_db)
) -> Any:
    from app.services.attendance_service import AttendanceService

    session = await AttendanceService.get_session_by_token(db, token)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session token")

    existing = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.student_id == student_id,
            AttendanceRecord.class_session_id == session.class_session_id
        )
    )
    record = existing.scalars().first()

    if record:
        return {"already_marked": True, "status": record.status}

    return {"already_marked": False}


class VerifyCodeRequest(BaseModel):
    token: str
    code: str


@router.post("/verify-code")
async def verify_session_code(
    payload: VerifyCodeRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
) -> Any:
    from app.services.attendance_service import AttendanceService

    session = await AttendanceService.get_session_by_token(db, payload.token)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session token")

    now = _utcnow()

    if session.expires_at < now:
        raise HTTPException(status_code=410, detail="Session has expired")

    if not session.is_active:
        raise HTTPException(status_code=410, detail="Session is no longer active")

    if session.code_verification_locked_until and session.code_verification_locked_until > now:
        retry_after = _seconds_until(session.code_verification_locked_until, now)
        raise HTTPException(
            status_code=429,
            detail=f"Code verification is temporarily paused for this session. Try again in {retry_after} seconds.",
        )

    if not session.verification_code:
        raise HTTPException(status_code=400, detail="Verification code not set for this session")

    client_fingerprint = _build_client_fingerprint(http_request)
    attempt_result = await db.execute(
        select(AttendanceCodeAttempt).where(
            AttendanceCodeAttempt.attendance_session_id == session.id,
            AttendanceCodeAttempt.client_fingerprint == client_fingerprint,
        )
    )
    attempt = attempt_result.scalars().first()

    if attempt and attempt.locked_until and attempt.locked_until > now:
        retry_after = _seconds_until(attempt.locked_until, now)
        raise HTTPException(
            status_code=429,
            detail=f"Too many invalid code attempts from this device. Try again in {retry_after} seconds.",
        )

    if payload.code == session.verification_code:
        if attempt:
            attempt.failed_attempts = 0
            attempt.first_failed_at = None
            attempt.last_failed_at = None
            attempt.code_verified_at = now
            attempt.locked_until = None
        else:
            attempt = AttendanceCodeAttempt(
                attendance_session_id=session.id,
                client_fingerprint=client_fingerprint,
                failed_attempts=0,
                code_verified_at=now,
            )
            db.add(attempt)
        if session.code_verification_locked_until and session.code_verification_locked_until <= now:
            session.code_verification_locked_until = None
        await db.commit()
        return {"valid": True, "message": "Code verified successfully"}

    window_start = now - timedelta(minutes=CODE_FAILURE_WINDOW_MINUTES)
    if not attempt:
        attempt = AttendanceCodeAttempt(
            attendance_session_id=session.id,
            client_fingerprint=client_fingerprint,
        )
        db.add(attempt)

    if not attempt.first_failed_at or attempt.first_failed_at < window_start:
        attempt.failed_attempts = 1
        attempt.first_failed_at = now
    else:
        attempt.failed_attempts += 1
    attempt.last_failed_at = now
    attempt.code_verified_at = None
    attempt.locked_until = None

    response_status = 400
    response_detail = "Invalid verification code"

    if attempt.failed_attempts >= CODE_MAX_FAILED_ATTEMPTS:
        attempt.locked_until = now + timedelta(minutes=CODE_LOCKOUT_MINUTES)
        response_status = 429
        response_detail = (
            f"Too many invalid code attempts from this device. Verification is locked for "
            f"{CODE_LOCKOUT_MINUTES} minutes."
        )

    await db.flush()

    global_failures_result = await db.execute(
        select(func.coalesce(func.sum(AttendanceCodeAttempt.failed_attempts), 0)).where(
            AttendanceCodeAttempt.attendance_session_id == session.id,
            AttendanceCodeAttempt.last_failed_at.is_not(None),
            AttendanceCodeAttempt.last_failed_at >= window_start,
        )
    )
    global_failures = global_failures_result.scalar() or 0

    if global_failures >= SESSION_FREEZE_THRESHOLD:
        session.code_verification_locked_until = now + timedelta(minutes=SESSION_FREEZE_MINUTES)
        response_status = 429
        response_detail = (
            f"Too many invalid code attempts for this session. Code verification is paused for "
            f"{SESSION_FREEZE_MINUTES} minutes."
        )

    await db.commit()

    raise HTTPException(status_code=response_status, detail=response_detail)
