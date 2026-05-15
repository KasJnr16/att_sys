import enum

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base

class Role(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

class User(Base):
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=True)
    role_id = Column(Integer, ForeignKey("role.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    role = relationship("Role")
    student = relationship("Student", back_populates="user", uselist=False)
    lecturer = relationship("Lecturer", back_populates="user", uselist=False)
    webauthn_credentials = relationship("WebAuthnCredential")
    auth_tokens = relationship("AuthToken", back_populates="user")

class AuthTokenPurpose(str, enum.Enum):
    email_verification = "email_verification"
    password_reset = "password_reset"

class AuthToken(Base):
    __tablename__ = "auth_token"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), nullable=False, index=True)
    purpose = Column(Enum(AuthTokenPurpose), nullable=False, index=True)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    code_hash = Column(String, index=True, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="auth_tokens")

class Student(Base):
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), unique=True, nullable=False)
    student_index = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    programme_id = Column(Integer, ForeignKey("programme.id"), nullable=False)
    face_embedding = Column(JSON, nullable=True)
    face_embedding_model = Column(String, nullable=True)
    face_embedding_dimensions = Column(Integer, nullable=True)
    face_enrolled_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="student")
    programme = relationship("Programme")
    webauthn_credentials = relationship("WebAuthnCredential", back_populates="student")

class Lecturer(Base):
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    department_id = Column(Integer, ForeignKey("department.id"), nullable=True)

    user = relationship("User", back_populates="lecturer")
