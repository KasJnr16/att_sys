from fastapi import APIRouter
from app.api.v1.endpoints import auth, academic, attendance, lecturer, student, search

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(academic.router, prefix="/academic", tags=["academic"])
api_router.include_router(attendance.router, tags=["attendance"])
api_router.include_router(lecturer.router, prefix="/lecturer", tags=["lecturer"])
api_router.include_router(student.router, prefix="/student", tags=["student"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
