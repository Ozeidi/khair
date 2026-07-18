from django.contrib import admin

from apps.audit.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "entity_type", "entity_id", "summary")
    list_filter = ("action", "entity_type")
    search_fields = ("entity_type", "entity_id", "summary")
    readonly_fields = [f.name for f in AuditLog._meta.fields]
    date_hierarchy = "created_at"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False  # Audit log is immutable (SRS §7.15).

    def has_change_permission(self, request, obj=None):
        return False
