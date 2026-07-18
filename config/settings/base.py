"""
Base settings shared across all environments — منصة الخير (Ethos).
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load .env if present (development convenience).
load_dotenv(BASE_DIR / ".env")


def env_bool(key, default=False):
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


def env_list(key, default=""):
    raw = os.environ.get(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = os.environ.get("SECRET_KEY", "django-insecure-dev-key-change-me")
DEBUG = env_bool("DEBUG", True)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", "localhost,127.0.0.1")

# ---------------------------------------------------------------------------
# Applications
# ---------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "django_filters",
    "corsheaders",
]

LOCAL_APPS = [
    "apps.core",
    "apps.accounts",
    "apps.organizations",
    "apps.projects",
    "apps.contributions",
    "apps.finance",
    "apps.communications",
    "apps.reports",
    "apps.audit",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.audit.middleware.CurrentRequestMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# ---------------------------------------------------------------------------
# Database (overridden per-environment)
# ---------------------------------------------------------------------------
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ---------------------------------------------------------------------------
# i18n / RTL Arabic
# ---------------------------------------------------------------------------
LANGUAGE_CODE = "ar"
TIME_ZONE = "Asia/Muscat"
USE_I18N = True
USE_TZ = True
LOCALE_PATHS = [BASE_DIR / "locale"]

# ---------------------------------------------------------------------------
# Static & media
# ---------------------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Frontend build integration (see apps.core.templatetags.vite).
VITE_DEV_SERVER = os.environ.get("VITE_DEV_SERVER", "").strip()
VITE_MANIFEST_PATH = BASE_DIR / "static" / "frontend" / ".vite" / "manifest.json"

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPagination",
    "PAGE_SIZE": 20,
    "DATETIME_FORMAT": "%Y-%m-%dT%H:%M:%S%z",
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
}

# ---------------------------------------------------------------------------
# CORS / CSRF (same-origin in prod; dev allows the Vite dev server)
# ---------------------------------------------------------------------------
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:8000,http://127.0.0.1:8000",
)

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # JS must read the CSRF token to send it back.
CSRF_COOKIE_SAMESITE = "Lax"

# Auth backends: email+password (web form) alongside the default phone/OTP flow.
AUTHENTICATION_BACKENDS = [
    "apps.accounts.backends.EmailBackend",
    "django.contrib.auth.backends.ModelBackend",
]

# ---------------------------------------------------------------------------
# Domain / business configuration
# ---------------------------------------------------------------------------
DEFAULT_CURRENCY = os.environ.get("DEFAULT_CURRENCY", "OMR")
CURRENCY_SYMBOL = os.environ.get("CURRENCY_SYMBOL", "ر.ع.")  # Omani Rial
MONEY_MAX_DIGITS = 14
MONEY_DECIMAL_PLACES = 3  # OMR is subdivided into 1000 baisa (3 decimal places)

OTP_TTL_SECONDS = int(os.environ.get("OTP_TTL_SECONDS", "300"))
OTP_MAX_ATTEMPTS = int(os.environ.get("OTP_MAX_ATTEMPTS", "5"))
OTP_RESEND_COOLDOWN_SECONDS = 60

# Approval / policy defaults (per-project overridable via ProjectSetting).
EXPENSE_INVOICE_REQUIRED_ABOVE = 1000
EXPENSE_TIER_LOW_MAX = 500
EXPENSE_TIER_MEDIUM_MAX = 5000
SEPARATION_OF_DUTIES = True

# File uploads
MAX_UPLOAD_SIZE_MB = 10
ALLOWED_UPLOAD_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf"]

# Field encryption
FIELD_ENCRYPTION_KEY = os.environ.get("FIELD_ENCRYPTION_KEY", "")

# WhatsApp / Outbox
WHATSAPP_BACKEND = os.environ.get("WHATSAPP_BACKEND", "console")
WHATSAPP_API_URL = os.environ.get("WHATSAPP_API_URL", "")
WHATSAPP_API_TOKEN = os.environ.get("WHATSAPP_API_TOKEN", "")
WHATSAPP_SENDER_ID = os.environ.get("WHATSAPP_SENDER_ID", "")
OUTBOX_MAX_RETRIES = 5

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
