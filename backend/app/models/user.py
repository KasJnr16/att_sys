from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
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
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    role = relationship("Role")
    student = relationship("Student", back_populates="user", uselist=False)
    lecturer = relationship("Lecturer", back_populates="user", uselist=False)
    webauthn_credentials = relationship("WebAuthnCredential")

class Student(Base):
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id"), unique=True, nullable=False)
    student_index = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    programme_id = Column(Integer, ForeignKey("programme.id"), nullable=False)
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
