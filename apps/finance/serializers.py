"""Serializers for the finance app.

Sensitive banking data (bank_account / iban) is write-only so it is never
leaked in list/detail responses. The public verify serializer exposes only the
minimal safe subset (SRS §8.1).
"""
from rest_framework import serializers

from apps.finance.models import (
    BudgetItem,
    Expense,
    ExpenseApproval,
    InKindContribution,
    InKindImage,
    Payment,
    PaymentAllocation,
    ProjectBudget,
    Receipt,
    Revenue,
    Supplier,
)


class SupplierSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Supplier
        fields = [
            "id",
            "name",
            "supplier_type",
            "phone",
            "email",
            "tax_number",
            "commercial_register",
            "address",
            "bank_name",
            "bank_account",
            "iban",
            "status",
            "status_display",
            "organization",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "bank_account": {"write_only": True},
            "iban": {"write_only": True},
        }


class PaymentAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentAllocation
        fields = ["id", "payment", "installment", "amount", "created_at"]
        read_only_fields = ["id", "created_at"]


class PaymentSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    method_display = serializers.CharField(source="get_method_display", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    allocations = PaymentAllocationSerializer(many=True, read_only=True)
    allocated_amount = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True
    )

    class Meta:
        model = Payment
        fields = [
            "id",
            "reference",
            "project",
            "project_name",
            "user",
            "subscription",
            "amount",
            "method",
            "method_display",
            "date",
            "reference_number",
            "receiving_account",
            "proof",
            "status",
            "status_display",
            "submitted_by",
            "reviewed_by",
            "rejection_reason",
            "notes",
            "idempotency_key",
            "allocations",
            "allocated_amount",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reference",
            "status",
            "submitted_by",
            "reviewed_by",
            "rejection_reason",
            "created_at",
            "updated_at",
        ]


class RevenueSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    revenue_type_display = serializers.CharField(
        source="get_revenue_type_display", read_only=True
    )
    project_name = serializers.CharField(source="project.name", read_only=True)

    class Meta:
        model = Revenue
        fields = [
            "id",
            "reference",
            "project",
            "project_name",
            "revenue_type",
            "revenue_type_display",
            "user",
            "external_name",
            "external_phone",
            "payment",
            "amount",
            "date",
            "method",
            "reference_number",
            "receiving_account",
            "description",
            "is_public",
            "status",
            "status_display",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "reference", "status", "created_at", "updated_at"]
        extra_kwargs = {"external_phone": {"write_only": True}}


class InKindImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = InKindImage
        fields = ["id", "contribution", "image", "created_at"]
        read_only_fields = ["id", "created_at"]


class InKindContributionSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    images = InKindImageSerializer(many=True, read_only=True)

    class Meta:
        model = InKindContribution
        fields = [
            "id",
            "reference",
            "project",
            "project_name",
            "name",
            "category",
            "description",
            "quantity",
            "unit",
            "estimated_value",
            "user",
            "external_name",
            "date",
            "received_by",
            "location",
            "count_in_progress",
            "is_public",
            "status",
            "status_display",
            "images",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "reference", "created_at", "updated_at"]


class ReceiptSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    verify_url = serializers.CharField(read_only=True)

    class Meta:
        model = Receipt
        fields = [
            "id",
            "code",
            "payment",
            "project",
            "project_name",
            "user",
            "amount",
            "issued_at",
            "pdf",
            "verify_url",
            "created_at",
        ]
        read_only_fields = fields


class PublicReceiptVerifySerializer(serializers.ModelSerializer):
    """Public verification — exposes ONLY the safe subset (SRS §8.1).

    Never phone, bank account, or proof of payment.
    """

    project = serializers.CharField(source="project.name", read_only=True)
    organization = serializers.SerializerMethodField()
    date = serializers.DateTimeField(source="issued_at", read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Receipt
        fields = ["status", "project", "organization", "amount", "date"]

    def get_organization(self, obj):
        org = getattr(obj.project, "organization", None)
        return getattr(org, "name", "") if org else ""

    def get_status(self, obj):
        payment = getattr(obj, "payment", None)
        if payment and payment.status == Payment.Status.REVERSED:
            return "reversed"
        return "valid"


class BudgetItemSerializer(serializers.ModelSerializer):
    remaining = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True
    )
    spend_ratio = serializers.DecimalField(
        max_digits=7, decimal_places=2, read_only=True
    )

    class Meta:
        model = BudgetItem
        fields = [
            "id",
            "budget",
            "name",
            "approved_amount",
            "spent_amount",
            "committed_amount",
            "alert_threshold",
            "remaining",
            "spend_ratio",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "spent_amount", "committed_amount", "created_at", "updated_at"]


class ProjectBudgetSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    items = BudgetItemSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectBudget
        fields = [
            "id",
            "reference",
            "project",
            "total_amount",
            "status",
            "status_display",
            "note",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "reference", "created_at", "updated_at"]


class ExpenseApprovalSerializer(serializers.ModelSerializer):
    decision_display = serializers.CharField(
        source="get_decision_display", read_only=True
    )

    class Meta:
        model = ExpenseApproval
        fields = [
            "id",
            "expense",
            "step_role",
            "approver",
            "decision",
            "decision_display",
            "note",
            "decided_at",
            "created_at",
        ]
        read_only_fields = fields


class ExpenseSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    tier_display = serializers.CharField(source="get_tier_display", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    supplier_name = serializers.CharField(
        source="supplier.name", default="", read_only=True
    )
    approvals = ExpenseApprovalSerializer(many=True, read_only=True)
    invoice_required = serializers.BooleanField(read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id",
            "reference",
            "project",
            "project_name",
            "category",
            "supplier",
            "supplier_name",
            "budget_item",
            "stage",
            "invoice_number",
            "invoice_date",
            "amount_before_tax",
            "tax_amount",
            "total_amount",
            "payment_date",
            "payment_method",
            "payment_reference",
            "description",
            "invoice_file",
            "status",
            "status_display",
            "created_by",
            "tier",
            "tier_display",
            "invoice_required",
            "approvals",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reference",
            "status",
            "created_by",
            "tier",
            "payment_date",
            "payment_method",
            "payment_reference",
            "created_at",
            "updated_at",
        ]
