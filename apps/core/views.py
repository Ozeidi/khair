"""Health probes (SRS §18.8)."""
from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse


def health_live(request):
    """Liveness: the process is up."""
    return JsonResponse({"status": "live"})


def health_ready(request):
    """Readiness: DB reachable and migrations applied."""
    try:
        connections["default"].cursor().execute("SELECT 1")
    except OperationalError:
        return JsonResponse({"status": "not-ready", "database": "down"}, status=503)
    return JsonResponse({"status": "ready", "database": "up"})
