from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User
from apps.accounts.phone import normalize_phone


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    display_name = serializers.CharField(read_only=True)
    organization_name = serializers.CharField(
        source="organization.name", default="", read_only=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "phone",
            "full_name",
            "display_name",
            "email",
            "role",
            "role_display",
            "organization",
            "organization_name",
            "is_active",
            "phone_verified",
            "notify_dues",
            "notify_updates",
            "notify_campaigns",
            "date_joined",
            "last_login",
        ]
        # Self-service (/me/) may only edit full_name + notification prefs.
        # email/is_active/role/etc. must never be self-writable (lockout &
        # unique-collision protection — SRS §7.2).
        read_only_fields = [
            "id",
            "phone",
            "email",
            "role",
            "organization",
            "is_active",
            "phone_verified",
            "date_joined",
            "last_login",
        ]


class RegisterSerializer(serializers.Serializer):
    """Email + password registration (SRS §7.1).

    Collects the user's key information. Phone is optional so email is a fully
    independent registration path alongside phone/OTP.
    """

    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("هذا البريد الإلكتروني مسجّل مسبقًا.")
        return value

    def validate_phone(self, value):
        if not value:
            return ""
        normalized = normalize_phone(value)
        if User.objects.filter(phone=normalized).exists():
            raise serializers.ValidationError("رقم الهاتف مسجّل مسبقًا.")
        return normalized

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        phone = validated_data.get("phone") or None
        user = User.objects.create_emailuser(
            email=validated_data["email"],
            password=validated_data["password"],
            full_name=validated_data["full_name"].strip(),
            phone=phone,
            phone_verified=False,
        )
        return user


class EmailLoginSerializer(serializers.Serializer):
    """Email + password login."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, max_length=128)


class RequestOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    purpose = serializers.ChoiceField(
        choices=["login", "register"], default="login", required=False
    )


class VerifyOTPSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=20)
    code = serializers.CharField(max_length=8)
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    purpose = serializers.ChoiceField(
        choices=["login", "register"], default="login", required=False
    )


class AdminUserSerializer(serializers.ModelSerializer):
    """Used by platform admins to manage users (SRS §7.2)."""

    class Meta:
        model = User
        fields = [
            "id",
            "phone",
            "full_name",
            "email",
            "role",
            "organization",
            "is_active",
            "phone_verified",
            "date_joined",
            "last_login",
        ]
        read_only_fields = ["id", "phone", "date_joined", "last_login"]
