"""Financial workflow services (SRS §9.3, §9.4, §17.5).

Every state change is wrapped in an atomic transaction and records an audit
entry. WhatsApp / Outbox side-effects are always enqueued *after* commit so
their failure can never roll back a financial approval.
"""
import logging
from decimal import Decimal

from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.core.exceptions import BusinessRuleError

logger = logging.getLogger(__name__)

ZERO = Decimal("0")


# ---------------------------------------------------------------------------
# Outbox helper — never let messaging failures break a financial transaction.
# ---------------------------------------------------------------------------
def _safe_enqueue(phone, body, *, kind="", user=None):
    """Enqueue a WhatsApp message; swallow every error (Outbox is best-effort)."""
    if not phone:
        return
    try:
        from apps.communications.services import enqueue_message

        enqueue_message(phone, body, kind=kind, user=user)
    except Exception:  # pragma: no cover - messaging must never break finance
        logger.exception("enqueue_message failed for %s", phone)


def _enqueue_after_commit(phone, body, *, kind="", user=None):
    """Schedule the enqueue for after the current transaction commits."""
    transaction.on_commit(
        lambda: _safe_enqueue(phone, body, kind=kind, user=user)
    )


# ---------------------------------------------------------------------------
# Payment approval — the central 8-step sequence (SRS §9.3, §17.5).
# ---------------------------------------------------------------------------
@transaction.atomic
def approve_payment(payment, user):
    """Approve a pending payment inside a single atomic transaction.

    Steps: lock → verify pending → allocate to installments (never exceeding
    the payment amount) → update installments + subscription → create Revenue →
    project.recalculate_financials() → issue Receipt → audit → enqueue WhatsApp
    confirmation (after commit).
    """
    from apps.finance.models import Payment, PaymentAllocation, Revenue, Receipt

    # 1) Lock the payment row and verify it is still pending.
    payment = (
        Payment.objects.select_for_update()
        .select_related("project", "subscription", "user")
        .get(pk=payment.pk)
    )
    if payment.status != Payment.Status.PENDING:
        raise BusinessRuleError(
            "لا يمكن اعتماد الدفعة إلا إذا كانت بانتظار المراجعة.",
            code="payment_not_pending",
        )

    old_status = payment.status
    amount = payment.amount or ZERO

    # 2) Build / verify allocations against subscription installments without
    #    exceeding the payment amount.
    subscription = payment.subscription
    if subscription is not None:
        existing_total = payment.allocations.aggregate(
            total=models.Sum("amount")
        )["total"] or ZERO
        remaining_to_allocate = amount - existing_total

        if remaining_to_allocate > ZERO:
            # Auto-allocate oldest unpaid installments first.
            installments = (
                subscription.installments.select_for_update()
                .exclude(status="paid")
                .order_by("sequence")
            )
            for inst in installments:
                if remaining_to_allocate <= ZERO:
                    break
                inst_remaining = (inst.amount or ZERO) - (inst.paid_amount or ZERO)
                if inst_remaining <= ZERO:
                    continue
                alloc_amount = min(inst_remaining, remaining_to_allocate)
                PaymentAllocation.objects.create(
                    payment=payment, installment=inst, amount=alloc_amount
                )
                remaining_to_allocate -= alloc_amount

    # Enforce the invariant: total allocations must never exceed the payment.
    allocated = payment.allocations.aggregate(total=models.Sum("amount"))["total"] or ZERO
    if allocated > amount:
        raise BusinessRuleError(
            "مجموع التوزيعات يتجاوز مبلغ الدفعة.",
            code="allocations_exceed_payment",
        )

    # 3) Apply allocations to installments, then recalculate the subscription.
    for alloc in payment.allocations.select_related("installment").select_for_update():
        inst = alloc.installment
        inst.paid_amount = (inst.paid_amount or ZERO) + (alloc.amount or ZERO)
        remaining = (inst.amount or ZERO) - inst.paid_amount
        if remaining <= ZERO:
            inst.status = "paid"
        elif inst.paid_amount > ZERO:
            inst.status = "partial"
        inst.save(update_fields=["paid_amount", "status", "updated_at"])

    if subscription is not None:
        if hasattr(subscription, "recalculate"):
            subscription.recalculate()

    # 4) Create the Revenue from this payment (revenue_type=share).
    revenue = Revenue.objects.create(
        project=payment.project,
        revenue_type=Revenue.RevenueType.SHARE,
        user=payment.user,
        payment=payment,
        amount=amount,
        date=payment.date,
        method=payment.method,
        reference_number=payment.reference_number,
        receiving_account=payment.receiving_account,
        status=Revenue.Status.APPROVED,
    )

    # 5) Update the payment status.
    payment.status = Payment.Status.APPROVED
    payment.reviewed_by = user
    payment.save(update_fields=["status", "reviewed_by", "updated_at"])

    # 6) Refresh project financial indicators.
    project = payment.project
    if hasattr(project, "recalculate_financials"):
        project.recalculate_financials()

    # 7) Issue the Receipt and (best-effort) render its PDF.
    receipt, _created = Receipt.objects.get_or_create(
        payment=payment,
        defaults={
            "project": payment.project,
            "user": payment.user,
            "amount": amount,
        },
    )
    try:
        build_receipt_pdf(receipt)
    except Exception:  # pragma: no cover - PDF is best-effort
        logger.exception("Receipt PDF generation failed for %s", receipt.code)

    # 8) Audit the approval.
    record(
        AuditLog.Action.APPROVE,
        payment,
        summary=f"اعتماد الدفعة {payment.reference} بمبلغ {amount}",
        old={"status": old_status},
        new={"status": payment.status, "revenue": revenue.reference},
        user=user,
    )

    # WhatsApp confirmation — after commit, failure never rolls back approval.
    phone = _payer_phone(payment)
    if phone:
        body = (
            f"تم اعتماد دفعتكم {payment.reference} بمبلغ {amount} "
            f"لمشروع {payment.project.name}. رمز الإيصال: {receipt.code}."
        )
        _enqueue_after_commit(phone, body, kind="receipt", user=payment.user)

    return payment


