"""Financial core models (SRS §7.7–§7.10, §7.14, §9.3, §9.4).

Cross-app foreign keys are declared as *string* references so this app never
imports another domain app at module load time.
"""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.core.encryption import EncryptedCharField
from apps.core.models import TimeStampedModel, money_field
from apps.core.references import make_reference
from apps.core.roles import Roles
from apps.core.validators import validate_upload

ZERO = Decimal("0")


# ---------------------------------------------------------------------------
# Supplier — المورد
# ---------------------------------------------------------------------------
class Supplier(TimeStampedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "نشط"
        INACTIVE = "inactive", "غير نشط"

    name = models.CharField("الاسم", max_length=200)
    supplier_type = models.CharField("نوع المورد", max_length=100, blank=True)
    phone = models.CharField("الهاتف", max_length=20, blank=True)
    email = models.EmailField("البريد الإلكتروني", blank=True)
    tax_number = models.CharField("الرقم الضريبي", max_length=50, blank=True)
    commercial_register = models.CharField("السجل التجاري", max_length=50, blank=True)
    address = models.CharField("العنوان", max_length=255, blank=True)
    bank_name = models.CharField("اسم البنك", max_length=150, blank=True)
    bank_account = EncryptedCharField("رقم الحساب", blank=True, default="")
    iban = EncryptedCharField("الآيبان", blank=True, default="")
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.ACTIVE
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.CASCADE,
        related_name="suppliers",
        null=True,
        blank=True,
        verbose_name="الجهة",
    )

    class Meta:
        verbose_name = "مورد"
        verbose_name_plural = "الموردون"
        ordering = ("name",)

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# Payment — الدفعة (SRS §7.7, §9.3)
# ---------------------------------------------------------------------------
class Payment(TimeStampedModel):
    class Method(models.TextChoices):
        TRANSFER = "transfer", "تحويل"
        DEPOSIT = "deposit", "إيداع"
        CASH = "cash", "نقدًا"
        POS = "pos", "نقاط بيع"
        LINK = "link", "رابط دفع"

    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        PENDING = "pending", "بانتظار المراجعة"
        APPROVED = "approved", "معتمدة"
        RETURNED = "returned", "معادة للاستكمال"
        REJECTED = "rejected", "مرفوضة"
        REVERSED = "reversed", "معكوسة"

    reference = models.CharField("الرقم المرجعي", max_length=20, unique=True, blank=True)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.PROTECT,
        related_name="payments",
        verbose_name="المشروع",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="payments",
        verbose_name="المساهم",
    )
    subscription = models.ForeignKey(
        "contributions.Subscription",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payments",
        verbose_name="الاشتراك",
    )
    amount = money_field("المبلغ")
    method = models.CharField(
        "طريقة الدفع", max_length=20, choices=Method.choices, default=Method.TRANSFER
    )
    date = models.DateField("التاريخ")
    reference_number = models.CharField("مرجع التحويل", max_length=100, blank=True)
    receiving_account = models.CharField("الحساب المستلم", max_length=150, blank=True)
    proof = models.FileField(
        "إثبات الدفع",
        upload_to="payments/proofs/",
        null=True,
        blank=True,
        validators=[validate_upload],
    )
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.PENDING
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="submitted_payments",
        verbose_name="أُرسلت بواسطة",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_payments",
        verbose_name="روجعت بواسطة",
    )
    rejection_reason = models.TextField("سبب الرفض/الإعادة", blank=True)
    notes = models.TextField("ملاحظات", blank=True)
    idempotency_key = models.CharField(
        "مفتاح منع التكرار", max_length=100, blank=True, db_index=True
    )

    class Meta:
        verbose_name = "دفعة"
        verbose_name_plural = "الدفعات"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["project", "status"]),
        ]

    def __str__(self):
        return self.reference or f"Payment #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("payment")
        super().save(*args, **kwargs)

    @property
    def allocated_amount(self):
        total = self.allocations.aggregate(total=models.Sum("amount"))["total"]
        return total or ZERO

    @property
    def unallocated_amount(self):
        return (self.amount or ZERO) - self.allocated_amount


