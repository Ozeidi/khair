"""أنواع الأسهم والاشتراكات والاستحقاقات (DOMAIN_CONTRACT §3, SRS §7.6)."""
import calendar
import datetime
from decimal import ROUND_HALF_UP, Decimal

from django.db import models, transaction

from apps.core.models import TimeStampedModel, money_field
from apps.core.references import make_reference

# دورية الاشتراك: القيم البرمجية ثابتة، لا تُترجم.
FREQUENCY_CHOICES = [
    ("one_time", "مرة واحدة"),
    ("weekly", "أسبوعي"),
    ("monthly", "شهري"),
    ("quarterly", "ربع سنوي"),
    ("semiannual", "نصف سنوي"),
    ("annual", "سنوي"),
    ("custom", "مخصص"),
]

# عدد الأشهر بين كل استحقاق حسب الدورية (weekly يُعالَج بالأسابيع).
_FREQUENCY_MONTHS = {
    "monthly": 1,
    "quarterly": 3,
    "semiannual": 6,
    "annual": 12,
}

_TWO_PLACES = Decimal("0.01")


def _add_months(base_date, months):
    """يضيف عددًا من الأشهر لتاريخ مع ضبط اليوم على آخر يوم صالح في الشهر."""
    month_index = base_date.month - 1 + months
    year = base_date.year + month_index // 12
    month = month_index % 12 + 1
    last_day = calendar.monthrange(year, month)[1]
    day = min(base_date.day, last_day)
    return base_date.replace(year=year, month=month, day=day)


class ShareType(TimeStampedModel):
    """نوع سهم قابل للاشتراك ضمن مشروع (DOMAIN_CONTRACT §3)."""

    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="share_types",
        verbose_name="المشروع",
    )
    name = models.CharField("الاسم", max_length=150)
    value = money_field("القيمة")
    description = models.TextField("الوصف", blank=True)
    frequency = models.CharField(
        "الدورية", max_length=20, choices=FREQUENCY_CHOICES, default="one_time"
    )
    min_quantity = models.PositiveIntegerField("الحد الأدنى", default=1)
    max_quantity = models.PositiveIntegerField("الحد الأعلى", null=True, blank=True)
    installments_count = models.PositiveIntegerField(
        "عدد الدفعات", null=True, blank=True
    )
    order = models.PositiveIntegerField("الترتيب", default=0)
    is_active = models.BooleanField("نشط", default=True)

    class Meta:
        verbose_name = "نوع سهم"
        verbose_name_plural = "أنواع الأسهم"
        ordering = ("order", "id")

    def __str__(self):
        return f"{self.name} ({self.value})"


