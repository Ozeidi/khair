"""Authentication backend for email + password login (SRS §7.1).

Django's default ``ModelBackend`` authenticates against ``USERNAME_FIELD`` (phone).
This backend adds email/password login for accounts registered via the web form,
while phone accounts keep using OTP. Both backends are installed together.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

User = get_user_model()


class EmailBackend(ModelBackend):
    """Authenticate by (case-insensitive) email + password."""

    def authenticate(self, request, email=None, password=None, **kwargs):
        # Accept the credential under either `email` or `username` for flexibility.
        email = email or kwargs.get("username")
        if not email or not password:
            return None
        try:
            user = User.objects.get(email__iexact=email.strip())
        except User.DoesNotExist:
            # Run the default hasher once to mitigate timing-based user enumeration.
            User().set_password(password)
            return None
        except User.MultipleObjectsReturned:
            user = User.objects.filter(email__iexact=email.strip()).order_by("id").first()
        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
