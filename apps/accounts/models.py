"""Users, OTP codes and login attempts (SRS §7.1, §7.2)."""
from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.accounts.managers import UserManager
from apps.core.models import TimeStampedModel
from apps.core.roles import Roles


class User(AbstractBaseUser, PermissionsMixin):
    """A platform user.

    Two registration paths are supported (SRS §7.1):
      • Phone + OTP        — ``phone`` is set, password may be unusable.
      • Email + password   — ``email`` is set; ``phone`` is optional.

    ``phone`` stays the ``USERNAME_FIELD`` for backward compatibility, but it is
    now nullable so email-only accounts are possible. Both ``phone`` and
    ``email`` are unique when present; empty values are normalised to ``NULL`` in
    :meth:`save` so multiple credential-less rows never collide.
    """

    phone = models.CharField(
        "رقم الهاتف", max_length=20, unique=True, null=True, blank=True
    )
    full_name = models.CharField("الاسم الكامل", max_length=150, blank=True)
    email = models.EmailField(
        "البريد الإلكتروني", unique=True, null=True, blank=True
    )
    role = models.CharField(
        "الدور", max_length=30, choices=Roles.CHOICES, default=Roles.CONTRIBUTOR
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
        verbose_name="الجهة",
    )

    is_active = models.BooleanField("نشط", default=True)
    is_staff = models.BooleanField("موظف إداري", default=False)
    phone_verified = models.BooleanField("تم التحقق من الهاتف", default=False)

    # Privacy / notification preferences (SRS §8.2).
    notify_dues = models.BooleanField("تذكير الاستحقاقات", default=True)
    notify_updates = models.BooleanField("تحديثات المشاريع", default=True)
    notify_campaigns = models.BooleanField("الحملات الترويجية", default=True)

    date_joined = models.DateTimeField("تاريخ التسجيل", default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "phone"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = "مستخدم"
        verbose_name_plural = "المستخدمون"
        ordering = ("-date_joined",)

    def save(self, *args, **kwargs):
        # Keep unique credential columns NULL (not "") so multiple accounts that
        # lack one credential don't violate the unique constraint.
        if not self.phone:
            self.phone = None
        if not self.email:
            self.email = None
        else:
            self.email = self.email.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.display_name

    @property
    def display_name(self):
        return self.full_name or self.email or self.phone or "مستخدم"

    @property
    def is_platform_admin(self):
        return self.role == Roles.PLATFORM_ADMIN


class OTPCode(TimeStampedModel):
    """Short-lived one-time password bound to a phone (SRS §7.1)."""

    class Purpose(models.TextChoices):
        LOGIN = "login", "تسجيل الدخول"
        REGISTER = "register", "إنشاء حساب"

    phone = models.CharField("رقم الهاتف", max_length=20, db_index=True)
    code = models.CharField("الرمز", max_length=8)
    purpose = models.CharField(
        "الغرض", max_length=20, choices=Purpose.choices, default=Purpose.LOGIN
    )
    expires_at = models.DateTimeField("ينتهي في")
    attempts = models.PositiveSmallIntegerField("المحاولات", default=0)
    is_used = models.BooleanField("مستخدم", default=False)

    class Meta:
        verbose_name = "رمز تحقق"
        verbose_name_plural = "رموز التحقق"
        ordering = ("-created_at",)

    def is_expired(self):
        return timezone.now() >= self.expires_at

    def is_valid(self):
        return (
            not self.is_used
            and not self.is_expired()
            and self.attempts < settings.OTP_MAX_ATTEMPTS
        )


class LoginAttempt(TimeStampedModel):
    """Audit of authentication attempts (SRS §7.1)."""

    phone = models.CharField("رقم الهاتف", max_length=20, db_index=True)
    successful = models.BooleanField("ناجحة", default=False)
    ip_address = models.GenericIPAddressField("عنوان IP", null=True, blank=True)
    user_agent = models.CharField("المتصفح", max_length=255, blank=True)

    class Meta:
        verbose_name = "محاولة دخول"
        verbose_name_plural = "محاولات الدخول"
        ordering = ("-created_at",)
