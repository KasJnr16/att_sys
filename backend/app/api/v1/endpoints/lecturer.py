from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.academic import Class, ClassSession, ClassShare, Course, Programme, Department, SharePermission
from app.models.user import User, Student, Lecturer, Role
from app.models.enrollment import AttendanceRecord, Enrollment
from app.models.attendance import AttendanceSession
from app.schemas.academic import Class as ClassSchema, ClassSession as ClassSessionSchema
from app.schemas.attendance import AttendanceFeedRecord, AttendanceRecord as AttendanceRecordSchema
from app.schemas.user import LecturerProfileCreate, LecturerProfile
from app.api.deps import RoleChecker
from app.services.class_access import get_class_access, get_session_access

router = APIRouter()


class ClassShareRequest(BaseModel):
    lecturer_id: int
    permission: SharePermission


class ManualAttendanceRequest(BaseModel):
    student_index: str
    full_name: Optional[str] = None


def _resolve_session_status(att_session: Optional[AttendanceSession]) -> str:
    if att_session and att_session.is_active and att_session.expires_at > datetime.now(timezone.utc):
        return "open"
    if att_session:
        return "closed"
    return "scheduled"


async def _ensure_student_for_class(
    db: AsyncSession,
    db_class: Class,
    student_index: str,
    full_name: Optional[str],
) -> tuple[Student, bool]:
    if not student_index.isdigit() or len(student_index) != 10:
        raise HTTPException(status_code=400, detail="Student index must be 10 digits")

    result = await db.execute(
        select(Student)
        .where(Student.student_index == student_index)
        .options(selectinload(Student.user))
    )
    student = result.scalars().first()
    if student:
        return student, False

    if not full_name or not full_name.strip():
        raise HTTPException(status_code=400, detail="Full name is required for new students")

    role_result = await db.execute(select(Role).where(Role.name == "student"))
    student_role = role_result.scalars().first()
    if not student_role:
        raise HTTPException(status_code=500, detail="Student role not found")

    email = f"{student_index}@htu.edu.gh"
    user_result = await db.execute(
        select(User)
        .where(User.email == email)
        .options(selectinload(User.student), selectinload(User.role))
    )
    user = user_result.scalars().first()

    if user:
        if user.student:
            if user.student.student_index != student_index:
                raise HTTPException(
                    status_code=409,
                    detail="A different student account already uses this institutional email.",
                )
            return user.student, False

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
            is_active=True,
        )
        db.add(user)
        await db.flush()

    student = Student(
        user_id=user.id,
        student_index=student_index,
        full_name=full_name.strip(),
        programme_id=db_class.course.programme_id,
    )
    db.add(student)
    await db.flush()
    await db.refresh(student)
    return student, True

@router.get("/classes", response_model=List[Any])
async def get_lecturer_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    classes_with_access: list[tuple[Class, bool, bool, Optional[str]]] = []

    if current_user.role.name == "admin":
        result = await db.execute(
            select(Class)
            .options(selectinload(Class.course).selectinload(Course.programme))
        )
        classes = result.scalars().all()
        classes_with_access = [(cls, True, True, "edit") for cls in classes]
    else:
        lecturer_id = current_user.lecturer.id if current_user.lecturer else None
        if not lecturer_id:
            return []

        owned_result = await db.execute(
            select(Class)
            .where(Class.lecturer_id == lecturer_id)
            .options(selectinload(Class.course).selectinload(Course.programme))
        )
        owned_classes = owned_result.scalars().all()
        classes_with_access.extend((cls, True, True, "edit") for cls in owned_classes)

        shared_result = await db.execute(
            select(ClassShare)
            .where(ClassShare.lecturer_id == lecturer_id)
            .options(
                selectinload(ClassShare.parent_class).selectinload(Class.course).selectinload(Course.programme)
            )
        )
        seen_ids = {cls.id for cls in owned_classes}
        for share in shared_result.scalars().all():
            shared_class = share.parent_class
            if not shared_class or shared_class.id in seen_ids:
                continue
            can_edit = share.permission == SharePermission.edit
            classes_with_access.append((shared_class, can_edit, False, share.permission.value))

    enriched_classes = []
    for cls, can_edit, is_owner, share_permission in classes_with_access:
        student_count_result = await db.execute(
            select(func.count(func.distinct(AttendanceRecord.student_id)))
            .select_from(AttendanceRecord)
            .join(ClassSession, ClassSession.id == AttendanceRecord.class_session_id)
            .where(ClassSession.class_id == cls.id)
        )
        student_count = student_count_result.scalar() or 0
        
        session_count_result = await db.execute(
            select(func.count(ClassSession.id))
            .where(ClassSession.class_id == cls.id)
        )
        session_count = session_count_result.scalar() or 0
        
        cls_dict = {
            "id": cls.id,
            "course_id": cls.course_id,
            "lecturer_id": cls.lecturer_id,
            "semester": cls.semester,
            "academic_year": cls.academic_year,
            "section": cls.section,
            "course": {
                "course_code": cls.course.course_code,
                "course_name": cls.course.course_name,
                "programme": {"name": cls.course.programme.name} if cls.course.programme else None
            } if cls.course else None,
            "student_count": student_count,
            "session_count": session_count,
            "can_edit": can_edit,
            "is_owner": is_owner,
            "share_permission": share_permission,
        }
        enriched_classes.append(cls_dict)
    
    return enriched_classes

