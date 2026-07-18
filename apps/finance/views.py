"""DRF views for the finance app.

Write actions require a finance role; project-scoped reads are limited to the
records owned by / belonging to the requesting user's scope. Payment create and
approve honor an ``Idempotency-Key`` (header or body ``idempotency_key``).
"""
from django.http import FileResponse, Http404
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.core.permissions import IsFinanceRole
from apps.core.roles import Roles
from apps.finance import services
from apps.finance.models import (
    BudgetItem,
    Expense,
    InKindContribution,
    Payment,
    ProjectBudget,
    Receipt,
    Revenue,
    Supplier,
)
from apps.finance.serializers import (
    BudgetItemSerializer,
    ExpenseSerializer,
    InKindContributionSerializer,
    PaymentSerializer,
    ProjectBudgetSerializer,
    PublicReceiptVerifySerializer,
    ReceiptSerializer,
    RevenueSerializer,
    SupplierSerializer,
)


# ---------------------------------------------------------------------------
# Scope helpers
# ---------------------------------------------------------------------------
def _is_staff_role(user):
    return bool(user and user.is_authenticated and user.role in Roles.STAFF_ROLES)


def _scoped_project_ids(user):
    """Project ids the user may see as staff (their org's projects / owned)."""
    from apps.projects.models import Project

    qs = Project.objects.all()
    if user.role == Roles.PLATFORM_ADMIN:
        return qs.values_list("id", flat=True)
    if user.organization_id:
        return qs.filter(organization_id=user.organization_id).values_list(
            "id", flat=True
        )
    return qs.filter(manager=user).values_list("id", flat=True)


def _get_idempotency_key(request):
    return request.headers.get("Idempotency-Key") or request.data.get(
        "idempotency_key", ""
    )


class FinanceScopedMixin:
    """Shared queryset scoping for finance viewsets keyed on ``project``."""

    permission_classes = [IsAuthenticated, IsFinanceRole]

    def _base_queryset(self):
        return super().get_queryset()

    def get_queryset(self):
        qs = self._base_queryset()
        user = self.request.user
        if not (user and user.is_authenticated):
            return qs.none()
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        if _is_staff_role(user):
            return qs.filter(project_id__in=_scoped_project_ids(user))
        # Contributors only ever see their own records.
        return qs.filter(user=user)


