"""الجهات والأعضاء والمستندات (DOMAIN_CONTRACT §1, SRS §7.3, §9.1)."""
from django.db import models

from apps.core.encryption import EncryptedCharField
from apps.core.models import TimeStampedModel
from apps.core.references import make_reference
from apps.core.roles import Roles
from apps.core.validators import validate_upload


class Organization(TimeStampedModel):
    """جهة خيرية (لجنة/جمعية/مؤسسة/فرد/فريق) — SRS §7.3."""

    class OrgType(models.TextChoices):
        COMMITTEE = "committee", "لجنة"
        ASSOCIATION = "association", "جمعية"
        FOUNDATION = "foundation", "مؤسسة"
        INDIVIDUAL = "individual", "فرد"
        TEAM = "team", "فريق"

    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        PENDING = "pending", "بانتظار التحقق"
        APPROVED = "approved", "معتمدة"
        RETURNED = "returned", "معادة للتعديل"
        REJECTED = "rejected", "مرفوضة"
        SUSPENDED = "suspended", "موقوفة"

    reference = models.CharField(
        "الرقم المرجعي", max_length=20, unique=True, blank=True
    )
    name = models.CharField("الاسم", max_length=200)
    org_type = models.CharField(
        "نوع الجهة",
        max_length=20,
        choices=OrgType.choices,
        default=OrgType.ASSOCIATION,
    )
    description = models.TextField("الوصف", blank=True)
    logo = models.ImageField(
        "الشعار", upload_to="orgs/logos/", null=True, blank=True
    )
    manager = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_organizations",
        verbose_name="المسؤول",
    )
    phone = models.CharField("رقم الهاتف", max_length=20)
    email = models.EmailField("البريد الإلكتروني", blank=True)
    location = models.CharField("الموقع", max_length=255, blank=True)

    bank_name = models.CharField("اسم البنك", max_length=150, blank=True)
    bank_account_name = models.CharField(
        "اسم صاحب الحساب", max_length=150, blank=True
    )
    iban = EncryptedCharField("الآيبان", blank=True, default="")

    status = models.CharField(
        "الحالة",
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    review_note = models.TextField("ملاحظة المراجعة", blank=True)

    class Meta:
        verbose_name = "جهة"
        verbose_name_plural = "الجهات"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["org_type"]),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("organization")
        super().save(*args, **kwargs)


class OrganizationMember(TimeStampedModel):
    """عضو في الجهة له دور محدد."""

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="members",
        verbose_name="الجهة",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.CASCADE,
        related_name="organization_memberships",
        verbose_name="المستخدم",
    )
    role = models.CharField("الدور", max_length=30, choices=Roles.CHOICES)

    class Meta:
        verbose_name = "عضو جهة"
        verbose_name_plural = "أعضاء الجهات"
        ordering = ("-created_at",)
        unique_together = ("organization", "user")

    def __str__(self):
        return f"{self.user} · {self.organization}"


class OrganizationDocument(TimeStampedModel):
    """مستند تحقق مرفوع للجهة."""

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="documents",
        verbose_name="الجهة",
    )
    title = models.CharField("العنوان", max_length=200)
    file = models.FileField(
        "الملف", upload_to="orgs/docs/", validators=[validate_upload]
    )

    class Meta:
        verbose_name = "مستند جهة"
        verbose_name_plural = "مستندات الجهات"
        ordering = ("-created_at",)

    def __str__(self):
        return self.title
