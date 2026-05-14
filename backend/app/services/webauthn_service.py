import json
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple
import base64

from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers import (
    bytes_to_base64url,
    base64url_to_bytes,
    options_to_json,
)
from webauthn.helpers.structs import (
    RegistrationCredential,
    AuthenticationCredential,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    AuthenticatorAttachment,
    ResidentKeyRequirement,
)

from app.core.config import settings
from app.models.user import User, Student
from app.models.webauthn import WebAuthnCredential, WebAuthnChallenge, ChallengeType

class WebAuthnService:
    @staticmethod
    async def get_registration_options(
        db: AsyncSession,
        user: User
    ) -> str:
        # Get existing credentials to exclude
        result = await db.execute(
            select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
        )
        existing_credentials = result.scalars().all()
        exclude_credentials = [
            RegistrationCredential(id=base64url_to_bytes(c.credential_id))
            for c in existing_credentials
        ]

        options = generate_registration_options(
            rp_id=settings.RP_ID,
            rp_name=settings.RP_NAME,
            user_id=str(user.id).encode("utf-8"),
            user_name=user.email,
            exclude_credentials=exclude_credentials,
            authenticator_selection=AuthenticatorSelectionCriteria(
                user_verification=UserVerificationRequirement.REQUIRED,
            )
        )

        # Store challenge
        challenge_db = WebAuthnChallenge(
            user_id=user.id,
            challenge_type=ChallengeType.registration,
            challenge_hash=bytes_to_base64url(options.challenge),
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        db.add(challenge_db)
        await db.commit()

        return options_to_json(options)

    @staticmethod
    async def verify_registration(
        db: AsyncSession,
        user: User,
        registration_response: dict,
        original_challenge: str
    ) -> WebAuthnCredential:
        # Check challenge
        result = await db.execute(
            select(WebAuthnChallenge).where(
                WebAuthnChallenge.challenge_hash == original_challenge,
                WebAuthnChallenge.user_id == user.id,
                WebAuthnChallenge.used_at == None,
                WebAuthnChallenge.expires_at > datetime.now(timezone.utc)
            )
        )
        challenge_db = result.scalars().first()
        if not challenge_db:
            raise ValueError("Invalid or expired challenge")

        verification = verify_registration_response(
            credential=registration_response,
            expected_challenge=base64url_to_bytes(original_challenge),
            expected_origin=settings.origin_str,
            expected_rp_id=settings.RP_ID,
            require_user_verification=True,
        )

        # Mark challenge as used
        challenge_db.used_at = datetime.utcnow()

        # Create credential (convert bytes to base64url strings for storage)
        new_credential = WebAuthnCredential(
            user_id=user.id,
            credential_id=bytes_to_base64url(verification.credential_id),
            public_key=bytes_to_base64url(verification.credential_public_key),
            sign_count=verification.sign_count,
            aaguid=verification.aaguid,
        )
        db.add(new_credential)
        await db.commit()
        await db.refresh(new_credential)

        return new_credential

    @staticmethod
    async def get_authentication_options(
        db: AsyncSession,
        user: Optional[User] = None
    ) -> str:
        # If user is None, it's a "discoverable credential" flow (passkeys)
        # But for university system, we probably know the user or they enter email first
        
        allow_credentials = []
        if user:
            result = await db.execute(
                select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
            )
            credentials = result.scalars().all()
            allow_credentials = [
                AuthenticationCredential(id=base64url_to_bytes(c.credential_id))
                for c in credentials
            ]

        options = generate_authentication_options(
            rp_id=settings.RP_ID,
            allow_credentials=allow_credentials,
            user_verification=UserVerificationRequirement.REQUIRED,
        )

        # Store challenge
        challenge_db = WebAuthnChallenge(
            user_id=user.id if user else None,
            challenge_type=ChallengeType.authentication,
            challenge_hash=bytes_to_base64url(options.challenge),
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        db.add(challenge_db)
        await db.commit()

        return options_to_json(options)

    @staticmethod
    async def verify_authentication(
        db: AsyncSession,
        authentication_response: dict,
        original_challenge: str,
        user: Optional[User] = None
    ) -> Tuple[User, WebAuthnCredential]:
        # Check challenge
        result = await db.execute(
            select(WebAuthnChallenge).where(
                WebAuthnChallenge.challenge_hash == original_challenge,
                WebAuthnChallenge.used_at == None,
                WebAuthnChallenge.expires_at > datetime.now(timezone.utc)
            )
        )
        challenge_db = result.scalars().first()
        if not challenge_db:
            raise ValueError("Invalid or expired challenge")
            
        # If we didn't know the user during options generation, 
        # the response will contain user handle (user.id)
        credential_id = authentication_response.get("id")
        if isinstance(credential_id, str):
            credential_id = base64url_to_bytes(credential_id)

        # Find credential in DB
        result = await db.execute(
            select(WebAuthnCredential).where(WebAuthnCredential.credential_id == bytes_to_base64url(credential_id))
        )
        db_credential = result.scalars().first()
        if not db_credential:
            raise ValueError("Credential not found")

        # Get user
        result = await db.execute(select(User).where(User.id == db_credential.user_id))
        db_user = result.scalars().first()
        if not db_user:
            raise ValueError("User not found")

        verification = verify_authentication_response(
            credential=authentication_response,
            expected_challenge=base64url_to_bytes(original_challenge),
            expected_origin=settings.origin_str,
            expected_rp_id=settings.RP_ID,
            credential_public_key=base64url_to_bytes(db_credential.public_key),
            credential_current_sign_count=db_credential.sign_count,
            require_user_verification=True,
        )

        db_credential.sign_count = verification.new_sign_count
        db_credential.last_used_at = datetime.utcnow()
        
        # Mark challenge as used
        challenge_db.used_at = datetime.utcnow()
        if not challenge_db.user_id:
            challenge_db.user_id = db_user.id

        await db.commit()

        return db_user, db_credential

    @staticmethod
    async def get_student_registration_options(
        db: AsyncSession,
        student: Student
    ) -> str:
        options = generate_registration_options(
            rp_id=settings.RP_ID,
            rp_name=settings.RP_NAME,
            user_id=str(student.id).encode("utf-8"),
            user_name=student.student_index,
            user_display_name=student.full_name,
            authenticator_selection=AuthenticatorSelectionCriteria(
                user_verification=UserVerificationRequirement.REQUIRED,
                resident_key=ResidentKeyRequirement.REQUIRED,
                require_resident_key=True,
            )
        )

        challenge_db = WebAuthnChallenge(
            user_id=student.user_id,
            student_id=student.id,
            challenge_type=ChallengeType.registration,
            challenge_hash=bytes_to_base64url(options.challenge),
            expires_at=datetime.utcnow() + timedelta(minutes=5),
            metadata_json={"student_id": student.id}
        )
        db.add(challenge_db)
        await db.commit()

        return options_to_json(options)

    @staticmethod
    async def verify_student_registration(
        db: AsyncSession,
        student: Student,
        registration_response: dict
    ) -> WebAuthnCredential:
        result = await db.execute(
            select(WebAuthnChallenge).where(
                WebAuthnChallenge.student_id == student.id if hasattr(WebAuthnChallenge, 'student_id') else False,
                WebAuthnChallenge.user_id == student.user_id,
                WebAuthnChallenge.challenge_type == ChallengeType.registration,
                WebAuthnChallenge.used_at == None,
                WebAuthnChallenge.expires_at > datetime.now(timezone.utc)
            ).order_by(WebAuthnChallenge.id.desc())
        )
        challenge_db = result.scalars().first()
        
        if not challenge_db:
            raise ValueError("Invalid or expired challenge")

        verification = verify_registration_response(
            credential=registration_response,
            expected_challenge=base64url_to_bytes(challenge_db.challenge_hash),
            expected_origin=settings.origin_str,
            expected_rp_id=settings.RP_ID,
            require_user_verification=True,
        )

        challenge_db.used_at = datetime.utcnow()

        new_credential = WebAuthnCredential(
            user_id=student.user_id,
            student_id=student.id,
            credential_id=bytes_to_base64url(verification.credential_id),
            public_key=bytes_to_base64url(verification.credential_public_key),
            sign_count=verification.sign_count,
            aaguid=verification.aaguid,
        )
        db.add(new_credential)
        await db.commit()
        await db.refresh(new_credential)

        return new_credential

    @staticmethod
    async def get_student_authentication_options(
        db: AsyncSession,
        student: Student
    ) -> str:
        options = generate_authentication_options(
            rp_id=settings.RP_ID,
            user_verification=UserVerificationRequirement.REQUIRED,
        )

        challenge_db = WebAuthnChallenge(
            user_id=student.user_id,
            student_id=student.id,
            challenge_type=ChallengeType.authentication,
            challenge_hash=bytes_to_base64url(options.challenge),
            expires_at=datetime.utcnow() + timedelta(minutes=5),
            metadata_json={"student_id": student.id}
        )
        db.add(challenge_db)
        await db.commit()

        return options_to_json(options)

    @staticmethod
    async def verify_student_authentication(
        db: AsyncSession,
        authentication_response: dict,
        challenge: str
    ) -> Tuple[Student, WebAuthnCredential]:
        result = await db.execute(
            select(WebAuthnChallenge).where(
                WebAuthnChallenge.challenge_hash == challenge,
                WebAuthnChallenge.challenge_type == ChallengeType.authentication,
                WebAuthnChallenge.used_at == None,
                WebAuthnChallenge.expires_at > datetime.now(timezone.utc)
            )
        )
        challenge_db = result.scalars().first()
        if not challenge_db:
            raise ValueError("Invalid or expired challenge")

        credential_id = authentication_response.get("rawId")
        if isinstance(credential_id, str):
            credential_id = base64url_to_bytes(credential_id)

        result = await db.execute(
            select(WebAuthnCredential).where(WebAuthnCredential.credential_id == bytes_to_base64url(credential_id))
        )
        db_credential = result.scalars().first()
        if not db_credential:
            raise ValueError("Credential not found")

        student_id = challenge_db.metadata_json.get("student_id") if challenge_db.metadata_json else None
        if not student_id:
            raise ValueError("Student ID not found in challenge")

        # Validate that the credential belongs to the student being authenticated
        if db_credential.student_id != student_id:
            raise ValueError("Credential does not belong to this student")

        result = await db.execute(
            select(Student).where(Student.id == student_id).options(selectinload(Student.programme))
        )
        db_student = result.scalars().first()
        if not db_student:
            raise ValueError("Student not found")

        verification = verify_authentication_response(
            credential=authentication_response,
            expected_challenge=base64url_to_bytes(challenge),
            expected_origin=settings.origin_str,
            expected_rp_id=settings.RP_ID,
            credential_public_key=base64url_to_bytes(db_credential.public_key),
            credential_current_sign_count=db_credential.sign_count,
            require_user_verification=True,
        )

        db_credential.sign_count = verification.new_sign_count
        db_credential.last_used_at = datetime.utcnow()
        challenge_db.used_at = datetime.utcnow()

        await db.commit()

        return db_student.id, db_credential
