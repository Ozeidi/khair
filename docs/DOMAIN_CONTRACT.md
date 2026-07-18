# عقد النطاق (Domain & API Contract) — منصة الخير

> **مصدر الحقيقة الوحيد** لبناء تطبيقات الـbackend. كل وكيل يبني تطبيقًا واحدًا يجب أن يلتزم
> حرفيًا بأسماء النماذج والحقول و`related_name` وقيم الحالات ومسارات الـAPI الواردة هنا حتى
> تتكامل الوحدات دون تعارض. العلاقات بين التطبيقات تُكتب كـ**سلاسل نصية** مثل
> `models.ForeignKey("projects.Project", ...)` لتجنّب الاقتران عند الاستيراد.

## اصطلاحات عامة (من `apps.core`)
- ترث كل النماذج من `apps.core.models.TimeStampedModel` (تعطي `created_at`, `updated_at`).
- القيم المالية: `from apps.core.models import money_field` ثم `amount = money_field("المبلغ")`.
  (Decimal، 14 خانة، منزلتان عشريتان).
- الأرقام المرجعية: `from apps.core.references import make_reference` → `make_reference("payment")`.
  الأنواع المتاحة: project, organization, subscription, payment, revenue, inkind, expense,
  receipt, campaign, budget.
- الأخطاء المنطقية: `from apps.core.exceptions import BusinessRuleError` → `raise BusinessRuleError("...", code="...")`.
- التدقيق: `from apps.audit.services import record` ثم
  `record(AuditLog.Action.APPROVE, instance, summary="...", old=..., new=...)`.
  استورد `from apps.audit.models import AuditLog`.
- الصلاحيات: `from apps.core.permissions import HasRole, IsPlatformAdmin, IsFinanceRole, ReadOnly`.
  الأدوار: `from apps.core.roles import Roles` (PLATFORM_ADMIN, ORG_MANAGER, PROJECT_OWNER,
  FINANCE_OFFICER, AUDITOR, CONTENT_OFFICER, CONTRIBUTOR).
- المستخدم: `settings.AUTH_USER_MODEL` أو السلسلة `"accounts.User"`.
- كل تطبيق يوفّر: `apps.py` (AppConfig باسم `apps.<name>`), `models.py`, `serializers.py`,
  `views.py` (DRF ViewSets), `urls.py` (DefaultRouter → `urlpatterns = router.urls`), `admin.py`.
- كل `ViewSet` مالي/حسّاس يضبط `permission_classes`. القراءة العامة (public) تُتاح بـ`AllowAny`
  على مسارات `public/` فقط.
- التقسيم الافتراضي (pagination) معرّف عالميًا. أضف `filterset_fields`, `search_fields`,
  `ordering_fields` حيثما يفيد.
- المسارات كلها تحت `/api/v1/` (يضاف عبر `config/urls.py`؛ كل تطبيق يسجّل routerه فقط).

---

## 1) organizations (تطبيق `apps.organizations`)

### Organization
- `reference` CharField(max_length=20, unique, blank) — يولّد `make_reference("organization")` في `save()` إن كان فارغًا.
- `name` (نص), `org_type` choices: committee/association/foundation/individual/team
  (لجنة/جمعية/مؤسسة/فرد/فريق), `description` (TextField),
- `logo` ImageField(upload_to="orgs/logos/", null, blank),
- `manager` FK("accounts.User", SET_NULL, null, related_name="managed_organizations"),
- `phone` CharField, `email` EmailField(blank), `location` CharField(blank),
- `bank_name` CharField(blank), `bank_account_name` CharField(blank),
  `iban` استخدم `apps.core.encryption.EncryptedCharField(blank, default="")`,
- `status` choices: draft/pending/approved/returned/rejected/suspended (default draft),
- `review_note` TextField(blank).
- `__str__` = name.

### OrganizationMember
- `organization` FK(Organization, CASCADE, related_name="members"),
- `user` FK("accounts.User", CASCADE, related_name="organization_memberships"),
- `role` CharField(choices=Roles.CHOICES),
- unique_together (organization, user).

### OrganizationDocument
- `organization` FK(Organization, CASCADE, related_name="documents"),
- `title` CharField, `file` FileField(upload_to="orgs/docs/", validators=[validate_upload]),
  (`from apps.core.validators import validate_upload`).

