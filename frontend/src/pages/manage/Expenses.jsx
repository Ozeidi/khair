import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import { EXPENSE_STATUS } from "@/lib/status";
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

const TIER_LABELS = {
  low: { label: "منخفض", style: "bg-status-approved/10 text-status-approved" },
  medium: { label: "متوسط", style: "bg-status-pending/10 text-status-pending" },
  high: { label: "مرتفع", style: "bg-status-rejected/10 text-status-rejected" },
};

const METHODS = [
  { value: "transfer", label: "تحويل بنكي" },
  { value: "cash", label: "نقدًا" },
  { value: "cheque", label: "شيك" },
  { value: "pos", label: "نقاط بيع" },
];

function TierPill({ code }) {
  const info = TIER_LABELS[code];
  if (!info) return <span className="text-on-surface-variant text-body-sm">—</span>;
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-label-md font-heading font-bold ${info.style}`}>
      {info.label}
    </span>
  );
}

function supplierName(e) {
  return e?.supplier_name || e?.supplier?.name || "—";
}
function projectName(e) {
  return e?.project_name || e?.project?.name || e?.project_title || "—";
}

const EMPTY_FORM = {
  project: "",
  category: "",
  supplier: "",
  invoice_number: "",
  invoice_date: new Date().toISOString().slice(0, 10),
  amount_before_tax: "",
  tax_amount: "0",
  budget_item: "",
  stage: "",
  payment_method: "transfer",
  description: "",
};

// Row-action config (SRS §9.4 lifecycle).
function actionsFor(status) {
  const list = [];
  if (status === "draft" || status === "returned") {
    list.push({ key: "submit", label: "إرسال للاعتماد", icon: "send", variant: "secondary" });
  }
  if (status === "draft" || status === "under_review" || status === "returned") {
    list.push({ key: "approve", label: "اعتماد", icon: "check", variant: "primary" });
  }
  if (status === "approved") {
    list.push({ key: "mark_paid", label: "تسجيل الدفع", icon: "paid", variant: "primary" });
  }
  return list;
}

export default function Expenses() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [formError, setFormError] = useState("");
  const [rowError, setRowError] = useState("");

  const expensesQ = useQuery({
    queryKey: ["manage-expenses"],
    queryFn: async () => (await api.get("/expenses/")).data,
  });
  const projectsQ = useQuery({
    queryKey: ["manage-projects-select"],
    queryFn: async () => (await api.get("/projects/")).data,
  });
  const budgetsQ = useQuery({
    queryKey: ["manage-budgets"],
    queryFn: async () => (await api.get("/budgets/")).data,
  });

  const expenses = expensesQ.data?.results ?? (Array.isArray(expensesQ.data) ? expensesQ.data : []);
  const projects = projectsQ.data?.results ?? (Array.isArray(projectsQ.data) ? projectsQ.data : []);
  const budgets = budgetsQ.data?.results ?? (Array.isArray(budgetsQ.data) ? budgetsQ.data : []);

  // Budget items for the currently selected project (for the modal + overrun check).
  const projectBudget = useMemo(
    () => budgets.find((b) => String(b.project) === String(form.project) || String(b.project_id) === String(form.project)),
    [budgets, form.project]
  );
  const budgetItems = projectBudget?.items ?? [];

  const totalAmount = (Number(form.amount_before_tax || 0) + Number(form.tax_amount || 0)) || 0;

  // Overrun warning: selected budget item's remaining vs this expense total.
  const selectedItem = budgetItems.find((i) => String(i.id) === String(form.budget_item));
  const itemRemaining = selectedItem
    ? Number(selectedItem.approved_amount || 0) - Number(selectedItem.spent_amount || 0) - Number(selectedItem.committed_amount || 0)
    : null;
  const overrun = selectedItem && totalAmount > itemRemaining;

  const createMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("project", form.project);
      if (form.category) fd.append("category", form.category);
      if (form.supplier) fd.append("supplier", form.supplier);
      if (form.invoice_number) fd.append("invoice_number", form.invoice_number);
      fd.append("invoice_date", form.invoice_date);
      fd.append("amount_before_tax", form.amount_before_tax);
      fd.append("tax_amount", form.tax_amount || "0");
      fd.append("total_amount", String(totalAmount));
      if (form.budget_item) fd.append("budget_item", form.budget_item);
      if (form.stage) fd.append("stage", form.stage);
      if (form.payment_method) fd.append("payment_method", form.payment_method);
      fd.append("description", form.description);
      if (invoiceFile) fd.append("invoice_file", invoiceFile);
      return (await api.post("/expenses/", fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manage-expenses"] });
      qc.invalidateQueries({ queryKey: ["manage-budgets"] });
      closeModal();
    },
    onError: (err) => setFormError(err?.apiMessage || "تعذّر تسجيل المصروف. تحقق من البيانات."),
  });

  const rowMutation = useMutation({
    mutationFn: async ({ id, key }) => (await api.post(`/expenses/${id}/${key}/`, {})).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manage-expenses"] });
      qc.invalidateQueries({ queryKey: ["manage-budgets"] });
    },
    onError: (err) => setRowError(err?.apiMessage || "تعذّر تنفيذ الإجراء."),
  });

  function openModal() {
    setForm(EMPTY_FORM);
    setInvoiceFile(null);
    setFormError("");
    setOpen(true);
  }
  function closeModal() {
    setOpen(false);
    setInvoiceFile(null);
    setFormError("");
  }
  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }
  function submit(e) {
    e.preventDefault();
    setFormError("");
    if (!form.project) return setFormError("اختر المشروع.");
    if (!form.amount_before_tax || Number(form.amount_before_tax) <= 0) return setFormError("أدخل المبلغ قبل الضريبة.");
    if (!form.invoice_date) return setFormError("أدخل تاريخ الفاتورة.");
    if (!form.description.trim()) return setFormError("أدخل وصف المصروف.");
    createMutation.mutate();
  }

  return (
    <div>
      <PageHeader
        title="المصروفات"
        subtitle="تسجيل المصروفات وربطها بالفواتير والميزانية ومتابعة اعتمادها."
        actions={
          <Button icon="add" onClick={openModal}>
            تسجيل مصروف
          </Button>
        }
      />

      {rowError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-status-rejected/10 text-status-rejected text-body-sm mb-stack-md">
          <Icon name="error" className="text-[18px]" />
          {rowError}
        </div>
      )}

      {expensesQ.isLoading ? (
        <Loading />
      ) : expensesQ.isError ? (
        <ErrorState description="تعذّر تحميل المصروفات." onRetry={() => expensesQ.refetch()} />
      ) : expenses.length === 0 ? (
        <EmptyState
          icon="request_quote"
          title="لا توجد مصروفات"
          description="ابدأ بتسجيل مصروف لربطه بالفاتورة والميزانية."
          action={<Button icon="add" onClick={openModal}>تسجيل مصروف</Button>}
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card padded={false} className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="p-4 font-medium">المرجع</th>
                    <th className="p-4 font-medium">التصنيف</th>
                    <th className="p-4 font-medium">المورد</th>
                    <th className="p-4 font-medium">رقم الفاتورة</th>
                    <th className="p-4 font-medium">الإجمالي</th>
                    <th className="p-4 font-medium">المستوى</th>
                    <th className="p-4 font-medium">الحالة</th>
                    <th className="p-4 font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                  {expenses.map((e) => {
                    const acts = actionsFor(e.status);
                    return (
                      <tr key={e.id} className="hover:bg-surface/60 transition-colors">
                        <td className="p-4">
                          <span className="font-code-ref text-code-ref text-secondary">{e.reference || "—"}</span>
                        </td>
                        <td className="p-4 text-on-surface-variant">{e.category || "—"}</td>
                        <td className="p-4 font-bold">{supplierName(e)}</td>
                        <td className="p-4 text-on-surface-variant">{e.invoice_number || "—"}</td>
                        <td className="p-4 font-medium">{formatMoney(e.total_amount)}</td>
                        <td className="p-4">
                          <TierPill code={e.tier} />
                        </td>
                        <td className="p-4">
                          <StatusBadge map={EXPENSE_STATUS} code={e.status} />
                        </td>
                        <td className="p-4">
                          {acts.length ? (
                            <div className="flex items-center gap-1">
                              {acts.map((a) => (
                                <Button
                                  key={a.key}
                                  size="sm"
                                  variant={a.variant}
                                  icon={a.icon}
                                  disabled={rowMutation.isPending}
                                  onClick={() => {
                                    setRowError("");
                                    rowMutation.mutate({ id: e.id, key: a.key });
                                  }}
                                >
                                  {a.label}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-on-surface-variant text-body-sm">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-stack-md">
            {expenses.map((e) => {
              const acts = actionsFor(e.status);
              return (
                <Card key={e.id}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-label-md font-heading font-bold text-on-surface truncate">
                        {supplierName(e)}
                      </h3>
                      <span className="font-code-ref text-code-ref text-secondary">{e.reference || "—"}</span>
                    </div>
                    <StatusBadge map={EXPENSE_STATUS} code={e.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-body-sm mb-3 pb-3 border-b border-outline-variant">
                    <span className="text-on-surface-variant">التصنيف</span>
                    <span className="text-left">{e.category || "—"}</span>
                    <span className="text-on-surface-variant">رقم الفاتورة</span>
                    <span className="text-left">{e.invoice_number || "—"}</span>
                    <span className="text-on-surface-variant">الإجمالي</span>
                    <span className="text-left font-medium">{formatMoney(e.total_amount)}</span>
                    <span className="text-on-surface-variant">المستوى</span>
                    <span className="text-left">
                      <TierPill code={e.tier} />
                    </span>
                  </div>
                  {acts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      {acts.map((a) => (
                        <Button
                          key={a.key}
                          size="sm"
                          variant={a.variant}
                          icon={a.icon}
                          disabled={rowMutation.isPending}
                          onClick={() => {
                            setRowError("");
                            rowMutation.mutate({ id: e.id, key: a.key });
                          }}
                        >
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Record expense modal */}
      <Modal
        open={open}
        onClose={closeModal}
        title="تسجيل مصروف"
        size="lg"
        footer={
          <>
            <Button type="submit" form="expense-form" disabled={createMutation.isPending} icon="check">
              {createMutation.isPending ? "جارٍ الحفظ…" : "حفظ المصروف"}
            </Button>
            <Button variant="ghost" onClick={closeModal} type="button">
              إلغاء
            </Button>
          </>
        }
      >
        <form id="expense-form" onSubmit={submit} className="flex flex-col gap-stack-md">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-status-rejected/10 text-status-rejected text-body-sm">
              <Icon name="error" className="text-[18px]" />
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
            <Field label="المشروع" required>
              <Select
                value={form.project}
                onChange={(e) => setForm((f) => ({ ...f, project: e.target.value, budget_item: "", stage: "" }))}
              >
                <option value="">اختر المشروع…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="التصنيف">
              <Input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="مثال: مواد بناء"
              />
            </Field>
          </div>

          <Field label="المورد" hint="اختياري — أدخل معرّف المورد إن وُجد.">
            <Input
              value={form.supplier}
              onChange={(e) => set("supplier", e.target.value)}
              placeholder="اسم أو معرّف المورد"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
            <Field label="رقم الفاتورة">
              <Input
                value={form.invoice_number}
                onChange={(e) => set("invoice_number", e.target.value)}
                placeholder="INV-000123"
              />
            </Field>
            <Field label="تاريخ الفاتورة" required>
              <Input
                type="date"
                value={form.invoice_date}
                onChange={(e) => set("invoice_date", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-stack-md">
            <Field label="قبل الضريبة" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount_before_tax}
                onChange={(e) => set("amount_before_tax", e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="الضريبة">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.tax_amount}
                onChange={(e) => set("tax_amount", e.target.value)}
                placeholder="0.00"
              />
            </Field>
            <Field label="الإجمالي">
              <Input value={formatMoney(totalAmount)} readOnly className="bg-surface-container-low" />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
            <Field label="بند الميزانية" hint={projectBudget ? "" : "لا توجد ميزانية معتمدة لهذا المشروع."}>
              <Select
                value={form.budget_item}
                onChange={(e) => set("budget_item", e.target.value)}
                disabled={!budgetItems.length}
              >
                <option value="">بدون بند…</option>
                {budgetItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="طريقة الدفع">
              <Select value={form.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Budget overrun warning */}
          {overrun && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-status-pending/10 text-status-pending text-body-sm">
              <Icon name="warning" className="text-[18px] mt-0.5" />
              <span>
                تنبيه: يتجاوز هذا المصروف المتبقي في بند «{selectedItem.name}» (المتبقي {formatMoney(itemRemaining)}).
              </span>
            </div>
          )}

          <Field label="وصف المصروف" required>
            <Textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="تفاصيل المصروف والغرض منه…"
              rows={3}
            />
          </Field>

          <Field label="ملف الفاتورة" hint="أرفق صورة أو ملف PDF للفاتورة.">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
              className="w-full text-body-sm text-on-surface-variant file:mr-0 file:ml-3 file:rounded-lg file:border-0 file:bg-surface-container-high file:px-4 file:py-2 file:text-label-md file:font-heading file:text-on-surface cursor-pointer"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
