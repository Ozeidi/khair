"""تسجيل نماذج الأسهم والاشتراكات في لوحة الإدارة."""
from django.contrib import admin

from apps.contributions.models import Installment, ShareType, Subscription


@admin.register(ShareType)
class ShareTypeAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "project",
        "value",
        "frequency",
        "min_quantity",
        "max_quantity",
        "installments_count",
        "order",
        "is_active",
    )
    list_filter = ("frequency", "is_active")
    search_fields = ("name", "description", "project__name")
    list_select_related = ("project",)
    ordering = ("project", "order")


class InstallmentInline(admin.TabularInline):
    model = Installment
    extra = 0
    fields = ("sequence", "due_date", "amount", "paid_amount", "status", "last_reminder_at")
    readonly_fields = ("sequence",)
    ordering = ("sequence",)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "project",
        "user",
        "contribution_type",
        "quantity",
        "total_value",
        "paid_amount",
        "status",
        "start_date",
    )
    list_filter = ("status", "contribution_type", "frequency")
    search_fields = ("reference", "user__full_name", "user__phone", "project__name")
    list_select_related = ("project", "user", "share_type")
    readonly_fields = ("reference", "unit_value", "total_value", "paid_amount")
    raw_id_fields = ("project", "user", "share_type")
    inlines = [InstallmentInline]
    date_hierarchy = "start_date"


@admin.register(Installment)
class InstallmentAdmin(admin.ModelAdmin):
    list_display = (
        "subscription",
        "sequence",
        "due_date",
        "amount",
        "paid_amount",
        "status",
        "last_reminder_at",
    )
    list_filter = ("status", "due_date")
    search_fields = ("subscription__reference",)
    list_select_related = ("subscription",)
    ordering = ("subscription", "sequence")
