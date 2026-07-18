from django.contrib import admin

from apps.organizations.models import (
    Organization,
    OrganizationDocument,
    OrganizationMember,
)


class OrganizationMemberInline(admin.TabularInline):
    model = OrganizationMember
    extra = 0
    autocomplete_fields = ("user",)


class OrganizationDocumentInline(admin.TabularInline):
    model = OrganizationDocument
    extra = 0


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "name",
        "org_type",
        "status",
        "manager",
        "phone",
        "created_at",
    )
    list_filter = ("status", "org_type", "created_at")
    search_fields = ("reference", "name", "phone", "email", "location")
    readonly_fields = ("reference", "created_at", "updated_at")
    autocomplete_fields = ("manager",)
    inlines = (OrganizationMemberInline, OrganizationDocumentInline)
    date_hierarchy = "created_at"
    ordering = ("-created_at",)


@admin.register(OrganizationMember)
class OrganizationMemberAdmin(admin.ModelAdmin):
    list_display = ("organization", "user", "role", "created_at")
    list_filter = ("role",)
    search_fields = (
        "organization__name",
        "user__full_name",
        "user__phone",
    )
    autocomplete_fields = ("organization", "user")


@admin.register(OrganizationDocument)
class OrganizationDocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "created_at")
    search_fields = ("title", "organization__name")
    autocomplete_fields = ("organization",)