def _payer_phone(payment):
    if payment.user_id and getattr(payment.user, "phone", ""):
        return payment.user.phone
    for rev in payment.revenues.all():
        if rev.external_phone:
            return rev.external_phone
    return ""


# ---------------------------------------------------------------------------
# Payment reject / return / reverse
# ---------------------------------------------------------------------------
@transaction.atomic
def reject_payment(payment, user, reason=""):
    from apps.finance.models import Payment

    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.status not in {Payment.Status.PENDING, Payment.Status.RETURNED}:
        raise BusinessRuleError(
            "لا يمكن رفض هذه الدفعة في حالتها الحالية.", code="payment_not_rejectable"
        )
    old_status = payment.status
    payment.status = Payment.Status.REJECTED
    payment.reviewed_by = user
    payment.rejection_reason = reason
    payment.save(
        update_fields=["status", "reviewed_by", "rejection_reason", "updated_at"]
    )
    record(
        AuditLog.Action.REJECT,
        payment,
        summary=f"رفض الدفعة {payment.reference}",
        old={"status": old_status},
        new={"status": payment.status, "reason": reason},
        user=user,
    )
    return payment


@transaction.atomic
def return_payment(payment, user, reason=""):
    """Return a pending payment to the submitter for completion."""
    from apps.finance.models import Payment

    payment = Payment.objects.select_for_update().get(pk=payment.pk)
    if payment.status != Payment.Status.PENDING:
        raise BusinessRuleError(
            "لا يمكن إعادة الدفعة إلا إذا كانت بانتظار المراجعة.",
            code="payment_not_returnable",
        )
    old_status = payment.status
    payment.status = Payment.Status.RETURNED
    payment.reviewed_by = user
    payment.rejection_reason = reason
    payment.save(
        update_fields=["status", "reviewed_by", "rejection_reason", "updated_at"]
    )
    record(
        AuditLog.Action.RETURN,
        payment,
        summary=f"إعادة الدفعة {payment.reference} للاستكمال",
        old={"status": old_status},
        new={"status": payment.status, "reason": reason},
        user=user,
    )
    return payment


