import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import { SUBSCRIPTION_STATUS } from "@/lib/status";
import { FREQUENCY_LABELS } from "./Subscriptions";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Button,
  Card,
  StatusBadge,
  ProgressBar,
  Modal,
  Field,
  Input,
  Select,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";

const INSTALLMENT_STATUS = {
  pending: { label: "مستحق", cls: "bg-status-pending/10 text-status-pending" },
  partial: { label: "مدفوع جزئيًا", cls: "bg-secondary/10 text-secondary" },
  paid: { label: "مدفوع", cls: "bg-status-completed/10 text-status-completed" },
  overdue: { label: "متأخر", cls: "bg-status-rejected/10 text-status-rejected" },
};

const METHODS = [
  { value: "transfer", label: "تحويل بنكي" },
  { value: "deposit", label: "إيداع" },
  { value: "cash", label: "نقدًا" },
  { value: "pos", label: "نقاط بيع" },
  { value: "link", label: "رابط دفع" },
];

function InstallmentStatus({ code }) {
  const info = INSTALLMENT_STATUS[code] || { label: code || "—", cls: "bg-surface-container-high text-on-surface-variant" };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-label-md font-heading font-bold ${info.cls}`}>
      {info.label}
    </span>
  );
}

function SummaryTile({ icon, label, value, tone = "" }) {
  return (
    <div className="flex flex-col gap-2 p-stack-md bg-surface rounded-xl border border-outline-variant">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name={icon} className="text-[18px]" />
        <span className="text-label-md font-heading">{label}</span>
      </div>
      <span className={`text-headline-sm font-heading ${tone || "text-on-surface"}`}>{value}</span>
    </div>
  );
}

export default function SubscriptionDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [target, setTarget] = useState(null); // installment being paid
  const [form, setForm] = useState({ amount: "", method: "transfer", date: "", reference_number: "" });
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState("");

  const subQ = useQuery({
    queryKey: ["subscription", id],
    queryFn: async () => (await api.get(`/subscriptions/${id}/`)).data,
    enabled: !!id,
  });

  const instQ = useQuery({
    queryKey: ["installments", id],
    queryFn: async () => (await api.get(`/installments/?subscription=${id}`)).data,
    enabled: !!id,
  });

  const sub = subQ.data;
  const installments = instQ.data?.results ?? (Array.isArray(instQ.data) ? instQ.data : []);

  const total = Number(sub?.total_value ?? 0);
  const paid = Number(sub?.paid_amount ?? 0);
  const remaining = Math.max(0, total - paid);
  const financialPct = total > 0 ? (paid / total) * 100 : 0;

  const shareName = sub?.share_type_name || sub?.share_type?.name || sub?.share_type_detail?.name || "—";
  const projName = sub?.project_name || sub?.project?.name || sub?.project_title || "—";

  const payMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("subscription", id);
      if (sub?.project_id || sub?.project) fd.append("project", sub.project_id ?? sub.project);
      fd.append("amount", form.amount);
      fd.append("method", form.method);
      fd.append("date", form.date);
      if (form.reference_number) fd.append("reference_number", form.reference_number);
      if (file) fd.append("proof", file);
      if (target?.id) {
        fd.append(
          "allocations",
          JSON.stringify([{ installment: target.id, amount: form.amount }])
        );
      }
      return (
        await api.post("/payments/", fd, { headers: { "Content-Type": "multipart/form-data" } })
      ).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription", id] });
      qc.invalidateQueries({ queryKey: ["installments", id] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      closeModal();
    },
    onError: (err) => {
      setFormError(err?.apiMessage || "تعذّر إرسال الدفعة. تحقق من البيانات وحاول مجددًا.");
    },
  });

  function openModal(inst) {
    setTarget(inst);
    setForm({
      amount: inst?.remaining != null ? String(inst.remaining) : inst?.amount != null ? String(inst.amount) : "",
      method: "transfer",
      date: new Date().toISOString().slice(0, 10),
      reference_number: "",
    });
    setFile(null);
    setFormError("");
  }

  function closeModal() {
    setTarget(null);
    setFile(null);
    setFormError("");
  }

  function submit(e) {
    e.preventDefault();
    setFormError("");
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError("أدخل مبلغًا صحيحًا.");
      return;
    }
    if (!form.date) {
      setFormError("أدخل تاريخ الدفع.");
      return;
    }
    payMutation.mutate();
  }

  if (subQ.isLoading) return <Loading />;
  if (subQ.isError)
    return (
      <ErrorState description="تعذّر تحميل تفاصيل الاشتراك." onRetry={() => subQ.refetch()} />
    );

  return (
    <div>
      <PageHeader
        title="تفاصيل الاشتراك"
        subtitle={projName}
        actions={
          <Button as={Link} to="/dashboard/subscriptions" variant="ghost" icon="arrow_forward" iconFlip>
            الاشتراكات
          </Button>
        }
      />

      {/* Overview card */}
      <Card className="mb-gutter">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-stack-md">
          <div>
            <span className="font-code-ref text-code-ref text-secondary">{sub?.reference || "—"}</span>
            <h2 className="text-headline-sm font-heading text-on-surface mt-1">{projName}</h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {shareName}
              {sub?.quantity > 1 ? ` × ${sub.quantity}` : ""} • {FREQUENCY_LABELS[sub?.frequency] || "—"}
            </p>
          </div>
          <StatusBadge map={SUBSCRIPTION_STATUS} code={sub?.status} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-stack-md mb-stack-md">
          <SummaryTile icon="request_quote" label="قيمة الوحدة" value={formatMoney(sub?.unit_value)} />
          <SummaryTile icon="account_balance_wallet" label="إجمالي الالتزام" value={formatMoney(total)} />
          <SummaryTile icon="check_circle" label="المدفوع" value={formatMoney(paid)} tone="text-primary" />
          <SummaryTile icon="hourglass_empty" label="المتبقي" value={formatMoney(remaining)} />
        </div>

        <ProgressBar tone="financial" value={financialPct} label="التقدم المالي" />
      </Card>

      {/* Installments schedule */}
      <Card padded={false} className="overflow-hidden">
        <div className="p-stack-md border-b border-outline-variant flex items-center gap-2">
          <Icon name="event" className="text-on-surface-variant" />
          <h3 className="text-headline-sm font-heading text-on-surface">جدول الاستحقاقات</h3>
        </div>

        {instQ.isLoading ? (
          <Loading />
        ) : instQ.isError ? (
          <ErrorState description="تعذّر تحميل الاستحقاقات." onRetry={() => instQ.refetch()} />
        ) : installments.length === 0 ? (
          <EmptyState
            icon="event_available"
            title="لا توجد استحقاقات"
            description="لم يتم إنشاء جدول استحقاقات لهذا الاشتراك."
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="p-4 font-medium">#</th>
                    <th className="p-4 font-medium">تاريخ الاستحقاق</th>
                    <th className="p-4 font-medium">المبلغ</th>
                    <th className="p-4 font-medium">المدفوع</th>
                    <th className="p-4 font-medium">الحالة</th>
                    <th className="p-4 font-medium">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                  {installments.map((inst) => {
                    const done = inst.status === "paid";
                    return (
                      <tr key={inst.id} className="hover:bg-surface/60 transition-colors">
                        <td className="p-4 text-on-surface-variant">{inst.sequence}</td>
                        <td className="p-4">{formatDate(inst.due_date)}</td>
                        <td className="p-4 font-medium">{formatMoney(inst.amount)}</td>
                        <td className="p-4 text-primary">{formatMoney(inst.paid_amount)}</td>
                        <td className="p-4">
                          <InstallmentStatus code={inst.status} />
                        </td>
                        <td className="p-4">
                          {done ? (
                            <span className="text-body-sm text-on-surface-variant">—</span>
                          ) : (
                            <Button size="sm" icon="upload_file" onClick={() => openModal(inst)}>
                              {inst.status === "partial" ? "رفع إثبات" : "دفع الآن"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-outline-variant">
              {installments.map((inst) => {
                const done = inst.status === "paid";
                return (
                  <div key={inst.id} className="p-stack-md flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-label-md font-heading font-bold text-on-surface">
                          القسط {inst.sequence}
                        </p>
                        <p className="text-body-sm text-on-surface-variant flex items-center gap-1 mt-0.5">
                          <Icon name="calendar_today" className="text-[16px]" />
                          {formatDate(inst.due_date)}
                        </p>
                      </div>
                      <InstallmentStatus code={inst.status} />
                    </div>
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-on-surface-variant">
                        المبلغ: <span className="text-on-surface font-medium">{formatMoney(inst.amount)}</span>
                      </span>
                      <span className="text-on-surface-variant">
                        المدفوع: <span className="text-primary font-medium">{formatMoney(inst.paid_amount)}</span>
                      </span>
                    </div>
                    {!done && (
                      <Button size="sm" icon="upload_file" onClick={() => openModal(inst)} className="w-full">
                        {inst.status === "partial" ? "رفع إثبات" : "دفع الآن"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* Payment modal */}
      <Modal
        open={!!target}
        onClose={closeModal}
        title={target ? `دفع القسط ${target.sequence}` : "دفع"}
        footer={
          <>
            <Button type="submit" form="pay-form" disabled={payMutation.isPending} icon="check">
              {payMutation.isPending ? "جارٍ الإرسال…" : "إرسال الدفعة"}
            </Button>
            <Button variant="ghost" onClick={closeModal} type="button">
              إلغاء
            </Button>
          </>
        }
      >
        <form id="pay-form" onSubmit={submit} className="flex flex-col gap-stack-md">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-status-rejected/10 text-status-rejected text-body-sm">
              <Icon name="error" className="text-[18px]" />
              {formError}
            </div>
          )}
          <Field label="المبلغ" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              placeholder="0.00"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
            <Field label="طريقة الدفع" required>
              <Select
                value={form.method}
                onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="تاريخ الدفع" required>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </Field>
          </div>
          <Field label="رقم المرجع / التحويل" hint="اختياري — رقم عملية التحويل البنكي.">
            <Input
              value={form.reference_number}
              onChange={(e) => setForm((f) => ({ ...f, reference_number: e.target.value }))}
              placeholder="مثال: TRX-889210"
            />
          </Field>
          <Field label="إثبات الدفع" hint="أرفق صورة أو ملف PDF لإيصال التحويل.">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-body-sm text-on-surface-variant file:mr-0 file:ml-3 file:rounded-lg file:border-0 file:bg-surface-container-high file:px-4 file:py-2 file:text-label-md file:font-heading file:text-on-surface cursor-pointer"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
