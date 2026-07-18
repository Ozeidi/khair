"""Upload validators (SRS §21, DECISIONS §10)."""
import os

from django.conf import settings
from django.core.exceptions import ValidationError


def validate_upload(file_obj):
    """Enforce size + extension allow-list on uploaded files."""
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if file_obj.size > max_bytes:
        raise ValidationError(
            f"حجم الملف يتجاوز الحد المسموح ({settings.MAX_UPLOAD_SIZE_MB} ميغابايت)."
        )
    ext = os.path.splitext(file_obj.name)[1].lower().lstrip(".")
    if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
        allowed = "، ".join(settings.ALLOWED_UPLOAD_EXTENSIONS)
        raise ValidationError(f"نوع الملف غير مسموح. الأنواع المسموحة: {allowed}.")
