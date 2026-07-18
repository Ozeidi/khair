"""Development settings — SQLite, relaxed security, console WhatsApp backend."""
from .base import *  # noqa: F401,F403
from .base import BASE_DIR

DEBUG = True
ALLOWED_HOSTS = ["*"]

INTERNAL_IPS = ["127.0.0.1"]

# SQLite for local development / demo.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# Cookies over http in dev.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Let the React dev server (5173) talk to the API.
CORS_ALLOW_ALL_ORIGINS = True

EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
