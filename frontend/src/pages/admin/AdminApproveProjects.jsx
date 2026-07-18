import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
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
import PageHeader from "@/components/ui/PageHeader";
import { PROJECT_STATUS } from "@/lib/status";
import { formatMoney, formatDate, formatNumber } from "@/lib/format";

function rows(data) {
  return Array.isArray(data) ? data : data?.results ?? [];
}

const STATUS_TABS = [
  { value: "pending_approval", label: "بانتظار الاعتماد" },
  { value: "returned", label: "معادة للتعديل" },
  { value: "approved", label: "معتمدة" },
  { value: "rejected", label: "مرفوضة" },
];

// §9.2 قائمة التحقق قبل الاعتماد.
const CHECKLIST = [
  { key: "description", label: "الوصف التفصيلي", test: (p) => !!(p.description || "").trim() },
  { key: "organization", label: "الجهة", test: (p) => !!p.organization },
  { key: "manager", label: "مدير المشروع", test: (p) => !!p.manager },
  { key: "target", label: "الهدف المالي", test: (p) => Number(p.target_amount) > 0 },
  { key: "cover", label: "صورة الغلاف", test: (p) => !!p.cover_image },
  {
    key: "payment",
    label: "وسيلة الدفع (حساب أو رابط)",
    test: (p) => !!(p.iban || p.bank_account_name || p.payment_link),
  },
  { key: "dates", label: "تاريخ البداية", test: (p) => !!p.start_date },
  { key: "category", label: "التصنيف", test: (p) => !!p.category },
];

const ACTIONS = {
  approve: {
    endpoint: "approve",
    title: "اعتماد المشروع",
    verb: "اعتماد ونشر",
    icon: "check_circle",
    variant: "primary",
    needsNote: false,
    note: "سيُعتمد المشروع ويُنشر ويبدأ استقبال المساهمات.",
  },
  return_for_edits: {
    endpoint: "return_for_edits",
    title: "إعادة للتعديل",
    verb: "إعادة",
    icon: "undo",
    variant: "secondary",
    needsNote: true,
    note: "سيعاد المشروع لصاحبه لاستكمال البيانات الناقصة.",
  },
  reject: {
    endpoint: "reject",
    title: "رفض المشروع",
    verb: "رفض",
    icon: "cancel",
    variant: "danger",
    needsNote: true,
    note: "سيتم إشعار صاحب المشروع بسبب الرفض.",
  },
};

// Transparency flags → Arabic labels (SRS §7.12).
const TRANSPARENCY_LABELS = [
  ["show_target", "الهدف"],
  ["show_collected", "المحصل"],
  ["show_remaining", "المتبقي"],
  ["show_revenues", "الإيرادات"],
  ["show_expenses", "المصروفات"],
  ["show_balance", "الرصيد"],
  ["show_invoices", "الفواتير"],
  ["show_contributor_names", "أسماء المساهمين"],
  ["show_stages", "المراحل"],
  ["show_updates", "التحديثات"],
];

function SummaryStat({ label, value, tone = "on-surface" }) {
  return (
    <div className="bg-surface rounded-lg border border-outline-variant p-3">
      <p className="text-body-sm text-on-surface-variant mb-1">{label}</p>
      <p className={`text-label-md font-heading font-bold text-${tone}`}>{value}</p>
    </div>
  );
}