@transaction.atomic
def reverse_payment(payment, user, reason=""):
    """Reverse an approved payment by creating reversing records — never delete.

    Creates a reversing Revenue (negative), rolls back installment allocations
    and the subscription/project indicators, and marks the payment reversed.
    """
    from apps.finance.models import Payment, Revenue

    payment = (
        Payment.objects.select_for_update()
        .select_related("project", "subscription")
        .get(pk=payment.pk)
    )
    if payment.status != Payment.Status.APPROVED:
        raise BusinessRuleError(
            "لا يمكن عكس دفعة غير معتمدة.", code="payment_not_reversible"
        )

    old_status = payment.status

    # Reverse installment paid amounts from allocations.
    for alloc in payment.allocations.select_related("installment").select_for_update():
        inst = alloc.installment
        inst.paid_amount = max(ZERO, (inst.paid_amount or ZERO) - (alloc.amount or ZERO))
        remaining = (inst.amount or ZERO) - inst.paid_amount
        if inst.paid_amount <= ZERO:
            inst.status = "pending"
        elif remaining > ZERO:
            inst.status = "partial"
        inst.save(update_fields=["paid_amount", "status", "updated_at"])

    subscription = payment.subscription
    if subscription is not None and hasattr(subscription, "recalculate"):
        subscription.recalculate()

    # Mark existing revenues reversed and create a reversing entry.
    for rev in payment.revenues.filter(status=Revenue.Status.APPROVED):
        rev.status = Revenue.Status.REVERSED
        rev.save(update_fields=["status", "updated_at"])

    reversing_revenue = Revenue.objects.create(
        project=payment.project,
        revenue_type=Revenue.RevenueType.SHARE,
        user=payment.user,
        payment=payment,
        amount=-(payment.amount or ZERO),
        date=timezone.now().date(),
        description=f"قيد عكسي للدفعة {payment.reference}. {reason}".strip(),
        status=Revenue.Status.REVERSED,
    )

    payment.status = Payment.Status.REVERSED
    payment.reviewed_by = user
    payment.save(update_fields=["status", "reviewed_by", "updated_at"])

    project = payment.project
    if hasattr(project, "recalculate_financials"):
        project.recalculate_financials()

    record(
        AuditLog.Action.REVERSE,
        payment,
        summary=f"عكس الدفعة {payment.reference}",
        old={"status": old_status},
        new={"status": payment.status, "reversing_revenue": reversing_revenue.reference},
        user=user,
    )
    return payment


# ---------------------------------------------------------------------------
# Expense workflow (SRS §9.4)
# ---------------------------------------------------------------------------
def _tier_step_roles(tier):
    """Ordered approval roles required per tier (SRS §9.4)."""
    from apps.core.roles import Roles
    from apps.finance.models import Expense

    if tier == Expense.Tier.LOW:
        return [Roles.PROJECT_OWNER]
    if tier == Expense.Tier.MEDIUM:
        return [Roles.FINANCE_OFFICER, Roles.PROJECT_OWNER]
    return [Roles.FINANCE_OFFICER, Roles.AUDITOR, Roles.ORG_MANAGER]


@transaction.atomic
def submit_expense(expense, user):
    """Move a draft expense into the approval workflow, building the steps."""
    from apps.finance.models import Expense, ExpenseApproval

    expense = Expense.objects.select_for_update().get(pk=expense.pk)
    if expense.status not in {Expense.Status.DRAFT, Expense.Status.RETURNED}:
        raise BusinessRuleError(
            "لا يمكن إرسال المصروف إلا من حالة المسودة أو المُعاد.",
            code="expense_not_submittable",
        )

    # Invoice-required threshold enforcement.
    if expense.invoice_required and not expense.invoice_file:
        raise BusinessRuleError(
            "الفاتورة مطلوبة لهذا المبلغ.", code="invoice_required"
        )

    old_status = expense.status
    expense.status = Expense.Status.UNDER_REVIEW
    expense.save(update_fields=["status", "tier", "updated_at"])

    # (Re)build pending approval steps for the tier.
    expense.approvals.all().delete()
    for role in _tier_step_roles(expense.tier):
        ExpenseApproval.objects.create(
            expense=expense,
            step_role=role,
            decision=ExpenseApproval.Decision.PENDING,
        )

    record(
        AuditLog.Action.SUBMIT,
        expense,
        summary=f"إرسال المصروف {expense.reference} للاعتماد ({expense.tier})",
        old={"status": old_status},
        new={"status": expense.status},
        user=user,
    )
    return expense