### API (router basenames)
- `organizations` → OrganizationViewSet (ModelViewSet). staff+admin. أفعال إضافية:
  `@action(detail=True, methods=["post"]) submit` (draft→pending),
  `approve`/`reject`/`return_for_edits` (IsPlatformAdmin) تغيّر الحالة وتستدعي `record(...)`.
- `organization-members` → nested-ish ViewSet (filter by organization).
- مسار عام: ضِف ViewSet `public/organizations/{id}` اختياري (يكفي التفاصيل العامة).

---

## 2) projects (تطبيق `apps.projects`)

### ProjectCategory
- `name` CharField(unique), `icon` CharField(blank, default="folder"), `order` PositiveInteger(default=0).

### Project
- `reference` CharField(20, unique, blank) → `make_reference("project")` في save().
- `organization` FK("organizations.Organization", PROTECT, related_name="projects"),
- `category` FK(ProjectCategory, SET_NULL, null, related_name="projects"),
- `manager` FK("accounts.User", SET_NULL, null, related_name="managed_projects"),
- `name` CharField, `public_slug` SlugField(unique, blank) (يولّد تلقائيًا من الاسم + رقم عشوائي في save),
- `short_description` CharField(max_length=280), `description` TextField,
- `cover_image` ImageField(upload_to="projects/covers/", null, blank),
- `location` CharField(blank), `state` CharField(blank) (الولاية/المنطقة),
- `latitude`/`longitude` FloatField(null, blank),
- `beneficiaries_count` PositiveInteger(null, blank),
- `start_date` DateField(null, blank), `end_date` DateField(null, blank),
- **المالية:** `currency` CharField(default="OMR"), `estimated_cost` money_field,
  `target_amount` money_field, `initial_amount` money_field(default=0),
  `minimum_contribution` money_field(default=0),
  `open_contribution` BooleanField(default=True), `count_inkind_in_progress` BooleanField(default=False),
- **حساب الاستلام:** `bank_name` CharField(blank), `bank_account_name` CharField(blank),
  `iban` EncryptedCharField(blank, default=""), `payment_link` URLField(blank), `payment_instructions` TextField(blank),
- **الحالة/المؤشرات:** `status` choices (انظر القائمة أدناه، default draft),
  `financial_progress` DecimalField(max_digits=5, decimal_places=2, default=0),
  `execution_progress` DecimalField(max_digits=5, decimal_places=2, default=0),
  `collected_amount` money_field(default=0) (يُحدَّث عند اعتماد الدفعات/الإيرادات),
  `contributors_count` PositiveInteger(default=0),
  `contributions_enabled` BooleanField(default=True),
  `review_note` TextField(blank), `published_at` DateTimeField(null, blank).
- **حالات المشروع** (status choices، القيم البرمجية): draft, pending_approval, returned, approved,
  active, funded, in_progress, suspended, cancelled, closing, financial_review, execution_review,
  completed, financially_closed. (التسميات العربية في §6.1 من claude.md).
- خصائص محسوبة: `remaining_amount` = target_amount - collected_amount.
- ميثود `recalculate_financials()` يجمع الإيرادات المعتمدة ويحدّث collected_amount + financial_progress + contributors_count.

### ProjectStage (مراحل التنفيذ)
- `project` FK(Project, CASCADE, related_name="stages"),
- `name`, `description` TextField(blank), `weight` DecimalField(5,2) (مجموع الأوزان=100),
- `start_date`/`end_date` DateField(null, blank),
- `responsible` FK("accounts.User", SET_NULL, null, blank, related_name="+"),
- `progress` DecimalField(5,2, default=0), `status` choices: pending/in_progress/completed/delayed,
- `order` PositiveInteger(default=0).

### ProjectUpdate (تحديثات المشروع)
- `project` FK(Project, CASCADE, related_name="updates"),
- `stage` FK(ProjectStage, SET_NULL, null, blank, related_name="updates"),
- `title`, `body` TextField, `new_progress` DecimalField(5,2, null, blank),
- `visibility` choices: public/internal (default public),
- `status` choices: draft/pending/scheduled/published/archived (default draft),
- `published_at` DateTimeField(null, blank), `author` FK("accounts.User", SET_NULL, null),
- `notify_contributors` BooleanField(default=False).

### ProjectUpdateImage
- `update` FK(ProjectUpdate, CASCADE, related_name="images"), `image` ImageField(upload_to="projects/updates/").

