import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { SUBSCRIPTION_STATUS } from "@/lib/status";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Card,
  StatusBadge,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";

// Frequency (الدورية) → Arabic label.
export const FREQUENCY_LABELS = {
  one_time: "مرة واحدة",
  weekly: "أسبوعي",
  monthly: "شهري",
  quarterly: "ربع سنوي",
  semiannual: "نصف سنوي",
  annual: "سنوي",
  custom: "مخصص",
};

function subTotals(s) {
  const total = Number(s?.total_value ?? 0);
  const paid = Number(s?.paid_amount ?? 0);
  const remaining = Math.max(0, total - paid);
  return { total, paid, remaining };
}

function shareLabel(s) {
  const name = s?.share_type_name || s?.share_type?.name || s?.share_type_detail?.name;
  const qty = Number(s?.quantity ?? 1);
  if (name) return qty > 1 ? `${name} × ${qty}` : name;
  const type = { share: "سهم", open: "مبلغ مفتوح", subscription: "اشتراك دوري" }[s?.contribution_type];
  return type || "—";
}

function projectName(s) {
  return s?.project_name || s?.project?.name || s?.project_title || "—";
}

export default function Subscriptions() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => (await api.get("/subscriptions/")).data,
  });

  const rows = data?.results ?? (Array.isArray(data) ? data : []);

  return (
    <div>
      <PageHeader
        title="اشتراكاتي"
        subtitle="جميع مساهماتك والتزاماتك الدورية عبر المشاريع الخيرية."
      />

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState
          description="تعذّر تحميل اشتراكاتك. حاول مرة أخرى."
          onRetry={refetch}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="volunteer_activism"
          title="لا توجد اشتراكات بعد"
          description="ابدأ بالمساهمة في أحد المشاريع لتظهر اشتراكاتك هنا."
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
                    <th className="p-4 font-medium">المشروع</th>
                    <th className="p-4 font-medium">السهم / الكمية</th>
                    <th className="p-4 font-medium">الإجمالي</th>
                    <th className="p-4 font-medium">المدفوع</th>
                    <th className="p-4 font-medium">المتبقي</th>
                    <th className="p-4 font-medium">الدورية</th>
                    <th className="p-4 font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                  {rows.map((s) => {
                    const { total, paid, remaining } = subTotals(s);
                    return (
                      <tr
                        key={s.id}
                        onClick={() => navigate(`/dashboard/subscriptions/${s.id}`)}
                        className="hover:bg-surface/60 transition-colors cursor-pointer"
                      >
                        <td className="p-4">
                          <span className="font-code-ref text-code-ref text-secondary">
                            {s.reference || "—"}
                          </span>
                        </td>
                        <td className="p-4 font-bold">{projectName(s)}</td>
                        <td className="p-4 text-on-surface-variant">{shareLabel(s)}</td>
                        <td className="p-4">{formatMoney(total)}</td>
                        <td className="p-4 text-primary font-medium">{formatMoney(paid)}</td>
                        <td className="p-4 text-on-surface-variant">{formatMoney(remaining)}</td>
                        <td className="p-4 text-on-surface-variant">
                          {FREQUENCY_LABELS[s.frequency] || "—"}
                        </td>
                        <td className="p-4">
                          <StatusBadge map={SUBSCRIPTION_STATUS} code={s.status} />
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
              const { total, paid, remaining } = subTotals(s);
              return (
                <Card
                  key={s.id}
                  onClick={() => navigate(`/dashboard/subscriptions/${s.id}`)}
                  className="cursor-pointer active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-label-md font-heading font-bold text-on-surface truncate">
                        {projectName(s)}
                      </h3>
                      <span className="font-code-ref text-code-ref text-secondary">
                        {s.reference || "—"}
                      </span>
                    </div>
                    <StatusBadge map={SUBSCRIPTION_STATUS} code={s.status} />
                  </div>
                  <div className="flex items-center gap-2 text-body-sm text-on-surface-variant mb-3">
                    <Icon name="paid" className="text-[18px]" />
                    <span>{shareLabel(s)}</span>
                    <span className="text-outline-variant">•</span>
                    <span>{FREQUENCY_LABELS[s.frequency] || "—"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-outline-variant text-center">
                    <div>
                      <p className="text-body-sm text-on-surface-variant">الإجمالي</p>
                      <p className="text-label-md font-heading font-bold">{formatMoney(total)}</p>
                    </div>
                    <div>
                      <p className="text-body-sm text-on-surface-variant">المدفوع</p>
                      <p className="text-label-md font-heading font-bold text-primary">
                        {formatMoney(paid)}
                      </p>
                    </div>
                    <div>
                      <p className="text-body-sm text-on-surface-variant">المتبقي</p>
                      <p className="text-label-md font-heading font-bold">{formatMoney(remaining)}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
