"""ViewSets للأسهم والاشتراكات والاستحقاقات (DOMAIN_CONTRACT §3)."""
from decimal import Decimal

from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.contributions.models import Installment, ShareType, Subscription
from apps.contributions.serializers import (
    InstallmentSerializer,
    PublicShareTypeSerializer,
    ShareTypeSerializer,
    SubscriptionCreateSerializer,
    SubscriptionSerializer,
)
from apps.core.exceptions import BusinessRuleError
from apps.core.roles import Roles


def _is_staff(user):
    return bool(user and user.is_authenticated and user.role in Roles.STAFF_ROLES)


class ShareTypeViewSet(viewsets.ModelViewSet):
    """إدارة أنواع الأسهم — طاقم العمل فقط."""

    queryset = ShareType.objects.select_related("project").all()
    serializer_class = ShareTypeSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["project", "is_active", "frequency"]
    search_fields = ["name", "description"]
    ordering_fields = ["order", "value", "created_at"]
    ordering = ["order", "id"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated or user.role == Roles.CONTRIBUTOR:
            return qs.none()
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        # طاقم الجهة/المشروع يرى أنواع أسهم مشاريع جهته.
        if user.organization_id:
            return qs.filter(project__organization_id=user.organization_id)
        return qs.filter(project__manager_id=user.id)


class SubscriptionViewSet(viewsets.ModelViewSet):
    """
    اشتراكات المساهمين. المساهم يرى/ينشئ اشتراكاته؛ الطاقم يرى اشتراكات مشاريعه.
    عند الإنشاء: يحسب الإجمالي، يولّد المرجع والاستحقاقات، يزيد عدّاد المساهمين،
    ويحاول إرسال رسالة تأكيد الاشتراك (Outbox) بأمان.
    """

    queryset = Subscription.objects.select_related(
        "project", "user", "share_type"
    ).prefetch_related("installments")
    permission_classes = [IsAuthenticated]
    filterset_fields = ["project", "user", "status", "contribution_type", "frequency"]
    search_fields = ["reference", "user__full_name", "user__phone", "project__name"]
    ordering_fields = ["created_at", "start_date", "total_value", "paid_amount"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return SubscriptionCreateSerializer
        return SubscriptionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        if user.role in Roles.STAFF_ROLES:
            if user.organization_id:
                return qs.filter(project__organization_id=user.organization_id)
            return qs.filter(project__manager_id=user.id)
        # المساهم: اشتراكاته فقط.
        return qs.filter(user=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        subscription = self._create_subscription(serializer.validated_data)
        out = SubscriptionSerializer(subscription, context=self.get_serializer_context())
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)

    def _create_subscription(self, data):
        user = self.request.user
        share_type = data.get("share_type")
        open_amount = data.pop("open_amount", None)
        quantity = data.get("quantity") or 1

        # المساهم لا يشترك نيابةً عن غيره.
        if not _is_staff(user):
            data["user"] = user

        # حساب قيمة الوحدة والإجمالي من نوع السهم أو المبلغ المفتوح.
        if share_type is not None:
            unit_value = share_type.value
            total_value = unit_value * Decimal(quantity)
            data.setdefault("frequency", share_type.frequency)
            if not data.get("installments_count"):
                data["installments_count"] = share_type.installments_count or 1
        else:
            unit_value = open_amount
            total_value = open_amount
            data["quantity"] = 1
            if not data.get("installments_count"):
                data["installments_count"] = 1

        subscription = Subscription(
            **data,
            unit_value=unit_value,
            total_value=total_value,
        )
        subscription.save()

        subscription.generate_installments()
        self._bump_contributors_count(subscription.project_id)

        record(
            AuditLog.Action.CREATE,
            subscription,
            summary=f"إنشاء اشتراك {subscription.reference}",
        )
        self._enqueue_confirmation(subscription)
        return subscription

    @staticmethod
    def _bump_contributors_count(project_id):
        """يزيد عدّاد المساهمين للمشروع (تحديث ذري)."""
        from apps.projects.models import Project

        Project.objects.filter(pk=project_id).update(
            contributors_count=F("contributors_count") + 1
        )

    @staticmethod
    def _enqueue_confirmation(subscription):
        """يحاول وضع رسالة تأكيد الاشتراك في Outbox — الفشل لا يُفشل الإنشاء."""
        try:
            from apps.communications.services import enqueue_message

            phone = getattr(subscription.user, "phone", "")
            if not phone:
                return
            body = (
                f"مرحبًا {subscription.user.display_name}، تم تسجيل مساهمتك في مشروع "
                f"{subscription.project.name}. عدد الأسهم: {subscription.quantity}، "
                f"إجمالي الالتزام: {subscription.total_value}، "
                f"رقم الاشتراك: {subscription.reference}."
            )
            enqueue_message(
                phone=phone,
                body=body,
                kind="subscription",
                user=subscription.user,
            )
        except Exception:
            # Outbox/communications قد لا يكون متاحًا؛ لا نُفشل الاشتراك.
            pass

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        """إيقاف الاشتراك مؤقتًا."""
        subscription = self.get_object()
        if subscription.status == Subscription.Status.CANCELLED:
            raise BusinessRuleError(
                "لا يمكن إيقاف اشتراك ملغى.", code="invalid_state"
            )
        old = subscription.status
        subscription.status = Subscription.Status.PAUSED
        subscription.save(update_fields=["status", "updated_at"])
        record(
            AuditLog.Action.UPDATE,
            subscription,
            summary="إيقاف الاشتراك",
            old={"status": old},
            new={"status": subscription.status},
        )
        return Response(SubscriptionSerializer(subscription).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """
        إلغاء الاشتراك: يوقف الاستحقاقات المستقبلية فقط ولا يمسّ المدفوعة (SRS قاعدة 19).
        """
        subscription = self.get_object()
        if subscription.status == Subscription.Status.CANCELLED:
            raise BusinessRuleError(
                "الاشتراك ملغى مسبقًا.", code="invalid_state"
            )
        old = subscription.status
        # يحذف فقط الاستحقاقات غير المسدّدة إطلاقًا؛ يترك المسدّدة والمسدّدة جزئيًا.
        future_removed = subscription.installments.filter(paid_amount=0).delete()
        subscription.status = Subscription.Status.CANCELLED
        subscription.save(update_fields=["status", "updated_at"])
        record(
            AuditLog.Action.UPDATE,
            subscription,
            summary="إلغاء الاشتراك (إيقاف الاستحقاقات المستقبلية)",
            old={"status": old},
            new={"status": subscription.status, "removed": future_removed[0]},
        )
        return Response(SubscriptionSerializer(subscription).data)


class InstallmentViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """قراءة الاستحقاقات + إجراء إرسال تذكير (طاقم العمل)."""

    queryset = Installment.objects.select_related(
        "subscription", "subscription__project", "subscription__user"
    )
    serializer_class = InstallmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = {
        "subscription": ["exact"],
        "subscription__project": ["exact"],
        "status": ["exact"],
        "due_date": ["exact", "gte", "lte"],
    }
    ordering_fields = ["due_date", "sequence", "amount"]
    ordering = ["subscription", "sequence"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return qs.none()
        if user.role == Roles.PLATFORM_ADMIN:
            return qs
        if user.role in Roles.STAFF_ROLES:
            if user.organization_id:
                return qs.filter(
                    subscription__project__organization_id=user.organization_id
                )
            return qs.filter(subscription__project__manager_id=user.id)
        return qs.filter(subscription__user=user)

    @action(detail=True, methods=["post"])
    def send_reminder(self, request, pk=None):
        """إرسال تذكير باستحقاق (طاقم العمل فقط) عبر Outbox."""
        installment = self.get_object()
        if not _is_staff(request.user):
            raise BusinessRuleError(
                "إرسال التذكير متاح لطاقم العمل فقط.", code="forbidden", status_code=403
            )

        subscription = installment.subscription
        sent = False
        try:
            from apps.communications.services import enqueue_message

            phone = getattr(subscription.user, "phone", "")
            if phone:
                body = (
                    f"تذكير: لديك استحقاق بمبلغ {installment.remaining} "
                    f"في مشروع {subscription.project.name} "
                    f"بتاريخ {installment.due_date}. رقم الاشتراك: {subscription.reference}."
                )
                enqueue_message(
                    phone=phone,
                    body=body,
                    kind="reminder",
                    user=subscription.user,
                )
                sent = True
        except Exception:
            sent = False

        installment.last_reminder_at = timezone.now()
        installment.save(update_fields=["last_reminder_at", "updated_at"])
        record(
            AuditLog.Action.SEND,
            installment,
            summary="إرسال تذكير استحقاق",
        )
        return Response(
            {
                "detail": "تم إرسال التذكير." if sent else "تم تسجيل التذكير (تعذّر الإرسال).",
                "installment": InstallmentSerializer(installment).data,
            }
        )


class PublicShareTypeViewSet(
    mixins.ListModelMixin, viewsets.GenericViewSet
):
    """قراءة عامة لأنواع الأسهم النشطة لمشروع عبر public_slug."""

    serializer_class = PublicShareTypeSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        slug = self.kwargs.get("project_slug")
        return (
            ShareType.objects.filter(
                project__public_slug=slug, is_active=True
            )
            .order_by("order", "id")
        )

    def list(self, request, *args, **kwargs):
        # يتحقق من وجود المشروع لإرجاع 404 واضحة إن لم يوجد.
        from apps.projects.models import Project

        get_object_or_404(Project, public_slug=self.kwargs.get("project_slug"))
        return super().list(request, *args, **kwargs)
