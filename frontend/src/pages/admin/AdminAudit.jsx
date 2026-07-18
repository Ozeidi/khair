import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Icon, Button, Field, Input, Select } from "@/components/ui";
import { Loading, ErrorState, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

function rows(data) {
  return Array.isArray(data) ? data : data?.results ?? [];
}

// أفعال سجل التدقيق (apps/audit/models.py::AuditLog.Action).
const ACTION_LABELS = {
  create: "إنشاء",
  update: "تعديل",
  delete: "حذف",
  approve: "اعتماد",
  reject: "رفض",
  return: "إعادة",
  submit: "إرسال",
  login: "دخول",
  logout: "خروج",
  reverse: "عكس",
  export: "تصدير",
  send: "إرسال رسالة",
  close: "إغلاق",
};

const ACTION_STYLES = {
  create: "bg-status-approved/10 text-status-approved",
  update: "bg-secondary/10 text-secondary",
  delete: "bg-status-rejected/10 text-status-rejected",
  approve: "bg-primary/10 text-primary",
  reject: "bg-status-rejected/10 text-status-rejected",
  return: "bg-status-returned/10 text-status-returned",
  submit: "bg-status-pending/10 text-status-pending",
  login: "bg-surface-container-high text-on-surface-variant",
  logout: "bg-surface-container-high text-on-surface-variant",
  reverse: "bg-status-returned/10 text-status-returned",
  export: "bg-secondary/10 text-secondary",
  send: "bg-status-completed/10 text-status-completed",
  close: "bg-status-completed/10 text-status-completed",
};

function ActionBadge({ action, label }) {
  const style = ACTION_STYLES[action] || "bg-surface-container-high text-on-surface-variant";
  return (
    <span className={`inline-block text-label-md px-2.5 py-0.5 rounded-full font-heading whitespace-nowrap ${style}`}>
      {label || ACTION_LABELS[action] || action}
    </span>
  );
}

export default function AdminAudit() {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = { page };
  if (action) params.action = action;
  if (entityType.trim()) params.entity_type = entityType.trim();
  if (search.trim()) params.search = search.trim();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", action, entityType, search, page],
    queryFn: async () => (await api.get("/audit-logs/", { params })).data,
    keepPreviousData: true,
  });

  const logs = rows(data);
  const count = data?.count ?? logs.length;
  const numPages = data?.num_pages ?? 1;
  const currentPage = data?.current_page ?? page;

  function resetPage(fn) {
    return (v) => { fn(v); setPage(1); };
  }

  return (
    <div className="space-y-stack-md">
      <div className="border-b border-outline-variant pb-stack-md">
        <h1 className="text-headline-lg font-heading text-on-surface">سجل التدقيق</h1>
        <p className="text-body-lg text-on-surface-variant mt-1">
          سجل غير قابل للتعديل يوثّق جميع العمليات الحساسة على المنصة.
        </p>
      </div>

      {/* الفلاتر */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow p-stack-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="بحث">
            <Input
              value={search}
              onChange={resetPage(setSearch)}
              placeholder="الكيان أو المعرّف أو الملخص…"
            />
          </Field>
          <Field label="الإجراء">
            <Select value={action} onChange={resetPage(setAction)}>
              <option value="">جميع الإجراءات</option>
              {Object.entries(ACTION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="نوع الكيان">
            <Input
              value={entityType}
              onChange={resetPage(setEntityType)}
              placeholder="مثال: Payment"
              className="font-code-ref"
            />
          </Field>
        </div>
        {(action || entityType || search) && (
          <div className="flex justify-end mt-3">
            <Button
              variant="ghost"
              size="sm"
              icon="filter_alt_off"
              onClick={() => { setAction(""); setEntityType(""); setSearch(""); setPage(1); }}
            >
              مسح الفلاتر
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <Loading label="جارٍ تحميل سجل التدقيق…" />
      ) : isError ? (
        <ErrorState description="تعذّر تحميل سجل التدقيق." onRetry={refetch} />
      ) : logs.length === 0 ? (
        <EmptyState icon="history" title="لا توجد سجلات" description="لا توجد سجلات مطابقة للفلاتر الحالية." />
      ) : (
        <>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant soft-shadow overflow-hidden">
            <div className="p-4 border-b border-outline-variant flex items-center gap-2 text-on-surface-variant">
              <Icon name="shield" className="text-[18px]" />
              <span className="text-body-sm">{count.toLocaleString("ar-SA")} عملية مسجّلة</span>
            </div>

            {/* جدول عالي الكثافة مخطّط لسطح المكتب */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-body-sm">
                <thead className="bg-surface-container-low text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-3 font-medium whitespace-nowrap">التاريخ والوقت</th>
                    <th className="px-4 py-3 font-medium">المستخدم</th>
                    <th className="px-4 py-3 font-medium">الإجراء</th>
                    <th className="px-4 py-3 font-medium">نوع الكيان</th>
                    <th className="px-4 py-3 font-medium">المعرّف</th>
                    <th className="px-4 py-3 font-medium">الملخص</th>
                    <th className="px-4 py-3 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="text-on-surface">
                  {logs.map((log, i) => (
                    <tr
                      key={log.id}
                      className={`${i % 2 ? "bg-surface/40" : ""} hover:bg-surface-container-low/60 transition-colors border-b border-outline-variant/50 last:border-0`}
                    >
                      <td className="px-4 py-2.5 text-on-surface-variant whitespace-nowrap font-code-ref text-[13px]">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-4 py-2.5 font-heading text-on-surface whitespace-nowrap">
                        {log.user_name || "النظام"}
                      </td>
                      <td className="px-4 py-2.5">
                        <ActionBadge action={log.action} label={log.action_display} />
                      </td>
                      <td className="px-4 py-2.5 text-on-surface-variant font-code-ref">{log.entity_type || "—"}</td>
                      <td className="px-4 py-2.5 text-on-surface-variant font-code-ref" dir="ltr">
                        {log.entity_id ? `#${log.entity_id}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 max-w-xs">
                        <p className="text-on-surface truncate" title={log.summary}>{log.summary || "—"}</p>
                      </td>
                      <td className="px-4 py-2.5 text-on-surface-variant font-code-ref text-[13px]" dir="ltr">
                        {log.ip_address || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* بطاقات للهاتف */}
            <div className="md:hidden divide-y divide-outline-variant">
              {logs.map((log) => (
                <div key={log.id} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <ActionBadge action={log.action} label={log.action_display} />
                    <span className="text-body-sm text-on-surface-variant font-code-ref text-[13px]">
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                  <p className="font-heading text-on-surface">{log.user_name || "النظام"}</p>
                  <p className="text-body-sm text-on-surface">{log.summary || "—"}</p>
                  <div className="flex flex-wrap gap-x-3 text-body-sm text-on-surface-variant font-code-ref">
                    <span>{log.entity_type || "—"}{log.entity_id ? ` #${log.entity_id}` : ""}</span>
                    {log.ip_address && <span dir="ltr">{log.ip_address}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* الترقيم */}
          {numPages > 1 && (
            <div className="flex justify-center items-center gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-4 py-2 rounded-lg border border-outline-variant text-label-md font-heading text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                <Icon name="chevron_right" className="text-[18px]" />
                السابق
              </button>
              <span className="text-body-sm text-on-surface-variant">
                صفحة {currentPage.toLocaleString("ar-SA")} من {numPages.toLocaleString("ar-SA")}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
                className="px-4 py-2 rounded-lg border border-outline-variant text-label-md font-heading text-on-surface-variant hover:bg-surface-container-low transition-colors disabled:opacity-40 flex items-center gap-1"
              >
                التالي
                <Icon name="chevron_left" className="text-[18px]" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
