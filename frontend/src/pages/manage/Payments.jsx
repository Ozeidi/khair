import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/format";
import { PAYMENT_STATUS } from "@/lib/status";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Button,
  Card,
  StatusBadge,
  Modal,
  Field,
  Textarea,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";

const METHOD_LABELS = {
  transfer: "تحويل بنكي",
  deposit: "إيداع",
  cash: "نقدًا",
  pos: "نقاط بيع",
  link: "رابط دفع",
};

// Review queue filter tabs (SRS §7.7 / §9.3).
const STATUS_TABS = [
  { value: "pending", label: "بانتظار المراجعة" },
  { value: "returned", label: "معادة للاستكمال" },
  { value: "approved", label: "معتمدة" },
  { value: "rejected", label: "مرفوضة" },
  { value: "", label: "الكل" },
];

const ACTIONS = {
  approve: {
    endpoint: "approve",
    title: "اعتماد الدفعة",
    verb: "اعتماد",
    icon: "check_circle",
    variant: "primary",
    needsReason: false,
    note: "سيتم إنشاء الإيراد والإيصال وتحديث مؤشرات المشروع تلقائيًا عند الاعتماد.",
  },
  reject: {
    endpoint: "reject",
    title: "رفض الدفعة",
    verb: "رفض",
    icon: "cancel",
    variant: "danger",
    needsReason: true,
    note: "سيتم إشعار المساهم بسبب الرفض. لا يمكن التراجع بعد الرفض.",
  },
  return_for_completion: {
    endpoint: "return_for_completion",
    title: "إعادة للاستكمال",
    verb: "إعادة",
    icon: "undo",
    variant: "secondary",
    needsReason: true,
    note: "ستعاد الدفعة للمساهم لاستكمال البيانات أو إثبات التحويل.",
  },
};

function contributorName(p) {
  return p?.user_name || p?.user_full_name || p?.contributor_name || p?.external_name || "غير مسجل";
}
function projectName(p) {
  return p?.project_name || p?.project?.name || p?.project_title || "—";
}
function proofUrl(p) {
  return p?.proof || p?.proof_url || p?.proof_file || null;
}

