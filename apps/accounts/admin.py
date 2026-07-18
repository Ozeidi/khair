from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from apps.accounts.models import LoginAttempt, OTPCode, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-date_joined",)
    list_display = ("phone", "full_name", "role", "organization", "is_active", "phone_verified")
    list_filter = ("role", "is_active", "phone_verified", "organization")
    search_fields = ("phone", "full_name", "email")
    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("البيانات الشخصية", {"fields": ("full_name", "email")}),
        ("الدور والصلاحيات", {"fields": ("role", "organization", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("الإشعارات", {"fields": ("notify_dues", "notify_updates", "notify_campaigns")}),
        ("تواريخ", {"fields": ("last_login", "date_joined", "phone_verified")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("phone", "full_name", "role", "password1", "password2")}),
    )
    readonly_fields = ("last_login", "date_joined")


@admin.register(OTPCode)
class OTPCodeAdmin(admin.ModelAdmin):
    list_display = ("phone", "code", "purpose", "expires_at", "attempts", "is_used")
    list_filter = ("purpose", "is_used")
    search_fields = ("phone",)


@admin.register(LoginAttempt)
class LoginAttemptAdmin(admin.ModelAdmin):
    list_display = ("phone", "successful", "ip_address", "created_at")
    list_filter = ("successful",)
    search_fields = ("phone", "ip_address")
