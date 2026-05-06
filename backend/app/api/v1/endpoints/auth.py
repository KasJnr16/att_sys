import json
from datetime import timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import User, Role
from app.schemas.token import Token
from app.schemas.user import UserCreate, UserUpdate, User as UserSchema
from app.schemas.webauthn import WebAuthnOptionsRequest, WebAuthnRegistrationVerifyRequest, WebAuthnLoginVerifyRequest
from app.security.jwt import create_access_token
from app.security.password import get_password_hash, verify_password
from app.core.config import settings
from app.api import deps
from app.services.webauthn_service import WebAuthnService

router = APIRouter()

@router.post("/login", response_model=Token)
async def login(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    # Basic login for initial authentication
    result = await db.execute(
        select(User)
        .options(selectinload(User.role))
        .where(User.email == form_data.username)
    )
    user = result.scalars().first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if user.role and user.role.name == "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student dashboard access is disabled. Use the attendance verification link from your lecturer.",
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(
            user.id,
            expires_delta=access_token_expires,
            extra_claims={"role": user.role.name if user.role else None},
        ),
        "token_type": "bearer",
    }

@router.post("/register-user")
async def register_user(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserCreate
) -> Any:
    role_result = await db.execute(select(Role).where(Role.id == user_in.role_id))
    role = role_result.scalars().first()
    if not role:
        raise HTTPException(status_code=400, detail="Invalid role")
    if role.name == "student":
        raise HTTPException(
            status_code=403,
            detail="Student account registration is disabled. Students should verify attendance through the lecturer's session link.",
        )

    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="User already exists",
        )

    db_obj = User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        role_id=user_in.role_id,
    )
    db.add(db_obj)
    await db.flush()
    user_id = db_obj.id
    user_email = db_obj.email
    user_role_id = db_obj.role_id
    user_is_active = db_obj.is_active
    await db.commit()

    return {
        "id": user_id,
        "email": user_email,
        "role_id": user_role_id,
        "is_active": user_is_active
    }

@router.post("/register/options")
async def get_registration_options(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
) -> Any:
    options_json = await WebAuthnService.get_registration_options(db, current_user)
    return json.loads(options_json)

@router.post("/register/verify")
async def verify_registration(
    *,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
    request_in: WebAuthnRegistrationVerifyRequest
) -> Any:
    try:
        credential = await WebAuthnService.verify_registration(
            db, current_user, request_in.registration_response, request_in.challenge
        )
        return {"status": "success", "credential_id": credential.credential_id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/login/options")
async def get_login_options(
    db: AsyncSession = Depends(get_db),
    request_in: WebAuthnOptionsRequest = None
) -> Any:
    user = None
    if request_in and request_in.email:
        result = await db.execute(select(User).where(User.email == request_in.email))
        user = result.scalars().first()
    
    options_json = await WebAuthnService.get_authentication_options(db, user)
    return json.loads(options_json)

@router.post("/login/verify", response_model=Token)
async def verify_login(
    *,
    db: AsyncSession = Depends(get_db),
    request_in: WebAuthnLoginVerifyRequest
) -> Any:
    try:
        user, credential = await WebAuthnService.verify_authentication(
            db, request_in.authentication_response, request_in.challenge
        )
        result = await db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(User.id == user.id)
        )
        user = result.scalars().first()
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return {
            "access_token": create_access_token(
                user.id,
                expires_delta=access_token_expires,
                extra_claims={"role": user.role.name if user and user.role else None},
            ),
            "token_type": "bearer",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/me")
async def read_user_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    options = [selectinload(User.role)]

    if current_user.role.name == "lecturer":
        options.append(selectinload(User.lecturer))
    elif current_user.role.name == "student":
        options.append(selectinload(User.student))

    result = await db.execute(
        select(User)
        .options(*options)
        .where(User.id == current_user.id)
    )
    user = result.scalars().first()

    return {
        "id": user.id,
        "email": user.email,
        "role_id": user.role_id,
        "role": {"id": user.role.id, "name": user.role.name} if user.role else None,
        "lecturer": {"id": user.lecturer.id, "full_name": user.lecturer.full_name} if user.lecturer else None,
        "student": {"id": user.student.id, "full_name": user.student.full_name} if user.student else None,
        "is_active": user.is_active
    }

@router.put("/me")
async def update_user_me(
    *,
    db: AsyncSession = Depends(get_db),
    user_in: UserUpdate,
    current_user: User = Depends(deps.get_current_active_user),
) -> Any:
    update_data = user_in.dict(exclude_unset=True)
    if update_data.get("password"):
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(current_user, field, value)

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    options = [selectinload(User.role)]

    if current_user.role.name == "lecturer":
        options.append(selectinload(User.lecturer))
    elif current_user.role.name == "student":
        options.append(selectinload(User.student))

    result = await db.execute(
        select(User)
        .options(*options)
        .where(User.id == current_user.id)
    )
    user = result.scalars().first()

    return {
        "id": user.id,
        "email": user.email,
        "role_id": user.role_id,
        "role": {"id": user.role.id, "name": user.role.name} if user.role else None,
        "lecturer": {"id": user.lecturer.id, "full_name": user.lecturer.full_name} if user.lecturer else None,
        "student": {"id": user.student.id, "full_name": user.student.full_name} if user.student else None,
        "is_active": user.is_active
    }
