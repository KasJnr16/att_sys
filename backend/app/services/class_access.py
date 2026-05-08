from typing import Tuple

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.academic import Class, ClassSession, ClassShare, Course, SharePermission
from app.models.user import User


async def get_class_access(
    db: AsyncSession,
    class_id: int,
    current_user: User,
    *,
    require_edit: bool = False,
) -> Tuple[Class, bool, bool]:
    result = await db.execute(
        select(Class)
        .where(Class.id == class_id)
        .options(
            selectinload(Class.course).selectinload(Course.programme),
            selectinload(Class.lecturer),
        )
    )
    db_class = result.scalars().first()
    if not db_class:
        raise HTTPException(status_code=404, detail="Class not found")

    if current_user.role.name == "admin":
        return db_class, True, True

    lecturer_id = current_user.lecturer.id if current_user.lecturer else None
    if not lecturer_id:
        raise HTTPException(status_code=403, detail="Lecturer profile not found")

    if db_class.lecturer_id == lecturer_id:
        return db_class, True, True

    share_result = await db.execute(
        select(ClassShare).where(
            ClassShare.class_id == class_id,
            ClassShare.lecturer_id == lecturer_id,
        )
    )
    share = share_result.scalars().first()
    if not share:
        raise HTTPException(status_code=403, detail="Not authorized for this class")

    can_edit = share.permission == SharePermission.edit
    if require_edit and not can_edit:
        raise HTTPException(status_code=403, detail="Edit access is required for this class")

    return db_class, can_edit, False


async def get_session_access(
    db: AsyncSession,
    session_id: int,
    current_user: User,
    *,
    require_edit: bool = False,
) -> Tuple[ClassSession, bool, bool]:
    result = await db.execute(
        select(ClassSession)
        .where(ClassSession.id == session_id)
        .options(
            selectinload(ClassSession.parent_class).selectinload(Class.course).selectinload(Course.programme),
            selectinload(ClassSession.parent_class).selectinload(Class.lecturer),
        )
    )
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    _, can_edit, is_owner = await get_class_access(
        db,
        session.class_id,
        current_user,
        require_edit=require_edit,
    )
    return session, can_edit, is_owner