@router.get("/classes/{class_id}/sessions", response_model=List[ClassSessionSchema])
async def get_class_sessions(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    await get_class_access(db, class_id, current_user)

    result = await db.execute(
        select(ClassSession).where(ClassSession.class_id == class_id)
    )
    sessions = result.scalars().all()
    
    enriched_sessions = []
    for session in sessions:
        att_result = await db.execute(
            select(AttendanceSession)
            .where(AttendanceSession.class_session_id == session.id)
        )
        att_session = att_result.scalars().first()

        attendance_count_result = await db.execute(
            select(func.count(func.distinct(AttendanceRecord.student_id)))
            .where(AttendanceRecord.class_session_id == session.id)
        )
        attendance_count = attendance_count_result.scalar() or 0

        # Determine status based on AttendanceSession
        status = _resolve_session_status(att_session)

        session_dict = {
            "id": session.id,
            "class_id": session.class_id,
            "session_date": session.session_date.isoformat() if session.session_date else None,
            "status": status,
            "created_by": session.created_by,
            "attendance_session_id": att_session.id if att_session else None,
            "attendance_count": attendance_count,
        }
        enriched_sessions.append(session_dict)
    
    return enriched_sessions


@router.get("/lecturers/search")
async def search_lecturers(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    stmt = (
        select(Lecturer)
        .join(User, User.id == Lecturer.user_id)
        .options(selectinload(Lecturer.user))
        .order_by(Lecturer.full_name)
    )

    if current_user.role.name == "lecturer" and current_user.lecturer:
        stmt = stmt.where(Lecturer.id != current_user.lecturer.id)

    if q.strip():
        search_term = f"%{q.strip()}%"
        stmt = stmt.where(
            Lecturer.full_name.ilike(search_term) |
            User.email.ilike(search_term)
        )

    stmt = stmt.limit(25)
    result = await db.execute(stmt)
    lecturers = result.scalars().all()

    return [
        {
            "id": lecturer.id,
            "full_name": lecturer.full_name,
            "email": lecturer.user.email if lecturer.user else None,
        }
        for lecturer in lecturers
    ]


@router.get("/classes/{class_id}/shares")
async def get_class_shares(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    _, _, is_owner = await get_class_access(db, class_id, current_user)
    if current_user.role.name != "admin" and not is_owner:
        raise HTTPException(status_code=403, detail="Only the class owner can manage shares")

    result = await db.execute(
        select(ClassShare)
        .where(ClassShare.class_id == class_id)
        .options(selectinload(ClassShare.lecturer).selectinload(Lecturer.user))
        .order_by(ClassShare.created_at.desc())
    )
    shares = result.scalars().all()

    return [
        {
            "id": share.id,
            "permission": share.permission.value if hasattr(share.permission, "value") else str(share.permission),
            "lecturer": {
                "id": share.lecturer.id,
                "full_name": share.lecturer.full_name,
                "email": share.lecturer.user.email if share.lecturer and share.lecturer.user else None,
            } if share.lecturer else None,
            "created_at": share.created_at.isoformat() if share.created_at else None,
        }
        for share in shares
    ]


@router.post("/classes/{class_id}/shares")
async def create_class_share(
    class_id: int,
    share_in: ClassShareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    _, _, is_owner = await get_class_access(db, class_id, current_user)
    if current_user.role.name != "admin" and not is_owner:
        raise HTTPException(status_code=403, detail="Only the class owner can share this class")

    owner_class_result = await db.execute(select(Class).where(Class.id == class_id))
    db_class = owner_class_result.scalars().first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")

    if db_class.lecturer_id == share_in.lecturer_id:
        raise HTTPException(status_code=400, detail="You cannot share a class with the owner")

    lecturer_result = await db.execute(
        select(Lecturer)
        .where(Lecturer.id == share_in.lecturer_id)
        .options(selectinload(Lecturer.user))
    )
    lecturer = lecturer_result.scalars().first()
    if not lecturer:
        raise HTTPException(status_code=404, detail="Lecturer not found")

    existing_result = await db.execute(
        select(ClassShare).where(
            ClassShare.class_id == class_id,
            ClassShare.lecturer_id == share_in.lecturer_id,
        )
    )
    existing_share = existing_result.scalars().first()
    if existing_share:
        existing_share.permission = share_in.permission
        await db.commit()
        await db.refresh(existing_share)
        share = existing_share
    else:
        share = ClassShare(
            class_id=class_id,
            lecturer_id=share_in.lecturer_id,
            permission=share_in.permission,
            shared_by_user_id=current_user.id,
        )
        db.add(share)
        await db.commit()
        await db.refresh(share)

    return {
        "id": share.id,
        "permission": share.permission.value if hasattr(share.permission, "value") else str(share.permission),
        "lecturer": {
            "id": lecturer.id,
            "full_name": lecturer.full_name,
            "email": lecturer.user.email if lecturer.user else None,
        },
    }


@router.put("/classes/{class_id}/shares/{share_id}")
async def update_class_share(
    class_id: int,
    share_id: int,
    share_in: ClassShareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    _, _, is_owner = await get_class_access(db, class_id, current_user)
    if current_user.role.name != "admin" and not is_owner:
        raise HTTPException(status_code=403, detail="Only the class owner can update shares")

    result = await db.execute(
        select(ClassShare)
        .where(ClassShare.id == share_id, ClassShare.class_id == class_id)
        .options(selectinload(ClassShare.lecturer).selectinload(Lecturer.user))
    )
    share = result.scalars().first()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    if share.lecturer_id != share_in.lecturer_id:
        raise HTTPException(status_code=400, detail="Lecturer mismatch for this share")

    share.permission = share_in.permission
    await db.commit()

    return {
        "id": share.id,
        "permission": share.permission.value if hasattr(share.permission, "value") else str(share.permission),
        "lecturer": {
            "id": share.lecturer.id,
            "full_name": share.lecturer.full_name,
            "email": share.lecturer.user.email if share.lecturer and share.lecturer.user else None,
        } if share.lecturer else None,
    }


@router.delete("/classes/{class_id}/shares/{share_id}")
async def delete_class_share(
    class_id: int,
    share_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    _, _, is_owner = await get_class_access(db, class_id, current_user)
    if current_user.role.name != "admin" and not is_owner:
        raise HTTPException(status_code=403, detail="Only the class owner can remove shares")

    result = await db.execute(
        select(ClassShare).where(ClassShare.id == share_id, ClassShare.class_id == class_id)
    )
    share = result.scalars().first()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    await db.delete(share)
    await db.commit()

    return {"status": "deleted", "share_id": share_id}

@router.delete("/classes/{class_id}/sessions/{session_id}")
async def delete_session(
    class_id: int,
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    await get_class_access(db, class_id, current_user, require_edit=True)
    
    result = await db.execute(select(ClassSession).where(ClassSession.id == session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.class_id != class_id:
        raise HTTPException(status_code=400, detail="Session does not belong to this class")
    
    att_sessions_result = await db.execute(
        select(AttendanceSession).where(AttendanceSession.class_session_id == session_id)
    )
    for att_session in att_sessions_result.scalars().all():
        await db.delete(att_session)
    
    att_records_result = await db.execute(
        select(AttendanceRecord).where(AttendanceRecord.class_session_id == session_id)
    )
    for record in att_records_result.scalars().all():
        await db.delete(record)
    
    await db.delete(session)
    await db.commit()
    
    return {"status": "deleted", "session_id": session_id}

@router.get("/sessions/{session_id}/details")
async def get_session_details(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    session, can_edit, is_owner = await get_session_access(db, session_id, current_user)

    att_session_result = await db.execute(
        select(AttendanceSession)
        .where(AttendanceSession.class_session_id == session_id)
    )
    attendance_session = att_session_result.scalars().first()

    status = _resolve_session_status(attendance_session)

    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.class_session_id == session_id)
        .options(selectinload(AttendanceRecord.student))
    )
    attendance_records = result.scalars().all()

    attendance_count_result = await db.execute(
        select(func.count(func.distinct(AttendanceRecord.student_id)))
        .where(AttendanceRecord.class_session_id == session_id)
    )
    attendance_count = attendance_count_result.scalar() or 0

    return {
        "id": session.id,
        "session_date": session.session_date.isoformat() if session.session_date else None,
        "status": status,
        "attendance_session_id": attendance_session.id if attendance_session else None,
        "class_id": session.class_id,
        "attendance_count": attendance_count,
        "can_edit": can_edit,
        "is_owner": is_owner,
        "attendance_records": [
            {
                "student": {
                    "full_name": record.student.full_name if record.student else "Unknown",
                    "student_index": record.student.student_index if record.student else "N/A"
                },
                "verified_at": record.verified_at.isoformat() if record.verified_at else None,
                "verification_method": record.verification_method.value if hasattr(record.verification_method, "value") else str(record.verification_method),
            }
            for record in attendance_records
        ]
    }


@router.post("/sessions/{session_id}/manual-attendance")
async def add_manual_attendance(
    session_id: int,
    payload: ManualAttendanceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    session, can_edit, _ = await get_session_access(db, session_id, current_user, require_edit=True)

    att_session_result = await db.execute(
        select(AttendanceSession).where(AttendanceSession.class_session_id == session_id)
    )
    attendance_session = att_session_result.scalars().first()
    status = _resolve_session_status(attendance_session)
    if status != "closed":
        raise HTTPException(
            status_code=400,
            detail="Manual attendance can only be added after the session has ended.",
        )

    class_result = await db.execute(
        select(Class)
        .where(Class.id == session.class_id)
        .options(selectinload(Class.course).selectinload(Course.programme))
    )
    db_class = class_result.scalars().first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")

    student, created_student = await _ensure_student_for_class(
        db,
        db_class,
        payload.student_index,
        payload.full_name,
    )

    existing_record_result = await db.execute(
        select(AttendanceRecord).where(
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.class_session_id == session_id,
        )
    )
    existing_record = existing_record_result.scalars().first()
    if existing_record:
        raise HTTPException(status_code=409, detail="Attendance already recorded for this student")

    record = AttendanceRecord(
        student_id=student.id,
        class_session_id=session_id,
        status="present",
        verification_method="manual",
        user_agent="lecturer-manual-entry",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return {
        "id": record.id,
        "student": {
            "id": student.id,
            "student_index": student.student_index,
            "full_name": student.full_name,
        },
        "verification_method": record.verification_method.value if hasattr(record.verification_method, "value") else str(record.verification_method),
        "verified_at": record.verified_at.isoformat() if record.verified_at else None,
        "created_student": created_student,
        "can_edit": can_edit,
    }

@router.get("/sessions/{session_id}/attendance", response_model=List[AttendanceFeedRecord])
async def get_session_attendance(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    await get_session_access(db, session_id, current_user)

    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.class_session_id == session_id)
        .options(selectinload(AttendanceRecord.student))
        .order_by(AttendanceRecord.verified_at.desc())
    )
    records = result.scalars().all()

    attendance_session_result = await db.execute(
        select(AttendanceSession).where(AttendanceSession.class_session_id == session_id)
    )
    active_attendance_session = attendance_session_result.scalars().first()

    feed = []
    for record in records:
        suspicious_reason = None
        if (
            active_attendance_session
            and record.distance_meters is not None
            and active_attendance_session.attendance_radius_meters
            and record.distance_meters >= int(active_attendance_session.attendance_radius_meters * 0.8)
        ):
            suspicious_reason = "Near attendance boundary"

        feed.append({
            "id": record.id,
            "student_id": record.student_id,
            "class_session_id": record.class_session_id,
            "status": record.status.value if hasattr(record.status, "value") else str(record.status),
            "verified_at": record.verified_at,
            "verification_method": record.verification_method.value if hasattr(record.verification_method, "value") else str(record.verification_method),
            "distance_meters": record.distance_meters,
            "suspicious_reason": suspicious_reason,
            "face_verified": record.face_verified,
            "face_confidence": record.face_confidence,
            "face_distance": record.face_distance,
            "face_threshold": record.face_threshold,
            "student": {
                "id": record.student.id,
                "student_index": record.student.student_index,
                "full_name": record.student.full_name,
            } if record.student else {
                "id": record.student_id,
                "student_index": "N/A",
                "full_name": "Unknown Student",
            },
        })

    return feed

@router.get("/classes/{class_id}/attendance-matrix", response_model=Any)
async def get_class_attendance_matrix(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    db_class, _, _ = await get_class_access(db, class_id, current_user)
    
    # 2. Get sessions
    result = await db.execute(
        select(ClassSession).where(ClassSession.class_id == class_id).order_by(ClassSession.session_date)
    )
    sessions = result.scalars().all()
    
    # 3. Get attendance records
    session_ids = [s.id for s in sessions]
    all_records = []
    if session_ids:
        result = await db.execute(
            select(AttendanceRecord)
            .where(AttendanceRecord.class_session_id.in_(session_ids))
            .options(selectinload(AttendanceRecord.student))
        )
        all_records = result.scalars().all()
    
    # Map records to (student_id, session_id) and keep unique recorded students for this class
    records_map = {}
    students_map = {}
    for r in all_records:
        records_map[(r.student_id, r.class_session_id)] = r
        if r.student and r.student_id not in students_map:
            students_map[r.student_id] = r.student

    students = sorted(students_map.values(), key=lambda student: student.full_name)
        
    # Construct the matrix from students who were actually recorded in any session of this class
    rows = []
    for s in students:
        row = {
            "student": {
                "id": s.id,
                "student_index": s.student_index,
                "full_name": s.full_name
            },
            "attendance": []
        }
        for sess in sessions:
            record = records_map.get((s.id, sess.id))
            row["attendance"].append({
                "session_id": sess.id,
                "status": record.status if record else "absent",
                "timestamp": record.verified_at if record else None
            })
        rows.append(row)
        
    return {
        "class": {
            "course_name": db_class.course.course_name,
            "course_code": db_class.course.course_code,
            "programme_name": db_class.course.programme.name
        },
        "sessions": [
            {"id": s.id, "date": s.session_date} for s in sessions
        ],
        "rows": rows
    }

@router.post("/profile", response_model=LecturerProfile)
async def create_lecturer_profile(
    *,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer"])),
    profile_in: LecturerProfileCreate,
) -> Any:
    if current_user.lecturer:
        raise HTTPException(status_code=400, detail="Lecturer profile already exists")
    
    dept_id = profile_in.department_id
    if profile_in.new_department_name:
        result = await db.execute(select(Department).where(Department.name == profile_in.new_department_name))
        dept = result.scalars().first()
        if not dept:
            dept = Department(name=profile_in.new_department_name)
            db.add(dept)
            await db.flush()
        dept_id = dept.id
    
    lecturer = Lecturer(
        user_id=current_user.id,
        full_name=profile_in.full_name,
        department_id=dept_id
    )
    db.add(lecturer)
    await db.commit()
    await db.refresh(lecturer)
    return lecturer

@router.get("/departments")
async def get_departments(
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(Department))
    return result.scalars().all()

@router.get("/stats")
async def get_lecturer_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    if current_user.role.name == "admin":
        result = await db.execute(select(func.count(Class.id)))
        total_classes = result.scalar() or 0

        result = await db.execute(select(func.count(func.distinct(Enrollment.student_id))))
        total_students = result.scalar() or 0

        session_ids_subquery = select(ClassSession.id)
    else:
        lecturer_id = current_user.lecturer.id if current_user.lecturer else None
        if not lecturer_id:
            return {
                "total_classes": 0,
                "total_students": 0,
                "attendance_rate": 0
            }

        shared_class_ids_subquery = select(ClassShare.class_id).where(ClassShare.lecturer_id == lecturer_id)
        accessible_class_ids_subquery = select(Class.id).where(
            (Class.lecturer_id == lecturer_id) | (Class.id.in_(shared_class_ids_subquery))
        )

        result = await db.execute(
            select(func.count(func.distinct(Class.id))).where(Class.id.in_(accessible_class_ids_subquery))
        )
        total_classes = result.scalar() or 0

        result = await db.execute(
            select(func.count(func.distinct(Enrollment.student_id)))
            .where(Enrollment.class_id.in_(accessible_class_ids_subquery))
        )
        total_students = result.scalar() or 0

        session_ids_subquery = select(ClassSession.id).where(
            ClassSession.class_id.in_(accessible_class_ids_subquery)
        )
    
    result = await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(AttendanceRecord.class_session_id.in_(session_ids_subquery))
    )
    total_attendance = result.scalar() or 0
    
    result = await db.execute(
        select(func.count(AttendanceRecord.id))
        .where(
            AttendanceRecord.class_session_id.in_(session_ids_subquery),
            AttendanceRecord.status == "present"
        )
    )
    present_count = result.scalar() or 0
    
    attendance_rate = round((present_count / total_attendance * 100), 1) if total_attendance > 0 else 0
    
    return {
        "total_classes": total_classes,
        "total_students": total_students,
        "attendance_rate": attendance_rate
    }
