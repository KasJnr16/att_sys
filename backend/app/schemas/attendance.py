from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime

class AttendanceSessionCreate(BaseModel):
    class_session_id: int
    expires_in_minutes: int = 15
    max_uses: int = 1
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    radius_meters: int = Field(50, ge=1, le=1000)

class AttendanceSession(BaseModel):
    id: int
    class_session_id: int
    token_hash: str
    expires_at: datetime
    is_active: bool
    usage_count: int

    class Config:
        from_attributes = True

class AttendanceJoinRequest(BaseModel):
    token: str

class AttendanceVerifyRequest(BaseModel):
    session_id: int
    authentication_response: dict
    challenge: str
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

class AttendanceRecord(BaseModel):
    id: int
    student_id: int
    class_session_id: int
    status: str
    verified_at: datetime
    verification_method: str
    credential_id: Optional[str] = None

    class Config:
        from_attributes = True


class AttendanceFeedStudent(BaseModel):
    id: int
    student_index: str
    full_name: str


class AttendanceFeedRecord(BaseModel):
    id: int
    student_id: int
    class_session_id: int
    status: str
    verified_at: datetime
    verification_method: str
    student: AttendanceFeedStudent
    distance_meters: Optional[int] = None
    suspicious_reason: Optional[str] = None
