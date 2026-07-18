"""Root URL configuration — منصة الخير.

Routing map (per SRS §17.2):
    /admin/         Django Admin (technical)
    /api/v1/...     REST API
    /media/         Protected/served attachments
    /health/...     Liveness / readiness probes
    /*              React SPA (catch-all)
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from apps.core.views import health_live, health_ready
from apps.core.spa import spa_index

api_v1 = [
    path("", include("apps.accounts.urls")),
    path("", include("apps.organizations.urls")),
    path("", include("apps.projects.urls")),
    path("", include("apps.contributions.urls")),
    path("", include("apps.finance.urls")),
    path("", include("apps.communications.urls")),
    path("", include("apps.reports.urls")),
    path("", include("apps.audit.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "api"), namespace="v1")),
    path("health/live/", health_live, name="health-live"),
    path("health/ready/", health_ready, name="health-ready"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# React SPA catch-all — must be last. Excludes api/admin/media/static/health.
urlpatterns += [
    re_path(r"^(?!api/|admin/|media/|static/|health/).*$", spa_index, name="spa"),
]