class Subscription(TimeStampedModel):
    """اشتراك مساهم في مشروع عبر نوع سهم أو مبلغ مفتوح (DOMAIN_CONTRACT §3)."""

    class ContributionType(models.TextChoices):
        SHARE = "share", "سهم"
        OPEN = "open", "مبلغ مفتوح"
        SUBSCRIPTION = "subscription", "اشتراك دوري"

    class PublicNamePreference(models.TextChoices):
        FULL = "full", "الاسم الكامل"
        ANONYMOUS = "anonymous", "فاعل خير"
        HIDDEN_AMOUNT = "hidden_amount", "إخفاء المبلغ"

    class Status(models.TextChoices):
        ACTIVE = "active", "نشط"
        COMPLETED = "completed", "مكتمل"
        PAUSED = "paused", "موقوف"
        CANCELLED = "cancelled", "ملغى"

    reference = models.CharField(
        "رقم الاشتراك", max_length=20, unique=True, blank=True
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.PROTECT,
        related_name="subscriptions",
        verbose_name="المشروع",
    )
    user = models.ForeignKey(
        "accounts.User",
        on_delete=models.PROTECT,
        related_name="subscriptions",
        verbose_name="المساهم",
    )
    share_type = models.ForeignKey(
        ShareType,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="subscriptions",
        verbose_name="نوع السهم",
    )
    contribution_type = models.CharField(
        "نوع المساهمة",
        max_length=20,
        choices=ContributionType.choices,
        default=ContributionType.SHARE,
    )
    quantity = models.PositiveIntegerField("عدد الأسهم", default=1)
    unit_value = money_field("قيمة الوحدة")
    total_value = money_field("إجمالي الالتزام")
    paid_amount = money_field("المدفوع", default=0)
    frequency = models.CharField(
        "الدورية", max_length=20, choices=FREQUENCY_CHOICES, default="one_time"
    )
    start_date = models.DateField("تاريخ البداية")
    installments_count = models.PositiveIntegerField("عدد الدفعات", default=1)
    public_name_preference = models.CharField(
        "تفضيل إظهار الاسم",
        max_length=20,
        choices=PublicNamePreference.choices,
        default=PublicNamePreference.ANONYMOUS,
    )
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.ACTIVE
    )

    class Meta:
        verbose_name = "اشتراك"
        verbose_name_plural = "الاشتراكات"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self):
        return self.reference or f"اشتراك #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("subscription")
        super().save(*args, **kwargs)

    @property
    def remaining(self):
        """المتبقي من إجمالي الالتزام."""
        return (self.total_value or Decimal("0")) - (self.paid_amount or Decimal("0"))

    def _due_date_for(self, sequence):
        """تاريخ استحقاق الدفعة رقم ``sequence`` (يبدأ من 1) حسب الدورية."""
        offset = sequence - 1
        if offset <= 0 or self.frequency in ("one_time", "custom"):
            return self.start_date
        if self.frequency == "weekly":
            return self.start_date + datetime.timedelta(weeks=offset)
        months = _FREQUENCY_MONTHS.get(self.frequency, 1)
        return _add_months(self.start_date, months * offset)

    @transaction.atomic
    def generate_installments(self):
        """
        ينشئ استحقاقات الاشتراك بتقسيم ``total_value`` على عدد الدفعات وفق الدورية.
        يُعالَج فرق التقريب على الدفعة الأخيرة. آمن لإعادة التوليد (يحذف المعلّقة غير المدفوعة).
        """
        # لا تُعِد توليد ما دُفع؛ احذف فقط الاستحقاقات المعلّقة غير المسدّدة.
        self.installments.filter(paid_amount=0).delete()

        count = self.installments_count or 1
        if count < 1:
            count = 1

        total = (self.total_value or Decimal("0")).quantize(
            _TWO_PLACES, rounding=ROUND_HALF_UP
        )
        base = (total / Decimal(count)).quantize(_TWO_PLACES, rounding=ROUND_HALF_UP)

        installments = []
        accumulated = Decimal("0")
        for sequence in range(1, count + 1):
            if sequence == count:
                # الدفعة الأخيرة تستوعب فرق التقريب.
                amount = total - accumulated
            else:
                amount = base
                accumulated += base
            installments.append(
                Installment(
                    subscription=self,
                    sequence=sequence,
                    due_date=self._due_date_for(sequence),
                    amount=amount,
                )
            )
        Installment.objects.bulk_create(installments)
        return installments

    @transaction.atomic
    def recalculate(self):
        """يحدّث ``paid_amount`` والحالة من مجموع مدفوعات الاستحقاقات."""
        agg = self.installments.aggregate(total_paid=models.Sum("paid_amount"))
        paid = agg["total_paid"] or Decimal("0")
        self.paid_amount = paid

        # لا تلمس الحالات النهائية التي يقرّرها المستخدم (موقوف/ملغى).
        if self.status not in (self.Status.PAUSED, self.Status.CANCELLED):
            if self.total_value and paid >= self.total_value:
                self.status = self.Status.COMPLETED
            else:
                self.status = self.Status.ACTIVE
        self.save(update_fields=["paid_amount", "status", "updated_at"])
        return self.paid_amount


class Installment(TimeStampedModel):
    """استحقاق واجب السداد ضمن اشتراك (DOMAIN_CONTRACT §3)."""

    class Status(models.TextChoices):
        PENDING = "pending", "معلّق"
        PARTIAL = "partial", "مسدّد جزئيًا"
        PAID = "paid", "مسدّد"
        OVERDUE = "overdue", "متأخر"

    subscription = models.ForeignKey(
        Subscription,
        on_delete=models.CASCADE,
        related_name="installments",
        verbose_name="الاشتراك",
    )
    sequence = models.PositiveIntegerField("التسلسل")
    due_date = models.DateField("تاريخ الاستحقاق")
    amount = money_field("المبلغ")
    paid_amount = money_field("المدفوع", default=0)
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.PENDING
    )
    last_reminder_at = models.DateTimeField("آخر تذكير", null=True, blank=True)

    class Meta:
        verbose_name = "استحقاق"
        verbose_name_plural = "الاستحقاقات"
        ordering = ("subscription", "sequence")
        indexes = [
            models.Index(fields=["subscription", "sequence"]),
            models.Index(fields=["status", "due_date"]),
        ]

    def __str__(self):
        return f"{self.subscription_id} · دفعة {self.sequence}"

    @property
    def remaining(self):
        """المتبقي من مبلغ الاستحقاق."""
        return (self.amount or Decimal("0")) - (self.paid_amount or Decimal("0"))
