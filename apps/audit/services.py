"""Helper to record audit entries from anywhere (SRS §10, rule 13)."""
from apps.audit.middleware import get_current_request, get_current_user
from apps.audit.models import AuditLog


def _client_ip(request):
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def record(action, entity, *, summary="", old=None, new=None, user=None):
    """Write an immutable audit entry. ``entity`` may be a model or a string."""
    request = get_current_request()
    acting_user = user or get_current_user()

    if hasattr(entity, "_meta"):
        entity_type = entity._meta.label
        entity_id = str(getattr(entity, "pk", "") or "")
    else:
        entity_type = str(entity)
        entity_id = ""

    return AuditLog.objects.create(
        user=acting_user,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        summary=summary or "",
        old_values=old,
        new_values=new,
        ip_address=_client_ip(request),
        user_agent=(request.META.get("HTTP_USER_AGENT", "")[:255] if request else ""),
    )
