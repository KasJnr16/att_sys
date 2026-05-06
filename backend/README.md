# University Attendance System - Backend

This is a production-oriented FastAPI backend for a secure, scalable university attendance system.

## Key Features
- **WebAuthn Authentication**: Primary identity proof for secure actions and attendance.
- **REST API**: Structured endpoints for academic management, enrollment, and attendance.
- **PostgreSQL**: Normalized schema for students, lecturers, classes, and sessions.
- **Alembic**: Async database migrations.
- **Secure Attendance Flow**: QR-based session entry with WebAuthn confirmation.

## Tech Stack
- FastAPI
- SQLAlchemy (Async)
- Alembic
- WebAuthn (fido2)
- Pydantic
- JWT

## Setup

1. **Database**: Ensure PostgreSQL is running and create the `att_sys` database.
2. **Environment**: Create a `.env` file in the `backend` folder (copy from `config.py` defaults if needed).
3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Run Migrations**:
   ```bash
   alembic upgrade head
   ```
5. **Seed Roles**:
   ```bash
   python app/db/seed.py
   ```
6. **Start Server**:
   ```bash
   uvicorn app.main:app --reload
   ```

## API Documentation
Once the server is running, visit `http://localhost:8000/api/v1/docs` for the interactive OpenAPI documentation.