class PaymentAllocation(TimeStampedModel):
    """توزيع الدفعة على استحقاقات الاشتراك. المجموع ≤ مبلغ الدفعة."""

    payment = models.ForeignKey(
        Payment,
        on_delete=models.CASCADE,
        related_name="allocations",
        verbose_name="الدفعة",
    )
    installment = models.ForeignKey(
        "contributions.Installment",
        on_delete=models.PROTECT,
        related_name="allocations",
        verbose_name="الاستحقاق",
    )
    amount = money_field("المبلغ")

    class Meta:
        verbose_name = "توزيع دفعة"
        verbose_name_plural = "توزيعات الدفعات"
        ordering = ("payment", "installment")

    def __str__(self):
        return f"{self.payment_id} → {self.installment_id}: {self.amount}"


# ---------------------------------------------------------------------------
# Revenue — الإيراد النقدي
# ---------------------------------------------------------------------------
class Revenue(TimeStampedModel):
    class RevenueType(models.TextChoices):
        SHARE = "share", "سهم"
        DONATION = "donation", "تبرع"
        GRANT = "grant", "منحة"
        CORPORATE = "corporate", "شراكة مؤسسية"
        EVENT = "event", "فعالية"
        OTHER = "other", "أخرى"

    class Status(models.TextChoices):
        APPROVED = "approved", "معتمد"
        REVERSED = "reversed", "معكوس"

    reference = models.CharField("الرقم المرجعي", max_length=20, unique=True, blank=True)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.PROTECT,
        related_name="revenues",
        verbose_name="المشروع",
    )
    revenue_type = models.CharField(
        "نوع الإيراد",
        max_length=20,
        choices=RevenueType.choices,
        default=RevenueType.DONATION,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revenues",
        verbose_name="المساهم",
    )
    external_name = models.CharField("اسم المساهم الخارجي", max_length=200, blank=True)
    external_phone = models.CharField("هاتف المساهم الخارجي", max_length=20, blank=True)
    payment = models.ForeignKey(
        Payment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="revenues",
        verbose_name="الدفعة",
    )
    amount = money_field("المبلغ")
    date = models.DateField("التاريخ")
    method = models.CharField("طريقة الدفع", max_length=50, blank=True)
    reference_number = models.CharField("مرجع التحويل", max_length=100, blank=True)
    receiving_account = models.CharField("الحساب المستلم", max_length=150, blank=True)
    description = models.TextField("الوصف", blank=True)
    is_public = models.BooleanField("عام", default=False)
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.APPROVED
    )

    class Meta:
        verbose_name = "إيراد"
        verbose_name_plural = "الإيرادات"
        ordering = ("-date", "-created_at")
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["revenue_type"]),
        ]

    def __str__(self):
        return self.reference or f"Revenue #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("revenue")
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# InKindContribution — المساهمة العينية (SRS §7.8)
# ---------------------------------------------------------------------------
class InKindContribution(TimeStampedModel):
    class Status(models.TextChoices):
        REGISTERED = "registered", "مسجلة"
        PENDING = "pending", "بانتظار المراجعة"
        ACCEPTED = "accepted", "مقبولة"
        RECEIVED = "received", "مستلمة"
        USED_PARTIAL = "used_partial", "مستخدمة جزئيًا"
        USED_FULL = "used_full", "مستخدمة كليًا"
        REJECTED = "rejected", "مرفوضة"
        CANCELLED = "cancelled", "ملغاة"

    reference = models.CharField("الرقم المرجعي", max_length=20, unique=True, blank=True)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.PROTECT,
        related_name="inkind_contributions",
        verbose_name="المشروع",
    )
    name = models.CharField("المادة", max_length=200)
    category = models.CharField("الفئة", max_length=100, blank=True)
    description = models.TextField("الوصف", blank=True)
    quantity = models.DecimalField("الكمية", max_digits=10, decimal_places=2)
    unit = models.CharField("الوحدة", max_length=50)
    estimated_value = money_field("القيمة التقديرية")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inkind",
        verbose_name="المساهم",
    )
    external_name = models.CharField("اسم المساهم الخارجي", max_length=200, blank=True)
    date = models.DateField("التاريخ")
    received_by = models.CharField("استلمها", max_length=150, blank=True)
    location = models.CharField("الموقع", max_length=200, blank=True)
    count_in_progress = models.BooleanField("تُحتسب في التقدم", default=False)
    is_public = models.BooleanField("عامة", default=False)
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.REGISTERED
    )

    class Meta:
        verbose_name = "مساهمة عينية"
        verbose_name_plural = "المساهمات العينية"
        ordering = ("-date", "-created_at")

    def __str__(self):
        return self.reference or self.name

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("inkind")
        super().save(*args, **kwargs)


