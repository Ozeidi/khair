"""Serializers for staff CRUD and transparency-aware public output (§7.5, §7.12)."""
from rest_framework import serializers

from apps.projects.models import (
    Project,
    ProjectCategory,
    ProjectStage,
    ProjectUpdate,
    ProjectUpdateImage,
    TransparencySetting,
)


# ---------------------------------------------------------------- categories
class ProjectCategorySerializer(serializers.ModelSerializer):
    projects_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProjectCategory
        fields = ["id", "name", "icon", "order", "projects_count"]


# -------------------------------------------------------------------- stages
class ProjectStageSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    responsible_name = serializers.CharField(
        source="responsible.display_name", default="", read_only=True
    )

    class Meta:
        model = ProjectStage
        fields = [
            "id",
            "project",
            "name",
            "description",
            "weight",
            "start_date",
            "end_date",
            "responsible",
            "responsible_name",
            "progress",
            "status",
            "status_display",
            "order",
            "created_at",
            "updated_at",
        ]


# -------------------------------------------------------------------- images
class ProjectUpdateImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectUpdateImage
        fields = ["id", "update", "image", "created_at"]


# ------------------------------------------------------------------- updates
class ProjectUpdateSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    author_name = serializers.CharField(
        source="author.display_name", default="", read_only=True
    )
    images = ProjectUpdateImageSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectUpdate
        fields = [
            "id",
            "project",
            "stage",
            "title",
            "body",
            "new_progress",
            "visibility",
            "status",
            "status_display",
            "published_at",
            "author",
            "author_name",
            "notify_contributors",
            "images",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["status", "published_at", "author"]


# -------------------------------------------------------------- transparency
class TransparencySettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransparencySetting
        fields = [
            "id",
            "project",
            "show_target",
            "show_collected",
            "show_remaining",
            "show_revenues",
            "show_expenses",
            "show_balance",
            "show_invoices",
            "show_contributor_names",
            "show_stages",
            "show_updates",
            "updated_by",
            "updated_at",
        ]
        read_only_fields = ["project", "updated_by", "updated_at"]


# ------------------------------------------------------------ staff project
class ProjectSerializer(serializers.ModelSerializer):
    """التسلسل الكامل لأصحاب المشروع والإدارة."""

    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    organization_name = serializers.CharField(
        source="organization.name", default="", read_only=True
    )
    category_name = serializers.CharField(
        source="category.name", default="", read_only=True
    )
    manager_name = serializers.CharField(
        source="manager.display_name", default="", read_only=True
    )
    remaining_amount = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True
    )

    class Meta:
        model = Project
        fields = [
            "id",
            "reference",
            "organization",
            "organization_name",
            "category",
            "category_name",
            "manager",
            "manager_name",
            "name",
            "public_slug",
            "short_description",
            "description",
            "cover_image",
            "location",
            "state",
            "latitude",
            "longitude",
            "beneficiaries_count",
            "start_date",
            "end_date",
            "currency",
            "estimated_cost",
            "target_amount",
            "initial_amount",
            "minimum_contribution",
            "open_contribution",
            "count_inkind_in_progress",
            "bank_name",
            "bank_account_name",
            "iban",
            "payment_link",
            "payment_instructions",
            "status",
            "status_display",
            "financial_progress",
            "execution_progress",
            "collected_amount",
            "contributors_count",
            "contributions_enabled",
            "remaining_amount",
            "review_note",
            "published_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "reference",
            "public_slug",
            "status",
            "financial_progress",
            "execution_progress",
            "collected_amount",
            "contributors_count",
            "published_at",
            "review_note",
        ]


class ProjectReviewSerializer(serializers.Serializer):
    """حمولة أفعال المراجعة (رفض/إعادة/تعليق)."""

    note = serializers.CharField(required=False, allow_blank=True, default="")


class ToggleContributionsSerializer(serializers.Serializer):
    enabled = serializers.BooleanField(required=False, allow_null=True, default=None)


# --------------------------------------------------------------- public API
class PublicCategorySerializer(serializers.ModelSerializer):
    projects_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProjectCategory
        fields = ["id", "name", "icon", "order", "projects_count"]


class PublicStageSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = ProjectStage
        fields = [
            "id",
            "name",
            "description",
            "weight",
            "progress",
            "status",
            "status_display",
            "order",
        ]


class PublicUpdateSerializer(serializers.ModelSerializer):
    images = ProjectUpdateImageSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectUpdate
        fields = [
            "id",
            "title",
            "body",
            "new_progress",
            "published_at",
            "images",
        ]


class PublicProjectListSerializer(serializers.ModelSerializer):
    """بطاقة المشروع العامة (§8.1)."""

    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    organization_name = serializers.CharField(
        source="organization.name", default="", read_only=True
    )
    category_name = serializers.CharField(
        source="category.name", default="", read_only=True
    )

    class Meta:
        model = Project
        fields = [
            "id",
            "reference",
            "name",
            "public_slug",
            "short_description",
            "cover_image",
            "location",
            "state",
            "organization_name",
            "category",
            "category_name",
            "currency",
            "target_amount",
            "collected_amount",
            "financial_progress",
            "execution_progress",
            "contributors_count",
            "status",
            "status_display",
            "published_at",
        ]


class PublicProjectDetailSerializer(serializers.ModelSerializer):
    """تفاصيل عامة تحترم إعدادات الشفافية (§7.12, §10 قواعد 9-10)."""

    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    organization_name = serializers.CharField(
        source="organization.name", default="", read_only=True
    )
    category_name = serializers.CharField(
        source="category.name", default="", read_only=True
    )
    remaining_amount = serializers.SerializerMethodField()
    stages = serializers.SerializerMethodField()
    updates = serializers.SerializerMethodField()
    transparency = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "reference",
            "name",
            "public_slug",
            "short_description",
            "description",
            "cover_image",
            "location",
            "state",
            "latitude",
            "longitude",
            "beneficiaries_count",
            "start_date",
            "end_date",
            "organization_name",
            "category",
            "category_name",
            "currency",
            "minimum_contribution",
            "open_contribution",
            "contributions_enabled",
            "target_amount",
            "collected_amount",
            "remaining_amount",
            "financial_progress",
            "execution_progress",
            "contributors_count",
            "payment_link",
            "payment_instructions",
            "status",
            "status_display",
            "published_at",
            "stages",
            "updates",
            "transparency",
        ]

    def _transparency(self, obj):
        return getattr(obj, "transparency", None)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        t = self._transparency(instance)
        # الافتراضات إن لم توجد إعدادات: اعرض الهدف/المحصل/المتبقي فقط.
        show_target = getattr(t, "show_target", True)
        show_collected = getattr(t, "show_collected", True)
        show_remaining = getattr(t, "show_remaining", True)
        if not show_target:
            data["target_amount"] = None
            data["financial_progress"] = None
        if not show_collected:
            data["collected_amount"] = None
            data["contributors_count"] = None
        if not show_remaining:
            data["remaining_amount"] = None
        return data

    def get_remaining_amount(self, obj):
        return obj.remaining_amount

    def get_transparency(self, obj):
        t = self._transparency(obj)
        fields = [
            "show_target",
            "show_collected",
            "show_remaining",
            "show_revenues",
            "show_expenses",
            "show_balance",
            "show_invoices",
            "show_contributor_names",
            "show_stages",
            "show_updates",
        ]
        if t is None:
            defaults = {
                "show_target": True,
                "show_collected": True,
                "show_remaining": True,
                "show_revenues": True,
                "show_expenses": True,
                "show_balance": False,
                "show_invoices": False,
                "show_contributor_names": False,
                "show_stages": True,
                "show_updates": True,
            }
            return defaults
        return {f: getattr(t, f) for f in fields}

    def get_stages(self, obj):
        t = self._transparency(obj)
        if not getattr(t, "show_stages", True):
            return []
        stages = obj.stages.all()
        return PublicStageSerializer(stages, many=True).data

    def get_updates(self, obj):
        t = self._transparency(obj)
        if not getattr(t, "show_updates", True):
            return []
        updates = obj.updates.filter(
            status=ProjectUpdate.Status.PUBLISHED,
            visibility=ProjectUpdate.Visibility.PUBLIC,
        ).prefetch_related("images")[:20]
        return PublicUpdateSerializer(updates, many=True).data
