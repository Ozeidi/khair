import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Icon,
  Button,
  StatusBadge,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import PageHeader from "@/components/ui/PageHeader";
import { PROJECT_STATUS } from "@/lib/status";
import { formatMoney, clampPercent } from "@/lib/format";

/* Normalize either a paginated envelope or a plain array into an array. */
function rows(data) {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ── Bento statistic tile (samples _1, _4) ──────────────────────────── */
function StatTile({ icon, label, iconWrap, children, danger }) {
  return (
    <div
      className={`bg-surface-container-lowest p-stack-md rounded-xl border flex flex-col justify-between relative overflow-hidden ${
        danger
          ? "border-status-rejected/30 shadow-[0_4px_12px_rgba(239,68,68,0.04)]"
          : "border-outline-variant soft-shadow"
      }`}
    >
      {danger && (
        <div className="absolute top-0 right-0 w-16 h-16 bg-status-rejected/5 -mr-8 -mt-8 rounded-full" />
      )}
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-2 rounded-lg ${iconWrap}`}>
          <Icon name={icon} />
        </div>
        <span
          className={`text-label-md font-heading ${
            danger ? "text-status-rejected font-bold" : "text-on-surface-variant"
          }`}
        >
          {label}
        </span>
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function Money({ value, className = "text-on-surface", unitClass = "text-on-surface-variant" }) {
  const formatted = formatMoney(value, "");
  return (
    <h3 className={`text-headline-lg font-heading ${className}`}>
      {formatted.trim()} <span className={`text-body-sm ${unitClass}`}>ر.ع.</span>
    </h3>
  );
}

/* Quick link tile. */
function QuickLink({ to, icon, label, tone = "primary" }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary-container text-on-secondary-container",
    tertiary: "bg-tertiary-container/20 text-tertiary",
    neutral: "bg-surface-container-high text-on-surface-variant",
  };
  return (
    <Link
      to={to}
      className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant bg-surface hover:bg-surface-container-low transition-colors group"
    >
      <div className={`p-2 rounded-lg ${tones[tone]}`}>
        <Icon name={icon} className="text-[20px]" />
      </div>
      <span className="text-label-md font-heading text-on-surface flex-1">{label}</span>
      <Icon
        name="chevron_left"
        className="text-[18px] text-on-surface-variant group-hover:text-primary transition-colors"
      />
    </Link>
  );
}

export default function ManageHome() {
  const { user } = useAuth();
  const orgName = user?.organization_name || user?.organization?.name;

  const projectsQuery = useQuery({
    queryKey: ["manage", "projects"],
    queryFn: async () => rows((await api.get("/projects/")).data),
  });
  const pendingPaymentsQuery = useQuery({
    queryKey: ["manage", "payments", "pending"],
    queryFn: async () =>
      rows((await api.get("/payments/", { params: { status: "pending" } })).data),
  });
  const budgetsQuery = useQuery({
    queryKey: ["manage", "budgets"],
    queryFn: async () => rows((await api.get("/budgets/")).data),
  });

  const projects = projectsQuery.data ?? [];
  const pendingPayments = pendingPaymentsQuery.data ?? [];
  const budgets = budgetsQuery.data ?? [];

  /* ── Aggregations (defensive) ──────────────────────────────────── */
  const projectsCount = projects.length;
  const totalCollected = projects.reduce((sum, p) => sum + num(p.collected_amount), 0);
  const pendingCount = pendingPayments.length;

  /* Budget overruns: any budget item whose spent+committed exceeds approved. */
  const overrunCount = budgets.reduce((count, b) => {
    const items = b?.items ?? [];
    const over = items.filter(
      (it) =>
        num(it.spent_amount) + num(it.committed_amount) > num(it.approved_amount) &&
        num(it.approved_amount) > 0
    ).length;
    return count + over;
  }, 0);

  const loading = projectsQuery.isLoading;
  const errored = projectsQuery.isError;

  const header = (
    <PageHeader
      title="لوحة المشاريع"
      subtitle={
        orgName
          ? `نظرة عامة على أداء مشاريع ${orgName} المالي والتنفيذي.`
          : "نظرة عامة على أداء مشاريعك المالي والتنفيذي."
      }
      actions={
        <Button as={Link} to="/manage/projects/new" variant="primary" icon="add">
          مشروع جديد
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <div>
        {header}
        <Loading label="جارٍ تحميل اللوحة…" />
      </div>
    );
  }

  if (errored) {
    return (
      <div>
        {header}
        <ErrorState
          description="تعذّر تحميل بيانات المشاريع."
          onRetry={() => projectsQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-stack-lg">
      {header}

      {/* Bento stats */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <StatTile
          icon="folder_managed"
          label="عدد المشاريع"
          iconWrap="bg-secondary-container text-on-secondary-container"
        >
          <h3 className="text-headline-lg font-heading text-on-surface">{projectsCount}</h3>
        </StatTile>

        <StatTile
          icon="account_balance_wallet"
          label="إجمالي المحصل"
          iconWrap="bg-primary/10 text-primary"
        >
          <Money value={totalCollected} className="text-primary" />
        </StatTile>

        <StatTile
          icon="hourglass_top"
          label="الدفعات المعلقة"
          iconWrap="bg-status-pending/10 text-status-pending"
        >
          <h3 className="text-headline-lg font-heading text-on-surface">
            {pendingPaymentsQuery.isLoading ? "…" : pendingCount}
            <span className="text-body-sm text-on-surface-variant"> بانتظار المراجعة</span>
          </h3>
        </StatTile>

        <StatTile
          icon="warning"
          label="تجاوزات الميزانية"
          iconWrap="bg-status-rejected/10 text-status-rejected"
          danger={overrunCount > 0}
        >
          <h3
            className={`text-headline-lg font-heading ${
              overrunCount > 0 ? "text-status-rejected" : "text-on-surface"
            }`}
          >
            {budgetsQuery.isLoading ? "…" : overrunCount}
            <span className="text-body-sm text-on-surface-variant"> بند متجاوز</span>
          </h3>
        </StatTile>
      </section>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Projects list (span 2) */}
        <div className="lg:col-span-2">
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant soft-shadow overflow-hidden">
            <div className="flex justify-between items-center p-stack-md border-b border-outline-variant">
              <h2 className="text-headline-sm font-heading text-on-surface">مشاريع الجهة</h2>
              <Link
                to="/manage/projects"
                className="text-label-md font-heading text-secondary hover:text-secondary/80 flex items-center gap-1"
              >
                عرض الكل
                <Icon name="chevron_left" className="text-[18px]" />
              </Link>
            </div>

            {projects.length === 0 ? (
              <EmptyState
                icon="folder_off"
                title="لا توجد مشاريع بعد"
                description="ابدأ بإنشاء مشروعك الأول لإدارة مساهماته وتمويله."
                action={
                  <Button
                    as={Link}
                    to="/manage/projects/new"
                    variant="primary"
                    icon="add"
                    className="mt-2"
                  >
                    مشروع جديد
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-outline-variant">
                {projects.slice(0, 6).map((p) => {
                  const finPct = clampPercent(p.financial_progress);
                  const execPct = clampPercent(p.execution_progress);
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/manage/projects/${p.id}`}
                        className="flex items-center gap-4 p-stack-md hover:bg-surface/60 transition-colors"
                      >
                        <div className="w-11 h-11 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center text-on-surface-variant shrink-0">
                          {p.cover_image ? (
                            <div
                              className="w-full h-full bg-cover bg-center"
                              style={{ backgroundImage: `url('${p.cover_image}')` }}
                            />
                          ) : (
                            <Icon name="volunteer_activism" className="text-[22px]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <h3 className="text-label-md font-heading font-bold text-on-surface truncate">
                              {p.name}
                            </h3>
                            <StatusBadge map={PROJECT_STATUS} code={p.status} />
                          </div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-primary h-full rounded-full"
                                style={{ width: `${finPct}%` }}
                              />
                            </div>
                            <span className="text-[12px] text-primary w-9 shrink-0">
                              {Math.round(finPct)}٪
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-secondary h-full rounded-full"
                                style={{ width: `${execPct}%` }}
                              />
                            </div>
                            <span className="text-[12px] text-secondary w-9 shrink-0">
                              {Math.round(execPct)}٪
                            </span>
                          </div>
                          <div className="flex flex-row-reverse justify-between text-code-ref font-code-ref text-on-surface-variant mt-1.5">
                            <span>الهدف: {formatMoney(p.target_amount)}</span>
                            <span>محصل: {formatMoney(p.collected_amount)}</span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Quick links + pending alert */}
        <div className="space-y-gutter">
          <section className="bg-surface-container-lowest rounded-xl border border-outline-variant soft-shadow p-stack-md">
            <h2 className="text-headline-sm font-heading text-on-surface mb-stack-md">
              روابط سريعة
            </h2>
            <div className="space-y-2">
              <QuickLink to="/manage/payments" icon="payments" label="مراجعة الدفعات" tone="primary" />
              <QuickLink to="/manage/expenses" icon="receipt_long" label="المصروفات" tone="secondary" />
              <QuickLink to="/manage/budget" icon="account_balance" label="الميزانية" tone="tertiary" />
              <QuickLink to="/manage/contributors" icon="groups" label="المساهمون" tone="neutral" />
              <QuickLink to="/manage/updates" icon="campaign" label="تحديثات المشروع" tone="secondary" />
              <QuickLink to="/manage/reports" icon="analytics" label="التقارير" tone="primary" />
            </div>
          </section>

          {pendingCount > 0 && (
            <section className="bg-status-pending/5 rounded-xl border border-status-pending/30 p-stack-md">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-status-pending/10 text-status-pending shrink-0">
                  <Icon name="notifications_active" />
                </div>
                <div>
                  <h3 className="text-label-md font-heading font-bold text-on-surface">
                    دفعات بانتظار المراجعة
                  </h3>
                  <p className="text-body-sm text-on-surface-variant mt-1">
                    لديك {pendingCount} دفعة تحتاج إلى اعتماد أو رفض.
                  </p>
                  <Link
                    to="/manage/payments"
                    className="inline-flex items-center gap-1 text-label-md font-heading text-primary hover:underline mt-2"
                  >
                    مراجعة الآن
                    <Icon name="chevron_left" className="text-[18px]" />
                  </Link>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
