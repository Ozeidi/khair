from rest_framework import serializers

from apps.organizations.models import (
    Organization,
    OrganizationDocument,
    OrganizationMember,
)


class OrganizationDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationDocument
        fields = ["id", "organization", "title", "file", "created_at"]
        read_only_fields = ["id", "created_at"]


class OrganizationMemberSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.display_name", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = OrganizationMember
        fields = [
            "id",
            "organization",
            "user",
            "user_name",
            "role",
            "role_display",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class OrganizationSerializer(serializers.ModelSerializer):
    """Full (staff) representation of an organization."""

    org_type_display = serializers.CharField(
        source="get_org_type_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    manager_name = serializers.CharField(
        source="manager.display_name", default="", read_only=True
    )
    documents = OrganizationDocumentSerializer(many=True, read_only=True)
    members = OrganizationMemberSerializer(many=True, read_only=True)

    class Meta:
        model = Organization
        fields = [
            "id",
            "reference",
            "name",
            "org_type",
            "org_type_display",
            "description",
            "logo",
            "manager",
            "manager_name",
            "phone",
            "email",
            "location",
            "bank_name",
            "bank_account_name",
            "iban",
            "status",
            "status_display",
            "review_note",
            "documents",
            "members",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "reference",
            "status",
            "review_note",
            "created_at",
            "updated_at",
        ]


class PublicOrganizationSerializer(serializers.ModelSerializer):
    """Public read-only view — excludes banking/contact-sensitive data (SRS §8.1)."""

    org_type_display = serializers.CharField(
        source="get_org_type_display", read_only=True
    )

    class Meta:
        model = Organization
        fields = [
            "id",
            "reference",
            "name",
            "org_type",
            "org_type_display",
            "description",
            "logo",
            "location",
            "created_at",
        ]


class ReviewNoteSerializer(serializers.Serializer):
    """Payload for reject / return_for_edits lifecycle actions."""

    review_note = serializers.CharField(allow_blank=True, required=False, default="")
