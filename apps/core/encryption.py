"""Field-level encryption for sensitive banking data (SRS §21).

Uses Fernet symmetric encryption keyed by ``FIELD_ENCRYPTION_KEY``. When no key
is configured (local/demo), values are stored as plaintext with a marker so the
system still works without secrets — never do this in production.
"""
from django.conf import settings
from django.db import models

_PLAINTEXT_MARKER = "plain:"


def _get_fernet():
    key = settings.FIELD_ENCRYPTION_KEY
    if not key:
        return None
    from cryptography.fernet import Fernet

    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_value(value):
    if value is None or value == "":
        return value
    fernet = _get_fernet()
    if fernet is None:
        return _PLAINTEXT_MARKER + value
    return fernet.encrypt(value.encode()).decode()


def decrypt_value(value):
    if value is None or value == "":
        return value
    if value.startswith(_PLAINTEXT_MARKER):
        return value[len(_PLAINTEXT_MARKER):]
    fernet = _get_fernet()
    if fernet is None:
        return value
    try:
        return fernet.decrypt(value.encode()).decode()
    except Exception:
        return value


class EncryptedCharField(models.CharField):
    """Transparently encrypts/decrypts its value at the DB boundary."""

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("max_length", 512)
        super().__init__(*args, **kwargs)

    def from_db_value(self, value, expression, connection):
        return decrypt_value(value)

    def get_prep_value(self, value):
        value = super().get_prep_value(value)
        return encrypt_value(value)
