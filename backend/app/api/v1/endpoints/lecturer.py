from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from datetime import datetime, timezone

from app.db.session import get_db
from app.models.academic import Class, ClassSession, Course, Programme, Department
from app.models.user import User, Student, Lecturer
from app.models.enrollment import AttendanceRecord, Enrollment
from app.models.attendance import AttendanceSession
from app.schemas.academic import Class as ClassSchema, ClassSession as ClassSessionSchema
from app.schemas.attendance import AttendanceFeedRecord, AttendanceRecord as AttendanceRecordSchema
from app.schemas.user import LecturerProfileCreate, LecturerProfile
from app.api.deps import RoleChecker

router = APIRouter()

@router.get("/classes", response_model=List[Any])
async def get_lecturer_classes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    lecturer_id = current_user.lecturer.id if current_user.lecturer else None
    if not lecturer_id:
        return []
    
    result = await db.execute(
        select(Class)
        .where(Class.lecturer_id == lecturer_id)
        .options(selectinload(Class.course).selectinload(Course.programme))
    )
    classes = result.scalars().all()
    
    enriched_classes = []
    for cls in classes:
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
            "session_count": session_count
        }
        enriched_classes.append(cls_dict)
    
    return enriched_classes

@router.get("/classes/{class_id}/sessions", response_model=List[ClassSessionSchema])
async def get_class_sessions(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    # Verify lecturer teaches this class
    result = await db.execute(select(Class).where(Class.id == class_id))
    db_class = result.scalars().first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    if current_user.role.name != "admin" and db_class.lecturer_id != current_user.lecturer.id:
        raise HTTPException(status_code=403, detail="Not authorized for this class")

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
        if att_session and att_session.is_active and att_session.expires_at > datetime.now(timezone.utc):
            status = "open"
        elif att_session:
            status = "closed"
        else:
            status = "scheduled"

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

@router.delete("/classes/{class_id}/sessions/{session_id}")
async def delete_session(
    class_id: int,
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    result = await db.execute(select(Class).where(Class.id == class_id))
    db_class = result.scalars().first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
    if current_user.role.name != "admin" and db_class.lecturer_id != current_user.lecturer.id:
        raise HTTPException(status_code=403, detail="Not authorized for this class")
    
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
    result = await db.execute(
        select(ClassSession)
        .where(ClassSession.id == session_id)
        .options(selectinload(ClassSession.parent_class))
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if current_user.role.name != "admin" and session.parent_class.lecturer_id != current_user.lecturer.id:
        raise HTTPException(status_code=403, detail="Not authorized for this session")

    att_session_result = await db.execute(
        select(AttendanceSession)
        .where(AttendanceSession.class_session_id == session_id)
    )
    attendance_session = att_session_result.scalars().first()

    # Determine status based on AttendanceSession
    if attendance_session and attendance_session.is_active and attendance_session.expires_at > datetime.now(timezone.utc):
        status = "open"
    elif attendance_session:
        status = "closed"
    else:
        status = "scheduled"

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
        "attendance_records": [
            {
                "student": {
                    "full_name": record.student.full_name if record.student else "Unknown",
                    "student_index": record.student.student_index if record.student else "N/A"
                },
                "verified_at": record.verified_at.isoformat() if record.verified_at else None
            }
            for record in attendance_records
        ]
    }

@router.get("/sessions/{session_id}/attendance", response_model=List[AttendanceFeedRecord])
async def get_session_attendance(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    result = await db.execute(
        select(ClassSession)
        .where(ClassSession.id == session_id)
        .options(selectinload(ClassSession.parent_class))
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if current_user.role.name != "admin" and session.parent_class.lecturer_id != current_user.lecturer.id:
        raise HTTPException(status_code=403, detail="Not authorized for this session")

    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.class_session_id == session_id)
        .options(selectinload(AttendanceRecord.student))
        .order_by(AttendanceRecord.verified_at.desc())
    )
    records = result.scalars().all()

    return [
        {
            "id": record.id,
            "student_id": record.student_id,
            "class_session_id": record.class_session_id,
            "status": record.status.value if hasattr(record.status, "value") else str(record.status),
            "verified_at": record.verified_at,
            "verification_method": record.verification_method.value if hasattr(record.verification_method, "value") else str(record.verification_method),
            "student": {
                "id": record.student.id,
                "student_index": record.student.student_index,
                "full_name": record.student.full_name,
            } if record.student else {
                "id": record.student_id,
                "student_index": "N/A",
                "full_name": "Unknown Student",
            },
        }
        for record in records
    ]

@router.get("/classes/{class_id}/attendance-matrix", response_model=Any)
async def get_class_attendance_matrix(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(RoleChecker(["lecturer", "admin"]))
) -> Any:
    # 1. Get class details
    result = await db.execute(
        select(Class)
        .where(Class.id == class_id)
        .options(selectinload(Class.course).selectinload(Course.programme))
    )
    db_class = result.scalars().first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")
    
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
    lecturer_id = current_user.lecturer.id if current_user.lecturer else None
    if not lecturer_id:
        return {
            "total_classes": 0,
            "total_students": 0,
            "attendance_rate": 0
        }
    
    class_ids_subquery = select(Class.id).where(Class.lecturer_id == lecturer_id)
    
    result = await db.execute(
        select(func.count(Class.id)).where(Class.lecturer_id == lecturer_id)
    )
    total_classes = result.scalar() or 0
    
    result = await db.execute(
        select(func.count(func.distinct(Enrollment.student_id)))
        .join(Class, Class.id == Enrollment.class_id)
        .where(Class.lecturer_id == lecturer_id)
    )
    total_students = result.scalar() or 0
    
    session_ids_subquery = select(ClassSession.id).join(Class).where(Class.lecturer_id == lecturer_id)
    
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
