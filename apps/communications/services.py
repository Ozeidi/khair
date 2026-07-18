"""WhatsApp/Outbox services (SRS §14, §15).

Public API relied on by ``accounts``, ``contributions`` and ``finance``::

    enqueue_message(phone, body, kind="", user=None, campaign=None, scheduled_at=None)

Never perform network I/O inside a DB transaction — enqueue only. Dispatch is
run out-of-band by the ``process_outbox`` management command.
"""
import json
import logging
import urllib.error
import urllib.request

from django.conf import settings
from django.db import transaction
from django.utils import timezone

logger = logging.getLogger("communications")


# ---------------------------------------------------------------------------
# Enqueue
# ---------------------------------------------------------------------------
def enqueue_message(phone, body, kind="", user=None, campaign=None, scheduled_at=None):
    """Create a pending :class:`OutboxMessage` and return it.

    STABLE SIGNATURE — accounts/contributions/finance depend on it. Enqueuing
    must never raise for expected empty inputs; callers wrap in try/except.
    """
    from apps.communications.models import OutboxMessage

    return OutboxMessage.objects.create(
        phone=phone or "",
        body=body or "",
        kind=kind or "",
        user=user,
        campaign=campaign,
        scheduled_at=scheduled_at,
        status=OutboxMessage.Status.PENDING,
    )


# ---------------------------------------------------------------------------
# Provider interface + implementations
# ---------------------------------------------------------------------------
class SendResult:
    """Outcome of a single provider send attempt."""

    def __init__(self, ok, external_ref="", error=""):
        self.ok = ok
        self.external_ref = external_ref
        self.error = error


class WhatsAppProvider:
    """Interface for WhatsApp gateways."""

    name = "base"

    def send(self, phone, body):
        raise NotImplementedError


class ConsoleProvider(WhatsAppProvider):
    """Logs the message instead of contacting a gateway (dev/demo)."""

    name = "console"

    def send(self, phone, body):
        logger.info("[WhatsApp:console] -> %s : %s", phone, body)
        ref = f"console-{timezone.now().strftime('%Y%m%d%H%M%S%f')}"
        return SendResult(ok=True, external_ref=ref)


