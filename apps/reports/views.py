"""نقاط نهاية التقارير (قراءة/تجميع فقط) — SRS §13، DOMAIN_CONTRACT §6.

تستورد نماذج finance/contributions/projects عبر طبقة الخدمات مباشرةً (reports
هو أعلى طبقة). تُطبّق صلاحيات النطاق: بيانات المشروع لأصحابه/طاقمه، ونظرة عامة
المنصة لمدير المنصة فقط.
"""
from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import AuditLog
from apps.audit.services import record
from apps.core.exceptions import BusinessRuleError
from apps.core.permissions import IsPlatformAdmin
from apps.reports import services
from apps.reports.exports import export_financial_excel, export_financial_pdf
from apps.reports.permissions import user_can_view_project


class ProjectScopedReportView(APIView):
    """أساس لكل تقارير مستوى المشروع: يجلب المشروع ويتحقق من النطاق."""

    permission_classes = [IsAuthenticated]

    def get_project(self, request, project_id):
        project = services.get_project_or_404(project_id)
        if not user_can_view_project(request.user, project):
            # لا نكشف الوجود؛ نرفع خطأ صلاحية موحّد.
            raise BusinessRuleError(
                "غير مصرّح لك بعرض تقارير هذا المشروع.",
                code="forbidden",
                status_code=403,
            )
        return project


class ProjectFinancialReportView(ProjectScopedReportView):
    """GET reports/project/<id>/financial/ — التقرير المالي الكامل."""

    def get(self, request, project_id):
        project = self.get_project(request, project_id)
        data = services.project_financial_report(project)
        return Response(data)


class ProjectSubscriptionsReportView(ProjectScopedReportView):
    """GET reports/project/<id>/subscriptions/ — اشتراكات + متأخرات."""

    def get(self, request, project_id):
        project = self.get_project(request, project_id)
        data = services.project_subscriptions_report(project)
        return Response(data)


class ProjectFinancialExportView(ProjectScopedReportView):
    """GET reports/project/<id>/financial/export/?format=pdf|excel."""

    def get(self, request, project_id):
        project = self.get_project(request, project_id)
        export_format = (request.query_params.get("format") or "pdf").lower()
        report = services.project_financial_report(project)

        if export_format == "pdf":
            content, content_type, filename = export_financial_pdf(report)
        elif export_format in ("excel", "xlsx"):
            content, content_type, filename = export_financial_excel(report)
        else:
            raise BusinessRuleError(
                "صيغة التصدير غير مدعومة (استخدم pdf أو excel).",
                code="unsupported_export_format",
                status_code=400,
            )

        record(
            AuditLog.Action.EXPORT,
            project,
            summary=f"تصدير التقرير المالي ({export_format}) للمشروع {project.reference}",
        )

        response = HttpResponse(content, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class AdminOverviewReportView(APIView):
    """GET reports/admin/overview/ — إجماليات المنصة (مدير المنصة فقط)."""

    permission_classes = [IsAuthenticated, IsPlatformAdmin]

    def get(self, request):
        data = services.admin_overview_report()
        return Response(data)
