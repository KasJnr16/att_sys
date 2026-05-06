from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Time, Date, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import enum

class Programme(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

class Department(Base):
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)

class Course(Base):
    id = Column(Integer, primary_key=True, index=True)
    course_code = Column(String, index=True, nullable=True)
    course_name = Column(String, nullable=False)
    programme_id = Column(Integer, ForeignKey("programme.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    programme = relationship("Programme")

class Class(Base):
    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("course.id"), nullable=False)
    lecturer_id = Column(Integer, ForeignKey("lecturer.id"), nullable=False)
    semester = Column(Integer, nullable=False)
    academic_year = Column(String, nullable=False)
    section = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    course = relationship("Course")
    lecturer = relationship("Lecturer")
    sessions = relationship("ClassSession", back_populates="parent_class")

class SessionStatus(str, enum.Enum):
    scheduled = "scheduled"
    open = "open"
    closed = "closed"
    cancelled = "cancelled"

class ClassSession(Base):
    __tablename__ = "class_session"
    id = Column(Integer, primary_key=True, index=True)
    class_id = Column(Integer, ForeignKey("class.id", ondelete="CASCADE"), nullable=False)
    session_date = Column(Date, nullable=False)
    status = Column(Enum(SessionStatus), default=SessionStatus.scheduled)
    created_by = Column(Integer, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    parent_class = relationship("Class", back_populates="sessions")
    attendance_records = relationship("AttendanceRecord", back_populates="class_session")
