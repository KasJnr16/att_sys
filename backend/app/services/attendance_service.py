import secrets
import hashlib
import math
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attendance import AttendanceCodeAttempt, AttendanceSession
from app.models.academic import ClassSession
from app.models.user import User

class AttendanceService:
    @staticmethod
    def build_client_fingerprint(client_ip: str, user_agent: str) -> str:
        return hashlib.sha256(f"{client_ip}|{user_agent}".encode("utf-8")).hexdigest()

    @staticmethod
    async def create_session(
        db: AsyncSession,
        class_session_id: int,
        user_id: int,
        latitude: float,
        longitude: float,
        radius_meters: int = 50,
        expires_in_minutes: int = 15,
        max_uses: int = 1
    ) -> Tuple[AttendanceSession, str]:
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        verification_code = f"{secrets.randbelow(900000) + 100000}"
        
        db_obj = AttendanceSession(
            class_session_id=class_session_id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(minutes=expires_in_minutes),
            created_by=user_id,
            max_uses=max_uses,
            verification_code=verification_code,
            generated_latitude=latitude,
            generated_longitude=longitude,
            attendance_radius_meters=radius_meters,
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        
        return db_obj, token

    @staticmethod
    async def get_session_by_token(
        db: AsyncSession,
        token: str
    ) -> Optional[AttendanceSession]:
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        result = await db.execute(
            select(AttendanceSession).where(
                AttendanceSession.token_hash == token_hash,
                AttendanceSession.is_active == True,
                AttendanceSession.expires_at > datetime.now(timezone.utc)
            )
        )
        return result.scalars().first()

    @staticmethod
    async def get_code_attempt(
        db: AsyncSession,
        attendance_session_id: int,
        client_fingerprint: str
    ) -> Optional[AttendanceCodeAttempt]:
        result = await db.execute(
            select(AttendanceCodeAttempt).where(
                AttendanceCodeAttempt.attendance_session_id == attendance_session_id,
                AttendanceCodeAttempt.client_fingerprint == client_fingerprint,
            )
        )
        return result.scalars().first()

    @staticmethod
    def calculate_distance_meters(
        origin_latitude: float,
        origin_longitude: float,
        current_latitude: float,
        current_longitude: float,
    ) -> float:
        earth_radius_meters = 6371000

        lat1 = math.radians(origin_latitude)
        lon1 = math.radians(origin_longitude)
        lat2 = math.radians(current_latitude)
        lon2 = math.radians(current_longitude)

        delta_lat = lat2 - lat1
        delta_lon = lon2 - lon1

        a = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return earth_radius_meters * c

    @staticmethod
    def validate_session_radius(
        session: AttendanceSession,
        latitude: float,
        longitude: float,
    ) -> tuple[bool, Optional[float]]:
        if session.generated_latitude is None or session.generated_longitude is None:
            return True, None

        distance = AttendanceService.calculate_distance_meters(
            session.generated_latitude,
            session.generated_longitude,
            latitude,
            longitude,
        )
        return distance <= session.attendance_radius_meters, distance
