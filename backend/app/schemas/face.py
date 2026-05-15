from pydantic import BaseModel, Field


class FaceEnrollmentRequest(BaseModel):
    student_id: int = Field(..., gt=0)
    image_base64: str = Field(..., min_length=32)


class FaceVerificationRequest(BaseModel):
    student_id: int = Field(..., gt=0)
    image_base64: str = Field(..., min_length=32)


class FaceStatusResponse(BaseModel):
    enrolled: bool
    embedding_model: str | None = None
    embedding_dimensions: int | None = None


class FaceEnrollmentResponse(BaseModel):
    enrolled: bool
    student_id: int
    embedding_model: str
    embedding_dimensions: int
    face_confidence: float | None = None
    anti_spoofing_passed: bool | None = None


class FaceVerificationResponse(BaseModel):
    verified: bool
    student_id: int
    distance: float | None = None
    threshold: float | None = None
    confidence: float | None = None
    match_threshold: float | None = None
    face_detection_confidence: float | None = None
    model: str | None = None
    anti_spoofing_passed: bool | None = None
