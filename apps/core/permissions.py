"""Reusable DRF permission classes. Authorization is enforced server-side (SRS §10.8)."""
from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.core.roles import Roles


class IsPlatformAdmin(BasePermission):
    message = "هذه العملية متاحة لمدير المنصة فقط."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == Roles.PLATFORM_ADMIN
        )


class HasRole(BasePermission):
    """View sets ``required_roles`` (an iterable of role codes)."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        required = getattr(view, "required_roles", None)
        if not required:
            return True
        return request.user.role in set(required)


class IsFinanceRole(BasePermission):
    message = "هذه العملية تتطلب صلاحية مالية."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in Roles.FINANCE_ROLES
        )


class ReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS


class IsOwnerOrStaff(BasePermission):
    """
    Object-level: contributors may only touch their own records; staff roles
    (platform admin / org / project) may touch records in their scope.
    Objects should expose a ``user`` attribute or override ``get_owner``.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role == Roles.PLATFORM_ADMIN:
            return True
        owner = getattr(obj, "user", None) or getattr(obj, "submitted_by", None)
        return owner == user
