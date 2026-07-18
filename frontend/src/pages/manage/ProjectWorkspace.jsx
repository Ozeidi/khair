import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";
import { useAuth, ROLES } from "@/lib/auth";
import {
  Icon,
  Button,
  StatusBadge,
  ProgressBar,
  Loading,
  ErrorState,
} from "@/components/ui";
import { PROJECT_STATUS } from "@/lib/status";
import { formatMoney, formatNumber, formatDate } from "@/lib/format";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ── Financial bento tile (matches contributor dashboard) ──────────── */
function StatTile({ icon, label, iconWrap, children, danger }) {
  return (
    <div
      className={`bg-surface-container-lowest p-stack-md rounded-xl border flex flex-col justify-between relative overflow-hidden ${
        danger ? "border-status-rejected/30" : "border-outline-variant soft-shadow"
      }`}
    >
      <div className="flex justify-between items-start mb-4">
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
      <div>{children}</div>
    </div>
  );
}

function Money({ value, className = "text-on-surface", unitClass = "text-on-surface-variant" }) {
  return (
    <h3 className={`text-headline-lg font-heading ${className}`}>
      {formatMoney(value, "").trim()} <span className={`text-body-sm ${unitClass}`}>ر.ع.</span>
    </h3>
  );
}

/* ── Quick navigation tile to a project sub-section ────────────────── */
function NavTile({ to, icon, title, hint }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-4 p-4 bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow hover:border-primary/40 transition-colors"
    >
      <div className="p-3 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary group-hover:text-on-primary transition-colors">
        <Icon name={icon} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-label-md font-heading font-bold text-on-surface truncate">{title}</h3>
        <p className="text-body-sm text-on-surface-variant truncate">{hint}</p>
      </div>
      <Icon name="chevron_left" className="text-on-surface-variant group-hover:text-primary" />
    </Link>
  );
}

