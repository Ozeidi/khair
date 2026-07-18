"""Uniform API error envelope + a domain exception for business-rule violations."""
from rest_framework.views import exception_handler


class BusinessRuleError(Exception):
    """Raised when a domain/business rule is violated (SRS §10)."""

    status_code = 422

    def __init__(self, message, code="business_rule", status_code=None):
        self.message = message
        self.code = code
        if status_code is not None:
            self.status_code = status_code
        super().__init__(message)


def api_exception_handler(exc, context):
    """Wrap DRF errors in a consistent JSON envelope and handle BusinessRuleError."""
    from rest_framework.response import Response

    if isinstance(exc, BusinessRuleError):
        return Response(
            {"error": {"code": exc.code, "message": exc.message}},
            status=exc.status_code,
        )

    response = exception_handler(exc, context)
    if response is not None:
        detail = response.data
        message = None
        fields = None
        if isinstance(detail, dict):
            fields = detail
            message = detail.get("detail")
            if message is None:
                # No top-level "detail" (field / non_field validation errors):
                # surface the first concrete message so the client never gets a
                # null message (which would hide the real reason).
                first = detail.get("non_field_errors")
                if first is None:
                    first = next(iter(detail.values()), None)
                if isinstance(first, (list, tuple)) and first:
                    message = str(first[0])
                elif first:
                    message = str(first)
                else:
                    message = "طلب غير صالح."
        else:
            message = detail
        response.data = {
            "error": {
                "code": getattr(exc, "default_code", "error"),
                "message": message,
                "fields": fields,
            }
        }
    return response