@transaction.atomic
def approve_expense_step(expense, user, note=""):
    """Approve the next pending step for ``expense`` on behalf of ``user``.

    Honors separation of duties: when SEPARATION_OF_DUTIES is on, the creator
    cannot be the sole approver.
    """
    from apps.finance.models import Expense, ExpenseApproval

    expense = Expense.objects.select_for_update().select_related("created_by").get(
        pk=expense.pk
    )
    if expense.status != Expense.Status.UNDER_REVIEW:
        raise BusinessRuleError(
            "المصروف ليس قيد المراجعة.", code="expense_not_under_review"
        )

    # Separation of duties — the creator may not solely approve.
    if getattr(settings, "SEPARATION_OF_DUTIES", True) and expense.created_by_id == getattr(
        user, "id", None
    ):
        raise BusinessRuleError(
            "لا يجوز لمنشئ المصروف اعتماده منفردًا (فصل المهام).",
            code="separation_of_duties",
        )

    step = (
        expense.approvals.filter(decision=ExpenseApproval.Decision.PENDING)
        .order_by("created_at")
        .first()
    )
    if step is None:
        raise BusinessRuleError(
            "لا توجد خطوة اعتماد معلّقة.", code="no_pending_step"
        )

    step.decision = ExpenseApproval.Decision.APPROVED
    step.approver = user
    step.note = note
    step.decided_at = timezone.now()
    step.save(update_fields=["decision", "approver", "note", "decided_at", "updated_at"])

    remaining = expense.approvals.filter(
        decision=ExpenseApproval.Decision.PENDING
    ).exists()

    old_status = expense.status
    if not remaining:
        expense.status = Expense.Status.APPROVED
        expense.save(update_fields=["status", "updated_at"])

        # Update committed amount on the linked budget item.
        if expense.budget_item_id:
            item = expense.budget_item
            item.committed_amount = (item.committed_amount or ZERO) + (
                expense.total_amount or ZERO
            )
            item.save(update_fields=["committed_amount", "updated_at"])

    record(
        AuditLog.Action.APPROVE,
        expense,
        summary=f"اعتماد خطوة ({step.step_role}) للمصروف {expense.reference}",
        old={"status": old_status},
        new={"status": expense.status, "step": step.step_role},
        user=user,
    )
    return expense


@transaction.atomic
def reject_expense(expense, user, reason=""):
    from apps.finance.models import Expense, ExpenseApproval

    expense = Expense.objects.select_for_update().get(pk=expense.pk)
    if expense.status not in {Expense.Status.UNDER_REVIEW, Expense.Status.DRAFT}:
        raise BusinessRuleError(
            "لا يمكن رفض المصروف في حالته الحالية.", code="expense_not_rejectable"
        )
    old_status = expense.status
    expense.status = Expense.Status.REJECTED
    expense.save(update_fields=["status", "updated_at"])

    step = (
        expense.approvals.filter(decision=ExpenseApproval.Decision.PENDING)
        .order_by("created_at")
        .first()
    )
    if step:
        step.decision = ExpenseApproval.Decision.REJECTED
        step.approver = user
        step.note = reason
        step.decided_at = timezone.now()
        step.save(
            update_fields=["decision", "approver", "note", "decided_at", "updated_at"]
        )

    record(
        AuditLog.Action.REJECT,
        expense,
        summary=f"رفض المصروف {expense.reference}",
        old={"status": old_status},
        new={"status": expense.status, "reason": reason},
        user=user,
    )
    return expense