class HttpProvider(WhatsAppProvider):
    """Sends via ``settings.WHATSAPP_API_URL`` using stdlib ``urllib`` (no requests dep).

    Falls back to logging when the API URL/token are not configured, so the
    system still works locally without secrets.
    """

    name = "http"

    def send(self, phone, body):
        api_url = getattr(settings, "WHATSAPP_API_URL", "")
        token = getattr(settings, "WHATSAPP_API_TOKEN", "")
        if not api_url:
            logger.info("[WhatsApp:http-unset] -> %s : %s", phone, body)
            return SendResult(ok=True, external_ref="http-unset")

        payload = {
            "to": phone,
            "body": body,
            "sender": getattr(settings, "WHATSAPP_SENDER_ID", ""),
        }
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(api_url, data=data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
            external_ref = ""
            try:
                external_ref = str(json.loads(raw).get("id", "")) if raw else ""
            except (ValueError, AttributeError):
                external_ref = ""
            return SendResult(ok=True, external_ref=external_ref or "http-ok")
        except urllib.error.HTTPError as exc:  # 4xx/5xx from gateway
            return SendResult(ok=False, error=f"HTTP {exc.code}: {exc.reason}")
        except (urllib.error.URLError, OSError) as exc:  # network failure
            return SendResult(ok=False, error=str(exc))


_PROVIDERS = {
    "console": ConsoleProvider,
    "http": HttpProvider,
}


def get_provider():
    """Select the WhatsApp provider from ``settings.WHATSAPP_BACKEND``."""
    backend = getattr(settings, "WHATSAPP_BACKEND", "console")
    provider_cls = _PROVIDERS.get(backend, ConsoleProvider)
    return provider_cls()


# ---------------------------------------------------------------------------
# Dispatch (worker)
# ---------------------------------------------------------------------------
def _due_messages(limit):
    from apps.communications.models import OutboxMessage

    now = timezone.now()
    qs = (
        OutboxMessage.objects.filter(status=OutboxMessage.Status.PENDING)
        .filter(models_scheduled_filter(now))
        .order_by("created_at")
    )
    return list(qs[:limit])


def models_scheduled_filter(now):
    """Q object matching messages that are due (no schedule or schedule in past)."""
    from django.db.models import Q

    return Q(scheduled_at__isnull=True) | Q(scheduled_at__lte=now)


def send_message(message, provider=None):
    """Attempt to send a single Outbox message and persist the outcome.

    Returns ``True`` on success. Updates ``status``, ``attempts``,
    ``external_ref``, ``error`` and ``sent_at`` with retry up to ``max_attempts``.
    """
    from apps.communications.models import CampaignRecipient, OutboxMessage

    provider = provider or get_provider()

    message.status = OutboxMessage.Status.SENDING
    message.attempts += 1
    message.save(update_fields=["status", "attempts", "updated_at"])

    try:
        result = provider.send(message.phone, message.body)
    except Exception as exc:  # never let a provider bug crash the worker
        result = SendResult(ok=False, error=str(exc))

    if result.ok:
        message.status = OutboxMessage.Status.SENT
        message.external_ref = result.external_ref or ""
        message.error = ""
        message.sent_at = timezone.now()
        message.save(update_fields=["status", "external_ref", "error", "sent_at", "updated_at"])
        _mark_recipient(message, CampaignRecipient.Status.SENT)
        return True

    message.error = result.error or "send failed"
    if message.attempts >= message.max_attempts:
        message.status = OutboxMessage.Status.FAILED
        _mark_recipient(message, CampaignRecipient.Status.FAILED)
    else:
        message.status = OutboxMessage.Status.PENDING  # retry on next run
    message.save(update_fields=["status", "error", "updated_at"])
    return False


def _mark_recipient(message, status):
    """Reflect the send outcome on the matching campaign recipient, if any."""
    if not message.campaign_id:
        return
    from apps.communications.models import CampaignRecipient

    CampaignRecipient.objects.filter(
        campaign_id=message.campaign_id, phone=message.phone
    ).update(status=status)


def dispatch(limit=100, provider=None):
    """Send due pending Outbox messages. Returns ``(sent, failed)`` counts."""
    provider = provider or get_provider()
    sent = failed = 0
    for message in _due_messages(limit):
        if send_message(message, provider=provider):
            sent += 1
        else:
            failed += 1
    return sent, failed


# ---------------------------------------------------------------------------
# Template rendering + seeding (SRS §15)
# ---------------------------------------------------------------------------
STANDARD_TEMPLATES = [
    {
        "key": "subscription_confirm",
        "name": "تأكيد الاشتراك",
        "body": (
            "مرحبًا {name}، تم تسجيل مساهمتك في مشروع {project}. عدد الأسهم: {quantity}، "
            "إجمالي الالتزام: {total}، رقم الاشتراك: {reference}. رابط المتابعة: {link}."
        ),
    },
    {
        "key": "due_reminder",
        "name": "تذكير الاستحقاق",
        "body": (
            "لديك دفعة مستحقة لمشروع {project} بقيمة {amount} بتاريخ {date}. "
            "رفع الإثبات: {link}."
        ),
    },
    {
        "key": "payment_confirm",
        "name": "تأكيد الدفع",
        "body": (
            "تم اعتماد دفعتك لمشروع {project}. المبلغ: {amount}، رقم الإيصال: {receipt}. "
            "الإيصال: {link}."
        ),
    },
    {
        "key": "payment_reject",
        "name": "رفض الدفع",
        "body": "تعذر اعتماد إثبات الدفع. السبب: {reason}. يرجى الاستكمال عبر {link}.",
    },
    {
        "key": "project_update",
        "name": "تحديث المشروع",
        "body": (
            "تحديث جديد لمشروع {project}: {title}. نسبة الإنجاز: {progress}. "
            "التفاصيل: {link}."
        ),
    },
]


def seed_templates():
    """Create/refresh the standard WhatsApp templates (SRS §15). Idempotent."""
    from apps.communications.models import WhatsAppTemplate

    created = 0
    for tpl in STANDARD_TEMPLATES:
        _, was_created = WhatsAppTemplate.objects.get_or_create(
            key=tpl["key"],
            defaults={"name": tpl["name"], "body": tpl["body"], "is_active": True},
        )
        if was_created:
            created += 1
    return created


def render_template(body, context):
    """Fill ``{placeholder}`` variables, leaving unknown ones intact."""
    if not body:
        return ""

    class _SafeDict(dict):
        def __missing__(self, key):
            return "{" + key + "}"

    try:
        return body.format_map(_SafeDict(context or {}))
    except (ValueError, IndexError):
        return body


def build_campaign_body(campaign):
    """Return the message body for a campaign (template body or free text)."""
    if campaign.template and campaign.template.body:
        base = campaign.template.body
    else:
        base = campaign.body or ""
    project_name = getattr(getattr(campaign, "project", None), "name", "")
    return render_template(base, {"project": project_name, "link": campaign.link or ""})


# ---------------------------------------------------------------------------
# Campaign audience resolution + sending (SRS §9.8, §10 rule 17)
# ---------------------------------------------------------------------------
def resolve_campaign_recipients(campaign):
    """Return a list of (user, phone) pairs for the campaign audience.

    Honors ``user.notify_campaigns`` (SRS §10 rule 17: never message opt-outs).
    Cross-app models are imported lazily to avoid import cycles.
    """
    from apps.contributions.models import Subscription

    Audience = campaign.Audience
    subs = (
        Subscription.objects.filter(project_id=campaign.project_id)
        .select_related("user")
    )

    if campaign.audience == Audience.ACTIVE:
        subs = subs.filter(status="active")
    elif campaign.audience == Audience.OVERDUE:
        subs = subs.filter(installments__status="overdue")

    seen = {}
    for sub in subs:
        user = sub.user
        if user is None:
            continue
        if not getattr(user, "notify_campaigns", True):
            continue  # rule 17: respect opt-out
        phone = getattr(user, "phone", "")
        if not phone or user.pk in seen:
            continue
        seen[user.pk] = (user, phone)
    return list(seen.values())


def send_campaign(campaign):
    """Build recipients + Outbox messages for a campaign. Returns recipient count.

    Sets the campaign to ``sending`` and enqueues one Outbox message per
    recipient (honoring notify_campaigns). Actual delivery happens via the
    Outbox worker.
    """
    from apps.communications.models import Campaign, CampaignRecipient

    recipients = resolve_campaign_recipients(campaign)
    body = build_campaign_body(campaign)

    with transaction.atomic():
        campaign.status = Campaign.Status.SENDING
        campaign.save(update_fields=["status", "updated_at"])
        # Clear any stale recipients from a prior attempt.
        campaign.recipients.all().delete()
        for user, phone in recipients:
            CampaignRecipient.objects.create(
                campaign=campaign,
                user=user,
                phone=phone,
                status=CampaignRecipient.Status.PENDING,
            )
            enqueue_message(
                phone=phone,
                body=body,
                kind="campaign",
                user=user,
                campaign=campaign,
                scheduled_at=campaign.scheduled_at,
            )

    if not recipients:
        campaign.status = Campaign.Status.COMPLETED
        campaign.save(update_fields=["status", "updated_at"])
    return len(recipients)