### TransparencySetting (شفافية — علاقة 1‑1 مع المشروع)
- `project` OneToOneField(Project, CASCADE, related_name="transparency"),
- حقول boolean (default True ما لم يُذكر): `show_target`, `show_collected`, `show_remaining`,
  `show_revenues`, `show_expenses`, `show_balance` (default False), `show_invoices` (default False),
  `show_contributor_names` (default False), `show_stages`, `show_updates`,
- `updated_by` FK("accounts.User", SET_NULL, null), (updated_at من TimeStamped يظهر آخر تحديث).

### API
- عام (AllowAny): `public/projects` (ListRetrieve, lookup_field="public_slug",
  يعرض فقط الحالات المنشورة: active/funded/in_progress/completed + احترام TransparencySetting),
  `public/categories`, `public/stats` (إجماليات المنصة).
- staff: `projects` (ModelViewSet) + أفعال: submit, approve, reject, return_for_edits,
  suspend, toggle_contributions. `project-stages`, `project-updates` (+ publish action),
  `categories` (admin write), `transparency` (retrieve/update by project owner).
- كل تغيير حالة/اعتماد يسجّل `record(...)`.

---

## 3) contributions (تطبيق `apps.contributions`)

### ShareType (أنواع الأسهم)
- `project` FK("projects.Project", CASCADE, related_name="share_types"),
- `name`, `value` money_field, `description` TextField(blank),
- `frequency` choices (القيم): one_time, weekly, monthly, quarterly, semiannual, annual, custom,
- `min_quantity` PositiveInteger(default=1), `max_quantity` PositiveInteger(null, blank),
- `installments_count` PositiveInteger(null, blank) (لِلدوري),
- `order` PositiveInteger(default=0), `is_active` BooleanField(default=True).

### Subscription (الاشتراك)
- `reference` CharField(20, unique, blank) → make_reference("subscription").
- `project` FK("projects.Project", PROTECT, related_name="subscriptions"),
- `user` FK("accounts.User", PROTECT, related_name="subscriptions"),
- `share_type` FK(ShareType, PROTECT, null, blank, related_name="subscriptions"),
- `contribution_type` choices: share/open/subscription (سهم/مبلغ مفتوح/اشتراك دوري),
- `quantity` PositiveInteger(default=1),
- `unit_value` money_field, `total_value` money_field,
  `paid_amount` money_field(default=0), (المتبقي = total_value - paid_amount خاصية),
- `frequency` choices (كما ShareType), `start_date` DateField,
- `installments_count` PositiveInteger(default=1),
- `public_name_preference` choices: full/anonymous/hidden_amount (كامل/فاعل خير/إخفاء المبلغ) default anonymous,
- `status` choices: active/completed/paused/cancelled (default active).
- ميثود `generate_installments()` ينشئ Installment حسب الدورية وعدد الدفعات (يقسّم total_value).
- ميثود `recalculate()` يحدّث paid_amount والحالة من الاستحقاقات/التوزيعات.

### Installment (الاستحقاق)
- `subscription` FK(Subscription, CASCADE, related_name="installments"),
- `sequence` PositiveInteger, `due_date` DateField,
- `amount` money_field, `paid_amount` money_field(default=0),
- `status` choices: pending/partial/paid/overdue (default pending),
- `last_reminder_at` DateTimeField(null, blank).
- خاصية `remaining` = amount - paid_amount.

### API
- `share-types` (ModelViewSet, staff, filter by project).
- `subscriptions` (ModelViewSet): المساهم يرى/ينشئ اشتراكاته؛ staff يرى اشتراكات مشاريعه.
  عند الإنشاء: يحسب total_value، يولّد reference، ينشئ الاستحقاقات، يحدّث contributors_count،
  ويستدعي communications enqueue (تأكيد اشتراك) عبر `apps.communications.services.enqueue_message` (لفّها بـtry/except).
  أفعال: `pause`, `cancel` (يوقف الاستحقاقات المستقبلية فقط).
- `installments` (ReadOnly + filter by subscription/project). أكشن `send_reminder` (staff).
- عام: `public/projects/{slug}/share-types` للقراءة.

---

## 4) finance (تطبيق `apps.finance`) — القلب المالي

### Supplier (المورد)
- `name`, `supplier_type` CharField(blank), `phone`, `email` (blank),
  `tax_number` (blank), `commercial_register` (blank), `address` (blank),
  `bank_name` (blank), `bank_account` EncryptedCharField(blank, default=""), `iban` EncryptedCharField(blank, default=""),
  `status` choices active/inactive, `organization` FK("organizations.Organization", CASCADE, related_name="suppliers", null).