@transaction.atomic
def return_expense(expense, user, reason=""):
    """Return an expense to the creator for edits."""
    from apps.finance.models import Expense, ExpenseApproval

    expense = Expense.objects.select_for_update().get(pk=expense.pk)
    if expense.status != Expense.Status.UNDER_REVIEW:
        raise BusinessRuleError(
            "لا يمكن إعادة المصروف إلا وهو قيد المراجعة.",
            code="expense_not_returnable",
        )
    old_status = expense.status
    expense.status = Expense.Status.RETURNED
    expense.save(update_fields=["status", "updated_at"])

    step = (
        expense.approvals.filter(decision=ExpenseApproval.Decision.PENDING)
        .order_by("created_at")
        .first()
    )
    if step:
        step.decision = ExpenseApproval.Decision.RETURNED
        step.approver = user
        step.note = reason
        step.decided_at = timezone.now()
        step.save(
            update_fields=["decision", "approver", "note", "decided_at", "updated_at"]
        )

    record(
        AuditLog.Action.RETURN,
        expense,
        summary=f"إعادة المصروف {expense.reference} للتعديل",
        old={"status": old_status},
        new={"status": expense.status, "reason": reason},
        user=user,
    )
    return expense


@transaction.atomic
def mark_expense_paid(expense, user, payment_date=None, payment_method="", payment_reference=""):
    """Record payment of an approved expense and move committed → spent."""
    from apps.finance.models import Expense

    expense = Expense.objects.select_for_update().select_related("budget_item").get(
        pk=expense.pk
    )
    if expense.status != Expense.Status.APPROVED:
        raise BusinessRuleError(
            "لا يمكن دفع مصروف غير معتمد.", code="expense_not_approved"
        )
    old_status = expense.status
    expense.status = Expense.Status.PAID
    expense.payment_date = payment_date or timezone.now().date()
    expense.payment_method = payment_method
    expense.payment_reference = payment_reference
    expense.save(
        update_fields=[
            "status",
            "payment_date",
            "payment_method",
            "payment_reference",
            "updated_at",
        ]
    )

    # Move the amount from committed → spent on the budget item.
    if expense.budget_item_id:
        item = expense.budget_item
        total = expense.total_amount or ZERO
        item.committed_amount = max(ZERO, (item.committed_amount or ZERO) - total)
        item.spent_amount = (item.spent_amount or ZERO) + total
        item.save(update_fields=["committed_amount", "spent_amount", "updated_at"])

    record(
        AuditLog.Action.UPDATE,
        expense,
        summary=f"تسجيل دفع المصروف {expense.reference}",
        old={"status": old_status},
        new={"status": expense.status},
        user=user,
    )
    return expense


# ---------------------------------------------------------------------------
# Receipt PDF generation (reportlab + qrcode, guarded)
# ---------------------------------------------------------------------------
def build_receipt_pdf(receipt):
    """Render ``receipt`` to a PDF with an embedded verify QR code.

    reportlab and qrcode are optional; if either import fails we return None
    without raising so the surrounding workflow keeps working.
    """
    try:
        import io

        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
    except Exception:  # pragma: no cover - reportlab optional
        logger.warning("reportlab is not installed; skipping receipt PDF.")
        return None

    from django.core.files.base import ContentFile

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawCentredString(width / 2, height - 40 * mm, "Receipt / ايصال")

    pdf.setFont("Helvetica", 12)
    y = height - 60 * mm
    lines = [
        f"Code: {receipt.code}",
        f"Amount: {receipt.amount}",
        f"Project: {getattr(receipt.project, 'name', '')}",
        f"Issued: {receipt.issued_at:%Y-%m-%d %H:%M}"
        if receipt.issued_at
        else "Issued: -",
        f"Verify: {receipt.verify_url}",
    ]
    for line in lines:
        pdf.drawString(25 * mm, y, line)
        y -= 10 * mm

    # QR code linking to the verification page.
    try:
        import qrcode
        from reportlab.lib.utils import ImageReader

        qr_img = qrcode.make(receipt.verify_url)
        qr_buffer = io.BytesIO()
        qr_img.save(qr_buffer, format="PNG")
        qr_buffer.seek(0)
        pdf.drawImage(
            ImageReader(qr_buffer),
            width - 70 * mm,
            height - 90 * mm,
            width=40 * mm,
            height=40 * mm,
        )
    except Exception:  # pragma: no cover - qrcode optional
        logger.info("qrcode unavailable; receipt PDF rendered without QR.")

    pdf.showPage()
    pdf.save()
    buffer.seek(0)

    filename = f"{receipt.code}.pdf"
    receipt.pdf.save(filename, ContentFile(buffer.read()), save=True)
    return receipt.pdf
