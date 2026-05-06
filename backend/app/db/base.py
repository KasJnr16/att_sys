# Import all the models, so that Base has them before being
# imported by Alembic
from app.db.base_class import Base  # noqa
from app.models.user import Role, User, Student, Lecturer  # noqa
from app.models.academic import Programme, Department, Course, Class, ClassSession  # noqa
from app.models.enrollment import Enrollment, AttendanceRecord  # noqa
from app.models.webauthn import WebAuthnCredential, WebAuthnChallenge  # noqa
from app.models.attendance import AttendanceSession  # noqa
from app.models.audit import AuditLog  # noqa
