"""DRF serializers for the communications app."""
from rest_framework import serializers

from apps.communications.models import (
    Campaign,
    CampaignRecipient,
    Notification,
    OutboxMessage,
    WhatsAppTemplate,
)


class WhatsAppTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = WhatsAppTemplate
        fields = [
            "id", "key", "name", "body", "is_active",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class OutboxMessageSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = OutboxMessage
        fields = [
            "id", "phone", "body", "kind", "status", "status_display",
            "attempts", "max_attempts", "external_ref", "error",
            "scheduled_at", "sent_at", "campaign", "user",
            "created_at", "updated_at",
        ]
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id", "title", "body", "is_read", "link",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "title", "body", "link", "created_at", "updated_at"]


class CampaignRecipientSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = CampaignRecipient
        fields = ["id", "user", "phone", "status", "status_display", "created_at"]
        read_only_fields = fields


class CampaignSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    recipients_count = serializers.IntegerField(source="recipients.count", read_only=True)

    class Meta:
        model = Campaign
        fields = [
            "id", "reference", "project", "name", "campaign_type",
            "audience", "template", "body", "link", "scheduled_at",
            "status", "status_display", "recipients_count",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "reference", "status", "status_display",
            "recipients_count", "created_at", "updated_at",
        ]
