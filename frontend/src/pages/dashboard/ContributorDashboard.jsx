import { Link } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
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
import { PROJECT_STATUS, SUBSCRIPTION_STATUS } from "@/lib/status";
import { formatMoney, formatDate, clampPercent } from "@/lib/format";

/* Normalize either a paginated envelope or a plain array into an array. */
function rows(data) {
  if (Array.isArray(data)) return data;
  return data?.results ?? [];
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ── Financial bento tile ─────────────────────────────────────────── */
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

/* ── Section shell (matches sample card styling) ──────────────────── */
function Section({ title, icon, action, children, className = "", noPad = false }) {
  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant soft-shadow overflow-hidden">
      <div className={`flex justify-between items-center ${noPad ? "p-stack-md border-b border-outline-variant" : "p-stack-md pb-0"}`}>
        <h2 className="text-headline-sm font-heading text-on-surface">{title}</h2>
        {action || (icon && <Icon name={icon} className="text-on-surface-variant" />)}
      </div>
      <div className={noPad ? "" : `p-stack-md ${className}`}>{children}</div>
    </section>
  );
}

export default function ContributorDashboard() {
  const { user } = useAuth();
  const name = user?.display_name || user?.full_name || "بك";

  const subsQuery = useQuery({
    queryKey: ["me", "subscriptions"],
    queryFn: async () => rows((await api.get("/subscriptions/")).data),
  });
  const paymentsQuery = useQuery({
    queryKey: ["me", "payments"],
    queryFn: async () => rows((await api.get("/payments/")).data),
  });
  const receiptsQuery = useQuery({
    queryKey: ["me", "receipts"],
    queryFn: async () => rows((await api.get("/receipts/")).data),
  });

  const subscriptions = subsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const receipts = receiptsQuery.data ?? [];

  /* Installments across every subscription (used for upcoming dues). */
  const installmentQueries = useQueries({
    queries: subscriptions.map((s) => ({
      queryKey: ["installments", s.id],
      queryFn: async () =>
        rows((await api.get("/installments/", { params: { subscription: s.id } })).data).map(
          (it) => ({ ...it, subscription: s })
        ),
      enabled: !!s.id,
    })),
  });
  const allInstallments = installmentQueries.flatMap((q) => q.data ?? []);

  /* ── Client-side aggregation (defensive) ───────────────────────── */
  const totalCommitments = subscriptions.reduce((sum, s) => sum + num(s.total_value), 0);
  const paid = subscriptions.reduce((sum, s) => sum + num(s.paid_amount), 0);
  const remaining = Math.max(0, totalCommitments - paid);
  const paidPct = totalCommitments > 0 ? (paid / totalCommitments) * 100 : 0;

  const overdue = allInstallments
    .filter((it) => it.status === "overdue")
    .reduce((sum, it) => sum + Math.max(0, num(it.amount) - num(it.paid_amount)), 0);

  /* Upcoming dues: unpaid installments, overdue first, then soonest. */
  const upcoming = allInstallments
    .filter((it) => it.status !== "paid")
    .sort((a, b) => new Date(a.due_date || 0) - new Date(b.due_date || 0))
    .slice(0, 5);

  const todayMs = Date.now();

  const loading = subsQuery.isLoading || paymentsQuery.isLoading;
  const errored = subsQuery.isError || paymentsQuery.isError;

  if (loading) {
    return (
      <>
        <Header name={name} />
        <Loading label="جارٍ تحميل لوحتك…" />
      </>
    );
  }

  if (errored) {
    return (
      <>
        <Header name={name} />
        <ErrorState
          description="تعذّر تحميل بيانات المساهمة."
          onRetry={() => {
            subsQuery.refetch();
            paymentsQuery.refetch();
          }}
        />
      </>
    );
  }

  return (
    <div className="space-y-stack-lg">
      <Header name={name} />

      {/* Financial Summary Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <StatTile
          icon="account_balance_wallet"
          label="إجمالي الالتزامات"
          iconWrap="bg-secondary-container text-on-secondary-container"
        >
          <Money value={totalCommitments} />
        </StatTile>

        <StatTile icon="check_circle" label="المدفوع" iconWrap="bg-primary/10 text-primary">
          <Money value={paid} />
          <div className="w-full bg-surface-container-high h-2 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${clampPercent(paidPct)}%` }}
            />
          </div>
        </StatTile>

        <StatTile
          icon="hourglass_empty"
          label="المتبقي"
          iconWrap="bg-surface-container-high text-on-surface-variant"
        >
          <Money value={remaining} />
        </StatTile>

        <StatTile icon="warning" label="المتأخر" iconWrap="bg-status-rejected/10 text-status-rejected" danger>
          <Money value={overdue} className="text-status-rejected" unitClass="opacity-80" />
        </StatTile>
      </section>

      {/* Main 3-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-gutter">
          {/* Upcoming Dues */}
          <Section title="الاستحقاقات القادمة" icon="event">
            {upcoming.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant py-4 text-center">
                لا توجد استحقاقات قادمة.
              </p>
            ) : (
              <div className="space-y-4">
                {upcoming.map((it) => {
                  const sub = it.subscription || {};
                  const due = it.due_date ? new Date(it.due_date).getTime() : null;
                  const isOverdue = it.status === "overdue" || (due != null && due < todayMs);
                  const dueAmount = Math.max(0, num(it.amount) - num(it.paid_amount));
                  return (
                    <div
                      key={it.id}
                      className="p-3 border border-outline-variant rounded-lg bg-surface flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h4 className="text-label-md font-heading font-bold text-on-surface truncate">
                            {sub.project_name || sub.project?.name || "مشروع"}
                          </h4>
                          <p className="text-body-sm text-on-surface-variant">
                            القسط {it.sequence ? `رقم ${it.sequence}` : ""}
                            {sub.share_type_name ? ` - ${sub.share_type_name}` : ""}
                          </p>
                        </div>
                        <span className="text-label-md font-heading font-bold text-on-surface whitespace-nowrap">
                          {formatMoney(dueAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-outline-variant gap-2">
                        <span
                          className={`text-body-sm flex items-center gap-1 ${
                            isOverdue ? "text-status-rejected" : "text-on-surface-variant"
                          }`}
                        >
                          <Icon
                            name={isOverdue ? "schedule" : "calendar_today"}
                            className="text-[16px]"
                          />
                          {isOverdue ? "مستحق" : "يستحق في"} {formatDate(it.due_date)}
                        </span>
                        <Link
                          to={sub.id ? `/dashboard/subscriptions/${sub.id}` : "/dashboard/subscriptions"}
                          className="bg-primary text-on-primary px-3 py-1.5 rounded-lg text-label-md font-heading hover:bg-primary/90 transition-colors whitespace-nowrap"
                        >
                          دفع الآن
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Digital Receipts */}
          <Section
            title="الإيصالات الرقمية"
            action={
              <Link
                to="/dashboard/receipts"
                className="text-label-md font-heading text-primary hover:underline"
              >
                عرض الكل
              </Link>
            }
          >
            {receiptsQuery.isLoading ? (
              <Loading label="جارٍ التحميل…" />
            ) : receipts.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant py-4 text-center">
                لا توجد إيصالات بعد.
              </p>
            ) : (
              <ul className="space-y-2">
                {receipts.slice(0, 5).map((r) => (
                  <li
                    key={r.id || r.code}
                    className="flex items-center justify-between p-2 hover:bg-surface rounded-lg transition-colors group border border-transparent hover:border-outline-variant"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-surface-container-high rounded text-on-surface-variant shrink-0">
                        <Icon name="receipt_long" className="text-[20px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-label-md font-heading text-on-surface truncate">
                          إيصال <span className="font-code-ref">#{r.code || r.reference || r.id}</span>
                        </p>
                        <p className="text-body-sm text-on-surface-variant">
                          {formatDate(r.issued_at || r.created_at)}
                        </p>
                      </div>
                    </div>
                    <span className="text-label-md font-heading text-on-surface-variant whitespace-nowrap">
                      {formatMoney(r.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {/* Right column (span 2) */}
        <div className="lg:col-span-2 space-y-gutter">
          {/* My Subscriptions table */}
          <Section
            title="قائمة اشتراكاتي"
            noPad
            action={
              <Link
                to="/dashboard/subscriptions"
                className="text-label-md font-heading text-secondary hover:text-secondary/80 flex items-center gap-1"
              >
                عرض الكل
                <Icon name="chevron_left" className="text-[18px]" />
              </Link>
            }
          >
            {subscriptions.length === 0 ? (
              <EmptyState
                icon="volunteer_activism"
                title="لا توجد اشتراكات بعد"
                description="ابدأ مساهمتك الأولى وادعم مشاريع الخير."
                action={
                  <Button as={Link} to="/projects" variant="contribute" icon="add" className="mt-2">
                    مساهمة جديدة
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-surface-container-low text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                    <tr>
                      <th className="p-4 font-medium">اسم المشروع</th>
                      <th className="p-4 font-medium">نوع السهم</th>
                      <th className="p-4 font-medium">الحالة</th>
                      <th className="p-4 font-medium w-[30%]">التقدم (المالي / التنفيذ)</th>
                    </tr>
                  </thead>
                  <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                    {subscriptions.map((s) => {
                      const total = num(s.total_value);
                      const finPct = total > 0 ? (num(s.paid_amount) / total) * 100 : 0;
                      const execPct = num(
                        s.execution_progress ?? s.project_execution_progress ?? s.project?.execution_progress
                      );
                      return (
                        <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded bg-surface-container-high overflow-hidden flex items-center justify-center text-on-surface-variant shrink-0">
                                <Icon name="volunteer_activism" className="text-[20px]" />
                              </div>
                              <span className="font-bold">
                                {s.project_name || s.project?.name || "مشروع"}
                              </span>
                            </div>
                          </td>
                          <td className="p-4 text-on-surface-variant">
                            {s.share_type_name || s.share_type?.name || "مبلغ مفتوح"}
                          </td>
                          <td className="p-4">
                            <StatusBadge map={SUBSCRIPTION_STATUS} code={s.status} />
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-primary h-full rounded-full"
                                    style={{ width: `${clampPercent(finPct)}%` }}
                                  />
                                </div>
                                <span className="text-[12px] text-primary w-9 shrink-0">
                                  {Math.round(clampPercent(finPct))}٪
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-secondary h-full rounded-full"
                                    style={{ width: `${clampPercent(execPct)}%` }}
                                  />
                                </div>
                                <span className="text-[12px] text-secondary w-9 shrink-0">
                                  {Math.round(clampPercent(execPct))}٪
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* Project Updates timeline */}
          <ProjectUpdates subscriptions={subscriptions} />
        </div>
      </div>
    </div>
  );
}

/* ── Page header ──────────────────────────────────────────────────── */
function Header({ name }) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-outline-variant pb-stack-md">
      <div>
        <h1 className="text-headline-lg font-heading text-on-surface">مرحباً، {name}</h1>
        <p className="text-body-lg text-on-surface-variant mt-1">
          نظرة عامة على مساهماتك الخيرية والتزاماتك المالية.
        </p>
      </div>
      <Button variant="ghost" icon="download">
        كشف حساب كامل
      </Button>
    </div>
  );
}

/* ── Latest project updates (from the contributor's projects) ─────── */
function ProjectUpdates({ subscriptions }) {
  const projectIds = [
    ...new Set(subscriptions.map((s) => s.project || s.project_id || s.project?.id).filter(Boolean)),
  ];

  const { data, isLoading } = useQuery({
    queryKey: ["project-updates", "contributor", projectIds],
    queryFn: async () => rows((await api.get("/project-updates/")).data),
    enabled: subscriptions.length > 0,
  });

  const updates = (data ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0)
    )
    .slice(0, 5);

  return (
    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant soft-shadow p-stack-md">
      <h2 className="text-headline-sm font-heading text-on-surface mb-stack-md">
        آخر تحديثات المشاريع
      </h2>
      {isLoading ? (
        <Loading label="جارٍ التحميل…" />
      ) : updates.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant py-4 text-center">
          لا توجد تحديثات جديدة على مشاريعك حالياً.
        </p>
      ) : (
        <div className="space-y-6 relative pr-8 before:absolute before:inset-y-0 before:right-[9px] before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-outline-variant before:to-transparent">
          {updates.map((u, idx) => (
            <div key={u.id} className="relative flex items-start gap-4">
              <div
                className={`absolute right-[-40px] top-1 w-6 h-6 rounded-full bg-surface border-2 z-10 flex items-center justify-center ${
                  idx === 0 ? "border-primary" : "border-outline-variant"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${idx === 0 ? "bg-primary" : "bg-outline-variant"}`}
                />
              </div>
              <div className="flex-1 bg-surface p-4 rounded-lg border border-outline-variant">
                <div className="flex justify-between items-start gap-2 mb-2">
                  <span
                    className={`text-label-md font-heading font-bold ${
                      idx === 0 ? "text-primary" : "text-on-surface"
                    }`}
                  >
                    {u.project_name || u.project?.name || u.title || "تحديث المشروع"}
                  </span>
                  <span className="text-body-sm text-on-surface-variant whitespace-nowrap">
                    {formatDate(u.published_at || u.created_at)}
                  </span>
                </div>
                {u.title && (
                  <p className="text-label-md font-heading text-on-surface mb-1">{u.title}</p>
                )}
                <p className="text-body-md text-on-surface line-clamp-3">{u.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