### Payment (الدفعة) — SRS §7.7, §9.3
- `reference` CharField(20, unique, blank) → make_reference("payment").
- `project` FK("projects.Project", PROTECT, related_name="payments"),
- `user` FK("accounts.User", PROTECT, null, blank, related_name="payments"),
- `subscription` FK("contributions.Subscription", SET_NULL, null, blank, related_name="payments"),
- `amount` money_field, `method` choices: transfer/deposit/cash/pos/link,
- `date` DateField, `reference_number` CharField(blank) (مرجع التحويل),
- `receiving_account` CharField(blank), `proof` FileField(upload_to="payments/proofs/", null, blank, validators=[validate_upload]),
- `status` choices: draft/pending/approved/returned/rejected/reversed (default pending),
- `submitted_by` FK("accounts.User", SET_NULL, null, related_name="submitted_payments"),
- `reviewed_by` FK("accounts.User", SET_NULL, null, blank, related_name="reviewed_payments"),
- `rejection_reason` TextField(blank), `notes` TextField(blank),
- `idempotency_key` CharField(blank, db_index) لمنع التكرار.

### PaymentAllocation (توزيع الدفعة على الاستحقاقات)
- `payment` FK(Payment, CASCADE, related_name="allocations"),
- `installment` FK("contributions.Installment", PROTECT, related_name="allocations"),
- `amount` money_field. القيد: مجموع التوزيعات ≤ amount الدفعة.

### Revenue (الإيراد) — نقدي
- `reference` CharField(20, unique, blank) → make_reference("revenue").
- `project` FK("projects.Project", PROTECT, related_name="revenues"),
- `revenue_type` choices: share/donation/grant/corporate/event/other,
- `user` FK("accounts.User", SET_NULL, null, blank, related_name="revenues"),
- `external_name` CharField(blank), `external_phone` CharField(blank),
- `payment` FK(Payment, SET_NULL, null, blank, related_name="revenues") (إن نشأ من دفعة),
- `amount` money_field, `date` DateField, `method` CharField(blank),
- `reference_number` CharField(blank), `receiving_account` CharField(blank),
- `description` TextField(blank), `is_public` BooleanField(default=False),
- `status` choices approved/reversed (default approved). لا يُحذف المعتمد.

### InKindContribution (مساهمة عينية) — SRS §7.8
- `reference` CharField(20, unique, blank) → make_reference("inkind").
- `project` FK("projects.Project", PROTECT, related_name="inkind_contributions"),
- `name` (المادة), `category` CharField(blank), `description` TextField(blank),
- `quantity` DecimalField(10,2), `unit` CharField, `estimated_value` money_field,
- `user` FK("accounts.User", SET_NULL, null, blank, related_name="inkind"),
- `external_name` CharField(blank), `date` DateField, `received_by` CharField(blank),
- `location` CharField(blank), `count_in_progress` BooleanField(default=False), `is_public` BooleanField(default=False),
- `status` choices: registered/pending/accepted/received/used_partial/used_full/rejected/cancelled.

### InKindImage: `contribution` FK(InKindContribution, CASCADE, related_name="images"), `image` ImageField.

### Receipt (الإيصال) — SRS §7.14
- `code` CharField(20, unique, blank) → make_reference("receipt").
- `payment` OneToOneField(Payment, CASCADE, related_name="receipt", null, blank),
- `project` FK("projects.Project", PROTECT, related_name="receipts"),
- `user` FK("accounts.User", SET_NULL, null, blank, related_name="receipts"),
- `amount` money_field, `issued_at` DateTimeField(auto_now_add),
- `pdf` FileField(upload_to="receipts/", null, blank).
- ميثود/خدمة `generate_pdf()` تُنشئ PDF عبر reportlab مع QR (`qrcode`) لرابط التحقق `/verify/{code}` (اختياري: يمكن توليدها كسلة، والتحقق يعمل من البيانات).

### ProjectBudget (الميزانية) — SRS §7.10
- `reference` CharField(20, unique, blank) → make_reference("budget").
- `project` OneToOneField("projects.Project", CASCADE, related_name="budget"),
- `total_amount` money_field, `status` choices draft/pending/approved/returned (default draft),
- `note` TextField(blank).

### BudgetItem
- `budget` FK(ProjectBudget, CASCADE, related_name="items"),
- `name`, `approved_amount` money_field, `spent_amount` money_field(default=0),
  `committed_amount` money_field(default=0),
