from typing import Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, cast
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import User, Student
from app.models.academic import Class, ClassSession, Course
from app.api.deps import get_current_active_user

router = APIRouter()


@router.get("")
async def global_search(
    q: str = Query(..., min_length=2, description="Search query"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    Global search across classes, students, sessions, and settings.
    """
    search_term = f"%{q}%"
    
    classes = []
    students = []
    sessions = []
    settings = []
    
    result = await db.execute(
        select(Class)
        .options(selectinload(Class.course))
        .join(Course)
        .where(
            Course.course_code.ilike(search_term) |
            Course.course_name.ilike(search_term)
        )
        .offset(skip)
        .limit(limit)
    )
    db_classes = result.scalars().all()
    for cls in db_classes:
        classes.append({
            "id": cls.id,
            "course_code": cls.course.course_code,
            "course_name": cls.course.course_name,
            "section": cls.section,
            "semester": cls.semester,
            "academic_year": cls.academic_year
        })
    
    result = await db.execute(
        select(Student)
        .options(selectinload(Student.programme))
        .where(
            Student.student_index.ilike(search_term) |
            Student.full_name.ilike(search_term)
        )
        .offset(skip)
        .limit(limit)
    )
    db_students = result.scalars().all()
    for s in db_students:
        students.append({
            "id": s.id,
            "student_index": s.student_index,
            "full_name": s.full_name,
            "programme": s.programme.name if s.programme else None
        })
    
    result = await db.execute(
        select(ClassSession)
        .options(selectinload(ClassSession.parent_class).selectinload(Class.course))
        .where(cast(ClassSession.session_date, String).ilike(search_term))
        .offset(skip)
        .limit(limit)
    )
    db_sessions = result.scalars().all()
    for sess in db_sessions:
        sessions.append({
            "id": sess.id,
            "date": sess.session_date.isoformat() if sess.session_date else None,
            "class_id": sess.class_id,
            "class_name": sess.parent_class.course.course_name if sess.parent_class and sess.parent_class.course else None
        })
    
    settings_options = [
        {"id": "attendance-expiration", "label": "Attendance Expiration", "type": "setting"},
        {"id": "attendance-radius", "label": "Attendance Radius", "type": "setting"},
        {"id": "attendance-location-radius", "label": "Attendance Location Radius", "type": "setting"},
        {"id": "profile", "label": "Profile Settings", "type": "setting"},
        {"id": "change-password", "label": "Change Password", "type": "setting"},
    ]
    
    q_lower = q.lower()
    for setting in settings_options:
        if q_lower in setting["label"].lower() or q_lower in setting["id"].lower():
            settings.append(setting)
    
    return {
        "classes": classes,
        "students": students,
        "sessions": sessions,
        "settings": settings
    }
