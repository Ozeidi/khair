import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Button,
  Card,
  StatusBadge,
  Modal,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import { SUBSCRIPTION_STATUS } from "@/lib/status";
import { formatMoney, formatDate, formatDateTime, clampPercent } from "@/lib/format";
import { useState } from "react";

const FREQUENCY_LABELS = {
  one_time: "مرة واحدة",
  weekly: "أسبوعي",
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semiannual: "نصف سنوي",
  annual: "سنوي",
  custom: "مخصص",
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function totals(s) {
  const total = num(s?.total_value);
  const paid = num(s?.paid_amount);
  const remaining = Math.max(0, total - paid);
  const pct = total > 0 ? (paid / total) * 100 : 0;
  return { total, paid, remaining, pct };
}

function contributorName(s) {
  return (
    s?.user_name ||
    s?.user_display_name ||
    s?.user?.full_name ||
    s?.user?.display_name ||
    s?.contributor_name ||
    "فاعل خير"
  );
}

function projectName(s) {
  return s?.project_name || s?.project?.name || s?.project_title || "—";
}

function shareLabel(s) {
  const name = s?.share_type_name || s?.share_type?.name;
  const qty = num(s?.quantity ?? 1);
  if (name) return qty > 1 ? `${name} × ${qty}` : name;
  return { share: "سهم", open: "مبلغ مفتوح", subscription: "اشتراك دوري" }[s?.contribution_type] || "—";
}

export default function Contributors() {
  const [params, setParams] = useSearchParams();
  const projectId = params.get("project") || "";
  const qc = useQueryClient();
  const [detail, setDetail] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["manage", "subscriptions", projectId],
    queryFn: async () =>
      (await api.get("/subscriptions/", { params: projectId ? { project: projectId } : {} })).data,
  });

  const rows = data?.results ?? (Array.isArray(data) ? data : []);

  const remind = useMutation({
    mutationFn: (sub) => {
      // Prefer subscription-level reminder; fall back to next unpaid installment.
      return api
        .post(`/subscriptions/${sub.id}/send_reminder/`)
        .catch(() => api.post(`/installments/${sub.next_installment_id || sub.id}/send_reminder/`));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manage", "subscriptions", projectId] }),
  });

  return (
    <div>
      <PageHeader
        title="المساهمون والاشتراكات"
        subtitle="متابعة اشتراكات المساهمين والالتزامات المالية عبر مشاريعك."
        actions={
          <>
            {projectId && (
              <Button variant="ghost" icon="filter_alt_off" onClick={() => setParams({})}>
                إلغاء تصفية المشروع
              </Button>
            )}
            <Button variant="ghost" icon="download">
              تصدير
            </Button>
          </>
        }
      />

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState description="تعذّر تحميل قائمة المساهمين." onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="diversity_3"
          title="لا يوجد مساهمون بعد"
          description="ستظهر اشتراكات المساهمين هنا فور تسجيلها."
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card padded={false} className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="p-4 font-medium">المساهم</th>
                    <th className="p-4 font-medium">المشروع</th>
                    <th className="p-4 font-medium">السهم</th>
                    <th className="p-4 font-medium">الالتزام</th>
                    <th className="p-4 font-medium">المدفوع</th>
                    <th className="p-4 font-medium">المتبقي</th>
                    <th className="p-4 font-medium">الحالة</th>
                    <th className="p-4 font-medium">آخر تذكير</th>
                    <th className="p-4 font-medium text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                  {rows.map((s) => {
                    const { total, paid, remaining } = totals(s);
                    return (
                      <tr key={s.id} className="hover:bg-surface/60 transition-colors">
                        <td className="p-4">
                          <div className="font-bold">{contributorName(s)}</div>
                          <span className="font-code-ref text-code-ref text-secondary">{s.reference}</span>
                        </td>
                        <td className="p-4 text-on-surface-variant">{projectName(s)}</td>
                        <td className="p-4 text-on-surface-variant">{shareLabel(s)}</td>
                        <td className="p-4 font-medium">{formatMoney(total)}</td>
                        <td className="p-4 text-primary font-medium">{formatMoney(paid)}</td>
                        <td className="p-4 text-on-surface-variant">{formatMoney(remaining)}</td>
                        <td className="p-4">
                          <StatusBadge map={SUBSCRIPTION_STATUS} code={s.status} />
                        </td>
                        <td className="p-4 text-body-sm text-on-surface-variant whitespace-nowrap">
                          {s.last_reminder_at ? formatDate(s.last_reminder_at) : "لم يُرسل"}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setDetail(s)}
                              className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
                              title="عرض"
                            >
                              <Icon name="visibility" className="text-[20px]" />
                            </button>
                            <button
                              onClick={() => remind.mutate(s)}
                              disabled={remind.isPending}
                              className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-secondary transition-colors disabled:opacity-50"
                              title="إرسال تذكير"
                            >
                              <Icon name="notifications_active" className="text-[20px]" />
                            </button>
                          </div>
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
            {rows.map((s) => {
              const { total, paid, remaining, pct } = totals(s);
              return (
                <Card key={s.id}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-label-md font-heading font-bold text-on-surface truncate">
                        {contributorName(s)}
                      </h3>
                      <p className="text-body-sm text-on-surface-variant truncate">{projectName(s)}</p>
                      <span className="font-code-ref text-code-ref text-secondary">{s.reference}</span>
                    </div>
                    <StatusBadge map={SUBSCRIPTION_STATUS} code={s.status} />
                  </div>
                  <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden mb-3">
                    <div className="bg-primary h-full rounded-full" style={{ width: `${clampPercent(pct)}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center mb-3">
                    <div>
                      <p className="text-body-sm text-on-surface-variant">الالتزام</p>
                      <p className="text-label-md font-heading font-bold">{formatMoney(total)}</p>
                    </div>
                    <div>
                      <p className="text-body-sm text-on-surface-variant">المدفوع</p>
                      <p className="text-label-md font-heading font-bold text-primary">{formatMoney(paid)}</p>
                    </div>
                    <div>
                      <p className="text-body-sm text-on-surface-variant">المتبقي</p>
                      <p className="text-label-md font-heading font-bold">{formatMoney(remaining)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-3 border-t border-outline-variant">
                    <Button variant="ghost" size="sm" icon="visibility" className="flex-1" onClick={() => setDetail(s)}>
                      عرض
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="notifications_active"
                      className="flex-1"
                      onClick={() => remind.mutate(s)}
                      disabled={remind.isPending}
                    >
                      تذكير
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {remind.isError && (
        <p className="text-body-sm text-status-rejected mt-3">تعذّر إرسال التذكير. حاول مرة أخرى.</p>
      )}

      {/* Detail modal */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title="تفاصيل الاشتراك"
        footer={
          <>
            <Button
              icon="notifications_active"
              onClick={() => {
                remind.mutate(detail);
                setDetail(null);
              }}
            >
              إرسال تذكير
            </Button>
            <Button variant="ghost" onClick={() => setDetail(null)}>
              إغلاق
            </Button>
          </>
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-code-ref text-code-ref text-secondary">{detail.reference}</span>
              <StatusBadge map={SUBSCRIPTION_STATUS} code={detail.status} />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-body-md">
              <Info label="المساهم" value={contributorName(detail)} />
              <Info label="المشروع" value={projectName(detail)} />
              <Info label="نوع السهم" value={shareLabel(detail)} />
              <Info label="الدورية" value={FREQUENCY_LABELS[detail.frequency] || "—"} />
              <Info label="الالتزام" value={formatMoney(totals(detail).total)} />
              <Info label="المدفوع" value={formatMoney(totals(detail).paid)} valueClass="text-primary" />
              <Info label="المتبقي" value={formatMoney(totals(detail).remaining)} />
              <Info label="تاريخ البدء" value={formatDate(detail.start_date)} />
              <Info label="عدد الدفعات" value={detail.installments_count ?? "—"} />
              <Info
                label="آخر تذكير"
                value={detail.last_reminder_at ? formatDateTime(detail.last_reminder_at) : "لم يُرسل"}
              />
            </dl>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value, valueClass = "text-on-surface" }) {
  return (
    <div>
      <dt className="text-body-sm text-on-surface-variant">{label}</dt>
      <dd className={`font-heading font-medium ${valueClass}`}>{value}</dd>
    </div>
  );
}
