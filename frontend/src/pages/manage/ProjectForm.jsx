import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Button,
  Card,
  CardHeader,
  StatusBadge,
  Field,
  Input,
  Textarea,
  Select,
  Loading,
  ErrorState,
} from "@/components/ui";
import { PROJECT_STATUS } from "@/lib/status";

// Omani governorates used for the state/region field (matches Project.state values).
const STATES = [
  "مسقط",
  "ظفار",
  "مسندم",
  "البريمي",
  "الداخلية",
  "شمال الباطنة",
  "جنوب الباطنة",
  "شمال الشرقية",
  "جنوب الشرقية",
  "الظاهرة",
  "الوسطى",
];

const CURRENCIES = [
  { value: "OMR", label: "ريال عُماني (ر.ع.)" },
  { value: "AED", label: "درهم إماراتي" },
  { value: "USD", label: "دولار أمريكي" },
];

// Which project statuses are still editable via this form.
const EDITABLE_STATUSES = ["draft", "returned"];

const EMPTY = {
  name: "",
  category: "",
  short_description: "",
  description: "",
  state: "",
  location: "",
  beneficiaries_count: "",
  start_date: "",
  end_date: "",
  currency: "OMR",
  estimated_cost: "",
  target_amount: "",
  initial_amount: "",
  minimum_contribution: "",
  open_contribution: true,
  count_inkind_in_progress: false,
  bank_name: "",
  bank_account_name: "",
  iban: "",
  payment_link: "",
  payment_instructions: "",
};

/* Only send fields that carry a value (avoid blanking server defaults). */
function buildPayload(form) {
  const out = {};
  const numeric = [
    "beneficiaries_count",
    "estimated_cost",
    "target_amount",
    "initial_amount",
    "minimum_contribution",
  ];
  Object.entries(form).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      out[key] = value;
      return;
    }
    if (value === "" || value === null || value === undefined) return;
    if (numeric.includes(key)) {
      const n = Number(value);
      out[key] = Number.isFinite(n) ? n : value;
    } else {
      out[key] = value;
    }
  });
  return out;
}

/* Section wrapper with icon + title. */
function Section({ icon, title, description, children }) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon name={icon} className="text-primary text-[22px]" />
            {title}
          </span>
        }
      />
      {description && (
        <p className="text-body-sm text-on-surface-variant -mt-2 mb-stack-md">{description}</p>
      )}
      {children}
    </Card>
  );
}