export default function Payments() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [action, setAction] = useState(null); // { key, payment }
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["manage-payments", status],
    queryFn: async () =>
      (await api.get("/payments/", { params: status ? { status } : {} })).data,
  });

  const rows = data?.results ?? (Array.isArray(data) ? data : []);

  const mutation = useMutation({
    mutationFn: async () => {
      const cfg = ACTIONS[action.key];
      const body = cfg.needsReason ? { reason, rejection_reason: reason } : {};
      return (await api.post(`/payments/${action.payment.id}/${cfg.endpoint}/`, body)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manage-payments"] });
      closeModal();
    },
    onError: (err) => {
      setFormError(err?.apiMessage || "تعذّر تنفيذ الإجراء. حاول مرة أخرى.");
    },
  });

  function openModal(key, payment) {
    setAction({ key, payment });
    setReason("");
    setFormError("");
  }
  function closeModal() {
    setAction(null);
    setReason("");
    setFormError("");
  }
  function submit(e) {
    e.preventDefault();
    setFormError("");
    const cfg = ACTIONS[action.key];
    if (cfg.needsReason && !reason.trim()) {
      setFormError("يرجى إدخال السبب.");
      return;
    }
    mutation.mutate();
  }

  const cfg = action ? ACTIONS[action.key] : null;

  return (
    <div>
      <PageHeader
        title="مراجعة الدفعات"
        subtitle="اعتماد إثباتات التحويل أو رفضها أو إعادتها للاستكمال."
      />

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-gutter">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value || "all"}
            onClick={() => setStatus(t.value)}
            className={`px-4 py-2 rounded-full text-label-md font-heading font-bold transition-colors ${
              status === t.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState description="تعذّر تحميل الدفعات." onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="receipt_long"
          title="لا توجد دفعات"
          description="لا توجد دفعات مطابقة للتصفية الحالية."
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
                    <th className="p-4 font-medium">المساهم</th>
                    <th className="p-4 font-medium">المشروع</th>
                    <th className="p-4 font-medium">المبلغ</th>
                    <th className="p-4 font-medium">الطريقة</th>
                    <th className="p-4 font-medium">التاريخ</th>
                    <th className="p-4 font-medium">رقم التحويل</th>
                    <th className="p-4 font-medium">الإثبات</th>
                    <th className="p-4 font-medium">الحالة</th>
                    <th className="p-4 font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                  {rows.map((p) => {
                    const url = proofUrl(p);
                    const canAct = p.status === "pending" || p.status === "returned";
                    return (
                      <tr key={p.id} className="hover:bg-surface/60 transition-colors">
                        <td className="p-4">
                          <span className="font-code-ref text-code-ref text-secondary">
                            {p.reference || "—"}
                          </span>
                        </td>
                        <td className="p-4 font-bold">{contributorName(p)}</td>
                        <td className="p-4 text-on-surface-variant">{projectName(p)}</td>
                        <td className="p-4 font-medium">{formatMoney(p.amount)}</td>
                        <td className="p-4 text-on-surface-variant">
                          {METHOD_LABELS[p.method] || p.method || "—"}
                        </td>
                        <td className="p-4 text-on-surface-variant">{formatDate(p.date)}</td>
                        <td className="p-4 text-on-surface-variant">
                          {p.reference_number || "—"}
                        </td>
                        <td className="p-4">
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline text-body-sm font-medium"
                            >
                              <Icon name="attachment" className="text-[18px]" />
                              عرض
                            </a>
                          ) : (
                            <span className="text-on-surface-variant text-body-sm">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <StatusBadge map={PAYMENT_STATUS} code={p.status} />
                        </td>
                        <td className="p-4">
                          {canAct ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                icon="check"
                                onClick={() => openModal("approve", p)}
                              >
                                اعتماد
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                icon="undo"
                                onClick={() => openModal("return_for_completion", p)}
                              >
                                إعادة
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                icon="close"
                                onClick={() => openModal("reject", p)}
                              >
                                رفض
                              </Button>
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
            {rows.map((p) => {
              const url = proofUrl(p);
              const canAct = p.status === "pending" || p.status === "returned";
              return (
                <Card key={p.id}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-label-md font-heading font-bold text-on-surface truncate">
                        {contributorName(p)}
                      </h3>
                      <span className="font-code-ref text-code-ref text-secondary">
                        {p.reference || "—"}
                      </span>
                    </div>
                    <StatusBadge map={PAYMENT_STATUS} code={p.status} />
                  </div>
                  <p className="text-body-sm text-on-surface-variant mb-3 truncate">
                    {projectName(p)}
                  </p>
                  <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-body-sm mb-3 pb-3 border-b border-outline-variant">
                    <span className="text-on-surface-variant">المبلغ</span>
                    <span className="font-medium text-left">{formatMoney(p.amount)}</span>
                    <span className="text-on-surface-variant">الطريقة</span>
                    <span className="text-left">{METHOD_LABELS[p.method] || p.method || "—"}</span>
                    <span className="text-on-surface-variant">التاريخ</span>
                    <span className="text-left">{formatDate(p.date)}</span>
                    <span className="text-on-surface-variant">رقم التحويل</span>
                    <span className="text-left">{p.reference_number || "—"}</span>
                    <span className="text-on-surface-variant">الإثبات</span>
                    <span className="text-left">
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-medium"
                        >
                          عرض
                        </a>
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                  {canAct && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" icon="check" onClick={() => openModal("approve", p)}>
                        اعتماد
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="undo"
                        onClick={() => openModal("return_for_completion", p)}
                      >
                        إعادة
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon="close"
                        onClick={() => openModal("reject", p)}
                      >
                        رفض
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Action modal */}
      <Modal
        open={!!action}
        onClose={closeModal}
        title={cfg?.title || ""}
        footer={
          <>
            <Button
              type="submit"
              form="pay-action-form"
              disabled={mutation.isPending}
              variant={cfg?.variant}
              icon={cfg?.icon}
            >
              {mutation.isPending ? "جارٍ التنفيذ…" : cfg?.verb}
            </Button>
            <Button variant="ghost" onClick={closeModal} type="button">
              إلغاء
            </Button>
          </>
        }
      >
        <form id="pay-action-form" onSubmit={submit} className="flex flex-col gap-stack-md">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-status-rejected/10 text-status-rejected text-body-sm">
              <Icon name="error" className="text-[18px]" />
              {formError}
            </div>
          )}
          {action && (
            <div className="p-stack-md bg-surface rounded-xl border border-outline-variant text-body-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">المرجع</span>
                <span className="font-code-ref text-code-ref text-secondary">
                  {action.payment.reference || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">المساهم</span>
                <span className="font-medium">{contributorName(action.payment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">المبلغ</span>
                <span className="font-medium">{formatMoney(action.payment.amount)}</span>
              </div>
            </div>
          )}
          {cfg?.note && (
            <p className="text-body-sm text-on-surface-variant flex items-start gap-2">
              <Icon name="info" className="text-[18px] mt-0.5" />
              {cfg.note}
            </p>
          )}
          {cfg?.needsReason && (
            <Field label="السبب" required>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="اكتب سبب القرار ليظهر للمساهم…"
              />
            </Field>
          )}
        </form>
      </Modal>
    </div>
  );
}
