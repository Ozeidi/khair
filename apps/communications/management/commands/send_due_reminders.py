"""Enqueue WhatsApp reminders for due/overdue installments (SRS §14.1, §15).

Respects ``user.notify_dues`` (SRS §8.2) and avoids re-reminding the same
installment within a configurable window.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = "ينشئ رسائل تذكير للاستحقاقات المستحقة أو المتأخرة (يحترم تفضيل المستخدم)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--lookahead-days",
            type=int,
            default=3,
            help="عدد الأيام المقبلة التي تُعتبر مستحقة (بالإضافة إلى المتأخرة).",
        )
        parser.add_argument(
            "--cooldown-hours",
            type=int,
            default=24,
            help="أقل فاصل زمني بين تذكيرين لنفس الاستحقاق.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="يعرض العدد دون إنشاء رسائل.",
        )

    def handle(self, *args, **options):
        # Import contributions models here to avoid module-level cross-app coupling.
        from apps.contributions.models import Installment
        from apps.communications.services import enqueue_message, render_template
        from apps.communications.models import WhatsAppTemplate

        now = timezone.now()
        today = timezone.localdate()
        horizon = today + timedelta(days=options["lookahead_days"])
        cooldown_before = now - timedelta(hours=options["cooldown_hours"])

        template = WhatsAppTemplate.objects.filter(
            key="due_reminder", is_active=True
        ).first()
        template_body = (
            template.body
            if template
            else (
                "لديك دفعة مستحقة لمشروع {project} بقيمة {amount} بتاريخ {date}. "
                "رفع الإثبات: {link}."
            )
        )

        due_statuses = [
            Installment.Status.PENDING,
            Installment.Status.PARTIAL,
            Installment.Status.OVERDUE,
        ]
        installments = (
            Installment.objects.filter(
                status__in=due_statuses,
                due_date__lte=horizon,
            )
            .select_related("subscription", "subscription__user", "subscription__project")
        )

        enqueued = skipped = 0
        for inst in installments:
            subscription = inst.subscription
            user = getattr(subscription, "user", None)
            if user is None or not getattr(user, "notify_dues", True):
                skipped += 1
                continue
            phone = getattr(user, "phone", "")
            if not phone:
                skipped += 1
                continue
            if inst.last_reminder_at and inst.last_reminder_at >= cooldown_before:
                skipped += 1
                continue

            project = getattr(subscription, "project", None)
            body = render_template(
                template_body,
                {
                    "name": getattr(user, "display_name", "") or "",
                    "project": getattr(project, "name", "") or "",
                    "amount": str(getattr(inst, "remaining", inst.amount)),
                    "date": inst.due_date.isoformat() if inst.due_date else "",
                    "link": "",
                },
            )

            if options["dry_run"]:
                enqueued += 1
                continue

            try:
                enqueue_message(phone=phone, body=body, kind="reminder", user=user)
            except Exception:
                skipped += 1
                continue

            inst.last_reminder_at = now
            inst.save(update_fields=["last_reminder_at"])
            enqueued += 1

        verb = "سيتم إنشاء" if options["dry_run"] else "أُنشئت"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {enqueued} رسالة تذكير · تم تخطي {skipped}."
            )
        )
