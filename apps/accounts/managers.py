from django.contrib.auth.models import BaseUserManager

from apps.accounts.phone import normalize_phone
from apps.core.roles import Roles


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create(self, phone, password, **extra):
        # A user needs at least one credential: a phone (OTP) or an email (password).
        if not phone and not extra.get("email"):
            raise ValueError("يلزم رقم هاتف أو بريد إلكتروني.")
        if phone:
            phone = normalize_phone(phone)
        if extra.get("email"):
            extra["email"] = self.normalize_email(extra["email"]).lower()
        user = self.model(phone=phone, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()  # contributors log in via OTP.
        user.save(using=self._db)
        return user

    def create_user(self, phone=None, password=None, **extra):
        extra.setdefault("role", Roles.CONTRIBUTOR)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create(phone, password, **extra)

    def create_emailuser(self, email, password, **extra):
        """Create an email + password account (no phone required)."""
        extra["email"] = email
        return self.create_user(phone=extra.pop("phone", None), password=password, **extra)

    def create_superuser(self, phone, password=None, **extra):
        extra.setdefault("role", Roles.PLATFORM_ADMIN)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("is_active", True)
        if extra.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        return self._create(phone, password, **extra)
