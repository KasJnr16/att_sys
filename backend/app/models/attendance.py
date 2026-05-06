from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, UniqueConstraint, Float
from sqlalchemy.sql import func
from app.db.base_class import Base

from sqlalchemy.orm import relationship

class AttendanceSession(Base):
    __tablename__ = "attendance_session"
    id = Column(Integer, primary_key=True, index=True)
    class_session_id = Column(Integer, ForeignKey("class_session.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_by = Column(Integer, ForeignKey("user.id"), nullable=False)
    max_uses = Column(Integer, default=1)
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    verification_code = Column(String(6), nullable=True)
    code_verification_locked_until = Column(DateTime(timezone=True), nullable=True)
    generated_latitude = Column(Float, nullable=True)
    generated_longitude = Column(Float, nullable=True)
    attendance_radius_meters = Column(Integer, nullable=False, default=50, server_default="50")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    class_session = relationship("ClassSession")
    code_attempts = relationship("AttendanceCodeAttempt", back_populates="attendance_session", cascade="all, delete-orphan")


class AttendanceCodeAttempt(Base):
    __tablename__ = "attendance_code_attempt"

    id = Column(Integer, primary_key=True, index=True)
    attendance_session_id = Column(Integer, ForeignKey("attendance_session.id", ondelete="CASCADE"), nullable=False, index=True)
    client_fingerprint = Column(String(64), nullable=False, index=True)
    failed_attempts = Column(Integer, nullable=False, default=0)
    first_failed_at = Column(DateTime(timezone=True), nullable=True)
    last_failed_at = Column(DateTime(timezone=True), nullable=True)
    code_verified_at = Column(DateTime(timezone=True), nullable=True)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    attendance_session = relationship("AttendanceSession", back_populates="code_attempts")

    __table_args__ = (
        UniqueConstraint("attendance_session_id", "client_fingerprint", name="_attendance_session_client_fingerprint_uc"),
    )
