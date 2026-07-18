"""Reference-number helpers (SRS §20).

Patterns:
    PRJ-2026-0001   project
    ORG-2026-0001   organization
    SUB-2026-000123 subscription
    PAY-2026-000456 payment
    REV-2026-000456 revenue
    EXP-2026-000078 expense
    RCP-2026-000456 receipt
    CMP-2026-0007   campaign
"""
from django.utils import timezone

from apps.core.models import ReferenceSequence

PREFIXES = {
    "project": ("PRJ", 4),
    "organization": ("ORG", 4),
    "subscription": ("SUB", 6),
    "payment": ("PAY", 6),
    "revenue": ("REV", 6),
    "inkind": ("INK", 6),
    "expense": ("EXP", 6),
    "receipt": ("RCP", 6),
    "campaign": ("CMP", 4),
    "budget": ("BDG", 4),
}


def make_reference(kind, when=None):
    """Return the next reference string for the given entity ``kind``."""
    if kind not in PREFIXES:
        raise ValueError(f"Unknown reference kind: {kind}")
    prefix, padding = PREFIXES[kind]
    year = (when or timezone.now()).year
    return ReferenceSequence.next_value(prefix, year, padding=padding)
