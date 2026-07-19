"""Production settings — PostgreSQL, hardened security, single Docker image.

Fails fast on missing/insecure configuration so a misconfigured container never
boots with dev fallbacks (an insecure SECRET_KEY, plaintext bank data, SQLite,
or an empty ALLOWED_HOSTS).
"""
import os
from urllib.parse import urlparse

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403
from .base import SECRET_KEY  # for validation below

DEBUG = False

# ---------------------------------------------------------------------------
# Fail-fast configuration guards (SRS §21 — no insecure prod fallbacks)
# ---------------------------------------------------------------------------
if not SECRET_KEY or SECRET_KEY.startswith("django-insecure"):
    raise ImproperlyConfigured(
        "SECRET_KEY must be set to a strong, unique value in production."
    )

_FIELD_KEY = os.environ.get("FIELD_ENCRYPTION_KEY", "").strip()
if not _FIELD_KEY:
    raise ImproperlyConfigured(
        "FIELD_ENCRYPTION_KEY is required in production (encrypts IBAN/bank data)."
    )
# Validate the key actually constructs a Fernet — catches malformed/CHANGE_ME values.
from cryptography.fernet import Fernet  # noqa: E402

try:
    Fernet(_FIELD_KEY.encode())
except Exception as exc:  # noqa: BLE001
    raise ImproperlyConfigured(
        "FIELD_ENCRYPTION_KEY is not a valid Fernet key "
        "(generate with cryptography.fernet.Fernet.generate_key())."
    ) from exc

# Require these to be explicitly provided via env (don't silently use the dev default).
if not os.environ.get("ALLOWED_HOSTS", "").strip():
    raise ImproperlyConfigured(
        "ALLOWED_HOSTS must be set (env) to the real public host(s) in production."
    )
if not os.environ.get("CSRF_TRUSTED_ORIGINS", "").strip():
    raise ImproperlyConfigured(
        "CSRF_TRUSTED_ORIGINS must be set (env) to the real https origin(s) in production."
    )

# ---------------------------------------------------------------------------
# Database — PostgreSQL via DATABASE_URL (required in production).
# ---------------------------------------------------------------------------
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if not DATABASE_URL:
    raise ImproperlyConfigured("DATABASE_URL is required in production (PostgreSQL).")

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
