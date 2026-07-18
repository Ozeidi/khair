"""ViewSets: staff CRUD + lifecycle actions and transparency-aware public reads."""
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.core.exceptions import BusinessRuleError
from apps.core.permissions import IsPlatformAdmin, ReadOnly
from apps.core.roles import Roles
from apps.projects import services
from apps.projects.models import (
    Project,
    ProjectCategory,
    ProjectStage,
    ProjectUpdate,
    TransparencySetting,
)
from apps.projects.serializers import (
    ProjectCategorySerializer,
    ProjectReviewSerializer,
    ProjectSerializer,
    ProjectStageSerializer,
    ProjectUpdateSerializer,
    PublicCategorySerializer,
    PublicProjectDetailSerializer,
    PublicProjectListSerializer,
    TransparencySettingSerializer,
    ToggleContributionsSerializer,
)


def _scoped_projects(user):
    """المشاريع التي يملك المستخدم صلاحية رؤيتها (§10.8)."""
    qs = Project.objects.select_related("organization", "category", "manager")
    if not (user and user.is_authenticated):
        return qs.none()
    if user.role == Roles.PLATFORM_ADMIN:
        return qs
    # مدير الجهة يرى مشاريع جهته؛ البقية يرون مشاريعهم أو مشاريع جهتهم.
    conditions = Q(manager=user)
    if user.organization_id:
        conditions |= Q(organization_id=user.organization_id)
    return qs.filter(conditions).distinct()


class ProjectCategoryViewSet(viewsets.ModelViewSet):
    """تصنيفات المشاريع: قراءة للجميع المصادقين، كتابة للمدير (§7.4)."""

    queryset = ProjectCategory.objects.all()
    serializer_class = ProjectCategorySerializer
    filterset_fields = ["order"]
    search_fields = ["name"]
    ordering_fields = ["order", "name"]

    def get_queryset(self):
        return ProjectCategory.objects.annotate(projects_count=Count("projects"))

    def get_permissions(self):
        if self.request.method in ("GET", "HEAD", "OPTIONS"):
            return [IsAuthenticated()]
        return [IsPlatformAdmin()]


