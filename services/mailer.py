"""Outgoing mail for account recovery and email verification
(PROJECT_AUDIT.md D3/F18).

SMTP is optional. Without SMTP_HOST nothing is sent: in a non-production
ENVIRONMENT the one-time code is logged so a developer can finish the flow
locally; in production only the fact that mail is not configured is logged,
never the code.
"""
import asyncio
import logging
import smtplib
from email.message import EmailMessage

from core.config import settings

logger = logging.getLogger(__name__)


class Mailer:
    @property
    def configured(self) -> bool:
        return bool(settings.SMTP_HOST and settings.SMTP_FROM)

    async def send_code(self, to: str, *, subject: str, intro: str, code: str, ttl_minutes: int) -> bool:
        """True when the message was handed to the SMTP server."""
        if not self.configured:
            if settings.ENVIRONMENT.lower() != "production":
                logger.info("SMTP is not configured - one-time code for local use: %s", code)
            else:
                logger.warning("SMTP is not configured - a one-time code was requested but could not be sent.")
            return False
        message = EmailMessage()
        message["From"] = settings.SMTP_FROM
        message["To"] = to
        message["Subject"] = subject
        message.set_content(
            f"{intro}\n\n    {code}\n\n"
            f"The code works once and expires in {ttl_minutes} minutes.\n"
            "If you did not ask for this, you can ignore this email - nothing has changed.\n"
        )
        try:
            await asyncio.to_thread(self._send, message)
            return True
        except Exception:
            logger.warning("Sending a one-time code by email failed.", exc_info=True)
            return False

    @staticmethod
    def _send(message: EmailMessage) -> None:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as smtp:
            smtp.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(message)


mailer = Mailer()
