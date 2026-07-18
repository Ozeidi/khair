"""تجميعات التقارير (SRS §13).

كل الدوال هنا للقراءة فقط وتستخدم تجميعات Django ORM (Sum/Count) لتفادي N+1.
النماذج من التطبيقات الأخرى تُستورد داخل الدوال لتفادي الاقتران عند الاستيراد،
مع أن reports هو أعلى طبقة ويُسمح له بالاستيراد المباشر.
"""
from decimal import Decimal

from django.db.models import Count, DecimalField, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

ZERO = Decimal("0.00")

# حالات الاستحقاق المتأخرة/غير المسدّدة بالكامل.
_OPEN_INSTALLMENT_STATUSES = ("pending", "partial", "overdue")


def _money_sum(queryset, field):
    """مجموع حقل مالي مع إرجاع Decimal(0) بدل None."""
    result = queryset.aggregate(
        total=Coalesce(
            Sum(field),
            Value(ZERO),
            output_field=DecimalField(max_digits=20, decimal_places=2),
        )
    )
    return result["total"] or ZERO


def get_project_or_404(project_id):
    """يجلب المشروع مع الجهة/المدير لتفادي استعلامات إضافية، أو يرفع 404."""
    from django.shortcuts import get_object_or_404

    from apps.projects.models import Project

    return get_object_or_404(
        Project.objects.select_related("organization", "manager"),
        pk=project_id,
    )


def project_financial_report(project):
    """يبني كائن التقرير المالي الكامل لمشروع (DOMAIN_CONTRACT §6)."""
    from apps.contributions.models import Installment, Subscription
    from apps.finance.models import (
        Expense,
        InKindContribution,
        Payment,
        Revenue,
    )

    today = timezone.now().date()

    # الإيرادات المعتمدة (النقدي المحصّل فعليًا).
    approved_revenues = Revenue.objects.filter(
        project=project, status="approved"
    )
    collected = _money_sum(approved_revenues, "amount")

    # الإيرادات حسب النوع.
    revenues_by_type = list(
        approved_revenues.values("revenue_type")
        .annotate(
            total=Coalesce(
                Sum("amount"),
                Value(ZERO),
                output_field=DecimalField(max_digits=20, decimal_places=2),
            ),
            count=Count("id"),
        )
        .order_by("-total")
    )

    # التعهدات (إجمالي قيمة الاشتراكات النشطة/المكتملة).
    subscriptions_qs = Subscription.objects.filter(project=project)
    pledged = _money_sum(
        subscriptions_qs.filter(status__in=("active", "completed")), "total_value"
    )

    # المصروفات المعتمدة/المدفوعة.
    settled_expenses = Expense.objects.filter(
        project=project, status__in=("approved", "paid")
    )
    expenses_total = _money_sum(settled_expenses, "total_amount")

    # المصروفات حسب التصنيف.
    expenses_by_category = list(
        settled_expenses.values("category")
        .annotate(
            total=Coalesce(
                Sum("total_amount"),
                Value(ZERO),
                output_field=DecimalField(max_digits=20, decimal_places=2),
            ),
            count=Count("id"),
        )
        .order_by("-total")
    )

    # المساهمات العينية المقبولة/المستلمة/المستخدمة.
    inkind_qs = InKindContribution.objects.filter(
        project=project,
        status__in=("accepted", "received", "used_partial", "used_full"),
    )
    inkind_value = _money_sum(inkind_qs, "estimated_value")

    # الدفعات المعلّقة (بانتظار الاعتماد).
    pending_payments_qs = Payment.objects.filter(project=project, status="pending")
    pending_payments = {
        "count": pending_payments_qs.count(),
        "amount": _money_sum(pending_payments_qs, "amount"),
    }

    # الفواتير الناقصة: مصروفات بلا رقم فاتورة أو بلا ملف فاتورة.
    missing_invoices_qs = Expense.objects.filter(project=project).filter(
        Q(invoice_number="") | Q(invoice_file="") | Q(invoice_file__isnull=True)
    )
    missing_invoices = {
        "count": missing_invoices_qs.count(),
        "amount": _money_sum(missing_invoices_qs, "total_amount"),
    }

    # تجاوزات الميزانية (البنود التي تجاوز إنفاقها+التزامها المعتمد).
    budget_overruns = _budget_overruns(project)

    # المتأخرات (استحقاقات فات موعدها ولم تُسدَّد بالكامل).
    overdue_qs = Installment.objects.filter(
        subscription__project=project,
        due_date__lt=today,
        status__in=_OPEN_INSTALLMENT_STATUSES,
    )
    overdue_amount = _money_sum(overdue_qs, "amount") - _money_sum(
        overdue_qs, "paid_amount"
    )

    target = project.target_amount or ZERO
    remaining = target - collected
    balance = collected - expenses_total

    return {
        "project": {
            "id": project.pk,
            "reference": project.reference,
            "name": project.name,
            "currency": project.currency,
            "status": project.status,
            "status_display": project.get_status_display(),
            "organization": project.organization_id,
            "organization_name": (
                project.organization.name if project.organization_id else ""
            ),
        },
        "target": target,
        "pledged": pledged,
        "collected": collected,
        "remaining": remaining,
        "expenses": expenses_total,
        "balance": balance,
        "inkind_value": inkind_value,
        "contributors": project.contributors_count,
        "subscriptions": subscriptions_qs.count(),
        "financial_progress": project.financial_progress,
        "execution_progress": project.execution_progress,
        "revenues_by_type": revenues_by_type,
        "expenses_by_category": expenses_by_category,
        "pending_payments": pending_payments,
        "missing_invoices": missing_invoices,
        "budget_overruns": budget_overruns,
        "overdue": {
            "count": overdue_qs.count(),
            "amount": overdue_amount if overdue_amount > ZERO else ZERO,
        },
    }


