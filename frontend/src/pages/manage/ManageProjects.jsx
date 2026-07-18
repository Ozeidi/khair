import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Button,
  Card,
  StatusBadge,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import { PROJECT_STATUS } from "@/lib/status";
import { formatMoney, clampPercent } from "@/lib/format";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* Dual (financial / execution) inline progress bars. */
function DualProgress({ financial, execution }) {
  const finPct = clampPercent(financial);
  const execPct = clampPercent(execution);
  return (
    <div className="flex flex-col gap-1.5 min-w-[140px]">
      <div className="flex items-center gap-2">
        <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
          <div className="bg-primary h-full rounded-full" style={{ width: `${finPct}%` }} />
        </div>
        <span className="text-[12px] text-primary w-9 shrink-0">{Math.round(finPct)}٪</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
          <div className="bg-secondary h-full rounded-full" style={{ width: `${execPct}%` }} />
        </div>
        <span className="text-[12px] text-secondary w-9 shrink-0">{Math.round(execPct)}٪</span>
      </div>
    </div>
  );
}

export default function ManageProjects() {
  const navigate = useNavigate();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["manage", "projects", "list"],
    queryFn: async () => (await api.get("/projects/")).data,
  });

  const rows = data?.results ?? (Array.isArray(data) ? data : []);

  return (
    <div>
      <PageHeader
        title="المشاريع"
        subtitle="جميع مشاريع جهتك — الحالة والتقدم المالي والتنفيذي."
        actions={
          <Button as={Link} to="/manage/projects/new" variant="primary" icon="add">
            مشروع جديد
          </Button>
        }
      />

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState description="تعذّر تحميل المشاريع. حاول مرة أخرى." onRetry={refetch} />
      ) : rows.length === 0 ? (
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
        <>
          {/* Desktop table */}
          <Card padded={false} className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="p-4 font-medium">المرجع</th>
                    <th className="p-4 font-medium">اسم المشروع</th>
                    <th className="p-4 font-medium">الحالة</th>
                    <th className="p-4 font-medium">التقدم (مالي / تنفيذ)</th>
                    <th className="p-4 font-medium">المحصل / الهدف</th>
                    <th className="p-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/manage/projects/${p.id}`)}
                      className="hover:bg-surface/60 transition-colors cursor-pointer"
                    >
                      <td className="p-4">
                        <span className="font-code-ref text-code-ref text-secondary">
                          {p.reference || "—"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-surface-container-high overflow-hidden flex items-center justify-center text-on-surface-variant shrink-0">
                            {p.cover_image ? (
                              <div
                                className="w-full h-full bg-cover bg-center"
                                style={{ backgroundImage: `url('${p.cover_image}')` }}
                              />
                            ) : (
                              <Icon name="volunteer_activism" className="text-[20px]" />
                            )}
                          </div>
                          <span className="font-bold">{p.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <StatusBadge map={PROJECT_STATUS} code={p.status} />
                      </td>
                      <td className="p-4">
                        <DualProgress
                          financial={p.financial_progress}
                          execution={p.execution_progress}
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-primary font-medium">
                            {formatMoney(p.collected_amount)}
                          </span>
                          <span className="text-body-sm text-on-surface-variant">
                            من {formatMoney(p.target_amount)}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-left">
                        <Icon
                          name="chevron_left"
                          className="text-[20px] text-on-surface-variant"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-stack-md">
            {rows.map((p) => (
              <Card
                key={p.id}
                onClick={() => navigate(`/manage/projects/${p.id}`)}
                className="cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-label-md font-heading font-bold text-on-surface truncate">
                      {p.name}
                    </h3>
                    <span className="font-code-ref text-code-ref text-secondary">
                      {p.reference || "—"}
                    </span>
                  </div>
                  <StatusBadge map={PROJECT_STATUS} code={p.status} />
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm text-on-surface-variant w-14 shrink-0">مالي</span>
                    <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${clampPercent(p.financial_progress)}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-primary w-9 shrink-0">
                      {Math.round(clampPercent(p.financial_progress))}٪
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-body-sm text-on-surface-variant w-14 shrink-0">تنفيذ</span>
                    <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-secondary h-full rounded-full"
                        style={{ width: `${clampPercent(p.execution_progress)}%` }}
                      />
                    </div>
                    <span className="text-[12px] text-secondary w-9 shrink-0">
                      {Math.round(clampPercent(p.execution_progress))}٪
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-outline-variant">
                  <div>
                    <p className="text-body-sm text-on-surface-variant">المحصل</p>
                    <p className="text-label-md font-heading font-bold text-primary">
                      {formatMoney(p.collected_amount)}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-body-sm text-on-surface-variant">الهدف</p>
                    <p className="text-label-md font-heading font-bold">
                      {formatMoney(p.target_amount)}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
