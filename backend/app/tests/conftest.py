import os


os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-should-be-long-enough-123456")
os.environ.setdefault("POSTGRES_SERVER", "localhost")
os.environ.setdefault("POSTGRES_USER", "postgres")
os.environ.setdefault("POSTGRES_PASSWORD", "postgres")
os.environ.setdefault("POSTGRES_DB", "att_sys_test")
os.environ.setdefault("RP_ID", "localhost")
os.environ.setdefault("RP_NAME", "University Attendance System")
os.environ.setdefault("ORIGIN", "http://localhost:3000")
