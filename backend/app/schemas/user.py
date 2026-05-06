from typing import Optional
from pydantic import BaseModel, EmailStr

class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = True

class UserCreate(UserBase):
    email: EmailStr
    password: str
    role_id: int

class UserUpdate(BaseModel):
    password: Optional[str] = None

class RoleBase(BaseModel):
    name: str

class Role(RoleBase):
    id: int
    class Config:
        from_attributes = True

class StudentBase(BaseModel):
    student_index: Optional[str] = None
    full_name: Optional[str] = None
    programme_id: Optional[int] = None

class Student(StudentBase):
    id: int
    user_id: int
    class Config:
        from_attributes = True

class LecturerBase(BaseModel):
    full_name: Optional[str] = None
    department_id: Optional[int] = None

class Lecturer(LecturerBase):
    id: int
    user_id: int
    class Config:
        from_attributes = True

class User(UserBase):
    id: int
    role_id: int
    role: Optional[Role] = None
    lecturer: Optional[Lecturer] = None
    student: Optional[Student] = None

    class Config:
        from_attributes = True

class LecturerProfileCreate(BaseModel):
    full_name: str
    department_id: Optional[int] = None
    new_department_name: Optional[str] = None

class LecturerProfile(LecturerProfileCreate):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class StudentSelfRegisterRequest(BaseModel):
    student_index: str
    full_name: str
    programme_id: int
    webauthn_registration_response: dict

class StudentSelfRegisterResponse(BaseModel):
    student_id: int
    user_id: int

class StudentLookupResponse(BaseModel):
    exists: bool
    has_webauthn: bool = False
    student_id: Optional[int] = None
