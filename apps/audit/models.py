"""Immutable audit trail (SRS §7.15, §12). Records are never deleted."""
from django.conf import settings
from django.db import models

from apps.core.models import TimeStampedModel


class AuditLog(TimeStampedModel):
    class Action(models.TextChoices):
        CREATE = "create", "إنشاء"
        UPDATE = "update", "تعديل"
        DELETE = "delete", "حذف"
        APPROVE = "approve", "اعتماد"
        REJECT = "reject", "رفض"
        RETURN = "return", "إعادة"
        SUBMIT = "submit", "إرسال"
        LOGIN = "login", "دخول"
        LOGOUT = "logout", "خروج"
        REVERSE = "reverse", "عكس"
        EXPORT = "export", "تصدير"
        SEND = "send", "إرسال رسالة"
        CLOSE = "close", "إغلاق"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        verbose_name="المستخدم",
    )
    action = models.CharField("العملية", max_length=20, choices=Action.choices)
    entity_type = models.CharField("نوع الكيان", max_length=80)
    entity_id = models.CharField("معرّف الكيان", max_length=64, blank=True)
    summary = models.CharField("وصف مختصر", max_length=255, blank=True)
    old_values = models.JSONField("القيم السابقة", null=True, blank=True)
    new_values = models.JSONField("القيم الجديدة", null=True, blank=True)
    ip_address = models.GenericIPAddressField("عنوان IP", null=True, blank=True)
    user_agent = models.CharField("متصفح المستخدم", max_length=255, blank=True)

    class Meta:
        verbose_name = "سجل تدقيق"
        verbose_name_plural = "سجل التدقيق"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["entity_type", "entity_id"]),
            models.Index(fields=["action"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self):
        return f"{self.get_action_display()} · {self.entity_type} · {self.entity_id}"