class ProjectViewSet(viewsets.ModelViewSet):
    """إدارة المشاريع + أفعال دورة الحياة (§7.4, §9.2)."""

    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "organization", "category", "contributions_enabled"]
    search_fields = ["name", "reference", "short_description", "location", "state"]
    ordering_fields = ["created_at", "target_amount", "collected_amount", "published_at"]

    def get_queryset(self):
        return _scoped_projects(self.request.user)

    def perform_create(self, serializer):
        project = serializer.save()
        record(
            AuditLog.Action.CREATE,
            project,
            summary="إنشاء مشروع",
            new={"name": project.name, "status": project.status},
        )

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        project = serializer.save()
        record(
            AuditLog.Action.UPDATE,
            project,
            summary="تعديل بيانات المشروع",
            old={"status": old_status},
            new={"status": project.status},
        )

    # ------------------------------------------------------ lifecycle actions
    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        project = self.get_object()
        services.submit_project(project, user=request.user)
        return Response(ProjectSerializer(project, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsPlatformAdmin])
    def approve(self, request, pk=None):
        project = self.get_object()
        services.approve_project(project, user=request.user)
        return Response(ProjectSerializer(project, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsPlatformAdmin])
    def reject(self, request, pk=None):
        project = self.get_object()
        payload = ProjectReviewSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        services.reject_project(
            project, note=payload.validated_data["note"], user=request.user
        )
        return Response(ProjectSerializer(project, context={"request": request}).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="return_for_edits",
        permission_classes=[IsPlatformAdmin],
    )
    def return_for_edits(self, request, pk=None):
        project = self.get_object()
        payload = ProjectReviewSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        services.return_project_for_edits(
            project, note=payload.validated_data["note"], user=request.user
        )
        return Response(ProjectSerializer(project, context={"request": request}).data)

    @action(detail=True, methods=["post"], permission_classes=[IsPlatformAdmin])
    def suspend(self, request, pk=None):
        project = self.get_object()
        payload = ProjectReviewSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        services.suspend_project(
            project, note=payload.validated_data["note"], user=request.user
        )
        return Response(ProjectSerializer(project, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="toggle_contributions")
    def toggle_contributions(self, request, pk=None):
        project = self.get_object()
        payload = ToggleContributionsSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        services.toggle_contributions(
            project, enabled=payload.validated_data["enabled"], user=request.user
        )
        return Response(ProjectSerializer(project, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="validate_stages")
    def validate_stages(self, request, pk=None):
        """يتحقق من مجموع أوزان المراحل = 100٪ (§7.11)."""
        project = self.get_object()
        total = services.stage_weights_total(project)
        valid = True
        error = ""
        try:
            services.validate_stage_weights(project)
        except BusinessRuleError as exc:
            valid = False
            error = exc.message
        return Response({"total_weight": total, "valid": valid, "error": error})


class ProjectStageViewSet(viewsets.ModelViewSet):
    """مراحل التنفيذ (§7.11)."""

    serializer_class = ProjectStageSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["project", "status"]
    ordering_fields = ["order", "created_at"]

    def get_queryset(self):
        projects = _scoped_projects(self.request.user)
        return (
            ProjectStage.objects.filter(project__in=projects)
            .select_related("project", "responsible")
        )

    def perform_create(self, serializer):
        stage = serializer.save()
        record(AuditLog.Action.CREATE, stage, summary="إضافة مرحلة")

    def perform_update(self, serializer):
        stage = serializer.save()
        stage.project.recalculate_execution()
        record(AuditLog.Action.UPDATE, stage, summary="تعديل مرحلة")


class ProjectUpdateViewSet(viewsets.ModelViewSet):
    """تحديثات المشروع + فعل النشر (§7.11, §9.7)."""

    serializer_class = ProjectUpdateSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["project", "stage", "status", "visibility"]
    search_fields = ["title", "body"]
    ordering_fields = ["created_at", "published_at"]

    def get_queryset(self):
        projects = _scoped_projects(self.request.user)
        return (
            ProjectUpdate.objects.filter(project__in=projects)
            .select_related("project", "stage", "author")
            .prefetch_related("images")
        )

    def perform_create(self, serializer):
        update = serializer.save(author=self.request.user)
        record(AuditLog.Action.CREATE, update, summary="إنشاء تحديث مشروع")

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        update = self.get_object()
        if update.status == ProjectUpdate.Status.PUBLISHED:
            raise BusinessRuleError(
                "التحديث منشور بالفعل.", code="already_published"
            )
        update.publish()
        record(
            AuditLog.Action.UPDATE,
            update,
            summary="نشر تحديث المشروع",
            new={"status": update.status},
        )
        return Response(
            ProjectUpdateSerializer(update, context={"request": request}).data
        )


class TransparencyViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """إعدادات الشفافية لصاحب المشروع (§7.12)."""

    serializer_class = TransparencySettingSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["project"]

    def get_queryset(self):
        projects = _scoped_projects(self.request.user)
        return TransparencySetting.objects.filter(
            project__in=projects
        ).select_related("project")

    def perform_update(self, serializer):
        old = TransparencySettingSerializer(serializer.instance).data
        setting = serializer.save(updated_by=self.request.user)
        record(
            AuditLog.Action.UPDATE,
            setting,
            summary="تعديل إعدادات الشفافية",
            old=old,
            new=TransparencySettingSerializer(setting).data,
        )


# =========================================================================
# Public (AllowAny) endpoints — read-only, transparency-respecting (§7.5)
# =========================================================================
class PublicProjectViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """المشاريع المنشورة للعامة، البحث عبر ``public_slug`` (§7.5)."""

    permission_classes = [AllowAny]
    lookup_field = "public_slug"
    filterset_fields = ["category", "state", "status"]
    search_fields = ["name", "short_description", "location", "state"]
    ordering_fields = [
        "published_at",
        "collected_amount",
        "financial_progress",
        "created_at",
    ]

    def get_queryset(self):
        return (
            Project.objects.filter(status__in=Project.PUBLIC_STATUSES)
            .select_related("organization", "category")
            .prefetch_related("transparency", "stages", "updates__images")
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return PublicProjectDetailSerializer
        return PublicProjectListSerializer


class PublicCategoryViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet
):
    """تصنيفات المشاريع للعامة مع عدد المشاريع المنشورة."""

    permission_classes = [AllowAny]
    serializer_class = PublicCategorySerializer
    ordering_fields = ["order", "name"]

    def get_queryset(self):
        return ProjectCategory.objects.annotate(
            projects_count=Count(
                "projects",
                filter=Q(projects__status__in=Project.PUBLIC_STATUSES),
            )
        ).order_by("order", "name")


class PublicStatsViewSet(viewsets.ViewSet):
    """إجماليات المنصة العامة (§7.5, §8.1)."""

    permission_classes = [AllowAny]

    def list(self, request):
        published = Project.objects.filter(status__in=Project.PUBLIC_STATUSES)
        agg = published.aggregate(
            projects_count=Count("id"),
            total_target=Sum("target_amount"),
            total_collected=Sum("collected_amount"),
            total_contributors=Sum("contributors_count"),
            total_beneficiaries=Sum("beneficiaries_count"),
        )
        completed = published.filter(status=Project.Status.COMPLETED).count()
        active = published.filter(status=Project.Status.ACTIVE).count()
        return Response(
            {
                "projects_count": agg["projects_count"] or 0,
                "active_projects": active,
                "completed_projects": completed,
                "total_target": agg["total_target"] or 0,
                "total_collected": agg["total_collected"] or 0,
                "total_contributors": agg["total_contributors"] or 0,
                "total_beneficiaries": agg["total_beneficiaries"] or 0,
                "categories_count": ProjectCategory.objects.count(),
                "generated_at": timezone.now(),
            }
        )
