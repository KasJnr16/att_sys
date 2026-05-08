import resend

from app.core.config import settings


def send_email(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    if not settings.RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is not configured.")

    resend.api_key = settings.RESEND_API_KEY
    resend.Emails.send(
        {
            "from": f"{settings.EMAIL_FROM_NAME} <{settings.RESEND_FROM_EMAIL}>",
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        }
    )
