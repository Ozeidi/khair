import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Button,
  Card,
  StatusBadge,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";

const REVENUE_TYPES = [
  { value: "share", label: "أسهم خيرية" },
  { value: "donation", label: "تبرع مباشر" },
  { value: "grant", label: "منحة" },
  { value: "corporate", label: "مساهمة شركة" },
  { value: "event", label: "فعالية" },
  { value: "other", label: "أخرى" },
];
const TYPE_LABELS = Object.fromEntries(REVENUE_TYPES.map((t) => [t.value, t.label]));

const METHODS = [
  { value: "transfer", label: "تحويل بنكي" },
  { value: "deposit", label: "إيداع" },
  { value: "cash", label: "نقدًا" },
  { value: "pos", label: "نقاط بيع" },
  { value: "link", label: "رابط دفع" },
];

const REVENUE_STATUS_MAP = {
  approved: { label: "معتمد", style: "bg-status-approved/10 text-status-approved" },
  reversed: { label: "معكوس", style: "bg-surface-container-high text-on-surface-variant" },
};

const INKIND_STATUS_MAP = {
  registered: { label: "مسجلة", style: "bg-status-draft/10 text-status-draft" },
  pending: { label: "بانتظار التحقق", style: "bg-status-pending/10 text-status-pending" },
  accepted: { label: "مقبولة", style: "bg-secondary/10 text-secondary" },
  received: { label: "مستلمة", style: "bg-status-approved/10 text-status-approved" },
  used_partial: { label: "مستخدمة جزئيًا", style: "bg-status-completed/10 text-status-completed" },
  used_full: { label: "مستخدمة بالكامل", style: "bg-status-completed/10 text-status-completed" },
  rejected: { label: "مرفوضة", style: "bg-status-rejected/10 text-status-rejected" },
  cancelled: { label: "ملغاة", style: "bg-surface-container-high text-on-surface-variant" },
};

