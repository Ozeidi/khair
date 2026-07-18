"""Project lifecycle transitions and stage-weight validation (SRS §9.2, §10)."""
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.core.exceptions import BusinessRuleError

from apps.projects.models import Project

# قاعدة العمل رقم 7: مجموع أوزان المراحل = 100%.
STAGE_WEIGHT_TOTAL = Decimal("100")


def stage_weights_total(project):
    """المجموع الحالي لأوزان مراحل المشروع."""
    from django.db.models import Sum

    total = project.stages.aggregate(total=Sum("weight"))["total"]
    return total or Decimal("0")


def validate_stage_weights(project):
    """يتحقق أن مجموع أوزان المراحل يساوي 100 (§10 قاعدة 7).

    يرفع ``BusinessRuleError`` إن لم يكن المجموع 100 (مع تسامح بسيط).
    """
    total = stage_weights_total(project)
    if project.stages.exists() and (total - STAGE_WEIGHT_TOTAL).copy_abs() > Decimal(
        "0.01"
    ):
        raise BusinessRuleError(
            f"مجموع أوزان المراحل يجب أن يساوي 100٪ (الحالي: {total}٪).",
            code="stage_weights_invalid",
        )
    return total


def _transition(project, new_status, action, summary, note=None, user=None):
    """يطبّق تغيير حالة مع تسجيل التدقيق."""
    old = {"status": project.status}
    project.status = new_status
    update_fields = ["status", "updated_at"]
    if note is not None:
        project.review_note = note
        update_fields.append("review_note")
    project.save(update_fields=update_fields)
    record(
        action,
        project,
        summary=summary,
        old=old,
        new={"status": new_status},
        user=user,
    )
    return project


def submit_project(project, user=None):
    """مسودة/معاد للتعديل → بانتظار الاعتماد (§9.2)."""
    if project.status not in (Project.Status.DRAFT, Project.Status.RETURNED):
        raise BusinessRuleError(
            "لا يمكن إرسال المشروع للاعتماد من حالته الحالية.",
            code="invalid_transition",
        )
    return _transition(
        project,
        Project.Status.PENDING_APPROVAL,
        AuditLog.Action.SUBMIT,
        "إرسال المشروع للاعتماد",
        note="",
        user=user,
    )


@transaction.atomic
def approve_project(project, user=None):
    """بانتظار الاعتماد → معتمد ثم نشط + توليد النشر (§7.4, §9.2, §10 قاعدة 1)."""
    if project.status != Project.Status.PENDING_APPROVAL:
        raise BusinessRuleError(
            "لا يمكن اعتماد مشروع ليس بانتظار الاعتماد.",
            code="invalid_transition",
        )
    old = {"status": project.status, "published_at": None}
    project.status = Project.Status.ACTIVE
    project.review_note = ""
    if not project.published_at:
        project.published_at = timezone.now()
    project.save(
        update_fields=["status", "review_note", "published_at", "updated_at"]
    )
    record(
        AuditLog.Action.APPROVE,
        project,
        summary="اعتماد ونشر المشروع",
        old=old,
        new={"status": project.status, "published_at": str(project.published_at)},
        user=user,
    )
    return project


def reject_project(project, note="", user=None):
    """بانتظار الاعتماد → مرفوض (§9.2)."""
    if project.status != Project.Status.PENDING_APPROVAL:
        raise BusinessRuleError(
            "لا يمكن رفض مشروع ليس بانتظار الاعتماد.",
            code="invalid_transition",
        )
    return _transition(
        project,
        Project.Status.CANCELLED,
        AuditLog.Action.REJECT,
        "رفض المشروع",
        note=note,
        user=user,
    )


def return_project_for_edits(project, note="", user=None):
    """بانتظار الاعتماد → معاد للتعديل (§9.2)."""
    if project.status != Project.Status.PENDING_APPROVAL:
        raise BusinessRuleError(
            "لا يمكن إعادة مشروع ليس بانتظار الاعتماد.",
            code="invalid_transition",
        )
    return _transition(
        project,
        Project.Status.RETURNED,
        AuditLog.Action.RETURN,
        "إعادة المشروع للتعديل",
        note=note,
        user=user,
    )


def suspend_project(project, note="", user=None):
    """تعليق المشروع مؤقتًا من حالة منشورة (§7.4)."""
    suspendable = {
        Project.Status.APPROVED,
        Project.Status.ACTIVE,
        Project.Status.FUNDED,
        Project.Status.IN_PROGRESS,
    }
    if project.status not in suspendable:
        raise BusinessRuleError(
            "لا يمكن تعليق المشروع من حالته الحالية.",
            code="invalid_transition",
        )
    return _transition(
        project,
        Project.Status.SUSPENDED,
        AuditLog.Action.UPDATE,
        "تعليق المشروع مؤقتًا",
        note=note,
        user=user,
    )


def toggle_contributions(project, enabled=None, user=None):
    """إيقاف/تفعيل استقبال المساهمات (§7.4)."""
    old = {"contributions_enabled": project.contributions_enabled}
    if enabled is None:
        enabled = not project.contributions_enabled
    project.contributions_enabled = bool(enabled)
    project.save(update_fields=["contributions_enabled", "updated_at"])
    record(
        AuditLog.Action.UPDATE,
        project,
        summary="تفعيل استقبال المساهمات"
        if project.contributions_enabled
        else "إيقاف استقبال المساهمات",
        old=old,
        new={"contributions_enabled": project.contributions_enabled},
        user=user,
    )
    return project
