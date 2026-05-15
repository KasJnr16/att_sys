from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import RoleChecker
from app.db.session import get_db
from app.models.user import Student
from app.schemas.face import (
    FaceEnrollmentRequest,
    FaceEnrollmentResponse,
    FaceStatusResponse,
    FaceVerificationRequest,
    FaceVerificationResponse,
)
from app.services.face_service import FaceService

router = APIRouter(dependencies=[Depends(RoleChecker(["admin"]))])


@router.get("/students/{student_id}/face", response_model=FaceStatusResponse)
async def student_face_status(student_id: int, db: AsyncSession = Depends(get_db)) -> Any:
    student = await _get_student(db, student_id)
    return {
        "enrolled": bool(student.face_embedding),
        "embedding_model": student.face_embedding_model,
        "embedding_dimensions": student.face_embedding_dimensions,
    }


@router.post("/enroll", response_model=FaceEnrollmentResponse)
async def enroll(payload: FaceEnrollmentRequest, db: AsyncSession = Depends(get_db)) -> Any:
    student = await _get_student(db, payload.student_id)
    enrollment = await FaceService.enroll(payload.student_id, payload.image_base64)
    student.face_embedding = enrollment.get("embedding")
    student.face_embedding_model = enrollment.get("embedding_model")
    student.face_embedding_dimensions = enrollment.get("embedding_dimensions")
    student.face_enrolled_at = datetime.now(timezone.utc)
    await db.commit()
    return enrollment


@router.post("/verify", response_model=FaceVerificationResponse)
async def verify(payload: FaceVerificationRequest, db: AsyncSession = Depends(get_db)) -> Any:
    student = await _get_student(db, payload.student_id)
    return await FaceService.verify(payload.student_id, payload.image_base64, student.face_embedding)


async def _get_student(db: AsyncSession, student_id: int) -> Student:
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalars().first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student
