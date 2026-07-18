"""مسارات التقارير (SRS §13). لا نماذج، فالراوتر فارغ لكنه موجود للتناسق."""
from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.reports.views import (
    AdminOverviewReportView,
    ProjectFinancialExportView,
    ProjectFinancialReportView,
    ProjectSubscriptionsReportView,
)

router = DefaultRouter()

urlpatterns = [
    path(
        "reports/project/<int:project_id>/financial/",
        ProjectFinancialReportView.as_view(),
        name="reports-project-financial",
    ),
    path(
        "reports/project/<int:project_id>/financial/export/",
        ProjectFinancialExportView.as_view(),
        name="reports-project-financial-export",
    ),
    path(
        "reports/project/<int:project_id>/subscriptions/",
        ProjectSubscriptionsReportView.as_view(),
        name="reports-project-subscriptions",
    ),
    path(
        "reports/admin/overview/",
        AdminOverviewReportView.as_view(),
        name="reports-admin-overview",
    ),
] + router.urls
