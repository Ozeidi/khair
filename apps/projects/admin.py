from django.contrib import admin

from apps.projects.models import (
    Project,
    ProjectCategory,
    ProjectStage,
    ProjectUpdate,
    ProjectUpdateImage,
    TransparencySetting,
)


@admin.register(ProjectCategory)
class ProjectCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "icon", "order")
    search_fields = ("name",)
    ordering = ("order", "name")


class ProjectStageInline(admin.TabularInline):
    model = ProjectStage
    extra = 0
    fields = ("name", "weight", "progress", "status", "order")


class TransparencyInline(admin.StackedInline):
    model = TransparencySetting
    extra = 0
    can_delete = False


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "name",
        "organization",
        "category",
        "status",
        "target_amount",
        "collected_amount",
        "financial_progress",
        "contributions_enabled",
    )
    list_filter = ("status", "category", "contributions_enabled", "organization")
    search_fields = ("reference", "name", "public_slug", "location", "state")
    readonly_fields = (
        "reference",
        "public_slug",
        "collected_amount",
        "financial_progress",
        "execution_progress",
        "contributors_count",
        "published_at",
        "created_at",
        "updated_at",
    )
    autocomplete_fields = ("organization", "category", "manager")
    inlines = (ProjectStageInline, TransparencyInline)
    date_hierarchy = "created_at"


@admin.register(ProjectStage)
class ProjectStageAdmin(admin.ModelAdmin):
    list_display = ("name", "project", "weight", "progress", "status", "order")
    list_filter = ("status",)
    search_fields = ("name", "project__name")
    autocomplete_fields = ("project", "responsible")


class ProjectUpdateImageInline(admin.TabularInline):
    model = ProjectUpdateImage
    extra = 0


@admin.register(ProjectUpdate)
class ProjectUpdateAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "project",
        "stage",
        "visibility",
        "status",
        "published_at",
        "author",
    )
    list_filter = ("status", "visibility")
    search_fields = ("title", "project__name")
    autocomplete_fields = ("project", "stage", "author")
    inlines = (ProjectUpdateImageInline,)


@admin.register(TransparencySetting)
class TransparencySettingAdmin(admin.ModelAdmin):
    list_display = (
        "project",
        "show_target",
        "show_collected",
        "show_remaining",
        "show_contributor_names",
        "updated_at",
    )
    search_fields = ("project__name",)
    autocomplete_fields = ("project", "updated_by")
