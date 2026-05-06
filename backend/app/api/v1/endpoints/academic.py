from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.academic import Programme, Course, Class, ClassSession, Department
from app.models.enrollment import Enrollment
from app.models.user import Lecturer
from app.schemas.academic import (
    ProgrammeCreate, Programme as ProgrammeSchema,
    CourseCreate, Course as CourseSchema,
    ClassCreate, Class as ClassSchema,
    ClassSessionCreate, ClassSession as ClassSessionSchema,
    EnrollmentCreate, Enrollment as EnrollmentSchema,
    Department as DepartmentSchema
)
from app.api import deps
from app.api.deps import RoleChecker
from app.models.user import User

router = APIRouter()

@router.get("/departments", response_model=List[DepartmentSchema])
async def read_departments(
    db: AsyncSession = Depends(get_db),
) -> Any:
    result = await db.execute(select(Department))
    return result.scalars().all()

@router.post("/programmes")
async def create_programme(
    *,
    db: AsyncSession = Depends(get_db),
    programme_in: ProgrammeCreate,
    current_user: User = Depends(RoleChecker(["admin", "lecturer"]))
) -> Any:
    result = await db.execute(select(Programme).where(Programme.name == programme_in.name))
    existing = result.scalars().first()
    if existing:
        return {"id": existing.id, "name": existing.name}

    db_obj = Programme(name=programme_in.name)
    db.add(db_obj)
    await db.flush()
    prog_id = db_obj.id
    prog_name = db_obj.name
    await db.commit()
    return {"id": prog_id, "name": prog_name}

@router.get("/programmes", response_model=List[ProgrammeSchema])
async def read_programmes(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    result = await db.execute(select(Programme).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/courses")
async def create_course(
    *,
    db: AsyncSession = Depends(get_db),
    course_in: CourseCreate,
    current_user: User = Depends(RoleChecker(["admin", "lecturer"]))
) -> Any:
    db_obj = Course(**course_in.dict(exclude_unset=True))
    db.add(db_obj)
    await db.flush()
    course_id = db_obj.id
    course_code = db_obj.course_code
    course_name = db_obj.course_name
    programme_id = db_obj.programme_id
    await db.commit()
    return {
        "id": course_id,
        "course_code": course_code,
        "course_name": course_name,
        "programme_id": programme_id
    }

@router.get("/courses", response_model=List[CourseSchema])
async def read_courses(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    result = await db.execute(select(Course).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/classes")
async def create_class(
    *,
    db: AsyncSession = Depends(get_db),
    class_in: ClassCreate,
    current_user: User = Depends(RoleChecker(["admin", "lecturer"]))
) -> Any:
    lecturer_id = class_in.lecturer_id

    if not lecturer_id and current_user.role.name == "lecturer":
        if not current_user.lecturer:
            raise HTTPException(status_code=400, detail="Please complete your lecturer profile first")
        lecturer_id = current_user.lecturer.id

    if not lecturer_id:
        raise HTTPException(status_code=400, detail="Lecturer ID is required")

    db_obj = Class(
        course_id=class_in.course_id,
        lecturer_id=lecturer_id,
        semester=class_in.semester,
        academic_year=class_in.academic_year,
        section=class_in.section
    )
    db.add(db_obj)
    await db.flush()
    class_id = db_obj.id

    result = await db.execute(
        select(Class)
        .options(selectinload(Class.course).selectinload(Course.programme))
        .where(Class.id == class_id)
    )
    cls = result.scalars().first()

    course_data = None
    if cls and cls.course:
        programme_data = {"name": cls.course.programme.name} if cls.course.programme else None
        course_data = {
            "course_code": cls.course.course_code,
            "course_name": cls.course.course_name,
            "programme": programme_data
        }

    response_data = {
        "id": cls.id if cls else class_id,
        "course_id": cls.course_id if cls else class_in.course_id,
        "lecturer_id": cls.lecturer_id if cls else lecturer_id,
        "semester": cls.semester if cls else class_in.semester,
        "academic_year": cls.academic_year if cls else class_in.academic_year,
        "section": cls.section if cls else class_in.section,
        "course": course_data
    }

    await db.commit()

    return response_data

@router.get("/classes")
async def read_classes(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    result = await db.execute(
        select(Class)
        .options(selectinload(Class.course).selectinload(Course.programme))
        .offset(skip).limit(limit)
    )
    classes = result.scalars().all()
    return [
        {
            "id": c.id,
            "course_id": c.course_id,
            "lecturer_id": c.lecturer_id,
            "semester": c.semester,
            "academic_year": c.academic_year,
            "section": c.section,
            "course": {
                "course_code": c.course.course_code,
                "course_name": c.course.course_name,
                "programme": {"name": c.course.programme.name} if c.course.programme else None
            } if c.course else None,
            "student_count": 0,
            "session_count": 0
        }
        for c in classes
    ]

@router.post("/classes/{class_id}/sessions")
async def create_class_session(
    *,
    db: AsyncSession = Depends(get_db),
    class_id: int,
    session_in: ClassSessionCreate,
    current_user: User = Depends(RoleChecker(["admin", "lecturer"]))
) -> Any:
    db_obj = ClassSession(
        **session_in.dict(),
        created_by=current_user.id
    )
    db.add(db_obj)
    await db.flush()
    session_id = db_obj.id
    session_class_id = db_obj.class_id
    session_date = db_obj.session_date
    session_status = db_obj.status
    session_created_by = db_obj.created_by
    await db.commit()
    return {
        "id": session_id,
        "class_id": session_class_id,
        "session_date": session_date.isoformat() if session_date else None,
        "status": str(session_status.value) if session_status else "scheduled",
        "created_by": session_created_by
    }

@router.post("/enrollments")
async def create_enrollment(
    *,
    db: AsyncSession = Depends(get_db),
    enrollment_in: EnrollmentCreate,
    current_user: User = Depends(RoleChecker(["admin"]))
) -> Any:
    db_obj = Enrollment(**enrollment_in.dict())
    db.add(db_obj)
    try:
        await db.flush()
        enrollment_id = db_obj.id
        enrollment_student_id = db_obj.student_id
        enrollment_class_id = db_obj.class_id
        enrollment_enrolled_at = db_obj.enrolled_at
        await db.commit()
    except Exception:
        raise HTTPException(status_code=400, detail="Student already enrolled in this class or invalid IDs")
    return {
        "id": enrollment_id,
        "student_id": enrollment_student_id,
        "class_id": enrollment_class_id,
        "enrolled_at": enrollment_enrolled_at.isoformat() if enrollment_enrolled_at else None
    }

@router.delete("/classes/{class_id}")
async def delete_class(
    *,
    db: AsyncSession = Depends(get_db),
    class_id: int,
    current_user: User = Depends(RoleChecker(["admin", "lecturer"]))
) -> Any:
    result = await db.execute(select(Class).where(Class.id == class_id))
    db_obj = result.scalars().first()
    if not db_obj:
        raise HTTPException(status_code=404, detail="Class not found")

    if current_user.role.name == "lecturer":
        if not current_user.lecturer or db_obj.lecturer_id != current_user.lecturer.id:
            raise HTTPException(status_code=403, detail="You can only delete your own classes")

    await db.delete(db_obj)
    await db.commit()
    return {"message": "Class deleted successfully"}