function StatusPill({ map, code }) {
  const info = map[code] || { label: code || "—", style: "bg-surface-container-high text-on-surface-variant" };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-label-md font-heading font-bold ${info.style}`}>
      {info.label}
    </span>
  );
}

function contributorName(r) {
  return r?.user_name || r?.user_full_name || r?.external_name || "غير مسجل";
}
function projectName(r) {
  return r?.project_name || r?.project?.name || r?.project_title || "—";
}

const EMPTY_FORM = {
  project: "",
  revenue_type: "donation",
  external_name: "",
  external_phone: "",
  amount: "",
  date: new Date().toISOString().slice(0, 10),
  method: "transfer",
  reference_number: "",
  receiving_account: "",
  description: "",
  is_public: false,
};

export default function Revenues() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");

  const revQ = useQuery({
    queryKey: ["manage-revenues"],
    queryFn: async () => (await api.get("/revenues/")).data,
  });
  const inkindQ = useQuery({
    queryKey: ["manage-inkind"],
    queryFn: async () => (await api.get("/inkind/")).data,
  });
  const projectsQ = useQuery({
    queryKey: ["manage-projects-select"],
    queryFn: async () => (await api.get("/projects/")).data,
  });

  const revenues = revQ.data?.results ?? (Array.isArray(revQ.data) ? revQ.data : []);
  const inkind = inkindQ.data?.results ?? (Array.isArray(inkindQ.data) ? inkindQ.data : []);
  const projects = projectsQ.data?.results ?? (Array.isArray(projectsQ.data) ? projectsQ.data : []);

  const cashTotal = revenues
    .filter((r) => r.status !== "reversed")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const inkindTotal = inkind.reduce((s, r) => s + Number(r.estimated_value || 0), 0);

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { ...form, amount: form.amount };
      if (!body.external_name) delete body.external_name;
      if (!body.external_phone) delete body.external_phone;
      return (await api.post("/revenues/", body)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manage-revenues"] });
      closeModal();
    },
    onError: (err) => {
      setFormError(err?.apiMessage || "تعذّر تسجيل الإيراد. تحقق من البيانات.");
    },
  });

  function openModal() {
    setForm(EMPTY_FORM);
    setFormError("");
    setOpen(true);
  }
  function closeModal() {
    setOpen(false);
    setFormError("");
  }
  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function submit(e) {
    e.preventDefault();
    setFormError("");
    if (!form.project) return setFormError("اختر المشروع.");
    if (!form.amount || Number(form.amount) <= 0) return setFormError("أدخل مبلغًا صحيحًا.");
    if (!form.date) return setFormError("أدخل تاريخ الإيراد.");
    mutation.mutate();
  }

  return (
    <div>
      <PageHeader
        title="الإيرادات"
        subtitle="تسجيل ومتابعة الإيرادات النقدية والمساهمات العينية للمشاريع."
        actions={
          <Button icon="add" onClick={openModal}>
            تسجيل إيراد
          </Button>
        }
      />

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md mb-gutter">
        <div className="bg-surface-container-lowest p-stack-md rounded-xl border border-outline-variant soft-shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Icon name="payments" />
          </div>
          <div>
            <p className="text-label-md font-heading text-on-surface-variant">إجمالي الإيرادات النقدية</p>
            <p className="text-headline-md font-heading text-on-surface">{formatMoney(cashTotal)}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-stack-md rounded-xl border border-outline-variant soft-shadow flex items-center gap-4">
          <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
            <Icon name="inventory_2" />
          </div>
          <div>
            <p className="text-label-md font-heading text-on-surface-variant">قيمة المساهمات العينية</p>
            <p className="text-headline-md font-heading text-on-surface">{formatMoney(inkindTotal)}</p>
          </div>
        </div>
      </div>

      {/* Cash revenues */}
      <div className="flex items-center gap-2 mb-stack-md">
        <Icon name="payments" className="text-primary" />
        <h2 className="text-headline-sm font-heading text-on-surface">الإيرادات النقدية</h2>
      </div>

      {revQ.isLoading ? (
        <Loading />
      ) : revQ.isError ? (
        <ErrorState description="تعذّر تحميل الإيرادات." onRetry={() => revQ.refetch()} />
      ) : revenues.length === 0 ? (
        <EmptyState
          icon="payments"
          title="لا توجد إيرادات نقدية"
          description="ابدأ بتسجيل إيراد لتظهر هنا."
          action={<Button icon="add" onClick={openModal}>تسجيل إيراد</Button>}
        />
      ) : (
        <>
          <Card padded={false} className="hidden md:block overflow-hidden mb-gutter">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="p-4 font-medium">المرجع</th>
                    <th className="p-4 font-medium">النوع</th>
                    <th className="p-4 font-medium">المساهم</th>
                    <th className="p-4 font-medium">المشروع</th>
                    <th className="p-4 font-medium">المبلغ</th>
                    <th className="p-4 font-medium">التاريخ</th>
                    <th className="p-4 font-medium">الظهور</th>
                    <th className="p-4 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                  {revenues.map((r) => (
                    <tr key={r.id} className="hover:bg-surface/60 transition-colors">
                      <td className="p-4">
                        <span className="font-code-ref text-code-ref text-secondary">{r.reference || "—"}</span>
                      </td>
                      <td className="p-4 text-on-surface-variant">{TYPE_LABELS[r.revenue_type] || "—"}</td>
                      <td className="p-4 font-bold">{contributorName(r)}</td>
                      <td className="p-4 text-on-surface-variant">{projectName(r)}</td>
                      <td className="p-4 font-medium text-primary">{formatMoney(r.amount)}</td>
                      <td className="p-4 text-on-surface-variant">{formatDate(r.date)}</td>
                      <td className="p-4">
                        {r.is_public ? (
                          <span className="inline-flex items-center gap-1 text-body-sm text-primary">
                            <Icon name="public" className="text-[16px]" /> عام
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
                            <Icon name="lock" className="text-[16px]" /> خاص
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <StatusPill map={REVENUE_STATUS_MAP} code={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="md:hidden space-y-stack-md mb-gutter">
            {revenues.map((r) => (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-label-md font-heading font-bold text-on-surface truncate">
                      {contributorName(r)}
                    </h3>
                    <span className="font-code-ref text-code-ref text-secondary">{r.reference || "—"}</span>
                  </div>
                  <StatusPill map={REVENUE_STATUS_MAP} code={r.status} />
                </div>
                <p className="text-body-sm text-on-surface-variant mb-2 truncate">{projectName(r)}</p>
                <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                  <span className="text-body-sm text-on-surface-variant">{TYPE_LABELS[r.revenue_type] || "—"}</span>
                  <span className="text-label-md font-heading font-bold text-primary">{formatMoney(r.amount)}</span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* In-kind contributions (visually separate) */}
      <div className="flex items-center gap-2 mb-stack-md mt-stack-lg">
        <Icon name="inventory_2" className="text-secondary" />
        <h2 className="text-headline-sm font-heading text-on-surface">المساهمات العينية</h2>
      </div>

      {inkindQ.isLoading ? (
        <Loading />
      ) : inkindQ.isError ? (
        <ErrorState description="تعذّر تحميل المساهمات العينية." onRetry={() => inkindQ.refetch()} />
      ) : inkind.length === 0 ? (
        <EmptyState
          icon="inventory_2"
          title="لا توجد مساهمات عينية"
          description="ستظهر المساهمات العينية المسجّلة هنا."
        />
      ) : (
        <Card padded={false} className="overflow-hidden border-r-4 border-r-secondary">
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-secondary/5 text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                <tr>
                  <th className="p-4 font-medium">المرجع</th>
                  <th className="p-4 font-medium">المادة</th>
                  <th className="p-4 font-medium">المساهم</th>
                  <th className="p-4 font-medium">الكمية</th>
                  <th className="p-4 font-medium">القيمة التقديرية</th>
                  <th className="p-4 font-medium">التاريخ</th>
                  <th className="p-4 font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                {inkind.map((r) => (
                  <tr key={r.id} className="hover:bg-surface/60 transition-colors">
                    <td className="p-4">
                      <span className="font-code-ref text-code-ref text-secondary">{r.reference || "—"}</span>
                    </td>
                    <td className="p-4 font-bold">{r.name || "—"}</td>
                    <td className="p-4 text-on-surface-variant">{contributorName(r)}</td>
                    <td className="p-4 text-on-surface-variant">
                      {r.quantity != null ? `${r.quantity} ${r.unit || ""}`.trim() : "—"}
                    </td>
                    <td className="p-4 font-medium text-secondary">{formatMoney(r.estimated_value)}</td>
                    <td className="p-4 text-on-surface-variant">{formatDate(r.date)}</td>
                    <td className="p-4">
                      <StatusPill map={INKIND_STATUS_MAP} code={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Record revenue modal */}
      <Modal
        open={open}
        onClose={closeModal}
        title="تسجيل إيراد نقدي"
        size="lg"
        footer={
          <>
            <Button type="submit" form="revenue-form" disabled={mutation.isPending} icon="check">
              {mutation.isPending ? "جارٍ الحفظ…" : "حفظ الإيراد"}
            </Button>
            <Button variant="ghost" onClick={closeModal} type="button">
              إلغاء
            </Button>
          </>
        }
      >
        <form id="revenue-form" onSubmit={submit} className="flex flex-col gap-stack-md">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-status-rejected/10 text-status-rejected text-body-sm">
              <Icon name="error" className="text-[18px]" />
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
            <Field label="المشروع" required>
              <Select value={form.project} onChange={(e) => set("project", e.target.value)}>
                <option value="">اختر المشروع…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="نوع الإيراد" required>
              <Select value={form.revenue_type} onChange={(e) => set("revenue_type", e.target.value)}>
                {REVENUE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
            <Field label="اسم المساهم" hint="لمساهم غير مسجّل — اختياري.">
              <Input
                value={form.external_name}
                onChange={(e) => set("external_name", e.target.value)}
                placeholder="مثال: فاعل خير"
              />
            </Field>
            <Field label="هاتف المساهم" hint="اختياري.">
              <Input
                value={form.external_phone}
                onChange={(e) => set("external_phone", e.target.value)}
                placeholder="+9689xxxxxxx"
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
            <Field label="المبلغ" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="تاريخ الإيراد" required>
              <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
            <Field label="طريقة الاستلام">
              <Select value={form.method} onChange={(e) => set("method", e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="رقم المرجع / التحويل">
              <Input
                value={form.reference_number}
                onChange={(e) => set("reference_number", e.target.value)}
                placeholder="مثال: TRX-889210"
              />
            </Field>
          </div>

          <Field label="الحساب المستلم">
            <Input
              value={form.receiving_account}
              onChange={(e) => set("receiving_account", e.target.value)}
              placeholder="اسم أو رقم الحساب المستلم"
            />
          </Field>

          <Field label="الوصف">
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="تفاصيل إضافية عن الإيراد…"
              rows={3}
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => set("is_public", e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span className="text-body-md text-on-surface">إظهار هذا الإيراد للعامة (وفق إعدادات الشفافية)</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
