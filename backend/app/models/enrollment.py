from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum, String, UniqueConstraint, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import enum

class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    excused = "excused"

class VerificationMethod(str, enum.Enum):
    webauthn = "webauthn"
    session_code = "session_code"
    manual = "manual"

class Enrollment(Base):
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student.id"), nullable=False)
    class_id = Column(Integer, ForeignKey("class.id", ondelete="CASCADE"), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), server_default=func.now())

    student = relationship("Student")
    parent_class = relationship("Class")

    __table_args__ = (UniqueConstraint('student_id', 'class_id', name='_student_class_uc'),)

class AttendanceRecord(Base):
    __tablename__ = "attendance_record"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student.id"), nullable=False)
    class_session_id = Column(Integer, ForeignKey("class_session.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(AttendanceStatus), default=AttendanceStatus.absent)
    verified_at = Column(DateTime(timezone=True), server_default=func.now())
    verification_method = Column(Enum(VerificationMethod), default=VerificationMethod.webauthn)
    device_aaguid = Column(String, nullable=True)
    credential_id = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    client_fingerprint = Column(String(64), nullable=True)
    attendance_latitude = Column(Float, nullable=True)
    attendance_longitude = Column(Float, nullable=True)
    distance_meters = Column(Integer, nullable=True)
    face_verified = Column(Boolean, nullable=True)
    face_distance = Column(Float, nullable=True)
    face_threshold = Column(Float, nullable=True)
    face_confidence = Column(Float, nullable=True)
    face_model = Column(String, nullable=True)
    face_antispoof_passed = Column(Boolean, nullable=True)

    student = relationship("Student")
    class_session = relationship("ClassSession", back_populates="attendance_records")

    __table_args__ = (UniqueConstraint('student_id', 'class_session_id', name='_student_session_uc'),)
