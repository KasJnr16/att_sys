import json
from datetime import datetime, timezone
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.session import get_db
from app.models.academic import Class, Programme
from app.models.attendance import AttendanceSession
from app.models.enrollment import Enrollment, AttendanceRecord
from app.models.user import User, Student, Role
from app.models.webauthn import WebAuthnCredential
from app.schemas.academic import Class as ClassSchema
from app.schemas.attendance import AttendanceRecord as AttendanceRecordSchema
from app.schemas.user import StudentLookupResponse
from app.api.deps import RoleChecker
from app.services.attendance_service import AttendanceService
from app.services.webauthn_service import WebAuthnService

router = APIRouter()


def _get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip
    return request.client.host if request.client else "unknown"


def _build_client_fingerprint(request: Request) -> str:
    client_ip = request.headers.get("x-attendance-client") or _get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")
    return AttendanceService.build_client_fingerprint(client_ip, user_agent)


async def _require_verified_code(
    db: AsyncSession,
    token: str,
    request: Request
) -> AttendanceSession:
    session = await AttendanceService.get_session_by_token(db, token)
    if not session:
        raise HTTPException(status_code=404, detail="Invalid or expired session token")

    attempt = await AttendanceService.get_code_attempt(db, session.id, _build_client_fingerprint(request))
    if not attempt or not attempt.code_verified_at:
        raise HTTPException(
            status_code=403,
            detail="Please verify the lecturer's 6-digit code before continuing.",
        )

    return session


@router.get("/lookup", response_model=StudentLookupResponse)
async def lookup_student(
    request: Request,
    index: str = Query(..., min_length=10, max_length=10, description="Student index (10 digits)"),
    token: str = Query(..., min_length=1, description="Attendance session token"),
    db: AsyncSession = Depends(get_db)
) -> Any:
    await _require_verified_code(db, token, request)

    result = await db.execute(
        select(Student)
        .where(Student.student_index == index)
        .options(selectinload(Student.programme))
    )
    student = result.scalars().first()

    if not student:
        return {"exists": False, "has_webauthn": False, "student_id": None}

    result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.student_id == student.id)
    )
    credentials = result.scalars().all()
    has_webauthn = len(credentials) > 0

    return {
        "exists": True,
        "has_webauthn": has_webauthn,
        "student_id": student.id,
    }


class ProgrammeResponse(BaseModel):
    id: int
    name: str
    model_config = {"from_attributes": True}


@router.get("/programmes", response_model=List[ProgrammeResponse])
async def get_programmes(db: AsyncSession = Depends(get_db)) -> List[ProgrammeResponse]:
    result = await db.execute(select(Programme).order_by(Programme.name))
    return result.scalars().all()


class StudentSelfRegisterRequest(BaseModel):
    student_index: str
    full_name: str | None = None
    class_session_id: int
    token: str
    webauthn_registration_response: dict


class StartNewStudentRegistrationRequest(BaseModel):
    student_index: str
    full_name: str | None = None
    class_session_id: int
    token: str


@router.post("/start-registration")
async def start_new_student_registration(
    request: StartNewStudentRegistrationRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
) -> Any:
    if not request.student_index.isdigit() or len(request.student_index) != 10:
        raise HTTPException(status_code=400, detail="Student index must be 10 digits")

    from app.models.academic import ClassSession, Class, Course
    verified_session = await _require_verified_code(db, request.token, http_request)

    if verified_session.class_session_id != request.class_session_id:
        raise HTTPException(status_code=403, detail="Session mismatch")

    result = await db.execute(
        select(ClassSession)
        .where(ClassSession.id == request.class_session_id)
        .options(selectinload(ClassSession.parent_class).selectinload(Class.course).selectinload(Course.programme))
    )
    class_session = result.scalars().first()
    if not class_session:
        raise HTTPException(status_code=404, detail="Class session not found")

    active_session_result = await db.execute(
        select(AttendanceSession).where(
            AttendanceSession.class_session_id == request.class_session_id,
            AttendanceSession.is_active == True,
            AttendanceSession.expires_at > datetime.now(timezone.utc),
        )
    )
    active_session = active_session_result.scalars().first()
    if not active_session:
        raise HTTPException(status_code=400, detail="Attendance session is no longer active")

    programme = class_session.parent_class.course.programme
    if not programme:
        raise HTTPException(status_code=400, detail="Programme not found for this session")

    existing = await db.execute(
        select(Student)
        .where(Student.student_index == request.student_index)
        .options(selectinload(Student.user))
    )
    student = existing.scalars().first()
    is_new_student = student is None

    if is_new_student:
        if not request.full_name or not request.full_name.strip():
            raise HTTPException(status_code=400, detail="Full name is required for new students")

        result = await db.execute(select(Role).where(Role.name == "student"))
        student_role = result.scalars().first()
        if not student_role:
            raise HTTPException(status_code=500, detail="Student role not found")

        email = f"{request.student_index}@htu.edu.gh"
        existing_user_result = await db.execute(
            select(User)
            .where(User.email == email)
            .options(selectinload(User.student), selectinload(User.role))
        )
        user = existing_user_result.scalars().first()

        if user:
            if user.student:
                if user.student.student_index != request.student_index:
                    raise HTTPException(
                        status_code=409,
                        detail="A different student account already uses this institutional email.",
                    )
                student = user.student
                is_new_student = False
            else:
                if user.role and user.role.name != "student":
                    raise HTTPException(
                        status_code=409,
                        detail="This institutional email is already linked to a non-student account.",
                    )
                user.role_id = student_role.id
                user.is_active = True
        else:
            user = User(
                email=email,
                role_id=student_role.id,
                is_active=True
            )
            db.add(user)
            await db.flush()

        if student is None:
            student = Student(
                user_id=user.id,
                student_index=request.student_index,
                full_name=request.full_name.strip(),
                programme_id=programme.id
            )
            db.add(student)
            await db.flush()
            await db.refresh(student)

    student_id = student.id

    options_json = await WebAuthnService.get_student_registration_options(db, student)

    return {
        "student_id": student_id,
        "student_index": student.student_index,
        "full_name": student.full_name,
        "is_new_student": is_new_student,
        "webauthn_options": json.loads(options_json),
        "challenge": json.loads(options_json)["challenge"],
        "class_info": {
            "course_name": class_session.parent_class.course.course_name,
            "course_code": class_session.parent_class.course.course_code,
            "programme_name": programme.name,
            "class_session_id": class_session.id
        }
    }


