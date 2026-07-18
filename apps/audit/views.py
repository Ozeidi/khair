from rest_framework import mixins, viewsets

from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.core.permissions import IsPlatformAdmin


class AuditLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only audit log. Platform admins only (SRS §8.4)."""

    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsPlatformAdmin]
    filterset_fields = ["action", "entity_type", "user"]
    search_fields = ["entity_type", "entity_id", "summary"]
    ordering_fields = ["created_at"]