# ---------------------------------------------------------------------------
# Suppliers
# ---------------------------------------------------------------------------
class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.select_related("organization").all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated, IsFinanceRole]
    filterset_fields = ["status", "organization", "supplier_type"]
    search_fields = ["name", "phone", "email", "tax_number"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        if user.organization_id:
            return qs.filter(organization_id=user.organization_id)
        return qs


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------
class PaymentViewSet(FinanceScopedMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.select_related(
        "project", "user", "subscription", "reviewed_by", "submitted_by"
    ).prefetch_related("allocations")
    serializer_class = PaymentSerializer
    filterset_fields = ["status", "project", "method", "subscription", "user"]
    search_fields = ["reference", "reference_number"]
    ordering_fields = ["date", "amount", "created_at"]

    def create(self, request, *args, **kwargs):
        # Idempotency: return the existing payment if the key was seen before.
        key = _get_idempotency_key(request)
        if key:
            existing = Payment.objects.filter(idempotency_key=key).first()
            if existing is not None:
                serializer = self.get_serializer(existing)
                return Response(serializer.data)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        key = _get_idempotency_key(self.request)
        payment = serializer.save(
            submitted_by=self.request.user, idempotency_key=key or ""
        )
        record(
            AuditLog.Action.CREATE,
            payment,
            summary=f"تسجيل الدفعة {payment.reference}",
            user=self.request.user,
        )

    def perform_destroy(self, instance):
        from apps.core.exceptions import BusinessRuleError

        if instance.status in {Payment.Status.APPROVED, Payment.Status.REVERSED}:
            raise BusinessRuleError(
                "لا يمكن حذف دفعة معتمدة أو معكوسة.", code="cannot_delete_approved"
            )
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        payment = self.get_object()
        # Idempotency on approve: if already approved, return it.
        if payment.status == Payment.Status.APPROVED:
            return Response(self.get_serializer(payment).data)
        payment = services.approve_payment(payment, request.user)
        return Response(self.get_serializer(payment).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        payment = self.get_object()
        reason = request.data.get("reason", "")
        payment = services.reject_payment(payment, request.user, reason=reason)
        return Response(self.get_serializer(payment).data)

    @action(detail=True, methods=["post"], url_path="return_for_completion")
    def return_for_completion(self, request, pk=None):
        payment = self.get_object()
        reason = request.data.get("reason", "")
        payment = services.return_payment(payment, request.user, reason=reason)
        return Response(self.get_serializer(payment).data)

    @action(detail=True, methods=["post"])
    def reverse(self, request, pk=None):
        payment = self.get_object()
        reason = request.data.get("reason", "")
        payment = services.reverse_payment(payment, request.user, reason=reason)
        return Response(self.get_serializer(payment).data)


# ---------------------------------------------------------------------------
# Revenues
# ---------------------------------------------------------------------------
class RevenueViewSet(FinanceScopedMixin, viewsets.ModelViewSet):
    queryset = Revenue.objects.select_related("project", "user", "payment")
    serializer_class = RevenueSerializer
    filterset_fields = ["status", "project", "revenue_type", "is_public"]
    search_fields = ["reference", "external_name", "reference_number"]
    ordering_fields = ["date", "amount", "created_at"]

    def perform_create(self, serializer):
        revenue = serializer.save()
        record(
            AuditLog.Action.CREATE,
            revenue,
            summary=f"تسجيل الإيراد {revenue.reference}",
            user=self.request.user,
        )

    def perform_destroy(self, instance):
        from apps.core.exceptions import BusinessRuleError

        if instance.status == Revenue.Status.APPROVED:
            raise BusinessRuleError(
                "لا يمكن حذف إيراد معتمد.", code="cannot_delete_approved"
            )
        super().perform_destroy(instance)


# ---------------------------------------------------------------------------
# In-kind contributions
# ---------------------------------------------------------------------------
class InKindContributionViewSet(FinanceScopedMixin, viewsets.ModelViewSet):
    queryset = InKindContribution.objects.select_related("project", "user").prefetch_related(
        "images"
    )
    serializer_class = InKindContributionSerializer
    filterset_fields = ["status", "project", "is_public", "count_in_progress"]
    search_fields = ["reference", "name", "external_name"]
    ordering_fields = ["date", "estimated_value", "created_at"]

    def perform_create(self, serializer):
        contribution = serializer.save()
        record(
            AuditLog.Action.CREATE,
            contribution,
            summary=f"تسجيل مساهمة عينية {contribution.reference}",
            user=self.request.user,
        )


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------
class ExpenseViewSet(FinanceScopedMixin, viewsets.ModelViewSet):
    queryset = Expense.objects.select_related(
        "project", "supplier", "budget_item", "stage", "created_by"
    ).prefetch_related("approvals")
    serializer_class = ExpenseSerializer
    filterset_fields = ["status", "project", "tier", "supplier", "budget_item"]
    search_fields = ["reference", "invoice_number", "description"]
    ordering_fields = ["invoice_date", "total_amount", "created_at"]

    def get_queryset(self):
        # Expenses have no ``user`` column; scope by project only.
        qs = self._base_queryset()
        user = self.request.user
        if not (user and user.is_authenticated):
            return qs.none()
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        return qs.filter(project_id__in=_scoped_project_ids(user))

    def perform_create(self, serializer):
        expense = serializer.save(created_by=self.request.user)
        record(
            AuditLog.Action.CREATE,
            expense,
            summary=f"إنشاء المصروف {expense.reference}",
            user=self.request.user,
        )

    def perform_destroy(self, instance):
        from apps.core.exceptions import BusinessRuleError

        if instance.status in {Expense.Status.APPROVED, Expense.Status.PAID}:
            raise BusinessRuleError(
                "لا يمكن حذف مصروف معتمد أو مدفوع.", code="cannot_delete_approved"
            )
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        expense = services.submit_expense(self.get_object(), request.user)
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        note = request.data.get("note", "")
        expense = services.approve_expense_step(
            self.get_object(), request.user, note=note
        )
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        reason = request.data.get("reason", "")
        expense = services.reject_expense(self.get_object(), request.user, reason=reason)
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=["post"], url_path="return_for_edits")
    def return_for_edits(self, request, pk=None):
        reason = request.data.get("reason", "")
        expense = services.return_expense(self.get_object(), request.user, reason=reason)
        return Response(self.get_serializer(expense).data)

    @action(detail=True, methods=["post"], url_path="mark_paid")
    def mark_paid(self, request, pk=None):
        expense = services.mark_expense_paid(
            self.get_object(),
            request.user,
            payment_date=request.data.get("payment_date") or None,
            payment_method=request.data.get("payment_method", ""),
            payment_reference=request.data.get("payment_reference", ""),
        )
        return Response(self.get_serializer(expense).data)


# ---------------------------------------------------------------------------
# Budgets / budget items
# ---------------------------------------------------------------------------
class ProjectBudgetViewSet(FinanceScopedMixin, viewsets.ModelViewSet):
    queryset = ProjectBudget.objects.select_related("project").prefetch_related("items")
    serializer_class = ProjectBudgetSerializer
    filterset_fields = ["status", "project"]
    search_fields = ["reference", "note"]
    ordering_fields = ["created_at", "total_amount"]


class BudgetItemViewSet(viewsets.ModelViewSet):
    queryset = BudgetItem.objects.select_related("budget", "budget__project")
    serializer_class = BudgetItemSerializer
    permission_classes = [IsAuthenticated, IsFinanceRole]
    filterset_fields = ["budget"]
    search_fields = ["name"]
    ordering_fields = ["name", "approved_amount"]

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        if not (user and user.is_authenticated):
            return qs.none()
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        return qs.filter(budget__project_id__in=_scoped_project_ids(user))


# ---------------------------------------------------------------------------
# Receipts (read + protected download)
# ---------------------------------------------------------------------------
class ReceiptViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Receipt.objects.select_related("project", "user", "payment")
    serializer_class = ReceiptSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["project", "user"]
    search_fields = ["code"]
    ordering_fields = ["issued_at"]

    def get_queryset(self):
        qs = self.queryset
        user = self.request.user
        if not (user and user.is_authenticated):
            return qs.none()
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        if _is_staff_role(user):
            return qs.filter(project_id__in=_scoped_project_ids(user))
        return qs.filter(user=user)

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        receipt = self.get_object()
        if not receipt.pdf:
            try:
                receipt.generate_pdf()
            except Exception:
                receipt = None
        if not receipt or not receipt.pdf:
            raise Http404("لا يوجد ملف إيصال.")
        record(
            AuditLog.Action.EXPORT,
            receipt,
            summary=f"تنزيل الإيصال {receipt.code}",
            user=request.user,
        )
        return FileResponse(
            receipt.pdf.open("rb"),
            as_attachment=True,
            filename=f"{receipt.code}.pdf",
        )


# ---------------------------------------------------------------------------
# Public receipt verification (AllowAny) — SRS §8.1
# ---------------------------------------------------------------------------
class PublicReceiptVerifyViewSet(
    mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """GET public/receipts/{code}/verify → minimal safe subset only."""

    queryset = Receipt.objects.select_related("project", "project__organization", "payment")
    serializer_class = PublicReceiptVerifySerializer
    permission_classes = [AllowAny]
    lookup_field = "code"

    @action(detail=True, methods=["get"])
    def verify(self, request, code=None):
        receipt = self.get_object()
        return Response(self.get_serializer(receipt).data)