def _budget_overruns(project):
    """بنود الميزانية التي تجاوز إنفاقها + التزامها المبلغ المعتمد."""
    from apps.finance.models import BudgetItem

    items = (
        BudgetItem.objects.filter(budget__project=project)
        .annotate(
            over=F("spent_amount") + F("committed_amount") - F("approved_amount")
        )
        .filter(over__gt=0)
        .values("id", "name", "approved_amount", "spent_amount", "committed_amount")
    )
    overruns = []
    for item in items:
        overruns.append(
            {
                "id": item["id"],
                "name": item["name"],
                "approved_amount": item["approved_amount"],
                "spent_amount": item["spent_amount"],
                "committed_amount": item["committed_amount"],
                "overrun": (
                    (item["spent_amount"] or ZERO)
                    + (item["committed_amount"] or ZERO)
                    - (item["approved_amount"] or ZERO)
                ),
            }
        )
    return overruns


def project_subscriptions_report(project):
    """قائمة الاشتراكات + قائمة الاستحقاقات المتأخرة (SRS §13.4)."""
    from apps.contributions.models import Installment, Subscription

    today = timezone.now().date()

    subscriptions = list(
        Subscription.objects.filter(project=project)
        .select_related("user", "share_type")
        .annotate(installments_total=Count("installments"))
        .values(
            "id",
            "reference",
            "user_id",
            "user__full_name",
            "contribution_type",
            "quantity",
            "total_value",
            "paid_amount",
            "frequency",
            "start_date",
            "status",
            "installments_total",
        )
        .order_by("-created_at")
    )
    for sub in subscriptions:
        sub["remaining"] = (sub["total_value"] or ZERO) - (
            sub["paid_amount"] or ZERO
        )

    overdue_qs = (
        Installment.objects.filter(
            subscription__project=project,
            due_date__lt=today,
            status__in=_OPEN_INSTALLMENT_STATUSES,
        )
        .select_related("subscription", "subscription__user")
        .order_by("due_date")
    )
    overdue = []
    for inst in overdue_qs:
        overdue.append(
            {
                "installment_id": inst.pk,
                "subscription_id": inst.subscription_id,
                "subscription_reference": inst.subscription.reference,
                "user_id": inst.subscription.user_id,
                "user_name": inst.subscription.user.full_name
                if inst.subscription.user_id
                else "",
                "sequence": inst.sequence,
                "due_date": inst.due_date,
                "amount": inst.amount,
                "paid_amount": inst.paid_amount,
                "remaining": (inst.amount or ZERO) - (inst.paid_amount or ZERO),
                "status": inst.status,
            }
        )

    overdue_amount = _money_sum(overdue_qs, "amount") - _money_sum(
        overdue_qs, "paid_amount"
    )

    return {
        "project": {
            "id": project.pk,
            "reference": project.reference,
            "name": project.name,
        },
        "subscriptions_count": len(subscriptions),
        "subscriptions": subscriptions,
        "overdue_count": len(overdue),
        "overdue_amount": overdue_amount if overdue_amount > ZERO else ZERO,
        "overdue": overdue,
    }


def admin_overview_report():
    """إجماليات المنصة لمدير المنصة (SRS §13.3)."""
    from apps.accounts.models import User
    from apps.contributions.models import Installment
    from apps.finance.models import Expense, Payment, Revenue
    from apps.organizations.models import Organization
    from apps.projects.models import Project

    today = timezone.now().date()

    total_collected = _money_sum(
        Revenue.objects.filter(status="approved"), "amount"
    )
    total_spent = _money_sum(
        Expense.objects.filter(status__in=("approved", "paid")), "total_amount"
    )

    overdue_qs = Installment.objects.filter(
        due_date__lt=today, status__in=_OPEN_INSTALLMENT_STATUSES
    )
    overdue_amount = _money_sum(overdue_qs, "amount") - _money_sum(
        overdue_qs, "paid_amount"
    )

    # المشاريع الأعلى تحصيلًا.
    top_projects = list(
        Project.objects.order_by("-collected_amount").values(
            "id", "reference", "name", "collected_amount", "target_amount"
        )[:10]
    )

    # المشاريع حسب الحالة.
    projects_by_status = list(
        Project.objects.values("status")
        .annotate(count=Count("id"))
        .order_by("-count")
    )

    return {
        "projects": {
            "total": Project.objects.count(),
            "by_status": projects_by_status,
        },
        "organizations": {
            "total": Organization.objects.count(),
            "approved": Organization.objects.filter(status="approved").count(),
        },
        "users": {
            "total": User.objects.count(),
            "active": User.objects.filter(is_active=True).count(),
        },
        "total_collected": total_collected,
        "total_spent": total_spent,
        "balance": total_collected - total_spent,
        "pending_payments": Payment.objects.filter(status="pending").count(),
        "overdue": {
            "count": overdue_qs.count(),
            "amount": overdue_amount if overdue_amount > ZERO else ZERO,
        },
        "top_projects": top_projects,
    }
