from rest_framework import serializers

from apps.audit.models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.display_name", default="", read_only=True)
    action_display = serializers.CharField(source="get_action_display", read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "user_name",
            "action",
            "action_display",
            "entity_type",
            "entity_id",
            "summary",
            "old_values",
            "new_values",
            "ip_address",
            "created_at",
        ]
        read_only_fields = fields