/* Toggle switch styled row. */
function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-4 p-3 rounded-lg border border-outline-variant bg-surface cursor-pointer">
      <div>
        <span className="text-label-md font-heading text-on-surface">{label}</span>
        {hint && <p className="text-body-sm text-on-surface-variant mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
          checked ? "bg-primary" : "bg-surface-container-high"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-surface-container-lowest shadow transition-all ${
            checked ? "right-0.5" : "right-[22px]"
          }`}
        />
      </button>
    </label>
  );
}

export default function ProjectForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const categoriesQuery = useQuery({
    queryKey: ["public", "categories"],
    queryFn: async () => (await api.get("/public/categories/")).data,
  });
  const categories = Array.isArray(categoriesQuery.data)
    ? categoriesQuery.data
    : categoriesQuery.data?.results ?? [];

  const projectQuery = useQuery({
    queryKey: ["manage", "project", id],
    queryFn: async () => (await api.get(`/projects/${id}/`)).data,
    enabled: isEdit,
  });

  // Hydrate form once the project loads.
  useEffect(() => {
    const p = projectQuery.data;
    if (!p) return;
    setForm({
      name: p.name ?? "",
      category: p.category ?? p.category_id ?? p.category?.id ?? "",
      short_description: p.short_description ?? "",
      description: p.description ?? "",
      state: p.state ?? "",
      location: p.location ?? "",
      beneficiaries_count: p.beneficiaries_count ?? "",
      start_date: p.start_date ?? "",
      end_date: p.end_date ?? "",
      currency: p.currency ?? "OMR",
      estimated_cost: p.estimated_cost ?? "",
      target_amount: p.target_amount ?? "",
      initial_amount: p.initial_amount ?? "",
      minimum_contribution: p.minimum_contribution ?? "",
      open_contribution: p.open_contribution ?? true,
      count_inkind_in_progress: p.count_inkind_in_progress ?? false,
      bank_name: p.bank_name ?? "",
      bank_account_name: p.bank_account_name ?? "",
      iban: p.iban ?? "",
      payment_link: p.payment_link ?? "",
      payment_instructions: p.payment_instructions ?? "",
    });
  }, [projectQuery.data]);

  const status = projectQuery.data?.status;
  const locked = isEdit && status && !EDITABLE_STATUSES.includes(status);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  }

  function applyError(err) {
    setError(err?.apiMessage || "تعذّر حفظ المشروع. تحقّق من الحقول وحاول مجددًا.");
    if (err?.apiFields && typeof err.apiFields === "object") {
      const mapped = {};
      Object.entries(err.apiFields).forEach(([k, v]) => {
        mapped[k] = Array.isArray(v) ? v.join("، ") : String(v);
      });
      setFieldErrors(mapped);
    }
  }

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = "اسم المشروع مطلوب.";
    if (!form.short_description.trim()) errs.short_description = "الوصف المختصر مطلوب.";
    if (!form.description.trim()) errs.description = "الوصف التفصيلي مطلوب.";
    if (!form.target_amount || Number(form.target_amount) <= 0)
      errs.target_amount = "المبلغ المستهدف مطلوب وأكبر من صفر.";
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      setError("يرجى استكمال الحقول المطلوبة.");
      return false;
    }
    return true;
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form);
      if (isEdit) return (await api.patch(`/projects/${id}/`, payload)).data;
      return (await api.post("/projects/", payload)).data;
    },
    onMutate: () => {
      setError("");
      setFieldErrors({});
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["manage", "projects"] });
      queryClient.invalidateQueries({ queryKey: ["manage", "projects", "list"] });
      const newId = data?.id ?? id;
      navigate(newId ? `/manage/projects/${newId}` : "/manage/projects");
    },
    onError: applyError,
  });

  // Save draft, then submit for approval in one action.
  const submitMutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form);
      const saved = isEdit
        ? (await api.patch(`/projects/${id}/`, payload)).data
        : (await api.post("/projects/", payload)).data;
      const pid = saved?.id ?? id;
      await api.post(`/projects/${pid}/submit/`);
      return saved;
    },
    onMutate: () => {
      setError("");
      setFieldErrors({});
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["manage", "projects"] });
      queryClient.invalidateQueries({ queryKey: ["manage", "projects", "list"] });
      const newId = data?.id ?? id;
      navigate(newId ? `/manage/projects/${newId}` : "/manage/projects");
    },
    onError: applyError,
  });

  const busy = saveMutation.isPending || submitMutation.isPending;

  function handleSaveDraft(e) {
    e.preventDefault();
    if (busy || locked) return;
    if (!validate()) return;
    saveMutation.mutate();
  }

  function handleSubmitForApproval() {
    if (busy || locked) return;
    if (!validate()) return;
    submitMutation.mutate();
  }

  if (isEdit && projectQuery.isLoading) {
    return (
      <div>
        <PageHeader title="تعديل المشروع" />
        <Loading label="جارٍ تحميل المشروع…" />
      </div>
    );
  }

  if (isEdit && projectQuery.isError) {
    return (
      <div>
        <PageHeader title="تعديل المشروع" />
        <ErrorState
          description="تعذّر تحميل بيانات المشروع."
          onRetry={() => projectQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? "تعديل المشروع" : "مشروع جديد"}
        subtitle={
          isEdit
            ? "حدّث بيانات المشروع أو أعِد إرساله للاعتماد."
            : "أدخل بيانات المشروع لحفظه كمسودة أو إرساله للاعتماد."
        }
        actions={isEdit && status ? <StatusBadge map={PROJECT_STATUS} code={status} /> : null}
      />

      {locked && (
        <div className="mb-stack-md flex items-start gap-3 p-4 rounded-xl border border-status-pending/30 bg-status-pending/5">
          <Icon name="lock" className="text-status-pending shrink-0" />
          <p className="text-body-sm text-on-surface">
            هذا المشروع في حالة لا تسمح بالتعديل المباشر. تغيير الحقول الحساسة بعد الاعتماد يتطلب طلب
            تعديل.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-stack-md flex items-start gap-3 p-4 rounded-xl border border-status-rejected/30 bg-status-rejected/5">
          <Icon name="error" className="text-status-rejected shrink-0" />
          <p className="text-body-sm text-status-rejected">{error}</p>
        </div>
      )}

      <form
        onSubmit={handleSaveDraft}
        className={`space-y-gutter ${locked ? "opacity-70 pointer-events-none" : ""}`}
      >
        {/* البيانات الأساسية */}
        <Section
          icon="badge"
          title="البيانات الأساسية"
          description="التعريف العام للمشروع الذي يظهر للمساهمين."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
            <Field label="اسم المشروع" required error={fieldErrors.name} className="md:col-span-2">
              <Input
                value={form.name}
                error={fieldErrors.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="مثال: بناء مسجد قرية الخير"
              />
            </Field>

            <Field label="التصنيف" error={fieldErrors.category}>
              <Select
                value={form.category}
                error={fieldErrors.category}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="">اختر تصنيفًا</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="عدد المستفيدين" error={fieldErrors.beneficiaries_count}>
              <Input
                type="number"
                min="0"
                value={form.beneficiaries_count}
                error={fieldErrors.beneficiaries_count}
                onChange={(e) => set("beneficiaries_count", e.target.value)}
                placeholder="مثال: 500"
              />
            </Field>

            <Field
              label="الوصف المختصر"
              required
              hint="يظهر في بطاقة المشروع (حتى 280 حرفًا)."
              error={fieldErrors.short_description}
              className="md:col-span-2"
            >
              <Textarea
                rows={2}
                maxLength={280}
                value={form.short_description}
                error={fieldErrors.short_description}
                onChange={(e) => set("short_description", e.target.value)}
                placeholder="جملة أو جملتان تلخّص هدف المشروع."
              />
            </Field>

            <Field
              label="الوصف التفصيلي"
              required
              error={fieldErrors.description}
              className="md:col-span-2"
            >
              <Textarea
                rows={6}
                value={form.description}
                error={fieldErrors.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="اشرح تفاصيل المشروع وأهدافه ومراحله."
              />
            </Field>

            <Field label="الولاية / المنطقة" error={fieldErrors.state}>
              <Select
                value={form.state}
                error={fieldErrors.state}
                onChange={(e) => set("state", e.target.value)}
              >
                <option value="">اختر المنطقة</option>
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="الموقع التفصيلي" error={fieldErrors.location}>
              <Input
                value={form.location}
                error={fieldErrors.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="الحي / القرية / المعلم"
              />
            </Field>
          </div>
        </Section>

        {/* التنفيذ */}
        <Section icon="event" title="التنفيذ" description="الإطار الزمني لتنفيذ المشروع.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
            <Field label="تاريخ البداية" required error={fieldErrors.start_date}>
              <Input
                type="date"
                value={form.start_date}
                error={fieldErrors.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </Field>
            <Field label="تاريخ النهاية" error={fieldErrors.end_date}>
              <Input
                type="date"
                value={form.end_date}
                error={fieldErrors.end_date}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* المالية */}
        <Section
          icon="payments"
          title="المالية"
          description="الأهداف المالية وإعدادات المساهمة."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
            <Field label="العملة" required error={fieldErrors.currency}>
              <Select
                value={form.currency}
                error={fieldErrors.currency}
                onChange={(e) => set("currency", e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="التكلفة التقديرية" required error={fieldErrors.estimated_cost}>
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                className="text-left"
                value={form.estimated_cost}
                error={fieldErrors.estimated_cost}
                onChange={(e) => set("estimated_cost", e.target.value)}
                placeholder="0.00"
              />
            </Field>

            <Field label="المبلغ المستهدف" required error={fieldErrors.target_amount}>
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                className="text-left"
                value={form.target_amount}
                error={fieldErrors.target_amount}
                onChange={(e) => set("target_amount", e.target.value)}
                placeholder="0.00"
              />
            </Field>

            <Field
              label="المتوفر مسبقًا"
              hint="مبلغ مجموع قبل إطلاق المشروع (اختياري)."
              error={fieldErrors.initial_amount}
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                className="text-left"
                value={form.initial_amount}
                error={fieldErrors.initial_amount}
                onChange={(e) => set("initial_amount", e.target.value)}
                placeholder="0.00"
              />
            </Field>

            <Field
              label="الحد الأدنى للمساهمة"
              required
              error={fieldErrors.minimum_contribution}
            >
              <Input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                className="text-left"
                value={form.minimum_contribution}
                error={fieldErrors.minimum_contribution}
                onChange={(e) => set("minimum_contribution", e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md mt-stack-md">
            <ToggleRow
              label="السماح بالمساهمة المفتوحة"
              hint="يمكن للمساهم إدخال أي مبلغ يحدده."
              checked={form.open_contribution}
              onChange={(v) => set("open_contribution", v)}
            />
            <ToggleRow
              label="احتساب العيني في الإنجاز"
              hint="تُحتسب المساهمات العينية ضمن نسبة الإنجاز."
              checked={form.count_inkind_in_progress}
              onChange={(v) => set("count_inkind_in_progress", v)}
            />
          </div>
        </Section>

        {/* حساب الاستلام */}
        <Section
          icon="account_balance"
          title="حساب الاستلام"
          description="بيانات الحساب البنكي وتعليمات الدفع للمساهمين."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-stack-md">
            <Field label="اسم البنك" error={fieldErrors.bank_name}>
              <Input
                value={form.bank_name}
                error={fieldErrors.bank_name}
                onChange={(e) => set("bank_name", e.target.value)}
                placeholder="مثال: بنك مسقط"
              />
            </Field>

            <Field label="اسم صاحب الحساب" error={fieldErrors.bank_account_name}>
              <Input
                value={form.bank_account_name}
                error={fieldErrors.bank_account_name}
                onChange={(e) => set("bank_account_name", e.target.value)}
                placeholder="اسم الجهة أو الحساب"
              />
            </Field>

            <Field
              label="رقم الآيبان (IBAN)"
              hint="مشفّر ولا يُعرض للعموم أبدًا."
              error={fieldErrors.iban}
              className="md:col-span-2"
            >
              <Input
                value={form.iban}
                error={fieldErrors.iban}
                onChange={(e) => set("iban", e.target.value)}
                placeholder="OM00 0000 0000 0000 0000 0000"
                dir="ltr"
                maxLength={34}
                className="text-left font-code-ref"
              />
            </Field>

            <Field label="رابط الدفع" error={fieldErrors.payment_link} className="md:col-span-2">
              <Input
                type="url"
                value={form.payment_link}
                error={fieldErrors.payment_link}
                onChange={(e) => set("payment_link", e.target.value)}
                placeholder="https://"
                dir="ltr"
                className="text-left"
              />
            </Field>

            <Field
              label="تعليمات الدفع"
              error={fieldErrors.payment_instructions}
              className="md:col-span-2"
            >
              <Textarea
                rows={3}
                value={form.payment_instructions}
                error={fieldErrors.payment_instructions}
                onChange={(e) => set("payment_instructions", e.target.value)}
                placeholder="تعليمات إضافية للمساهم عند التحويل."
              />
            </Field>
          </div>
        </Section>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <Button
            as={Link}
            to={isEdit ? `/manage/projects/${id}` : "/manage/projects"}
            variant="ghost"
            icon="arrow_forward"
            iconFlip
            type="button"
          >
            إلغاء
          </Button>

          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <Button type="submit" variant="secondary" icon="save" disabled={busy || locked}>
              {saveMutation.isPending ? "جارٍ الحفظ…" : "حفظ كمسودة"}
            </Button>
            <Button
              type="button"
              variant="primary"
              icon="send"
              disabled={busy || locked}
              onClick={handleSubmitForApproval}
            >
              {submitMutation.isPending ? "جارٍ الإرسال…" : "إرسال للاعتماد"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