@router.post("/register")
async def self_register_student(
    request: StudentSelfRegisterRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db)
) -> Any:
    if not request.student_index.isdigit() or len(request.student_index) != 10:
        raise HTTPException(status_code=400, detail="Student index must be 10 digits")

    from app.models.academic import ClassSession, Class, Course
    verified_session = await _require_verified_code(db, request.token, http_request)

    if verified_session.class_session_id != request.class_session_id:
        raise HTTPException(status_code=403, detail="Session mismatch")

    result = await db.execute(
        select(ClassSession)
        .where(ClassSession.id == request.class_session_id)
        .options(selectinload(ClassSession.parent_class).selectinload(Class.course).selectinload(Course.programme))
    )
    class_session = result.scalars().first()
    if not class_session:
        raise HTTPException(status_code=404, detail="Class session not found")

    active_session_result = await db.execute(
        select(AttendanceSession).where(
            AttendanceSession.class_session_id == request.class_session_id,
            AttendanceSession.is_active == True,
            AttendanceSession.expires_at > datetime.now(timezone.utc),
        )
    )
    active_session = active_session_result.scalars().first()
    if not active_session:
        raise HTTPException(status_code=400, detail="Attendance session is no longer active")

    programme = class_session.parent_class.course.programme
    if not programme:
        raise HTTPException(status_code=400, detail="Programme not found for this session")

    result = await db.execute(
        select(Student).where(Student.student_index == request.student_index)
    )
    existing = result.scalars().first()
    
    if not existing:
        raise HTTPException(status_code=404, detail="Student not found. Please start registration first.")

    student = existing

    student_id = student.id
    user_id = student.user_id
    student_index = student.student_index
    full_name = student.full_name

    try:
        credential = await WebAuthnService.verify_student_registration(
            db=db,
            student=student,
            registration_response=request.webauthn_registration_response
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"WebAuthn registration failed: {str(e)}")

    return {
        "student_id": student_id,
        "user_id": user_id,
        "student_index": student_index,
        "full_name": full_name,
        "credential_id": credential.credential_id,
        "class_info": {
            "course_name": class_session.parent_class.course.course_name,
            "course_code": class_session.parent_class.course.course_code,
            "programme_name": programme.name,
            "class_session_id": class_session.id
        }
    }


@router.get("/me", response_model=Any)
async def get_student_profile(
    current_user: User = Depends(RoleChecker(["student"]))
) -> Any:
    if not current_user.student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return current_user.student

@router.get("/classes", response_model=List[ClassSchema])
async def get_enrolled_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["student"]))
) -> Any:
    if not current_user.student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    result = await db.execute(
        select(Class)
        .join(Enrollment, Enrollment.class_id == Class.id)
        .where(Enrollment.student_id == current_user.student.id)
        .options(selectinload(Class.course), selectinload(Class.lecturer))
    )
    return result.scalars().all()

@router.get("/attendance", response_model=List[AttendanceRecordSchema])
async def get_student_attendance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["student"]))
) -> Any:
    if not current_user.student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    
    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.student_id == current_user.student.id)
        .options(selectinload(AttendanceRecord.class_session))
    )
    return result.scalars().all()
