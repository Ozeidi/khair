"""مُسلسِلات الأسهم والاشتراكات والاستحقاقات."""
from decimal import Decimal

from rest_framework import serializers

from apps.contributions.models import Installment, ShareType, Subscription


class ShareTypeSerializer(serializers.ModelSerializer):
    frequency_display = serializers.CharField(
        source="get_frequency_display", read_only=True
    )

    class Meta:
        model = ShareType
        fields = [
            "id",
            "project",
            "name",
            "value",
            "description",
            "frequency",
            "frequency_display",
            "min_quantity",
            "max_quantity",
            "installments_count",
            "order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class PublicShareTypeSerializer(serializers.ModelSerializer):
    """قراءة عامة لأنواع الأسهم النشطة لمشروع (لا تكشف حقولًا حسّاسة)."""

    frequency_display = serializers.CharField(
        source="get_frequency_display", read_only=True
    )

    class Meta:
        model = ShareType
        fields = [
            "id",
            "name",
            "value",
            "description",
            "frequency",
            "frequency_display",
            "min_quantity",
            "max_quantity",
            "installments_count",
            "order",
        ]


class InstallmentSerializer(serializers.ModelSerializer):
    remaining = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = Installment
        fields = [
            "id",
            "subscription",
            "sequence",
            "due_date",
            "amount",
            "paid_amount",
            "remaining",
            "status",
            "status_display",
            "last_reminder_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SubscriptionSerializer(serializers.ModelSerializer):
    """قراءة/تحديث الاشتراك. حقول الحساب للقراءة فقط."""

    installments = InstallmentSerializer(many=True, read_only=True)
    remaining = serializers.DecimalField(
        max_digits=14, decimal_places=3, read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    contribution_type_display = serializers.CharField(
        source="get_contribution_type_display", read_only=True
    )
    project_name = serializers.CharField(source="project.name", read_only=True)
    user_name = serializers.CharField(source="user.display_name", read_only=True)

    class Meta:
        model = Subscription
        fields = [
            "id",
            "reference",
            "project",
            "project_name",
            "user",
            "user_name",
            "share_type",
            "contribution_type",
            "contribution_type_display",
            "quantity",
            "unit_value",
            "total_value",
            "paid_amount",
            "remaining",
            "frequency",
            "start_date",
            "installments_count",
            "public_name_preference",
            "status",
            "status_display",
            "installments",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "reference",
            "unit_value",
            "total_value",
            "paid_amount",
            "status",
            "installments",
            "created_at",
            "updated_at",
        ]


class SubscriptionCreateSerializer(serializers.ModelSerializer):
    """
    إنشاء اشتراك. يحسب المُسلسِل قيمة الوحدة والإجمالي من نوع السهم أو المبلغ المفتوح؛
    منطق التوليد (المرجع/الاستحقاقات/العدّاد) في الـViewSet.
    """

    open_amount = serializers.DecimalField(
        max_digits=14,
        decimal_places=3,
        required=False,
        write_only=True,
        help_text="المبلغ المفتوح عند المساهمة بمبلغ حر بدون نوع سهم.",
    )

    class Meta:
        model = Subscription
        fields = [
            "id",
            "project",
            "user",
            "share_type",
            "contribution_type",
            "quantity",
            "frequency",
            "start_date",
            "installments_count",
            "public_name_preference",
            "open_amount",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        share_type = attrs.get("share_type")
        open_amount = attrs.get("open_amount")
        contribution_type = attrs.get("contribution_type")

        if share_type is None and open_amount is None:
            raise serializers.ValidationError(
                "يجب تحديد نوع سهم أو مبلغ مفتوح."
            )
        if share_type is not None:
            if not share_type.is_active:
                raise serializers.ValidationError(
                    {"share_type": "نوع السهم غير نشط."}
                )
            project = attrs.get("project")
            if project is not None and share_type.project_id != project.id:
                raise serializers.ValidationError(
                    {"share_type": "نوع السهم لا يتبع هذا المشروع."}
                )
            quantity = attrs.get("quantity") or 1
            if quantity < share_type.min_quantity:
                raise serializers.ValidationError(
                    {"quantity": f"الحد الأدنى {share_type.min_quantity}."}
                )
            if share_type.max_quantity and quantity > share_type.max_quantity:
                raise serializers.ValidationError(
                    {"quantity": f"الحد الأعلى {share_type.max_quantity}."}
                )
        elif open_amount is not None and open_amount <= Decimal("0"):
            raise serializers.ValidationError(
                {"open_amount": "المبلغ المفتوح يجب أن يكون موجبًا."}
            )

        if contribution_type == Subscription.ContributionType.OPEN and open_amount is None:
            raise serializers.ValidationError(
                {"open_amount": "المبلغ المفتوح مطلوب للمساهمة المفتوحة."}
            )
        return attrs
