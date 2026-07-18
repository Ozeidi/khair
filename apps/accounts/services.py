"""OTP generation / verification (SRS §7.1)."""
import logging
import secrets

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import LoginAttempt, OTPCode, User
from apps.accounts.phone import normalize_phone
from apps.core.exceptions import BusinessRuleError

logger = logging.getLogger("accounts.otp")


def _generate_code():
    return "".join(secrets.choice("0123456789") for _ in range(4))


def request_otp(phone, purpose=OTPCode.Purpose.LOGIN):
    """Create + deliver a fresh OTP, honoring the resend cooldown."""
    phone = normalize_phone(phone)

    recent = (
        OTPCode.objects.filter(phone=phone, purpose=purpose, is_used=False)
        .order_by("-created_at")
        .first()
    )
    if recent:
        elapsed = (timezone.now() - recent.created_at).total_seconds()
        if elapsed < settings.OTP_RESEND_COOLDOWN_SECONDS:
            wait = int(settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed)
            raise BusinessRuleError(
                f"يرجى الانتظار {wait} ثانية قبل طلب رمز جديد.", code="otp_cooldown"
            )

    code = _generate_code()
    otp = OTPCode.objects.create(
        phone=phone,
        code=code,
        purpose=purpose,
        expires_at=timezone.now() + timezone.timedelta(seconds=settings.OTP_TTL_SECONDS),
    )
    _deliver(phone, code)
    return otp


def _deliver(phone, code):
    """Deliver the OTP via WhatsApp Outbox; always log in dev."""
    logger.info("OTP for %s = %s", phone, code)
    try:
        from apps.communications.services import enqueue_message

        enqueue_message(
            phone=phone,
            body=f"رمز الدخول إلى منصة الخير: {code}. صالح لمدة 5 دقائق.",
            kind="otp",
        )
    except Exception:  # never let delivery break the login flow (SRS §14.3)
        logger.debug("Outbox unavailable; OTP only logged.", exc_info=True)


@transaction.atomic
def verify_otp(phone, code, purpose=OTPCode.Purpose.LOGIN, full_name="", request=None):
    """Validate an OTP and return (user, created)."""
    phone = normalize_phone(phone)
    otp = (
        OTPCode.objects.select_for_update()
        .filter(phone=phone, purpose=purpose, is_used=False)
        .order_by("-created_at")
        .first()
    )

    ip = None
    ua = ""
    if request is not None:
        ip = request.META.get("REMOTE_ADDR")
        ua = request.META.get("HTTP_USER_AGENT", "")[:255]

    if otp is None or otp.is_expired():
        LoginAttempt.objects.create(phone=phone, successful=False, ip_address=ip, user_agent=ua)
        raise BusinessRuleError("انتهت صلاحية الرمز أو أنه غير موجود.", code="otp_invalid")

    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise BusinessRuleError("تم تجاوز عدد المحاولات المسموح.", code="otp_locked")

    if otp.code != code:
        otp.attempts += 1
        otp.save(update_fields=["attempts"])
        LoginAttempt.objects.create(phone=phone, successful=False, ip_address=ip, user_agent=ua)
        raise BusinessRuleError("الرمز غير صحيح.", code="otp_mismatch")

    otp.is_used = True
    otp.save(update_fields=["is_used"])

    # Account resolution is purpose-aware:
    #   • LOGIN    → the account must already exist; never auto-create.
    #   • REGISTER → create the account on first successful verification.
    user = User.objects.filter(phone=phone).first()
    if user is None:
        if purpose != OTPCode.Purpose.REGISTER:
            LoginAttempt.objects.create(phone=phone, successful=False, ip_address=ip, user_agent=ua)
            raise BusinessRuleError(
                "لا يوجد حساب مرتبط بهذا الرقم. يرجى إنشاء حساب أولًا.", code="no_account"
            )
        # create_user() sets an unusable password (phone/OTP accounts have no password).
        user = User.objects.create_user(
            phone=phone, full_name=full_name, phone_verified=True
        )
        created = True
    else:
        created = False
        if full_name and not user.full_name:
            user.full_name = full_name
        user.phone_verified = True
        user.save(update_fields=["phone_verified", "full_name"])

    LoginAttempt.objects.create(phone=phone, successful=True, ip_address=ip, user_agent=ua)
    return user, created
