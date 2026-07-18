from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.core.exceptions import BusinessRuleError
from apps.core.permissions import IsPlatformAdmin
from apps.core.roles import Roles
from apps.organizations.models import (
    Organization,
    OrganizationDocument,
    OrganizationMember,
)
from apps.organizations.serializers import (
    OrganizationDocumentSerializer,
    OrganizationMemberSerializer,
    OrganizationSerializer,
    PublicOrganizationSerializer,
    ReviewNoteSerializer,
)


def _org_scope(user, prefix=""):
    """Q() filter for objects the user can access via an organization.

    ``prefix`` targets the path to the ``Organization`` (e.g. ``"organization__"``
    for related models; empty string when filtering ``Organization`` directly).
    Matches organizations the user manages, is a member of, or belongs to.
    """
    from django.db.models import Q

    scope = Q(**{f"{prefix}manager": user}) | Q(
        **{f"{prefix}members__user": user}
    )
    if getattr(user, "organization_id", None):
        key = f"{prefix}pk" if not prefix else f"{prefix.rstrip('_')}_id"
        scope |= Q(**{key: user.organization_id})
    return scope


class OrganizationViewSet(viewsets.ModelViewSet):
    """إدارة الجهات (staff + platform admin) — DOMAIN_CONTRACT §1, SRS §7.3, §9.1."""

    queryset = Organization.objects.select_related("manager").prefetch_related(
        "documents", "members__user"
    )
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "org_type", "manager"]
    search_fields = ["name", "reference", "phone", "email", "location"]
    ordering_fields = ["created_at", "name", "status"]

    def get_permissions(self):
        if self.action in {"approve", "reject", "return_for_edits"}:
            return [IsPlatformAdmin()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not (user and user.is_authenticated):
            return qs.none()
        # مدير المنصة يرى كل الجهات؛ غيره يرى جهات يديرها أو هو عضو فيها أو ينتمي إليها.
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        return qs.filter(_org_scope(user)).distinct()

    def perform_create(self, serializer):
        # المُنشئ يصبح مسؤول الجهة افتراضيًا ما لم يُحدَّد غير ذلك.
        manager = serializer.validated_data.get("manager") or self.request.user
        organization = serializer.save(manager=manager)
        record(
            AuditLog.Action.CREATE,
            organization,
            summary=f"إنشاء الجهة {organization.name}",
        )

    def perform_update(self, serializer):
        organization = serializer.save()
        record(
            AuditLog.Action.UPDATE,
            organization,
            summary=f"تعديل الجهة {organization.name}",
        )

    def _set_status(self, organization, new_status, action_type, summary, note=None):
        old_status = organization.status
        organization.status = new_status
        update_fields = ["status", "updated_at"]
        if note is not None:
            organization.review_note = note
            update_fields.append("review_note")
        organization.save(update_fields=update_fields)
        record(
            action_type,
            organization,
            summary=summary,
            old={"status": old_status},
            new={"status": new_status},
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        """draft/returned → pending (يقدّم الجهة للتحقق)."""
        organization = self.get_object()
        if organization.status not in {
            Organization.Status.DRAFT,
            Organization.Status.RETURNED,
        }:
            raise BusinessRuleError(
                "لا يمكن إرسال الجهة إلا من حالة المسودة أو المعادة للتعديل.",
                code="invalid_status_transition",
            )
        if not organization.manager_id:
            raise BusinessRuleError(
                "يلزم تعيين مسؤول للجهة قبل الإرسال.", code="missing_manager"
            )
        if not organization.phone:
            raise BusinessRuleError(
                "يلزم وجود وسيلة تواصل قبل الإرسال.", code="missing_contact"
            )
        self._set_status(
            organization,
            Organization.Status.PENDING,
            AuditLog.Action.SUBMIT,
            summary=f"إرسال الجهة {organization.name} للتحقق",
        )
        return Response(self.get_serializer(organization).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """pending → approved (مدير المنصة فقط)."""
        organization = self.get_object()
        if organization.status != Organization.Status.PENDING:
            raise BusinessRuleError(
                "لا يمكن اعتماد جهة ليست بانتظار التحقق.",
                code="invalid_status_transition",
            )
        self._set_status(
            organization,
            Organization.Status.APPROVED,
            AuditLog.Action.APPROVE,
            summary=f"اعتماد الجهة {organization.name}",
            note="",
        )
        return Response(self.get_serializer(organization).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """pending → rejected (مدير المنصة فقط)."""
        organization = self.get_object()
        if organization.status != Organization.Status.PENDING:
            raise BusinessRuleError(
                "لا يمكن رفض جهة ليست بانتظار التحقق.",
                code="invalid_status_transition",
            )
        note_serializer = ReviewNoteSerializer(data=request.data)
        note_serializer.is_valid(raise_exception=True)
        self._set_status(
            organization,
            Organization.Status.REJECTED,
            AuditLog.Action.REJECT,
            summary=f"رفض الجهة {organization.name}",
            note=note_serializer.validated_data.get("review_note", ""),
        )
        return Response(self.get_serializer(organization).data)

    @action(detail=True, methods=["post"])
    def return_for_edits(self, request, pk=None):
        """pending → returned (مدير المنصة فقط)."""
        organization = self.get_object()
        if organization.status != Organization.Status.PENDING:
            raise BusinessRuleError(
                "لا يمكن إعادة جهة ليست بانتظار التحقق.",
                code="invalid_status_transition",
            )
        note_serializer = ReviewNoteSerializer(data=request.data)
        note_serializer.is_valid(raise_exception=True)
        self._set_status(
            organization,
            Organization.Status.RETURNED,
            AuditLog.Action.RETURN,
            summary=f"إعادة الجهة {organization.name} للتعديل",
            note=note_serializer.validated_data.get("review_note", ""),
        )
        return Response(self.get_serializer(organization).data)


class OrganizationMemberViewSet(viewsets.ModelViewSet):
    """أعضاء الجهات (staff). يُصفّى حسب الجهة."""

    queryset = OrganizationMember.objects.select_related("user", "organization")
    serializer_class = OrganizationMemberSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["organization", "role", "user"]
    search_fields = ["user__full_name", "user__phone"]
    ordering_fields = ["created_at", "role"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not (user and user.is_authenticated):
            return qs.none()
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        return qs.filter(_org_scope(user, prefix="organization__")).distinct()

    def perform_create(self, serializer):
        member = serializer.save()
        record(
            AuditLog.Action.CREATE,
            member,
            summary=f"إضافة العضو {member.user} إلى {member.organization}",
        )

    def perform_destroy(self, instance):
        record(
            AuditLog.Action.DELETE,
            instance,
            summary=f"إزالة العضو {instance.user} من {instance.organization}",
        )
        instance.delete()


class OrganizationDocumentViewSet(viewsets.ModelViewSet):
    """مستندات التحقق للجهات (staff). يُصفّى حسب الجهة."""

    queryset = OrganizationDocument.objects.select_related("organization")
    serializer_class = OrganizationDocumentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["organization"]
    search_fields = ["title"]
    ordering_fields = ["created_at", "title"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not (user and user.is_authenticated):
            return qs.none()
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        return qs.filter(_org_scope(user, prefix="organization__")).distinct()

    def perform_create(self, serializer):
        document = serializer.save()
        record(
            AuditLog.Action.CREATE,
            document,
            summary=f"رفع مستند {document.title} للجهة {document.organization}",
        )


class PublicOrganizationViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """قراءة عامة للجهات المعتمدة فقط (AllowAny) — SRS §7.5, §8.1."""

    queryset = Organization.objects.filter(
        status=Organization.Status.APPROVED
    ).order_by("-created_at")
    serializer_class = PublicOrganizationSerializer
    permission_classes = [AllowAny]
    filterset_fields = ["org_type"]
    search_fields = ["name", "location"]
    ordering_fields = ["created_at", "name"]