- خصائص: `remaining` = approved - spent - committed; `spend_ratio`.
- `alert_threshold` DecimalField(5,2, default=90).

### Expense (المصروف) — SRS §7.9, §9.4
- `reference` CharField(20, unique, blank) → make_reference("expense").
- `project` FK("projects.Project", PROTECT, related_name="expenses"),
- `category` FK(ProjectCategory? لا — استخدم CharField `category`) : `category` CharField(blank) أو FK بسيط ExpenseCategory اختياري؛ **استخدم CharField `category`**.
- `supplier` FK(Supplier, SET_NULL, null, blank, related_name="expenses"),
- `budget_item` FK(BudgetItem, SET_NULL, null, blank, related_name="expenses"),
- `stage` FK("projects.ProjectStage", SET_NULL, null, blank, related_name="expenses"),
- `invoice_number` CharField(blank), `invoice_date` DateField,
- `amount_before_tax` money_field, `tax_amount` money_field(default=0), `total_amount` money_field,
- `payment_date` DateField(null, blank), `payment_method` CharField(blank), `payment_reference` CharField(blank),
- `description` TextField, `invoice_file` FileField(upload_to="expenses/invoices/", null, blank, validators=[validate_upload]),
- `status` choices: draft/under_review/approved/returned/rejected/paid (default draft),
- `created_by` FK("accounts.User", SET_NULL, null, related_name="created_expenses"),
- `tier` choices low/medium/high (يُحسب من المبلغ عند الحفظ).

### ExpenseApproval (خطوات الاعتماد)
- `expense` FK(Expense, CASCADE, related_name="approvals"),
- `step_role` CharField(choices=Roles.CHOICES), `approver` FK("accounts.User", SET_NULL, null),
- `decision` choices: pending/approved/rejected/returned, `note` TextField(blank), `decided_at` DateTimeField(null, blank).

### الخدمة المحورية: اعتماد الدفعة (SRS §9.3, §17.5)
اكتب `apps/finance/services.py::approve_payment(payment, user)` داخل `transaction.atomic()`:
1. `select_for_update` للدفعة والتحقق أن الحالة pending.
2. إنشاء/التحقق من التوزيعات على الاستحقاقات (لا يتجاوز المجموع قيمة الدفعة).
3. تحديث الاستحقاقات (paid_amount/status) والاشتراك (recalculate).
4. إنشاء Revenue (revenue_type=share, من الدفعة).
5. تحديث مؤشرات المشروع `project.recalculate_financials()`.
6. إصدار Receipt (code + amount) واستدعاء توليد PDF (يمكن تأجيله).
7. `record(AuditLog.Action.APPROVE, payment, ...)`.
8. `enqueue_message(...)` لتأكيد الدفع (خارج أي اتصال شبكي؛ Outbox فقط) — بعد الـcommit عبر `transaction.on_commit` أفضل، لكن يكفي enqueue داخلها.
> واتساب لا يُستدعى داخل المعاملة. الفشل في Outbox لا يُفشل الاعتماد.

خدمات أخرى: `reject_payment`, `return_payment`, `reverse_payment` (تنشئ قيدًا عكسيًا لا حذفًا),
`submit_expense`/`approve_expense_step` وفق الحدود (low/medium/high) وفصل المهام
(المنشئ لا يعتمد منفردًا) — استخدم القيم من settings: EXPENSE_TIER_LOW_MAX, EXPENSE_TIER_MEDIUM_MAX,
EXPENSE_INVOICE_REQUIRED_ABOVE, SEPARATION_OF_DUTIES.

### API (finance)
- `suppliers`, `payments`, `revenues`, `inkind`, `expenses`, `budgets`, `budget-items`, `receipts`.
- أفعال Payment: `approve`, `reject`, `return_for_completion`, `reverse` (finance role).
- أفعال Expense: `submit`, `approve` (خطوة), `reject`, `return_for_edits`, `mark_paid`.
- عام: `public/receipts/{code}/verify` (AllowAny) يرجّع {status, project, organization, amount, date}
  دون هاتف/حساب بنكي/إثبات (SRS §8.1). `receipts/{id}/download` (محمي، يرجّع PDF).
- صلاحيات: كتابة مالية تتطلب IsFinanceRole أو HasRole؛ القراءة للمشروع لأصحابه.

---

## 5) communications (تطبيق `apps.communications`) — SRS §14, §15

