from django.contrib import admin, messages

from apps.communications.models import (
    Campaign,
    CampaignRecipient,
    Notification,
    OutboxMessage,
    WhatsAppTemplate,
)
from apps.communications.services import seed_templates


@admin.register(WhatsAppTemplate)
class WhatsAppTemplateAdmin(admin.ModelAdmin):
    list_display = ("key", "name", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("key", "name", "body")
    actions = ["seed_standard_templates"]

    @admin.action(description="زرع قوالب واتساب القياسية (SRS §15)")
    def seed_standard_templates(self, request, queryset):
        created = seed_templates()
        self.message_user(
            request, f"تم إنشاء {created} قالبًا جديدًا.", level=messages.SUCCESS
        )


@admin.register(OutboxMessage)
class OutboxMessageAdmin(admin.ModelAdmin):
    list_display = ("phone", "kind", "status", "attempts", "sent_at", "created_at")
    list_filter = ("status", "kind")
    search_fields = ("phone", "body", "external_ref", "error")
    readonly_fields = ("sent_at", "external_ref", "attempts", "created_at", "updated_at")
    autocomplete_fields = ("campaign", "user")
    date_hierarchy = "created_at"


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "title", "is_read", "created_at")
    list_filter = ("is_read",)
    search_fields = ("title", "body", "user__phone", "user__full_name")
    autocomplete_fields = ("user",)


class CampaignRecipientInline(admin.TabularInline):
    model = CampaignRecipient
    extra = 0
    fields = ("user", "phone", "status")
    readonly_fields = ("user", "phone", "status")
    can_delete = False


@admin.register(Campaign)
class CampaignAdmin(admin.ModelAdmin):
    list_display = ("reference", "name", "project", "audience", "status", "scheduled_at")
    list_filter = ("status", "audience")
    search_fields = ("reference", "name")
    readonly_fields = ("reference", "created_at", "updated_at")
    autocomplete_fields = ("project", "template")
    inlines = [CampaignRecipientInline]


@admin.register(CampaignRecipient)
class CampaignRecipientAdmin(admin.ModelAdmin):
    list_display = ("campaign", "phone", "user", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("phone", "campaign__reference", "user__phone")
    autocomplete_fields = ("campaign", "user")