export default function ProjectWorkspace() {
  const { id } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const projectQuery = useQuery({
    queryKey: ["project", id],
    queryFn: async () => (await api.get(`/projects/${id}/`)).data,
    enabled: !!id,
  });

  const financialQuery = useQuery({
    queryKey: ["project", id, "financial"],
    queryFn: async () => (await api.get(`/reports/project/${id}/financial/`)).data,
    enabled: !!id,
  });

  const project = projectQuery.data;
  const fin = financialQuery.data ?? {};

  const lifecycle = useMutation({
    mutationFn: ({ action, body }) => api.post(`/projects/${id}/${action}/`, body ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      setNote("");
      setRejecting(false);
    },
  });

  if (projectQuery.isLoading) return <Loading label="جارٍ تحميل مساحة عمل المشروع…" />;
  if (projectQuery.isError || !project)
    return (
      <ErrorState
        description="تعذّر تحميل بيانات المشروع."
        onRetry={() => projectQuery.refetch()}
      />
    );

  const role = user?.role;
  const isAdmin = role === ROLES.PLATFORM_ADMIN;
  const canSubmit =
    ["draft", "returned"].includes(project.status) &&
    [ROLES.PROJECT_OWNER, ROLES.ORG_MANAGER, ROLES.PLATFORM_ADMIN].includes(role);
  const canReview = isAdmin && project.status === "pending_approval";

  // Prefer report figures, fall back to the project record.
  const target = num(fin.target ?? project.target_amount);
  const collected = num(fin.collected ?? project.collected_amount);
  const pledged = num(fin.pledged ?? collected);
  const remaining = num(fin.remaining ?? Math.max(0, target - collected));
  const expenses = num(fin.expenses);
  const balance = num(fin.balance ?? collected - expenses);
  const inkindValue = num(fin.inkind_value);
  const contributors = num(fin.contributors ?? project.contributors_count);
  const finProgress = num(fin.financial_progress ?? project.financial_progress);
  const execProgress = num(fin.execution_progress ?? project.execution_progress);
  const pendingPayments = num(fin.pending_payments);
  const missingInvoices = num(fin.missing_invoices);
  const budgetOverruns = Array.isArray(fin.budget_overruns) ? fin.budget_overruns.length : num(fin.budget_overruns);

  const q = (extra) => `?project=${id}${extra || ""}`;

  return (
    <div className="space-y-stack-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-outline-variant pb-stack-md">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <Link to="/manage/projects" className="text-secondary hover:underline text-label-md font-heading flex items-center gap-1">
              <Icon name="arrow_forward" className="text-[18px]" flip />
              المشاريع
            </Link>
            <StatusBadge map={PROJECT_STATUS} code={project.status} />
          </div>
          <h1 className="text-headline-lg font-heading text-on-surface">{project.name}</h1>
          <div className="flex items-center gap-3 flex-wrap mt-1 text-body-sm text-on-surface-variant">
            <span className="font-code-ref text-code-ref text-secondary">{project.reference}</span>
            {project.organization_name && (
              <>
                <span className="text-outline-variant">•</span>
                <span>{project.organization_name}</span>
              </>
            )}
            {(project.location || project.state) && (
              <>
                <span className="text-outline-variant">•</span>
                <span className="flex items-center gap-1">
                  <Icon name="location_on" className="text-[16px]" />
                  {[project.location, project.state].filter(Boolean).join("، ")}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button as={Link} to={`/manage/projects/${id}/edit`} variant="ghost" icon="edit">
            تعديل
          </Button>
          {project.public_slug && (
            <Button as={Link} to={`/projects/${project.public_slug}`} variant="secondary" icon="visibility">
              الصفحة العامة
            </Button>
          )}
          {canSubmit && (
            <Button
              icon="send"
              onClick={() => lifecycle.mutate({ action: "submit" })}
              disabled={lifecycle.isPending}
            >
              إرسال للاعتماد
            </Button>
          )}
        </div>
      </div>

      {/* Review actions (admin) */}
      {canReview && (
        <div className="bg-status-pending/5 border border-status-pending/30 rounded-xl p-stack-md">
          <div className="flex items-start gap-3">
            <Icon name="gavel" className="text-status-pending" />
            <div className="flex-1">
              <h2 className="text-label-md font-heading font-bold text-on-surface">
                هذا المشروع بانتظار اعتمادك
              </h2>
              <p className="text-body-sm text-on-surface-variant mt-1">
                راجع بيانات المشروع والأسهم والشفافية قبل اتخاذ القرار.
              </p>
              {rejecting ? (
                <div className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="سبب الإعادة / الرفض…"
                    className="flex-1 bg-surface-container-lowest border border-outline-variant rounded-lg px-3 py-2.5 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <Button
                    variant="ghost"
                    onClick={() => lifecycle.mutate({ action: "return_for_edits", body: { review_note: note, note } })}
                    disabled={lifecycle.isPending}
                  >
                    إعادة للتعديل
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => lifecycle.mutate({ action: "reject", body: { review_note: note, note } })}
                    disabled={lifecycle.isPending}
                  >
                    رفض
                  </Button>
                </div>
              ) : (
                <div className="mt-3 flex gap-2 flex-wrap">
                  <Button
                    icon="check_circle"
                    onClick={() => lifecycle.mutate({ action: "approve" })}
                    disabled={lifecycle.isPending}
                  >
                    اعتماد المشروع
                  </Button>
                  <Button variant="ghost" icon="undo" onClick={() => setRejecting(true)}>
                    إعادة أو رفض
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {project.review_note && ["returned", "rejected"].includes(project.status) && (
        <div className="bg-status-returned/5 border border-status-returned/30 rounded-xl p-stack-md flex items-start gap-3">
          <Icon name="feedback" className="text-status-returned" />
          <div>
            <h3 className="text-label-md font-heading font-bold text-on-surface">ملاحظة المراجعة</h3>
            <p className="text-body-md text-on-surface-variant mt-1">{project.review_note}</p>
          </div>
        </div>
      )}

      {lifecycle.isError && (
        <p className="text-body-sm text-status-rejected">
          {lifecycle.error?.apiMessage || "تعذّر تنفيذ الإجراء. حاول مرة أخرى."}
        </p>
      )}

      {/* Financial summary */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        <StatTile icon="flag" label="الهدف" iconWrap="bg-secondary-container text-on-secondary-container">
          <Money value={target} />
        </StatTile>
        <StatTile icon="savings" label="المُحصّل" iconWrap="bg-primary/10 text-primary">
          <Money value={collected} className="text-primary" />
          <p className="text-body-sm text-on-surface-variant mt-1">
            التعهدات: {formatMoney(pledged)}
          </p>
        </StatTile>
        <StatTile icon="payments" label="المصروفات" iconWrap="bg-tertiary-container/20 text-tertiary">
          <Money value={expenses} />
        </StatTile>
        <StatTile icon="account_balance" label="الرصيد" iconWrap="bg-surface-container-high text-on-surface-variant">
          <Money value={balance} className={balance < 0 ? "text-status-rejected" : "text-on-surface"} />
        </StatTile>
      </section>

      {/* Progress + secondary figures */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow p-stack-md md:p-gutter">
          <h2 className="text-headline-sm font-heading text-on-surface mb-stack-md">مؤشرات الإنجاز</h2>
          <div className="space-y-stack-lg">
            <div>
              <ProgressBar
                tone="financial"
                value={finProgress || (target > 0 ? (collected / target) * 100 : 0)}
                label="الإنجاز المالي"
                size="lg"
              />
              <div className="flex justify-between text-body-sm text-on-surface-variant mt-2">
                <span>المُحصّل: {formatMoney(collected)}</span>
                <span>المتبقي: {formatMoney(remaining)}</span>
              </div>
            </div>
            <div>
              <ProgressBar tone="execution" value={execProgress} label="الإنجاز التنفيذي" size="lg" />
              <p className="text-body-sm text-on-surface-variant mt-2">
                يُحسب من أوزان مراحل التنفيذ ونِسَب إنجازها.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow p-stack-md md:p-gutter">
          <h2 className="text-headline-sm font-heading text-on-surface mb-stack-md">نظرة سريعة</h2>
          <ul className="space-y-3 text-body-md">
            <li className="flex items-center justify-between">
              <span className="text-on-surface-variant flex items-center gap-2">
                <Icon name="group" className="text-[18px]" /> عدد المساهمين
              </span>
              <span className="font-heading font-bold">{formatNumber(contributors)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-on-surface-variant flex items-center gap-2">
                <Icon name="inventory_2" className="text-[18px]" /> قيمة العيني
              </span>
              <span className="font-heading font-bold">{formatMoney(inkindValue)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-on-surface-variant flex items-center gap-2">
                <Icon name="event" className="text-[18px]" /> تاريخ البداية
              </span>
              <span className="font-heading">{formatDate(project.start_date)}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-on-surface-variant flex items-center gap-2">
                <Icon name="event_available" className="text-[18px]" /> تاريخ النهاية
              </span>
              <span className="font-heading">{formatDate(project.end_date)}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Alerts */}
      {(pendingPayments > 0 || missingInvoices > 0 || budgetOverruns > 0) && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-gutter">
          <AlertTile icon="pending_actions" label="دفعات معلقة" value={pendingPayments} to={`/manage/payments${q()}`} />
          <AlertTile icon="request_quote" label="فواتير ناقصة" value={missingInvoices} to={`/manage/expenses${q()}`} />
          <AlertTile icon="warning" label="تجاوزات الميزانية" value={budgetOverruns} to={`/manage/budget${q()}`} />
        </section>
      )}

      {/* Sub-section navigation */}
      <section>
        <h2 className="text-headline-sm font-heading text-on-surface mb-stack-md">إدارة المشروع</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
          <NavTile to={`/manage/contributors${q()}`} icon="diversity_3" title="المساهمون والاشتراكات" hint="متابعة الاشتراكات والاستحقاقات" />
          <NavTile to={`/manage/payments${q()}`} icon="receipt_long" title="الدفعات" hint="مراجعة واعتماد إثباتات الدفع" />
          <NavTile to={`/manage/revenues${q()}`} icon="volunteer_activism" title="الإيرادات" hint="النقدي والعيني" />
          <NavTile to={`/manage/expenses${q()}`} icon="shopping_cart" title="المصروفات" hint="الفواتير والاعتمادات" />
          <NavTile to={`/manage/budget${q()}`} icon="pie_chart" title="الميزانية" hint="البنود والالتزامات" />
          <NavTile to={`/manage/updates${q()}`} icon="campaign" title="التحديثات والمراحل" hint="نشر التقدم التنفيذي" />
          <NavTile to={`/manage/campaigns${q()}`} icon="forum" title="الحملات" hint="رسائل واتساب للمساهمين" />
          <NavTile to={`/manage/reports${q()}`} icon="analytics" title="التقارير المالية" hint="تصدير PDF و Excel" />
        </div>
      </section>
    </div>
  );
}

function AlertTile({ icon, label, value, to }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between p-4 bg-status-rejected/5 border border-status-rejected/30 rounded-xl hover:bg-status-rejected/10 transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon name={icon} className="text-status-rejected" />
        <span className="text-label-md font-heading font-bold text-on-surface">{label}</span>
      </div>
      <span className="text-headline-sm font-heading font-bold text-status-rejected">
        {formatNumber(value)}
      </span>
    </Link>
  );
}
