"""Project catalogue, execution stages, updates and transparency (SRS §7.4, §7.5,
§7.11, §7.12, §9.2, §9.7, §6.1)."""
from decimal import Decimal

from django.db import models
from django.utils import timezone
from django.utils.text import slugify

from apps.core.encryption import EncryptedCharField
from apps.core.models import TimeStampedModel, money_field
from apps.core.references import make_reference


class ProjectCategory(TimeStampedModel):
    """تصنيف المشاريع (§7.4)."""

    name = models.CharField("الاسم", max_length=120, unique=True)
    icon = models.CharField("الأيقونة", max_length=60, blank=True, default="folder")
    order = models.PositiveIntegerField("الترتيب", default=0)

    class Meta:
        verbose_name = "تصنيف مشروع"
        verbose_name_plural = "تصنيفات المشاريع"
        ordering = ("order", "name")

    def __str__(self):
        return self.name


class Project(TimeStampedModel):
    """المشروع الخيري بدورة حياته المالية والتنفيذية (§6.1, §7.4)."""

    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        PENDING_APPROVAL = "pending_approval", "بانتظار الاعتماد"
        RETURNED = "returned", "معاد للتعديل"
        APPROVED = "approved", "معتمد"
        ACTIVE = "active", "نشط"
        FUNDED = "funded", "مكتمل التمويل"
        IN_PROGRESS = "in_progress", "قيد التنفيذ"
        SUSPENDED = "suspended", "موقوف مؤقتًا"
        CANCELLED = "cancelled", "ملغى"
        CLOSING = "closing", "طلب إغلاق"
        FINANCIAL_REVIEW = "financial_review", "بانتظار المراجعة المالية"
        EXECUTION_REVIEW = "execution_review", "بانتظار المراجعة التنفيذية"
        COMPLETED = "completed", "مكتمل"
        FINANCIALLY_CLOSED = "financially_closed", "مغلق ماليًا"

    #: الحالات التي يظهر بها المشروع في الصفحات العامة (§7.5).
    PUBLIC_STATUSES = (
        Status.ACTIVE,
        Status.FUNDED,
        Status.IN_PROGRESS,
        Status.COMPLETED,
    )

    reference = models.CharField(
        "الرقم المرجعي", max_length=20, unique=True, blank=True
    )
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="projects",
        verbose_name="الجهة",
    )
    category = models.ForeignKey(
        ProjectCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="projects",
        verbose_name="التصنيف",
    )
    manager = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_projects",
        verbose_name="مدير المشروع",
    )

    name = models.CharField("اسم المشروع", max_length=200)
    public_slug = models.SlugField(
        "الرابط العام", max_length=220, unique=True, blank=True
    )
    short_description = models.CharField("وصف مختصر", max_length=280)
    description = models.TextField("الوصف")
    cover_image = models.ImageField(
        "صورة الغلاف", upload_to="projects/covers/", null=True, blank=True
    )

    location = models.CharField("الموقع", max_length=200, blank=True)
    state = models.CharField("الولاية/المنطقة", max_length=120, blank=True)
    latitude = models.FloatField("خط العرض", null=True, blank=True)
    longitude = models.FloatField("خط الطول", null=True, blank=True)
    beneficiaries_count = models.PositiveIntegerField(
        "عدد المستفيدين", null=True, blank=True
    )
    start_date = models.DateField("تاريخ البدء", null=True, blank=True)
    end_date = models.DateField("تاريخ الانتهاء", null=True, blank=True)

    # المالية
    currency = models.CharField("العملة", max_length=8, default="OMR")
    estimated_cost = money_field("التكلفة التقديرية")
    target_amount = money_field("المبلغ المستهدف")
    initial_amount = money_field("المبلغ المتوفر", default=0)
    minimum_contribution = money_field("أقل مساهمة", default=0)
    open_contribution = models.BooleanField("السماح بمبلغ مفتوح", default=True)
    count_inkind_in_progress = models.BooleanField(
        "احتساب العيني في الإنجاز", default=False
    )

    # حساب الاستلام
    bank_name = models.CharField("اسم البنك", max_length=120, blank=True)
    bank_account_name = models.CharField(
        "اسم صاحب الحساب", max_length=150, blank=True
    )
    iban = EncryptedCharField("الآيبان", blank=True, default="")
    payment_link = models.URLField("رابط الدفع", blank=True)
    payment_instructions = models.TextField("تعليمات الدفع", blank=True)

    # الحالة والمؤشرات
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    financial_progress = models.DecimalField(
        "الإنجاز المالي", max_digits=5, decimal_places=2, default=0
    )
    execution_progress = models.DecimalField(
        "الإنجاز التنفيذي", max_digits=5, decimal_places=2, default=0
    )
    collected_amount = money_field("المبلغ المحصّل", default=0)
    contributors_count = models.PositiveIntegerField("عدد المساهمين", default=0)
    contributions_enabled = models.BooleanField(
        "استقبال المساهمات مفعّل", default=True
    )
    review_note = models.TextField("ملاحظة المراجعة", blank=True)
    published_at = models.DateTimeField("تاريخ النشر", null=True, blank=True)

    class Meta:
        verbose_name = "مشروع"
        verbose_name_plural = "المشاريع"
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["public_slug"]),
            models.Index(fields=["organization"]),
        ]

    def __str__(self):
        return self.name

    # ------------------------------------------------------------------ save
    def save(self, *args, **kwargs):
        if not self.reference:
            self.reference = make_reference("project")
        if not self.public_slug:
            self.public_slug = self._generate_slug()
        super().save(*args, **kwargs)

    def _generate_slug(self):
        """رابط عام فريد من الاسم + لاحقة عشوائية (§7.4)."""
        import secrets

        base = slugify(self.name, allow_unicode=True) or "project"
        base = base[:200]
        for _ in range(10):
            suffix = secrets.token_hex(3)
            candidate = f"{base}-{suffix}"
            if not Project.objects.filter(public_slug=candidate).exists():
                return candidate
        # fallback نادر جدًا
        return f"{base}-{secrets.token_hex(6)}"

    # -------------------------------------------------------------- computed
    @property
    def remaining_amount(self):
        return (self.target_amount or Decimal("0")) - (
            self.collected_amount or Decimal("0")
        )

    @property
    def is_public_visible(self):
        return self.status in self.PUBLIC_STATUSES

    # ------------------------------------------------------------ financials
    def recalculate_financials(self, save=True):
        """يجمع الإيرادات المعتمدة ويحدّث المحصّل والإنجاز المالي وعدد المساهمين.

        يُستدعى بعد اعتماد الدفعات/الإيرادات (§10 قاعدة 16).
        """
        from django.db.models import Count, Sum

        # استيراد داخل الدالة لتفادي الدوران بين التطبيقات.
        Revenue = self.revenues.model
        agg = self.revenues.filter(status="approved").aggregate(
            total=Sum("amount"),
            contributors=Count("user", distinct=True),
        )
        collected = agg["total"] or Decimal("0")
        self.collected_amount = collected

        target = self.target_amount or Decimal("0")
        if target > 0:
            progress = (collected / target) * Decimal("100")
            self.financial_progress = min(progress, Decimal("100")).quantize(
                Decimal("0.01")
            )
        else:
            self.financial_progress = Decimal("0")

        # عدد المساهمين الفريدين من الإيرادات المعتمدة المرتبطة بمستخدم.
        self.contributors_count = agg["contributors"] or 0

        if save:
            self.save(
                update_fields=[
                    "collected_amount",
                    "financial_progress",
                    "contributors_count",
                    "updated_at",
                ]
            )
        return self.collected_amount

    def recalculate_execution(self, save=True):
        """يحسب الإنجاز التنفيذي كمعدل موزون بأوزان المراحل (§7.11)."""
        stages = list(self.stages.all())
        total_weight = sum((s.weight or Decimal("0")) for s in stages)
        if total_weight <= 0:
            self.execution_progress = Decimal("0")
        else:
            weighted = sum(
                (s.weight or Decimal("0")) * (s.progress or Decimal("0"))
                for s in stages
            )
            self.execution_progress = (weighted / total_weight).quantize(
                Decimal("0.01")
            )
        if save:
            self.save(update_fields=["execution_progress", "updated_at"])
        return self.execution_progress


