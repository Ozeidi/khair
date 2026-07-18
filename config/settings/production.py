"""Production settings — PostgreSQL, hardened security, single Docker image."""
import os
from urllib.parse import urlparse

from .base import *  # noqa: F401,F403

DEBUG = False

# ---------------------------------------------------------------------------
# Database — PostgreSQL via DATABASE_URL (falls back to SQLite volume if unset).
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL:
    parsed = urlparse(DATABASE_URL)
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/"),
            "USER": parsed.username or "",
            "PASSWORD": parsed.password or "",
            "HOST": parsed.hostname or "",
            "PORT": str(parsed.port or "5432"),
            "CONN_MAX_AGE": 60,
        }
    }

# ---------------------------------------------------------------------------
# Security hardening
# ---------------------------------------------------------------------------
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = os.environ.get("SECURE_SSL_REDIRECT", "True").lower() == "true"
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"

# In production the SPA is served from the same origin; no cross-origin needed.
CORS_ALLOW_ALL_ORIGINS = False