class InKindImage(TimeStampedModel):
    contribution = models.ForeignKey(
        InKindContribution,
        on_delete=models.CASCADE,
        related_name="images",
        verbose_name="المساهمة",
    )
    image = models.ImageField("الصورة", upload_to="inkind/")

    class Meta:
        verbose_name = "صورة مساهمة عينية"
        verbose_name_plural = "صور المساهمات العينية"

    def __str__(self):
        return f"Image #{self.pk} · {self.contribution_id}"


# ---------------------------------------------------------------------------
# Receipt — الإيصال (SRS §7.14)
# ---------------------------------------------------------------------------
class Receipt(TimeStampedModel):
    code = models.CharField("الرمز", max_length=20, unique=True, blank=True)
    payment = models.OneToOneField(
        Payment,
        on_delete=models.CASCADE,
        related_name="receipt",
        null=True,
        blank=True,
        verbose_name="الدفعة",
    )
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.PROTECT,
        related_name="receipts",
        verbose_name="المشروع",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipts",
        verbose_name="المساهم",
    )
    amount = money_field("المبلغ")
    issued_at = models.DateTimeField("تاريخ الإصدار", auto_now_add=True)
    pdf = models.FileField("ملف الإيصال", upload_to="receipts/", null=True, blank=True)

    class Meta:
        verbose_name = "إيصال"
        verbose_name_plural = "الإيصالات"
        ordering = ("-issued_at",)

    def __str__(self):
        return self.code or f"Receipt #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = make_reference("receipt")
        super().save(*args, **kwargs)

    @property
    def verify_path(self):
        return f"/verify/{self.code}"

    @property
    def verify_url(self):
        base = getattr(settings, "PUBLIC_BASE_URL", "").rstrip("/")
        return f"{base}{self.verify_path}" if base else self.verify_path

    def generate_pdf(self):
        """Render a PDF with an embedded QR code linking to the verify page.

        reportlab / qrcode are optional dependencies — if either is missing we
        degrade gracefully and simply skip PDF generation.
        """
        from apps.finance.services import build_receipt_pdf

        return build_receipt_pdf(self)