### WhatsAppTemplate: `key` CharField(unique), `name`, `body` TextField (بمتغيرات {name}...), `is_active` Boolean.
### OutboxMessage (نمط Outbox):
- `phone` CharField, `body` TextField, `kind` CharField(blank) (otp/subscription/receipt/reminder/update/campaign),
- `status` choices: pending/sending/sent/failed (default pending),
- `attempts` PositiveInteger(default=0), `max_attempts` PositiveInteger(default=5),
- `external_ref` CharField(blank), `error` TextField(blank),
- `scheduled_at` DateTimeField(null, blank), `sent_at` DateTimeField(null, blank),
- `campaign` FK(Campaign, SET_NULL, null, blank, related_name="messages"),
- `user` FK("accounts.User", SET_NULL, null, blank).
### Notification (إشعار داخلي): `user` FK, `title`, `body`, `is_read` Boolean, `link` CharField(blank).
### Campaign: `reference` make_reference("campaign"), `project` FK("projects.Project", CASCADE, related_name="campaigns"),
  `name`, `campaign_type` CharField(blank), `audience` choices: all/active/overdue/custom,
  `template` FK(WhatsAppTemplate, SET_NULL, null, blank), `body` TextField(blank), `link` URLField(blank),
  `scheduled_at` DateTimeField(null, blank),
  `status` choices: draft/pending/approved/scheduled/sending/completed/partial/failed/cancelled (default draft).
### CampaignRecipient: `campaign` FK(CASCADE, related_name="recipients"), `user` FK("accounts.User", SET_NULL, null),
  `phone` CharField, `status` choices pending/sent/failed.

### services.py
- `enqueue_message(phone, body, kind="", user=None, campaign=None, scheduled_at=None)` → ينشئ OutboxMessage(pending). **هذه الدالة يعتمد عليها accounts وcontributions وfinance؛ يجب أن توجد بهذا التوقيع.**
- `WhatsAppProvider` واجهة + `ConsoleProvider` (يطبع) و`HttpProvider` (يستخدم settings.WHATSAPP_API_URL). اختيار المزوّد من settings.WHATSAPP_BACKEND.
- management commands: `process_outbox` (يرسل pending عبر المزوّد ويحدّث الحالة/إعادة المحاولة),
  `send_due_reminders` (ينشئ رسائل تذكير للاستحقاقات المستحقة). ضعها في
  `apps/communications/management/commands/`.

### API
- `templates` (admin), `outbox` (admin read), `notifications` (المستخدم يقرأ إشعاراته + mark_read),
- `campaigns` (staff) + أفعال: `preview`, `test_send`, `approve`, `send` (ينشئ recipients + outbox messages).

---

## 6) reports (تطبيق `apps.reports`) — SRS §13

قراءة فقط (تجميعات). لا نماذج جديدة (أو نموذج بسيط للحفظ إن لزم — غير مطلوب).
### views (APIView أو ViewSet actions), كلها ترجّع JSON مجمّع:
- `GET reports/project/{id}/financial/` → {target, pledged, collected, remaining, expenses,
  balance, inkind_value, contributors, subscriptions, financial_progress, execution_progress,
  revenues_by_type, expenses_by_category, pending_payments, missing_invoices, budget_overruns}.
- `GET reports/project/{id}/subscriptions/` → قائمة اشتراكات + متأخرات.
- `GET reports/admin/overview/` (IsPlatformAdmin) → إحصاءات المنصة (projects, orgs, users, totals).
- `GET reports/project/{id}/financial/export/?format=pdf|excel` → ملف (reportlab/openpyxl).
- استخدم تجميعات Django ORM (Sum/Count) وتجنّب N+1.
- صلاحيات: بيانات المشروع لأصحابه؛ overview للمدير.
> reports يقرأ نماذج finance/contributions/projects عبر الاستيراد المباشر (مسموح، فهو أعلى طبقة).

---

## ملاحظات تكامل نهائية
- لا تعدّل `config/urls.py` أو `config/settings/*` (المنسّق يتكفّل بذلك؛ الـincludes جاهزة).
- لا تنشئ ملفات migration يدويًا؛ المنسّق يشغّل `makemigrations`.
- إن احتجت استيراد نموذج من تطبيق آخر داخل الدوال (services) استورده داخل الدالة لتفادي الدوران.
- اكتب `admin.py` يسجّل النماذج الرئيسية بعرض قوائم مفيدة.
- اجعل كل `ViewSet.get_queryset` يحترم النطاق (المستخدم/الجهة/المشروع) والصلاحيات.