class ProjectStage(TimeStampedModel):
    """مرحلة تنفيذ بوزن نسبي (§7.11). مجموع الأوزان = 100%."""

    class Status(models.TextChoices):
        PENDING = "pending", "بانتظار البدء"
        IN_PROGRESS = "in_progress", "قيد التنفيذ"
        COMPLETED = "completed", "مكتملة"
        DELAYED = "delayed", "متأخرة"

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="stages",
        verbose_name="المشروع",
    )
    name = models.CharField("اسم المرحلة", max_length=200)
    description = models.TextField("الوصف", blank=True)
    weight = models.DecimalField("الوزن", max_digits=5, decimal_places=2)
    start_date = models.DateField("تاريخ البدء", null=True, blank=True)
    end_date = models.DateField("تاريخ الانتهاء", null=True, blank=True)
    responsible = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="المسؤول",
    )
    progress = models.DecimalField(
        "النسبة", max_digits=5, decimal_places=2, default=0
    )
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.PENDING
    )
    order = models.PositiveIntegerField("الترتيب", default=0)

    class Meta:
        verbose_name = "مرحلة مشروع"
        verbose_name_plural = "مراحل المشاريع"
        ordering = ("project", "order", "id")

    def __str__(self):
        return f"{self.project.name} · {self.name}"


