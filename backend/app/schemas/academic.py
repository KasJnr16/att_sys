from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime

class ProgrammeBase(BaseModel):
    name: str

class ProgrammeCreate(ProgrammeBase):
    pass

class Programme(ProgrammeBase):
    id: int
    class Config:
        from_attributes = True


class ProgrammeNested(BaseModel):
    name: str
    class Config:
        from_attributes = True

class DepartmentBase(BaseModel):
    name: str

class Department(DepartmentBase):
    id: int
    class Config:
        from_attributes = True

class CourseBase(BaseModel):
    course_code: Optional[str] = None
    course_name: str
    programme_id: int

class CourseCreate(CourseBase):
    pass

class Course(CourseBase):
    id: int
    class Config:
        from_attributes = True


class CourseNested(BaseModel):
    course_code: Optional[str] = None
    course_name: str
    programme: Optional[ProgrammeNested] = None
    class Config:
        from_attributes = True


class ClassBase(BaseModel):
    course_id: int
    lecturer_id: Optional[int] = None
    semester: int
    academic_year: str
    section: Optional[str] = None

class ClassCreate(ClassBase):
    pass

class Class(ClassBase):
    id: int
    course: Optional[CourseNested] = None
    student_count: Optional[int] = 0
    session_count: Optional[int] = 0
    class Config:
        from_attributes = True

class ClassSessionBase(BaseModel):
    class_id: int
    session_date: date

class ClassSessionCreate(ClassSessionBase):
    pass

class ClassSession(ClassSessionBase):
    id: int
    status: Optional[str] = None
    created_by: Optional[int] = None
    attendance_session_id: Optional[int] = None
    attendance_count: Optional[int] = 0
    class Config:
        from_attributes = True

class EnrollmentCreate(BaseModel):
    student_id: int
    class_id: int

class Enrollment(EnrollmentCreate):
    id: int
    enrolled_at: datetime
    class Config:
        from_attributes = True
