from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.accounts.serializers import (
    AdminUserSerializer,
    EmailLoginSerializer,
    RegisterSerializer,
    RequestOTPSerializer,
    UserSerializer,
    VerifyOTPSerializer,
)
from apps.accounts.services import request_otp, verify_otp
from apps.audit.services import record
from apps.audit.models import AuditLog
from apps.core.exceptions import BusinessRuleError
from apps.core.permissions import IsPlatformAdmin


class RegisterView(APIView):
    """Email + password registration (SRS §7.1). Signs the new user in."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user, backend="apps.accounts.backends.EmailBackend")
        record(AuditLog.Action.CREATE, user, summary="إنشاء حساب بالبريد الإلكتروني", user=user)
        return Response(
            {"user": UserSerializer(user).data, "created": True, "csrf_token": get_token(request)},
            status=status.HTTP_201_CREATED,
        )


class PasswordLoginView(APIView):
    """Email + password login (SRS §7.1)."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = EmailLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            raise BusinessRuleError(
                "البريد الإلكتروني أو كلمة المرور غير صحيحة.", code="invalid_credentials"
            )
        if not user.is_active:
            raise BusinessRuleError("الحساب معطّل.", code="account_disabled")
        login(request, user, backend="apps.accounts.backends.EmailBackend")
        record(AuditLog.Action.LOGIN, user, summary="تسجيل دخول بالبريد الإلكتروني", user=user)
        return Response(
            {"user": UserSerializer(user).data, "csrf_token": get_token(request)}
        )


class RequestOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RequestOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_otp(serializer.validated_data["phone"], serializer.validated_data.get("purpose", "login"))
        return Response({"detail": "تم إرسال رمز التحقق."}, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user, created = verify_otp(
            data["phone"], data["code"], data.get("purpose", "login"),
            full_name=data.get("full_name", ""), request=request,
        )
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        record(AuditLog.Action.LOGIN, user, summary="تسجيل دخول عبر OTP", user=user)
        return Response(
            {"user": UserSerializer(user).data, "created": created, "csrf_token": get_token(request)}
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        record(AuditLog.Action.LOGOUT, request.user, summary="تسجيل خروج")
        logout(request)
        return Response({"detail": "تم تسجيل الخروج."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"user": UserSerializer(request.user).data, "csrf_token": get_token(request)})

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"user": serializer.data})


class CSRFView(APIView):
    """Bootstrap the CSRF cookie for the SPA."""

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"csrf_token": get_token(request)})


class UserViewSet(viewsets.ModelViewSet):
    """Platform-admin user management (SRS §7.2)."""

    queryset = User.objects.select_related("organization").all()
    serializer_class = AdminUserSerializer
    permission_classes = [IsPlatformAdmin]
    filterset_fields = ["role", "organization", "is_active"]
    search_fields = ["full_name", "phone", "email"]
    ordering_fields = ["date_joined", "last_login"]

    @action(detail=True, methods=["post"])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        record(AuditLog.Action.UPDATE, user, summary=f"تغيير الحالة إلى {'نشط' if user.is_active else 'معطّل'}")
        return Response({"is_active": user.is_active})