export default function AdminApproveProjects() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending_approval");
  const [selected, setSelected] = useState(null); // project under review
  const [action, setAction] = useState(null);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "projects", statusFilter],
    queryFn: async () =>
      rows((await api.get("/projects/", { params: { status: statusFilter } })).data),
  });

  // Transparency for the project under review.
  const transparencyQ = useQuery({
    enabled: !!selected,
    queryKey: ["admin", "transparency", selected?.id],
    queryFn: async () =>
      rows((await api.get("/transparency/", { params: { project: selected.id } })).data)[0] ??
      null,
  });

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/projects/${selected.id}/${ACTIONS[action].endpoint}/`, { note })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "projects"] });
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      closeReview();
    },
    onError: (err) => setFormError(err?.apiMessage || "تعذّر تنفيذ الإجراء. حاول مرة أخرى."),
  });

  const projects = data ?? [];

  function openReview(p) {
    setSelected(p);
    setAction(null);
    setNote("");
    setFormError("");
  }
  function closeReview() {
    setSelected(null);
    setAction(null);
    setNote("");
    setFormError("");
  }
  function submit(e) {
    e.preventDefault();
    setFormError("");
    if (!action) return;
    if (ACTIONS[action].needsNote && !note.trim()) {
      setFormError("يرجى إدخال سبب القرار.");
      return;
    }
    mutation.mutate();
  }

  const cfg = action ? ACTIONS[action] : null;
  const transparency = transparencyQ.data;
  const checklist = selected ? CHECKLIST.map((c) => ({ ...c, ok: c.test(selected) })) : [];
  const allChecked = checklist.every((c) => c.ok);

  return (
    <div>
      <PageHeader
        title="اعتماد المشاريع"
        subtitle="مراجعة المشاريع المقدَّمة للاعتماد وفق قائمة التحقق قبل النشر."
      />

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-gutter">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`px-4 py-2 rounded-full text-label-md font-heading font-bold transition-colors ${
              statusFilter === t.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading label="جارٍ تحميل المشاريع…" />
      ) : isError ? (
        <ErrorState description="تعذّر تحميل المشاريع." onRetry={refetch} />
      ) : projects.length === 0 ? (
        <EmptyState
          icon="fact_check"
          title="لا توجد مشاريع"
          description="لا توجد مشاريع بهذه الحالة حالياً."
        />
      ) : (
        <div className="space-y-stack-md">
          {projects.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex gap-4 min-w-0 flex-1">
                  <div className="w-14 h-14 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center text-on-surface-variant shrink-0">
                    {p.cover_image ? (
                      <div
                        className="w-full h-full bg-cover bg-center"
                        style={{ backgroundImage: `url('${p.cover_image}')` }}
                      />
                    ) : (
                      <Icon name="volunteer_activism" className="text-[26px]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge map={PROJECT_STATUS} code={p.status} />
                      <span className="text-code-ref font-code-ref text-secondary">
                        {p.reference}
                      </span>
                    </div>
                    <h3 className="text-headline-sm font-heading text-on-surface">{p.name}</h3>
                    <p className="text-body-md text-on-surface-variant mt-1 line-clamp-2">
                      {p.short_description || p.description}
                    </p>
                    <div className="flex gap-4 mt-3 text-body-sm text-on-surface-variant flex-wrap">
                      <span className="flex items-center gap-1">
                        <Icon name="domain" className="text-[16px]" />
                        {p.organization_name || "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="payments" className="text-[16px]" />
                        هدف: {formatMoney(p.target_amount)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="calendar_today" className="text-[16px]" />
                        {formatDate(p.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <Button variant="ghost" icon="reviews" onClick={() => openReview(p)}>
                    مراجعة
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Review modal */}
      <Modal
        open={!!selected}
        onClose={closeReview}
        size="xl"
        title={selected ? `مراجعة المشروع — ${selected.name}` : ""}
        footer={
          cfg ? (
            <>
              <Button
                type="submit"
                form="project-review-form"
                disabled={mutation.isPending}
                variant={cfg.variant}
                icon={cfg.icon}
              >
                {mutation.isPending ? "جارٍ التنفيذ…" : cfg.verb}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setAction(null)}>
                رجوع
              </Button>
            </>
          ) : (
            <Button variant="ghost" type="button" onClick={closeReview}>
              إغلاق
            </Button>
          )
        }
      >
        {selected && (
          <div className="space-y-stack-lg">
            {/* Header meta */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-code-ref font-code-ref text-secondary">
                {selected.reference}
              </span>
              <StatusBadge map={PROJECT_STATUS} code={selected.status} />
            </div>

            {/* Financial summary */}
            <section>
              <h3 className="text-label-md font-heading text-on-surface mb-2 flex items-center gap-2">
                <Icon name="account_balance_wallet" className="text-primary text-[20px]" />
                الملخص المالي
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryStat label="الهدف المالي" value={formatMoney(selected.target_amount)} tone="primary" />
                <SummaryStat label="التكلفة التقديرية" value={formatMoney(selected.estimated_cost)} />
                <SummaryStat label="المتوفر مسبقًا" value={formatMoney(selected.initial_amount)} />
                <SummaryStat
                  label="الحد الأدنى للمساهمة"
                  value={formatMoney(selected.minimum_contribution)}
                />
                <SummaryStat label="العملة" value={selected.currency || "OMR"} />
                <SummaryStat
                  label="مساهمة مفتوحة"
                  value={selected.open_contribution ? "نعم" : "لا"}
                />
                <SummaryStat
                  label="احتساب العيني"
                  value={selected.count_inkind_in_progress ? "نعم" : "لا"}
                />
                <SummaryStat
                  label="المستفيدون"
                  value={
                    selected.beneficiaries_count != null
                      ? formatNumber(selected.beneficiaries_count)
                      : "—"
                  }
                />
              </div>
            </section>

            {/* §9.2 checklist */}
            <section>
              <h3 className="text-label-md font-heading text-on-surface mb-2 flex items-center gap-2">
                <Icon name="checklist" className="text-primary text-[20px]" />
                قائمة التحقق قبل الاعتماد
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {checklist.map((c) => (
                  <li
                    key={c.key}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-body-sm ${
                      c.ok
                        ? "border-status-approved/30 bg-status-approved/5 text-on-surface"
                        : "border-status-rejected/30 bg-status-rejected/5 text-on-surface"
                    }`}
                  >
                    <Icon
                      name={c.ok ? "check_circle" : "cancel"}
                      className={`text-[18px] ${
                        c.ok ? "text-status-approved" : "text-status-rejected"
                      }`}
                    />
                    {c.label}
                  </li>
                ))}
              </ul>
              {!allChecked && (
                <p className="text-body-sm text-status-rejected mt-2 flex items-center gap-1">
                  <Icon name="warning" className="text-[18px]" />
                  بعض عناصر التحقق ناقصة — يُنصح بالإعادة للتعديل قبل الاعتماد.
                </p>
              )}
            </section>

            {/* Transparency summary */}
            <section>
              <h3 className="text-label-md font-heading text-on-surface mb-2 flex items-center gap-2">
                <Icon name="visibility" className="text-primary text-[20px]" />
                إعدادات الشفافية العامة
              </h3>
              {transparencyQ.isLoading ? (
                <p className="text-body-sm text-on-surface-variant">جارٍ تحميل الشفافية…</p>
              ) : transparency ? (
                <div className="flex flex-wrap gap-2">
                  {TRANSPARENCY_LABELS.map(([key, label]) => {
                    const on = !!transparency[key];
                    return (
                      <span
                        key={key}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-body-sm font-medium ${
                          on
                            ? "bg-status-approved/10 text-status-approved"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        <Icon
                          name={on ? "visibility" : "visibility_off"}
                          className="text-[16px]"
                        />
                        {label}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-body-sm text-on-surface-variant">
                  لم تُضبط إعدادات الشفافية بعد.
                </p>
              )}
            </section>

            {/* Description */}
            {selected.description && (
              <section>
                <h3 className="text-label-md font-heading text-on-surface mb-2 flex items-center gap-2">
                  <Icon name="description" className="text-primary text-[20px]" />
                  الوصف
                </h3>
                <p className="text-body-md text-on-surface whitespace-pre-line">
                  {selected.description}
                </p>
              </section>
            )}

            {selected.review_note && (
              <div className="p-3 rounded-lg bg-status-returned/10 text-status-returned text-body-sm flex items-start gap-2">
                <Icon name="sticky_note_2" className="text-[18px] mt-0.5" />
                <span>ملاحظة سابقة: {selected.review_note}</span>
              </div>
            )}

            {/* Decision */}
            <section className="border-t border-outline-variant pt-stack-md">
              {!action ? (
                <div>
                  <p className="text-label-md font-heading text-on-surface mb-2">القرار</p>
                  {selected.status === "pending_approval" ||
                  selected.status === "returned" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button icon="check_circle" onClick={() => setAction("approve")}>
                        اعتماد ونشر
                      </Button>
                      <Button
                        variant="secondary"
                        icon="undo"
                        onClick={() => setAction("return_for_edits")}
                      >
                        إعادة للتعديل
                      </Button>
                      <Button variant="danger" icon="cancel" onClick={() => setAction("reject")}>
                        رفض
                      </Button>
                    </div>
                  ) : (
                    <p className="text-body-sm text-on-surface-variant">
                      لا توجد إجراءات متاحة لهذه الحالة.
                    </p>
                  )}
                </div>
              ) : (
                <form
                  id="project-review-form"
                  onSubmit={submit}
                  className="space-y-stack-md"
                >
                  <div className="flex items-center gap-2 text-label-md font-heading text-on-surface">
                    <Icon name={cfg.icon} className="text-primary" />
                    {cfg.title}
                  </div>
                  {formError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-status-rejected/10 text-status-rejected text-body-sm">
                      <Icon name="error" className="text-[18px]" />
                      {formError}
                    </div>
                  )}
                  <p className="text-body-sm text-on-surface-variant flex items-start gap-2">
                    <Icon name="info" className="text-[18px] mt-0.5" />
                    {cfg.note}
                  </p>
                  <Field
                    label="سبب القرار / ملاحظة"
                    required={cfg.needsNote}
                    hint={cfg.needsNote ? "" : "اختياري"}
                  >
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="اكتب ملاحظتك لصاحب المشروع…"
                    />
                  </Field>
                </form>
              )}
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