# ---------------------------------------------------------------------------
# ProjectBudget / BudgetItem — الميزانية (SRS §7.10)
# ---------------------------------------------------------------------------
class ProjectBudget(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        PENDING = "pending", "بانتظار الاعتماد"
        APPROVED = "approved", "معتمدة"
        RETURNED = "returned", "معادة"

    reference = models.CharField("الرقم المرجعي", max_length=20, unique=True, blank=True)
    project = models.OneToOneField(
        "projects.Project",
        on_delete=models.CASCADE,
        related_name="budget",
        verbose_name="المشروع",
    )
    total_amount = money_field("إجمالي الميزانية")
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    note = models.TextField("ملاحظة", blank=True)

    class Meta:
        verbose_name = "ميزانية مشروع"
        verbose_name_plural = "ميزانيات المشاريع"
        ordering = ("-created_at",)

    def __str__(self):
        return self.reference or f"Budget #{self.pk}"

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("budget")
        super().save(*args, **kwargs)


class BudgetItem(TimeStampedModel):
    budget = models.ForeignKey(
        ProjectBudget,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="الميزانية",
    )
    name = models.CharField("البند", max_length=200)
    approved_amount = money_field("المبلغ المعتمد")
    spent_amount = money_field("المبلغ المصروف", default=0)
    committed_amount = money_field("المبلغ الملتزم به", default=0)
    alert_threshold = models.DecimalField(
        "حد التنبيه (%)", max_digits=5, decimal_places=2, default=Decimal("90")
    )

    class Meta:
        verbose_name = "بند ميزانية"
        verbose_name_plural = "بنود الميزانية"
        ordering = ("budget", "name")

    def __str__(self):
        return self.name

    @property
    def remaining(self):
        return (
            (self.approved_amount or ZERO)
            - (self.spent_amount or ZERO)
            - (self.committed_amount or ZERO)
        )

    @property
    def spend_ratio(self):
        approved = self.approved_amount or ZERO
        if approved <= ZERO:
            return ZERO
        return ((self.spent_amount or ZERO) / approved) * Decimal("100")


# ---------------------------------------------------------------------------
# Expense / ExpenseApproval — المصروف (SRS §7.9, §9.4)
# ---------------------------------------------------------------------------
class Expense(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        UNDER_REVIEW = "under_review", "قيد المراجعة"
        APPROVED = "approved", "معتمد"
        RETURNED = "returned", "معاد للتعديل"
        REJECTED = "rejected", "مرفوض"
        PAID = "paid", "مدفوع"

    class Tier(models.TextChoices):
        LOW = "low", "منخفض"
        MEDIUM = "medium", "متوسط"
        HIGH = "high", "مرتفع"

    reference = models.CharField("الرقم المرجعي", max_length=20, unique=True, blank=True)
    project = models.ForeignKey(
        "projects.Project",
        on_delete=models.PROTECT,
        related_name="expenses",
        verbose_name="المشروع",
    )
    category = models.CharField("الفئة", max_length=100, blank=True)
    supplier = models.ForeignKey(
        Supplier,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses",
        verbose_name="المورد",
    )
    budget_item = models.ForeignKey(
        BudgetItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses",
        verbose_name="بند الميزانية",
    )
    stage = models.ForeignKey(
        "projects.ProjectStage",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses",
        verbose_name="المرحلة",
    )
    invoice_number = models.CharField("رقم الفاتورة", max_length=100, blank=True)
    invoice_date = models.DateField("تاريخ الفاتورة")
    amount_before_tax = money_field("المبلغ قبل الضريبة")
    tax_amount = money_field("مبلغ الضريبة", default=0)
    total_amount = money_field("المبلغ الإجمالي")
    payment_date = models.DateField("تاريخ الدفع", null=True, blank=True)
    payment_method = models.CharField("طريقة الدفع", max_length=50, blank=True)
    payment_reference = models.CharField("مرجع الدفع", max_length=100, blank=True)
    description = models.TextField("الوصف")
    invoice_file = models.FileField(
        "ملف الفاتورة",
        upload_to="expenses/invoices/",
        null=True,
        blank=True,
        validators=[validate_upload],
    )
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_expenses",
        verbose_name="أنشأه",
    )
    tier = models.CharField(
        "المستوى", max_length=10, choices=Tier.choices, default=Tier.LOW
    )

    class Meta:
        verbose_name = "مصروف"
        verbose_name_plural = "المصروفات"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["project", "status"]),
            models.Index(fields=["tier"]),
        ]

    def __str__(self):
        return self.reference or f"Expense #{self.pk}"

    def compute_tier(self):
        """Derive the tier from the total amount using policy thresholds."""
        amount = self.total_amount or ZERO
        low_max = Decimal(str(getattr(settings, "EXPENSE_TIER_LOW_MAX", 500)))
        medium_max = Decimal(str(getattr(settings, "EXPENSE_TIER_MEDIUM_MAX", 5000)))
        if amount <= low_max:
            return self.Tier.LOW
        if amount <= medium_max:
            return self.Tier.MEDIUM
        return self.Tier.HIGH

    @property
    def invoice_required(self):
        threshold = Decimal(str(getattr(settings, "EXPENSE_INVOICE_REQUIRED_ABOVE", 1000)))
        return (self.total_amount or ZERO) > threshold

    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("expense")
        self.tier = self.compute_tier()
        super().save(*args, **kwargs)


class ExpenseApproval(TimeStampedModel):
    class Decision(models.TextChoices):
        PENDING = "pending", "بانتظار"
        APPROVED = "approved", "معتمد"
        REJECTED = "rejected", "مرفوض"
        RETURNED = "returned", "معاد"

    expense = models.ForeignKey(
        Expense,
        on_delete=models.CASCADE,
        related_name="approvals",
        verbose_name="المصروف",
    )
    step_role = models.CharField("دور الخطوة", max_length=30, choices=Roles.CHOICES)
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="المعتمد",
    )
    decision = models.CharField(
        "القرار", max_length=20, choices=Decision.choices, default=Decision.PENDING
    )
    note = models.TextField("ملاحظة", blank=True)
    decided_at = models.DateTimeField("تاريخ القرار", null=True, blank=True)

    class Meta:
        verbose_name = "خطوة اعتماد مصروف"
        verbose_name_plural = "خطوات اعتماد المصروفات"
        ordering = ("expense", "created_at")

    def __str__(self):
        return f"{self.expense_id} · {self.step_role} · {self.decision}"
