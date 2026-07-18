"""WhatsApp/notification models: templates, Outbox, notifications, campaigns (SRS §14, §15)."""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel
from apps.core.references import make_reference


class WhatsAppTemplate(TimeStampedModel):
    """Reusable WhatsApp message template with ``{placeholder}`` variables (SRS §15)."""

    key = models.CharField("المفتاح", max_length=60, unique=True)
    name = models.CharField("الاسم", max_length=150)
    body = models.TextField("النص")
    is_active = models.BooleanField("نشط", default=True)

    class Meta:
        verbose_name = "قالب واتساب"
        verbose_name_plural = "قوالب واتساب"
        ordering = ("key",)

    def __str__(self):
        return self.name


class OutboxMessage(TimeStampedModel):
    """Outbound WhatsApp message following the Outbox pattern (SRS §14.3)."""

    class Status(models.TextChoices):
        PENDING = "pending", "قيد الانتظار"
        SENDING = "sending", "قيد الإرسال"
        SENT = "sent", "مُرسلة"
        FAILED = "failed", "فشلت"

    phone = models.CharField("رقم الهاتف", max_length=20)
    body = models.TextField("النص")
    kind = models.CharField(
        "النوع", max_length=30, blank=True,
        help_text="otp/subscription/receipt/reminder/update/campaign",
    )
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.PENDING,
        db_index=True,
    )
    attempts = models.PositiveIntegerField("عدد المحاولات", default=0)
    max_attempts = models.PositiveIntegerField("الحد الأقصى للمحاولات", default=5)
    external_ref = models.CharField("المرجع الخارجي", max_length=255, blank=True)
    error = models.TextField("الخطأ", blank=True)
    scheduled_at = models.DateTimeField("مجدولة في", null=True, blank=True)
    sent_at = models.DateTimeField("أُرسلت في", null=True, blank=True)
    campaign = models.ForeignKey(
        "communications.Campaign",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="messages",
        verbose_name="الحملة",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="outbox_messages",
        verbose_name="المستخدم",
    )

    class Meta:
        verbose_name = "رسالة صادرة"
        verbose_name_plural = "الرسائل الصادرة (Outbox)"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["status", "scheduled_at"]),
        ]

    def __str__(self):
        return f"{self.phone} · {self.get_status_display()}"


class Notification(TimeStampedModel):
    """In-app notification for a single user (SRS §16)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
        verbose_name="المستخدم",
    )
    title = models.CharField("العنوان", max_length=200)
    body = models.TextField("النص", blank=True)
    is_read = models.BooleanField("مقروء", default=False)
    link = models.CharField("الرابط", max_length=500, blank=True)

    class Meta:
        verbose_name = "إشعار"
        verbose_name_plural = "الإشعارات"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["user", "is_read"]),
        ]

    def __str__(self):
        return f"{self.user_id} · {self.title}"


class Campaign(TimeStampedModel):
    """A WhatsApp broadcast campaign scoped to a project (SRS §7.13, §9.8)."""

    class Audience(models.TextChoices):
        ALL = "all", "الجميع"
        ACTIVE = "active", "المساهمون النشطون"
        OVERDUE = "overdue", "المتأخرون"
        CUSTOM = "custom", "مخصص"

    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        PENDING = "pending", "بانتظار الاعتماد"
        APPROVED = "approved", "معتمدة"
        SCHEDULED = "scheduled", "مجدولة"
        SENDING = "sending", "قيد الإرسال"
        COMPLETED = "completed", "مكتملة"
        PARTIAL = "partial", "جزئية"
        FAILED = "failed", "فاشلة"
        CANCELLED = "cancelled", "ملغاة"

    reference = models.CharField("الرقم المرجعي", max_length=20, unique=True, blank=True)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="campaigns",
        verbose_name="المشروع",
    )
    name = models.CharField("الاسم", max_length=200)
    campaign_type = models.CharField("نوع الحملة", max_length=40, blank=True)
    audience = models.CharField(
        "الجمهور", max_length=20, choices=Audience.choices, default=Audience.ALL
    )
    template = models.ForeignKey(
        WhatsAppTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaigns",
        verbose_name="القالب",
    )
    body = models.TextField("النص", blank=True)
    link = models.URLField("الرابط", blank=True)
    scheduled_at = models.DateTimeField("مجدولة في", null=True, blank=True)
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.DRAFT
    )

    class Meta:
        verbose_name = "حملة"
        verbose_name_plural = "الحملات"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.reference} · {self.name}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("campaign")
        super().save(*args, **kwargs)


class CampaignRecipient(TimeStampedModel):
    """A resolved recipient of a campaign (SRS §9.8)."""

    class Status(models.TextChoices):
        PENDING = "pending", "قيد الانتظار"
        SENT = "sent", "مُرسلة"
        FAILED = "failed", "فشلت"

    campaign = models.ForeignKey(
        Campaign,
        on_delete=models.CASCADE,
        related_name="recipients",
        verbose_name="الحملة",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="campaign_recipients",
        verbose_name="المستخدم",
    )
    phone = models.CharField("رقم الهاتف", max_length=20)
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.PENDING
    )

    class Meta:
        verbose_name = "مستلم حملة"
        verbose_name_plural = "مستلمو الحملات"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.campaign_id} · {self.phone}"
