from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import enum

class ChallengeType(str, enum.Enum):
    registration = "registration"
    authentication = "authentication"

class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credential"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    student_id = Column(Integer, ForeignKey("student.id"), nullable=True)
    credential_id = Column(String, unique=True, index=True, nullable=False)
    public_key = Column(String, nullable=False)
    sign_count = Column(Integer, default=0)
    transports = Column(String, nullable=True)
    attestation_format = Column(String, nullable=True)
    aaguid = Column(String, nullable=True)
    backup_eligible = Column(Boolean, default=False)
    backup_state = Column(Boolean, default=False)
    nickname = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="webauthn_credentials")
    student = relationship("Student", back_populates="webauthn_credentials")

class WebAuthnChallenge(Base):
    __tablename__ = "webauthn_challenge"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=True)
    student_id = Column(Integer, ForeignKey("student.id"), nullable=True)
    challenge_type = Column(SQLEnum(ChallengeType), nullable=False)
    challenge_hash = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    metadata_json = Column(JSON, nullable=True)
