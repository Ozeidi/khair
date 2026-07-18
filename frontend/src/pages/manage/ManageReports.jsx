import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Button,
  Card,
  ProgressBar,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import { Field, Select } from "@/components/ui";
import { formatMoney, formatNumber, formatDate, clampPercent } from "@/lib/format";

const REVENUE_TYPE_LABELS = {
  share: "أسهم",
  donation: "تبرعات",
  grant: "منح",
  corporate: "شركات",
  event: "فعاليات",
  other: "أخرى",
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function asList(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    return Object.entries(v).map(([key, value]) => ({ type: key, category: key, ...normalizeEntry(value) }));
  }
  return [];
}

function normalizeEntry(value) {
  if (value && typeof value === "object") return value;
  return { amount: value, total: value };
}

export default function ManageReports() {
  const [params, setParams] = useSearchParams();
  const [projectId, setProjectId] = useState(params.get("project") || "");

  useEffect(() => {
    const p = params.get("project");
    if (p && p !== projectId) setProjectId(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const projectsQuery = useQuery({
    queryKey: ["manage", "projects", "picker"],
    queryFn: async () => (await api.get("/projects/")).data,
  });
  const projects = projectsQuery.data?.results ?? (Array.isArray(projectsQuery.data) ? projectsQuery.data : []);

  const reportQuery = useQuery({
    queryKey: ["report", "financial", projectId],
    queryFn: async () => (await api.get(`/reports/project/${projectId}/financial/`)).data,
    enabled: !!projectId,
  });

  const r = reportQuery.data ?? {};

  const selectProject = (val) => {
    setProjectId(val);
    setParams(val ? { project: val } : {});
  };

  const target = num(r.target);
  const collected = num(r.collected);
  const pledged = num(r.pledged ?? collected);
  const remaining = num(r.remaining ?? Math.max(0, target - collected));
  const expenses = num(r.expenses);
  const balance = num(r.balance ?? collected - expenses);
  const inkindValue = num(r.inkind_value);

  const revenuesByType = asList(r.revenues_by_type);
  const expensesByCategory = asList(r.expenses_by_category);
  const budgetOverruns = Array.isArray(r.budget_overruns) ? r.budget_overruns : [];
  const pendingPayments = num(r.pending_payments);
  const missingInvoices = num(r.missing_invoices);

  const revenueTotal = revenuesByType.reduce((s, x) => s + num(x.amount ?? x.total), 0) || collected;
  const expenseTotal = expensesByCategory.reduce((s, x) => s + num(x.amount ?? x.total), 0) || expenses;

  const exportUrl = (fmt) => `/api/v1/reports/project/${projectId}/financial/export/?format=${fmt}`;

  return (
    <div>
      <PageHeader
        title="التقارير المالية"
        subtitle="تقرير مالي شامل لكل مشروع مع إمكانية التصدير."
        actions={
          projectId ? (
            <>
              <Button as="a" href={exportUrl("pdf")} target="_blank" rel="noopener" variant="ghost" icon="picture_as_pdf">
                تصدير PDF
              </Button>
              <Button as="a" href={exportUrl("excel")} target="_blank" rel="noopener" variant="secondary" icon="table_view">
                تصدير Excel
              </Button>
            </>
          ) : null
        }
      />

      {/* Project picker */}
      <Card className="mb-stack-lg">
        <Field label="اختر المشروع">
          {projectsQuery.isLoading ? (
            <Loading label="جارٍ تحميل المشاريع…" />
          ) : (
            <Select value={projectId} onChange={(e) => selectProject(e.target.value)}>
              <option value="">— اختر مشروعًا —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.reference ? `(${p.reference})` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Card>

      {!projectId ? (
        <EmptyState
          icon="analytics"
          title="اختر مشروعًا لعرض تقريره"
          description="سيظهر التقرير المالي الكامل بعد اختيار المشروع."
        />
      ) : reportQuery.isLoading ? (
        <Loading label="جارٍ إعداد التقرير…" />
      ) : reportQuery.isError ? (
        <ErrorState description="تعذّر تحميل التقرير المالي." onRetry={reportQuery.refetch} />
      ) : (
        <div className="space-y-stack-lg">
          {/* Balances summary */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-gutter">
            <SummaryCard icon="flag" label="الهدف" value={target} tone="secondary" />
            <SummaryCard icon="savings" label="المُحصّل" value={collected} tone="primary" />
            <SummaryCard icon="payments" label="المصروفات" value={expenses} tone="tertiary" />
            <SummaryCard
              icon="account_balance"
              label="الرصيد"
              value={balance}
              tone={balance < 0 ? "danger" : "neutral"}
            />
          </section>

          {/* Progress */}
          <Card>
            <h2 className="text-headline-sm font-heading text-on-surface mb-stack-md">الإنجاز والأرصدة</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
              <div className="space-y-4">
                <ProgressBar
                  tone="financial"
                  value={r.financial_progress ?? (target > 0 ? (collected / target) * 100 : 0)}
                  label="الإنجاز المالي"
                  size="lg"
                />
                <ProgressBar tone="execution" value={r.execution_progress} label="الإنجاز التنفيذي" size="lg" />
              </div>
              <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-body-md content-start">
                <Row label="التعهدات" value={formatMoney(pledged)} />
                <Row label="المتبقي للهدف" value={formatMoney(remaining)} />
                <Row label="قيمة العيني" value={formatMoney(inkindValue)} />
                <Row label="عدد المساهمين" value={formatNumber(num(r.contributors))} />
                <Row label="عدد الاشتراكات" value={formatNumber(num(r.subscriptions))} />
              </dl>
            </div>
          </Card>

          {/* Revenues + Expenses breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            <Breakdown
              title="الإيرادات حسب النوع"
              icon="volunteer_activism"
              tone="financial"
              total={revenueTotal}
              items={revenuesByType.map((x) => ({
                label: REVENUE_TYPE_LABELS[x.type ?? x.revenue_type] || x.type || x.label || "أخرى",
                amount: num(x.amount ?? x.total),
              }))}
            />
            <Breakdown
              title="المصروفات حسب التصنيف"
              icon="shopping_cart"
              tone="execution"
              total={expenseTotal}
              items={expensesByCategory.map((x) => ({
                label: x.category || x.label || x.name || "غير مصنّف",
                amount: num(x.amount ?? x.total),
              }))}
            />
          </div>

          {/* Attention items */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
            <FlagCard icon="pending_actions" label="دفعات معلقة" count={pendingPayments} desc="بانتظار المراجعة والاعتماد" />
            <FlagCard icon="request_quote" label="فواتير ناقصة" count={missingInvoices} desc="مصروفات دون فاتورة مرفقة" />
            <FlagCard
              icon="warning"
              label="تجاوزات الميزانية"
              count={budgetOverruns.length}
              desc="بنود تجاوزت الحد المعتمد"
            />
          </div>

          {/* Budget overruns detail */}
          {budgetOverruns.length > 0 && (
            <Card padded={false} className="overflow-hidden">
              <div className="p-stack-md border-b border-outline-variant flex items-center gap-2">
                <Icon name="warning" className="text-status-rejected" />
                <h2 className="text-headline-sm font-heading text-on-surface">تفاصيل تجاوزات الميزانية</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-surface-container-low text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                    <tr>
                      <th className="p-4 font-medium">البند</th>
                      <th className="p-4 font-medium">المعتمد</th>
                      <th className="p-4 font-medium">المصروف</th>
                      <th className="p-4 font-medium">التجاوز</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                    {budgetOverruns.map((b, i) => {
                      const approved = num(b.approved_amount ?? b.approved);
                      const spent = num(b.spent_amount ?? b.spent);
                      const over = num(b.overrun ?? Math.max(0, spent - approved));
                      return (
                        <tr key={b.id ?? i}>
                          <td className="p-4 font-bold">{b.name || b.item || "—"}</td>
                          <td className="p-4 text-on-surface-variant">{formatMoney(approved)}</td>
                          <td className="p-4">{formatMoney(spent)}</td>
                          <td className="p-4 text-status-rejected font-bold">{formatMoney(over)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, tone }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary-container text-on-secondary-container",
    tertiary: "bg-tertiary-container/20 text-tertiary",
    neutral: "bg-surface-container-high text-on-surface-variant",
    danger: "bg-status-rejected/10 text-status-rejected",
  };
  const valueColor = tone === "danger" ? "text-status-rejected" : tone === "primary" ? "text-primary" : "text-on-surface";
  return (
    <Card className="flex flex-col justify-between">
      <div className={`p-2 rounded-lg w-fit ${tones[tone]}`}>
        <Icon name={icon} />
      </div>
      <div className="mt-4">
        <p className="text-label-md font-heading text-on-surface-variant">{label}</p>
        <h3 className={`text-headline-lg font-heading ${valueColor}`}>
          {formatMoney(value, "").trim()} <span className="text-body-sm text-on-surface-variant">ر.ع.</span>
        </h3>
      </div>
    </Card>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <dt className="text-body-sm text-on-surface-variant">{label}</dt>
      <dd className="font-heading font-bold text-on-surface">{value}</dd>
    </div>
  );
}

function Breakdown({ title, icon, tone, total, items }) {
  const fill = tone === "execution" ? "bg-secondary" : "bg-primary";
  const rows = items.filter((x) => x.amount > 0).sort((a, b) => b.amount - a.amount);
  return (
    <Card>
      <div className="flex items-center gap-2 mb-stack-md">
        <Icon name={icon} className="text-on-surface-variant" />
        <h2 className="text-headline-sm font-heading text-on-surface">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant py-6 text-center">لا توجد بيانات.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((x, i) => {
            const pct = total > 0 ? (x.amount / total) * 100 : 0;
            return (
              <div key={i}>
                <div className="flex justify-between text-body-sm mb-1">
                  <span className="text-on-surface font-medium">{x.label}</span>
                  <span className="text-on-surface-variant">{formatMoney(x.amount)}</span>
                </div>
                <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div className={`h-full ${fill} rounded-full`} style={{ width: `${clampPercent(pct)}%` }} />
                </div>
              </div>
            );
          })}
          <div className="pt-3 mt-1 border-t border-outline-variant flex justify-between">
            <span className="text-label-md font-heading font-bold text-on-surface">الإجمالي</span>
            <span className="text-label-md font-heading font-bold text-on-surface">{formatMoney(total)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

function FlagCard({ icon, label, count, desc }) {
  const alert = count > 0;
  return (
    <div
      className={`flex items-center gap-4 p-stack-md rounded-xl border ${
        alert ? "bg-status-rejected/5 border-status-rejected/30" : "bg-surface-container-lowest border-outline-variant soft-shadow"
      }`}
    >
      <div className={`p-3 rounded-lg ${alert ? "bg-status-rejected/10 text-status-rejected" : "bg-surface-container-high text-on-surface-variant"}`}>
        <Icon name={icon} />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className={`text-headline-md font-heading font-bold ${alert ? "text-status-rejected" : "text-on-surface"}`}>
            {formatNumber(count)}
          </span>
          <span className="text-label-md font-heading text-on-surface">{label}</span>
        </div>
        <p className="text-body-sm text-on-surface-variant truncate">{desc}</p>
      </div>
    </div>
  );
}
