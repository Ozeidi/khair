"""Admin registrations. Approved financial records are protected from deletion
and from editing once they reach an immutable state."""
from django.contrib import admin

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


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "supplier_type", "phone", "status", "organization")
    list_filter = ("status", "supplier_type")
    search_fields = ("name", "phone", "email", "tax_number")


class PaymentAllocationInline(admin.TabularInline):
    model = PaymentAllocation
    extra = 0
    autocomplete_fields = ("installment",)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("reference", "project", "amount", "method", "status", "date")
    list_filter = ("status", "method")
    search_fields = ("reference", "reference_number")
    date_hierarchy = "date"
    readonly_fields = ("reference",)
    inlines = [PaymentAllocationInline]

    def has_delete_permission(self, request, obj=None):
        if obj is not None and obj.status in {
            Payment.Status.APPROVED,
            Payment.Status.REVERSED,
        }:
            return False
        return super().has_delete_permission(request, obj)


@admin.register(Revenue)
class RevenueAdmin(admin.ModelAdmin):
    list_display = ("reference", "project", "revenue_type", "amount", "status", "date")
    list_filter = ("status", "revenue_type", "is_public")
    search_fields = ("reference", "external_name", "reference_number")
    date_hierarchy = "date"
    readonly_fields = ("reference",)

    def has_delete_permission(self, request, obj=None):
        if obj is not None and obj.status == Revenue.Status.APPROVED:
            return False
        return super().has_delete_permission(request, obj)


class InKindImageInline(admin.TabularInline):
    model = InKindImage
    extra = 0


@admin.register(InKindContribution)
class InKindContributionAdmin(admin.ModelAdmin):
    list_display = ("reference", "project", "name", "quantity", "unit", "status", "date")
    list_filter = ("status", "is_public", "count_in_progress")
    search_fields = ("reference", "name", "external_name")
    readonly_fields = ("reference",)
    inlines = [InKindImageInline]


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("code", "project", "amount", "issued_at")
    search_fields = ("code",)
    date_hierarchy = "issued_at"
    readonly_fields = ("code", "issued_at")

    def has_delete_permission(self, request, obj=None):
        return False  # Receipts are permanent records.


class BudgetItemInline(admin.TabularInline):
    model = BudgetItem
    extra = 0


@admin.register(ProjectBudget)
class ProjectBudgetAdmin(admin.ModelAdmin):
    list_display = ("reference", "project", "total_amount", "status")
    list_filter = ("status",)
    search_fields = ("reference",)
    readonly_fields = ("reference",)
    inlines = [BudgetItemInline]


@admin.register(BudgetItem)
class BudgetItemAdmin(admin.ModelAdmin):
    list_display = ("name", "budget", "approved_amount", "spent_amount", "committed_amount")
    search_fields = ("name",)


class ExpenseApprovalInline(admin.TabularInline):
    model = ExpenseApproval
    extra = 0
    readonly_fields = ("decided_at",)


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("reference", "project", "total_amount", "tier", "status", "invoice_date")
    list_filter = ("status", "tier")
    search_fields = ("reference", "invoice_number", "description")
    date_hierarchy = "invoice_date"
    readonly_fields = ("reference", "tier")
    inlines = [ExpenseApprovalInline]

    def has_delete_permission(self, request, obj=None):
        if obj is not None and obj.status in {
            Expense.Status.APPROVED,
            Expense.Status.PAID,
        }:
            return False
        return super().has_delete_permission(request, obj)
