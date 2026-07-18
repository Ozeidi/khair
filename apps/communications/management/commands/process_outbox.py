"""Send pending Outbox messages via the configured WhatsApp provider (SRS §14.3, §17)."""
from django.core.management.base import BaseCommand

from apps.communications.services import dispatch, get_provider


class Command(BaseCommand):
    help = "يرسل رسائل Outbox المعلّقة والمستحقة عبر مزوّد واتساب المُهيّأ."

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit",
            type=int,
            default=100,
            help="أقصى عدد من الرسائل يُعالَج في هذه الدفعة.",
        )

    def handle(self, *args, **options):
        provider = get_provider()
        sent, failed = dispatch(limit=options["limit"], provider=provider)
        self.stdout.write(
            self.style.SUCCESS(
                f"المزوّد={provider.name} · أُرسلت={sent} · فشلت={failed}"
            )
        )
