"""DRF ViewSets for communications (SRS §14, §15)."""
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.communications.models import (
    Campaign,
    Notification,
    OutboxMessage,
    WhatsAppTemplate,
)
from apps.communications.serializers import (
    CampaignRecipientSerializer,
    CampaignSerializer,
    NotificationSerializer,
    OutboxMessageSerializer,
    WhatsAppTemplateSerializer,
)
from apps.communications.services import (
    build_campaign_body,
    enqueue_message,
    resolve_campaign_recipients,
    send_campaign,
)
from apps.core.exceptions import BusinessRuleError
from apps.core.permissions import IsPlatformAdmin
from apps.core.roles import Roles


class WhatsAppTemplateViewSet(viewsets.ModelViewSet):
    """Manage WhatsApp templates (platform admin)."""

    queryset = WhatsAppTemplate.objects.all()
    serializer_class = WhatsAppTemplateSerializer
    permission_classes = [IsPlatformAdmin]
    filterset_fields = ["is_active", "key"]
    search_fields = ["key", "name", "body"]
    ordering_fields = ["key", "created_at"]


class OutboxMessageViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """Read-only view of the Outbox (platform admin)."""

    queryset = OutboxMessage.objects.select_related("campaign", "user").all()
    serializer_class = OutboxMessageSerializer
    permission_classes = [IsPlatformAdmin]
    filterset_fields = ["status", "kind", "campaign"]
    search_fields = ["phone", "body", "external_ref"]
    ordering_fields = ["created_at", "sent_at", "attempts"]


class NotificationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """A user reads their own notifications and marks them read (SRS §16)."""

    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["is_read"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        user = self.request.user
        if not (user and user.is_authenticated):
            return Notification.objects.none()
        return Notification.objects.filter(user=user)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=["is_read", "updated_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"updated": updated})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"unread": count})


class CampaignViewSet(viewsets.ModelViewSet):
    """Manage WhatsApp campaigns (staff, scoped to owned/managed projects)."""

    serializer_class = CampaignSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["project", "status", "audience"]
    search_fields = ["name", "reference"]
    ordering_fields = ["created_at", "scheduled_at"]

    def get_queryset(self):
        user = self.request.user
        qs = Campaign.objects.select_related("project", "template").prefetch_related(
            "recipients"
        )
        if not (user and user.is_authenticated):
            return qs.none()
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        if user.role not in Roles.STAFF_ROLES:
            return qs.none()
        # Scope to projects the user manages or projects of their organization.
        from django.db.models import Q

        scope = Q(project__manager=user)
        if getattr(user, "organization_id", None):
            scope |= Q(project__organization_id=user.organization_id)
        return qs.filter(scope).distinct()

    def _check_staff(self):
        user = self.request.user
        if user.role not in Roles.STAFF_ROLES:
            raise BusinessRuleError(
                "هذه العملية متاحة للطاقم فقط.", code="forbidden", status_code=403
            )

    def perform_create(self, serializer):
        self._check_staff()
        serializer.save()

    @action(detail=True, methods=["get", "post"])
    def preview(self, request, pk=None):
        """Return the rendered body and resolved audience size without sending."""
        campaign = self.get_object()
        recipients = resolve_campaign_recipients(campaign)
        return Response(
            {
                "body": build_campaign_body(campaign),
                "audience": campaign.audience,
                "recipients_count": len(recipients),
                "sample": [phone for _, phone in recipients[:10]],
            }
        )

    @action(detail=True, methods=["post"])
    def test_send(self, request, pk=None):
        """Enqueue a single test message to the caller (or a provided phone)."""
        campaign = self.get_object()
        phone = request.data.get("phone") or getattr(request.user, "phone", "")
        if not phone:
            raise BusinessRuleError("رقم الهاتف مطلوب للاختبار.", code="phone_required")
        enqueue_message(
            phone=phone,
            body="[اختبار] " + build_campaign_body(campaign),
            kind="campaign",
            user=request.user,
        )
        return Response({"detail": "تمت جدولة رسالة اختبار.", "phone": phone})

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """draft/pending → approved (or scheduled if a schedule is set)."""
        self._check_staff()
        campaign = self.get_object()
        if campaign.status not in {Campaign.Status.DRAFT, Campaign.Status.PENDING}:
            raise BusinessRuleError(
                "لا يمكن اعتماد الحملة في حالتها الحالية.", code="invalid_status"
            )
        old_status = campaign.status
        campaign.status = (
            Campaign.Status.SCHEDULED if campaign.scheduled_at else Campaign.Status.APPROVED
        )
        campaign.save(update_fields=["status", "updated_at"])
        record(
            AuditLog.Action.APPROVE,
            campaign,
            summary=f"اعتماد حملة {campaign.reference}",
            old={"status": old_status},
            new={"status": campaign.status},
        )
        return Response(self.get_serializer(campaign).data)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        """Build recipients + Outbox messages for an approved/scheduled campaign."""
        self._check_staff()
        campaign = self.get_object()
        if campaign.status not in {
            Campaign.Status.APPROVED,
            Campaign.Status.SCHEDULED,
        }:
            raise BusinessRuleError(
                "يجب اعتماد الحملة قبل الإرسال.", code="not_approved"
            )
        old_status = campaign.status
        count = send_campaign(campaign)
        record(
            AuditLog.Action.SEND,
            campaign,
            summary=f"إرسال حملة {campaign.reference} إلى {count} مستلم",
            old={"status": old_status},
            new={"status": campaign.status, "recipients": count},
        )
        return Response(
            {
                "detail": "تمت جدولة رسائل الحملة.",
                "recipients_count": count,
                "status": campaign.status,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        self._check_staff()
        campaign = self.get_object()
        if campaign.status in {Campaign.Status.COMPLETED, Campaign.Status.SENDING}:
            raise BusinessRuleError(
                "لا يمكن إلغاء الحملة في حالتها الحالية.", code="invalid_status"
            )
        old_status = campaign.status
        campaign.status = Campaign.Status.CANCELLED
        campaign.save(update_fields=["status", "updated_at"])
        record(
            AuditLog.Action.UPDATE,
            campaign,
            summary=f"إلغاء حملة {campaign.reference}",
            old={"status": old_status},
            new={"status": campaign.status},
        )
        return Response(self.get_serializer(campaign).data)

    @action(detail=True, methods=["get"])
    def recipients(self, request, pk=None):
        campaign = self.get_object()
        qs = campaign.recipients.select_related("user").all()
        page = self.paginate_queryset(qs)
        serializer = CampaignRecipientSerializer(
            page if page is not None else qs, many=True
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)
