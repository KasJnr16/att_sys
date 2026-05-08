import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import AuthToken, AuthTokenPurpose, User
from app.services.email_service import send_email


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def generate_numeric_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def create_login_token(user: User) -> dict[str, str]:
    from app.security.jwt import create_access_token

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(
            user.id,
            expires_delta=access_token_expires,
            extra_claims={"role": user.role.name if user.role else None},
        ),
        "token_type": "bearer",
    }


async def create_auth_token(
    db: AsyncSession,
    user: User,
    purpose: AuthTokenPurpose,
    expires_in_minutes: int,
    include_code: bool = False,
) -> tuple[str, str | None]:
    raw_token = secrets.token_urlsafe(48)
    code = generate_numeric_code() if include_code else None
    token = AuthToken(
        user_id=user.id,
        purpose=purpose,
        token_hash=hash_secret(raw_token),
        code_hash=hash_secret(code) if code else None,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes),
    )
    db.add(token)
    await db.flush()
    return raw_token, code


def send_verification_email(email: str, verify_url: str, code: str) -> None:
    subject = "Verify your UniAtt account"
    text_body = (
        "Welcome to UniAtt.\n\n"
        f"Verify your email by opening this link:\n{verify_url}\n\n"
        f"Or enter this verification code: {code}\n\n"
        f"The code expires in {settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES} minutes."
    )
    html_body = render_email_template(
        title="Verify your email",
        intro="Welcome to UniAtt. Confirm this email address to finish creating your account.",
        action_label="Verify email",
        action_url=verify_url,
        code=code,
        footer=f"This code expires in {settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES} minutes.",
    )
    send_email(email, subject, text_body, html_body)


def send_password_reset_email(email: str, reset_url: str) -> None:
    subject = "Reset your UniAtt password"
    text_body = (
        "We received a request to reset your UniAtt password.\n\n"
        f"Open this link to choose a new password:\n{reset_url}\n\n"
        f"The link expires in {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes. "
        "If you did not request this, you can ignore this email."
    )
    html_body = render_email_template(
        title="Reset your password",
        intro="We received a request to reset your UniAtt password. Use the button below to choose a new password.",
        action_label="Reset password",
        action_url=reset_url,
        footer=(
            f"This link expires in {settings.PASSWORD_RESET_TOKEN_EXPIRE_MINUTES} minutes. "
            "If you did not request this, you can ignore this email."
        ),
    )
    send_email(email, subject, text_body, html_body)


def render_email_template(
    *,
    title: str,
    intro: str,
    action_label: str,
    action_url: str,
    footer: str,
    code: str | None = None,
) -> str:
    code_block = ""
    if code:
        code_block = f"""
        <tr>
          <td style="padding: 0 32px 24px;">
            <p style="margin: 0 0 10px; color: #64748b; font-size: 13px;">Or enter this code in the app</p>
            <div style="display: inline-block; padding: 14px 18px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc; color: #0f172a; font-size: 26px; font-weight: 700; letter-spacing: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
              {code}
            </div>
          </td>
        </tr>
        """

    return f"""
    <!doctype html>
    <html>
      <body style="margin: 0; padding: 0; background: #f8fafc; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f8fafc; padding: 32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden;">
                <tr>
                  <td style="padding: 28px 32px 10px;">
                    <table role="presentation" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="width: 40px; height: 40px; border-radius: 12px; background: #4f46e5; color: #ffffff; text-align: center; font-size: 22px; font-weight: 800;">U</td>
                        <td style="padding-left: 12px;">
                          <div style="color: #0f172a; font-size: 20px; font-weight: 800; line-height: 1;">UniAtt</div>
                          <div style="color: #64748b; font-size: 12px; margin-top: 3px;">University Attendance System</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 32px 12px;">
                    <h1 style="margin: 0; color: #0f172a; font-size: 24px; line-height: 1.25;">{title}</h1>
                    <p style="margin: 12px 0 0; color: #475569; font-size: 15px; line-height: 1.65;">{intro}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 32px 24px;">
                    <a href="{action_url}" style="display: inline-block; border-radius: 10px; background: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 18px;">{action_label}</a>
                  </td>
                </tr>
                {code_block}
                <tr>
                  <td style="padding: 0 32px 30px;">
                    <p style="margin: 0 0 12px; color: #64748b; font-size: 13px; line-height: 1.6;">{footer}</p>
                    <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">If the button does not work, copy and paste this link into your browser:<br><span style="word-break: break-all;">{action_url}</span></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """
