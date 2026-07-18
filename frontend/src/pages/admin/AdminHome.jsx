import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Icon, Button, StatusBadge, Loading, ErrorState } from "@/components/ui";
import PageHeader from "@/components/ui/PageHeader";
import { PROJECT_STATUS } from "@/lib/status";
import { formatMoney, formatNumber, clampPercent } from "@/lib/format";

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
function StatTile({ icon, label, iconWrap, children, danger, to }) {
  const inner = (
    <div
      className={`bg-surface-container-lowest p-stack-md rounded-xl border flex flex-col justify-between h-full relative overflow-hidden transition-shadow ${
        danger
          ? "border-status-rejected/30 shadow-[0_4px_12px_rgba(239,68,68,0.04)]"
          : "border-outline-variant soft-shadow"
      } ${to ? "hover:shadow-soft-lg group" : ""}`}
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
  return to ? (
    <Link to={to} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
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

/* Review-queue list card. */
function QueueCard({ title, icon, tone, count, viewAllTo, children }) {
  const tones = {
    pending: "bg-status-pending/10 text-status-pending",
    secondary: "bg-secondary-container text-on-secondary-container",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant soft-shadow overflow-hidden flex flex-col">
      <div className="flex justify-between items-center p-stack-md border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${tones[tone]}`}>
            <Icon name={icon} className="text-[20px]" />
          </div>
          <h2 className="text-headline-sm font-heading text-on-surface">{title}</h2>
          {count > 0 && (
            <span className="bg-status-pending/15 text-status-pending text-label-md font-heading font-bold px-2 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="text-label-md font-heading text-secondary hover:text-secondary/80 flex items-center gap-1"
          >
            عرض الكل
            <Icon name="chevron_left" className="text-[18px]" />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </section>
  );
}

function QueueRow({ title, subtitle, reference, to }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-3 p-4 hover:bg-surface/60 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-label-md font-heading font-bold text-on-surface truncate">{title}</p>
        {reference && (
          <p className="text-code-ref font-code-ref text-secondary">{reference}</p>
        )}
        {subtitle && !reference && (
          <p className="text-body-sm text-on-surface-variant truncate">{subtitle}</p>
        )}
      </div>
      <span className="inline-flex items-center gap-1 text-label-md font-heading text-primary shrink-0">
        مراجعة
        <Icon name="chevron_left" className="text-[18px]" />
      </span>
    </Link>
  );
}

export default function AdminHome() {
  const overviewQ = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => (await api.get("/reports/admin/overview/")).data,
  });

  const orgsQ = useQuery({
    queryKey: ["admin", "orgs", "pending"],
    queryFn: async () =>
      rows((await api.get("/organizations/", { params: { status: "pending" } })).data),
  });
  const projectsQ = useQuery({
    queryKey: ["admin", "projects", "pending"],
    queryFn: async () =>
      rows((await api.get("/projects/", { params: { status: "pending_approval" } })).data),
  });
  const paymentsQ = useQuery({
    queryKey: ["admin", "payments", "pending"],
    queryFn: async () =>
      rows((await api.get("/payments/", { params: { status: "pending" } })).data),
  });

  const o = overviewQ.data ?? {};
  const pendingOrgs = orgsQ.data ?? [];
  const pendingProjects = projectsQ.data ?? [];
  const pendingPayments = paymentsQ.data ?? [];

  const topProjects = o.top_projects ?? [];
  const overdue = o.overdue ?? {};

  const header = (
    <PageHeader
      title="لوحة إدارة المنصة"
      subtitle="نظرة شاملة على صحة المنصة والعمليات التي تحتاج مراجعة."
      actions={
        <Button as={Link} to="/admin-console/audit" variant="ghost" icon="history">
          سجل التدقيق
        </Button>
      }
    />
  );

  if (overviewQ.isLoading) {
    return (
      <div>
        {header}
        <Loading label="جارٍ تحميل مؤشرات المنصة…" />
      </div>
    );
  }
  if (overviewQ.isError) {
    return (
      <div>
        {header}
        <ErrorState
          description="تعذّر تحميل مؤشرات المنصة."
          onRetry={() => overviewQ.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-stack-lg">
      {header}

      {/* Bento — platform totals */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-gutter">
        <StatTile
          icon="folder_managed"
          label="المشاريع"
          iconWrap="bg-secondary-container text-on-secondary-container"
          to="/admin-console/projects"
        >
          <h3 className="text-headline-lg font-heading text-on-surface">
            {formatNumber(o.projects?.total)}
          </h3>
        </StatTile>

        <StatTile
          icon="domain"
          label="الجهات"
          iconWrap="bg-secondary/10 text-secondary"
          to="/admin-console/organizations"
        >
          <h3 className="text-headline-lg font-heading text-on-surface">
            {formatNumber(o.organizations?.total)}
            <span className="text-body-sm text-on-surface-variant">
              {" "}
              ({formatNumber(o.organizations?.approved)} معتمدة)
            </span>
          </h3>
        </StatTile>

        <StatTile
          icon="group"
          label="المستخدمون"
          iconWrap="bg-tertiary-container/20 text-tertiary"
          to="/admin-console/users"
        >
          <h3 className="text-headline-lg font-heading text-on-surface">
            {formatNumber(o.users?.total)}
            <span className="text-body-sm text-on-surface-variant">
              {" "}
              ({formatNumber(o.users?.active)} نشط)
            </span>
          </h3>
        </StatTile>

        <StatTile
          icon="account_balance_wallet"
          label="إجمالي المحصل"
          iconWrap="bg-primary/10 text-primary"
        >
          <Money value={o.total_collected} className="text-primary" />
        </StatTile>

        <StatTile
          icon="payments"
          label="إجمالي المصروف"
          iconWrap="bg-secondary/10 text-secondary"
        >
          <Money value={o.total_spent} className="text-secondary" />
          <p className="text-body-sm text-on-surface-variant mt-1">
            الرصيد: {formatMoney(o.balance)}
          </p>
        </StatTile>

        <StatTile
          icon="running_with_errors"
          label="المتأخرات"
          iconWrap="bg-status-rejected/10 text-status-rejected"
          danger={num(overdue.amount) > 0}
        >
          <Money
            value={overdue.amount}
            className={num(overdue.amount) > 0 ? "text-status-rejected" : "text-on-surface"}
          />
          <p className="text-body-sm text-on-surface-variant mt-1">
            {formatNumber(overdue.count)} استحقاق متأخر
          </p>
        </StatTile>
      </section>

      {/* Review queues */}
      <div>
        <h2 className="text-headline-md font-heading text-on-surface mb-stack-md flex items-center gap-2">
          <Icon name="rule" className="text-primary" />
          عمليات تحتاج مراجعة
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          <QueueCard
            title="جهات بانتظار الاعتماد"
            icon="domain"
            tone="secondary"
            count={pendingOrgs.length}
            viewAllTo="/admin-console/organizations"
          >
            {orgsQ.isLoading ? (
              <div className="p-6 text-center text-body-sm text-on-surface-variant">
                جارٍ التحميل…
              </div>
            ) : pendingOrgs.length === 0 ? (
              <div className="p-6 text-center text-body-sm text-on-surface-variant">
                لا توجد جهات معلّقة.
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {pendingOrgs.slice(0, 5).map((org) => (
                  <QueueRow
                    key={org.id}
                    title={org.name}
                    reference={org.reference}
                    to="/admin-console/organizations"
                  />
                ))}
              </div>
            )}
          </QueueCard>

          <QueueCard
            title="مشاريع بانتظار الاعتماد"
            icon="fact_check"
            tone="primary"
            count={pendingProjects.length}
            viewAllTo="/admin-console/projects"
          >
            {projectsQ.isLoading ? (
              <div className="p-6 text-center text-body-sm text-on-surface-variant">
                جارٍ التحميل…
              </div>
            ) : pendingProjects.length === 0 ? (
              <div className="p-6 text-center text-body-sm text-on-surface-variant">
                لا توجد مشاريع معلّقة.
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {pendingProjects.slice(0, 5).map((p) => (
                  <QueueRow
                    key={p.id}
                    title={p.name}
                    reference={p.reference}
                    to="/admin-console/projects"
                  />
                ))}
              </div>
            )}
          </QueueCard>

          <QueueCard
            title="دفعات بانتظار المراجعة"
            icon="hourglass_top"
            tone="pending"
            count={pendingPayments.length}
          >
            {paymentsQ.isLoading ? (
              <div className="p-6 text-center text-body-sm text-on-surface-variant">
                جارٍ التحميل…
              </div>
            ) : pendingPayments.length === 0 ? (
              <div className="p-6 text-center text-body-sm text-on-surface-variant">
                لا توجد دفعات معلّقة.
              </div>
            ) : (
              <div className="divide-y divide-outline-variant">
                {pendingPayments.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0">
                      <p className="text-label-md font-heading font-bold text-on-surface truncate">
                        {p.user_name || p.contributor_name || p.external_name || "غير مسجل"}
                      </p>
                      <p className="text-code-ref font-code-ref text-secondary">
                        {p.reference}
                      </p>
                    </div>
                    <span className="text-label-md font-heading text-on-surface shrink-0">
                      {formatMoney(p.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </QueueCard>
        </div>
      </div>

      {/* Top projects */}
      <section className="bg-surface-container-lowest rounded-xl border border-outline-variant soft-shadow overflow-hidden">
        <div className="flex justify-between items-center p-stack-md border-b border-outline-variant">
          <h2 className="text-headline-sm font-heading text-on-surface flex items-center gap-2">
            <Icon name="trending_up" className="text-primary" />
            المشاريع الأعلى تحصيلًا
          </h2>
        </div>
        {topProjects.length === 0 ? (
          <div className="p-6 text-center text-body-sm text-on-surface-variant">
            لا توجد بيانات بعد.
          </div>
        ) : (
          <ul className="divide-y divide-outline-variant">
            {topProjects.map((p, i) => {
              const target = num(p.target_amount);
              const collected = num(p.collected_amount);
              const pct = target > 0 ? clampPercent((collected / target) * 100) : 0;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-4 p-stack-md hover:bg-surface/60 transition-colors"
                >
                  <span className="w-7 h-7 shrink-0 rounded-full bg-surface-container-high text-on-surface-variant text-label-md font-heading font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-label-md font-heading font-bold text-on-surface truncate">
                        {p.name}
                      </h3>
                      <span className="text-code-ref font-code-ref text-secondary shrink-0">
                        {p.reference}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[12px] text-primary w-9 shrink-0">
                        {Math.round(pct)}٪
                      </span>
                    </div>
                    <div className="flex flex-row-reverse justify-between text-code-ref font-code-ref text-on-surface-variant">
                      <span>الهدف: {formatMoney(target)}</span>
                      <span>محصل: {formatMoney(collected)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
