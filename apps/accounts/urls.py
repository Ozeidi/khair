from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import (
    CSRFView,
    LogoutView,
    MeView,
    PasswordLoginView,
    RegisterView,
    RequestOTPView,
    UserViewSet,
    VerifyOTPView,
)

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/login/", PasswordLoginView.as_view(), name="password-login"),
    path("auth/request-otp/", RequestOTPView.as_view(), name="request-otp"),
    path("auth/verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("auth/logout/", LogoutView.as_view(), name="logout"),
    path("auth/csrf/", CSRFView.as_view(), name="csrf"),
    path("me/", MeView.as_view(), name="me"),
] + router.urls