class ProjectUpdate(TimeStampedModel):
    """تحديث المشروع بدورة نشر (§7.11, §9.7)."""

    class Visibility(models.TextChoices):
        PUBLIC = "public", "عام"
        INTERNAL = "internal", "داخلي"

    class Status(models.TextChoices):
        DRAFT = "draft", "مسودة"
        PENDING = "pending", "بانتظار المراجعة"
        SCHEDULED = "scheduled", "مجدول"
        PUBLISHED = "published", "منشور"
        ARCHIVED = "archived", "مؤرشف"

    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="updates",
        verbose_name="المشروع",
    )
    stage = models.ForeignKey(
        ProjectStage,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updates",
        verbose_name="المرحلة",
    )
    title = models.CharField("العنوان", max_length=200)
    body = models.TextField("المحتوى")
    new_progress = models.DecimalField(
        "النسبة الجديدة", max_digits=5, decimal_places=2, null=True, blank=True
    )
    visibility = models.CharField(
        "الظهور",
        max_length=20,
        choices=Visibility.choices,
        default=Visibility.PUBLIC,
    )
    status = models.CharField(
        "الحالة", max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    published_at = models.DateTimeField("تاريخ النشر", null=True, blank=True)
    author = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="project_updates",
        verbose_name="الكاتب",
    )
    notify_contributors = models.BooleanField("إشعار المساهمين", default=False)

    class Meta:
        verbose_name = "تحديث مشروع"
        verbose_name_plural = "تحديثات المشاريع"
        ordering = ("-created_at",)

    def __str__(self):
        return self.title

    def publish(self):
        """ينشر التحديث ويطبّق نسبة الإنجاز الجديدة على المرحلة إن وُجدت (§9.7)."""
        self.status = self.Status.PUBLISHED
        if not self.published_at:
            self.published_at = timezone.now()
        self.save(update_fields=["status", "published_at", "updated_at"])
        # حدّث نسبة المرحلة والإنجاز التنفيذي عند وجود نسبة جديدة.
        if self.new_progress is not None and self.stage_id:
            self.stage.progress = self.new_progress
            self.stage.save(update_fields=["progress", "updated_at"])
            self.project.recalculate_execution()


class ProjectUpdateImage(TimeStampedModel):
    """صور مرفقة بتحديث المشروع."""

    update = models.ForeignKey(
        ProjectUpdate,
        on_delete=models.CASCADE,
        related_name="images",
        verbose_name="التحديث",
    )
    image = models.ImageField("الصورة", upload_to="projects/updates/")

    class Meta:
        verbose_name = "صورة تحديث"
        verbose_name_plural = "صور التحديثات"

    def __str__(self):
        return f"صورة #{self.pk}"


class TransparencySetting(TimeStampedModel):
    """إعدادات ما يُعرض في الصفحة العامة للمشروع (§7.12)."""

    project = models.OneToOneField(
        Project,
        on_delete=models.CASCADE,
        related_name="transparency",
        verbose_name="المشروع",
    )
    show_target = models.BooleanField("عرض الهدف", default=True)
    show_collected = models.BooleanField("عرض المحصّل", default=True)
    show_remaining = models.BooleanField("عرض المتبقي", default=True)
    show_revenues = models.BooleanField("عرض الإيرادات", default=True)
    show_expenses = models.BooleanField("عرض المصروفات", default=True)
    show_balance = models.BooleanField("عرض الرصيد", default=False)
    show_invoices = models.BooleanField("عرض الفواتير", default=False)
    show_contributor_names = models.BooleanField(
        "عرض أسماء المساهمين", default=False
    )
    show_stages = models.BooleanField("عرض المراحل", default=True)
    show_updates = models.BooleanField("عرض التحديثات", default=True)
    updated_by = models.ForeignKey(
        "accounts.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transparency_updates",
        verbose_name="آخر تعديل بواسطة",
    )

    class Meta:
        verbose_name = "إعداد شفافية"
        verbose_name_plural = "إعدادات الشفافية"

    def __str__(self):
        return f"شفافية · {self.project.name}"
