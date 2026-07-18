"""Shared base models and the reference-number sequence generator."""
from django.conf import settings
from django.db import models, transaction


class TimeStampedModel(models.Model):
    """Adds created/updated timestamps to any model."""

    created_at = models.DateTimeField("تاريخ الإنشاء", auto_now_add=True)
    updated_at = models.DateTimeField("تاريخ التحديث", auto_now=True)

    class Meta:
        abstract = True


def money_field(verbose_name, **kwargs):
    """Factory for a consistent Decimal money field across the whole system."""
    kwargs.setdefault("max_digits", settings.MONEY_MAX_DIGITS)
    kwargs.setdefault("decimal_places", settings.MONEY_DECIMAL_PLACES)
    kwargs.setdefault("default", 0)
    return models.DecimalField(verbose_name, **kwargs)


class ReferenceSequence(models.Model):
    """
    Atomic per-prefix, per-year counter used to mint human-readable reference
    numbers such as ``PRJ-2026-0001`` (SRS §20).
    """

    prefix = models.CharField(max_length=8)
    year = models.PositiveIntegerField()
    last_value = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "متسلسلة مرجعية"
        verbose_name_plural = "المتسلسلات المرجعية"
        unique_together = ("prefix", "year")

    def __str__(self):
        return f"{self.prefix}-{self.year}: {self.last_value}"

    @classmethod
    def next_value(cls, prefix, year, padding=4):
        """Return the next formatted reference, incrementing atomically."""
        with transaction.atomic():
            seq, _ = cls.objects.select_for_update().get_or_create(
                prefix=prefix, year=year
            )
            seq.last_value += 1
            seq.save(update_fields=["last_value"])
            return f"{prefix}-{year}-{str(seq.last_value).zfill(padding)}"
