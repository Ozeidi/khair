import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney, clampPercent } from "@/lib/format";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Button,
  Card,
  Modal,
  Field,
  Input,
  Textarea,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";

const BUDGET_STATUS_MAP = {
  draft: { label: "مسودة", style: "bg-status-draft/10 text-status-draft" },
  pending: { label: "بانتظار الاعتماد", style: "bg-status-pending/10 text-status-pending" },
  approved: { label: "معتمدة", style: "bg-status-approved/10 text-status-approved" },
  returned: { label: "معادة للتعديل", style: "bg-status-returned/10 text-status-returned" },
};

function StatusPill({ code }) {
  const info =
    BUDGET_STATUS_MAP[code] || { label: code || "—", style: "bg-surface-container-high text-on-surface-variant" };
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-label-md font-heading font-bold ${info.style}`}>
      {info.label}
    </span>
  );
}

function itemStats(item) {
  const approved = Number(item?.approved_amount || 0);
  const spent = Number(item?.spent_amount || 0);
  const committed = Number(item?.committed_amount || 0);
  const remaining = approved - spent - committed;
  const ratio = approved > 0 ? ((spent + committed) / approved) * 100 : 0;
  const threshold = Number(item?.alert_threshold ?? 90);
  const over = ratio > 100;
  const near = !over && ratio >= threshold;
  return { approved, spent, committed, remaining, ratio, over, near };
}

function projectName(b) {
  return b?.project_name || b?.project?.name || b?.project_title || `مشروع #${b?.project ?? ""}`;
}

export default function Budget() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [itemModal, setItemModal] = useState(null); // { budget, item? }
  const [itemForm, setItemForm] = useState({ name: "", approved_amount: "", alert_threshold: "90" });
  const [totalModal, setTotalModal] = useState(null); // budget
  const [totalForm, setTotalForm] = useState({ total_amount: "", note: "" });
  const [formError, setFormError] = useState("");
  const [rowError, setRowError] = useState("");

  const budgetsQ = useQuery({
    queryKey: ["manage-budgets"],
    queryFn: async () => (await api.get("/budgets/")).data,
  });

  const budgets = budgetsQ.data?.results ?? (Array.isArray(budgetsQ.data) ? budgetsQ.data : []);

  // Default-select the first budget.
  useEffect(() => {
    if (selectedId == null && budgets.length) setSelectedId(budgets[0].id);
  }, [budgets, selectedId]);

  const budget = budgets.find((b) => String(b.id) === String(selectedId)) || budgets[0] || null;
  const items = budget?.items ?? [];

  const totals = items.reduce(
    (acc, i) => {
      const s = itemStats(i);
      acc.approved += s.approved;
      acc.spent += s.spent;
      acc.committed += s.committed;
      acc.remaining += s.remaining;
      return acc;
    },
    { approved: 0, spent: 0, committed: 0, remaining: 0 }
  );

  const itemMutation = useMutation({
    mutationFn: async () => {
      const body = {
        budget: itemModal.budget.id,
        name: itemForm.name,
        approved_amount: itemForm.approved_amount,
        alert_threshold: itemForm.alert_threshold || "90",
      };
      if (itemModal.item) {
        return (await api.patch(`/budget-items/${itemModal.item.id}/`, body)).data;
      }
      return (await api.post("/budget-items/", body)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manage-budgets"] });
      setItemModal(null);
    },
    onError: (err) => setFormError(err?.apiMessage || "تعذّر حفظ البند."),
  });

  const totalMutation = useMutation({
    mutationFn: async () =>
      (
        await api.patch(`/budgets/${totalModal.id}/`, {
          total_amount: totalForm.total_amount,
          note: totalForm.note,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["manage-budgets"] });
      setTotalModal(null);
    },
    onError: (err) => setFormError(err?.apiMessage || "تعذّر تحديث الميزانية."),
  });

  const approveMutation = useMutation({
    mutationFn: async (id) => (await api.post(`/budgets/${id}/approve/`, {})).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manage-budgets"] }),
    onError: (err) => setRowError(err?.apiMessage || "تعذّر اعتماد الميزانية."),
  });

  function openItem(item) {
    setItemModal({ budget, item });
    setItemForm({
      name: item?.name || "",
      approved_amount: item?.approved_amount != null ? String(item.approved_amount) : "",
      alert_threshold: item?.alert_threshold != null ? String(item.alert_threshold) : "90",
    });
    setFormError("");
  }
  function openTotal() {
    setTotalModal(budget);
    setTotalForm({
      total_amount: budget?.total_amount != null ? String(budget.total_amount) : "",
      note: budget?.note || "",
    });
    setFormError("");
  }
  function submitItem(e) {
    e.preventDefault();
    setFormError("");
    if (!itemForm.name.trim()) return setFormError("أدخل اسم البند.");
    if (!itemForm.approved_amount || Number(itemForm.approved_amount) < 0)
      return setFormError("أدخل المبلغ المعتمد.");
    itemMutation.mutate();
  }
  function submitTotal(e) {
    e.preventDefault();
    setFormError("");
    if (!totalForm.total_amount || Number(totalForm.total_amount) < 0)
      return setFormError("أدخل إجمالي الميزانية.");
    totalMutation.mutate();
  }

  return (
    <div>
      <PageHeader
        title="الميزانية"
        subtitle="إدارة بنود الميزانية ومتابعة المصروف والالتزامات والمتبقي لكل مشروع."
      />

      {rowError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-status-rejected/10 text-status-rejected text-body-sm mb-stack-md">
          <Icon name="error" className="text-[18px]" />
          {rowError}
        </div>
      )}

      {budgetsQ.isLoading ? (
        <Loading />
      ) : budgetsQ.isError ? (
        <ErrorState description="تعذّر تحميل الميزانيات." onRetry={() => budgetsQ.refetch()} />
      ) : budgets.length === 0 ? (
        <EmptyState
          icon="account_balance_wallet"
          title="لا توجد ميزانيات"
          description="لم يتم إنشاء ميزانية لأي مشروع بعد."
        />
      ) : (
        <>
          {/* Project budget selector */}
          {budgets.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-gutter">
              {budgets.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className={`px-4 py-2 rounded-full text-label-md font-heading font-bold transition-colors ${
                    String(b.id) === String(budget?.id)
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  {projectName(b)}
                </button>
              ))}
            </div>
          )}

          {/* Budget summary */}
          <Card className="mb-gutter">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-stack-md">
              <div>
                <span className="font-code-ref text-code-ref text-secondary">{budget?.reference || "—"}</span>
                <h2 className="text-headline-sm font-heading text-on-surface mt-1">{projectName(budget)}</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <StatusPill code={budget?.status} />
                <Button size="sm" variant="ghost" icon="edit" onClick={openTotal}>
                  تعديل الإجمالي
                </Button>
                {budget?.status !== "approved" && (
                  <Button
                    size="sm"
                    icon="verified"
                    disabled={approveMutation.isPending}
                    onClick={() => {
                      setRowError("");
                      approveMutation.mutate(budget.id);
                    }}
                  >
                    اعتماد الميزانية
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-stack-md">
              <div className="p-stack-md bg-surface rounded-xl border border-outline-variant">
                <p className="text-label-md font-heading text-on-surface-variant">إجمالي الميزانية</p>
                <p className="text-headline-sm font-heading text-on-surface mt-1">
                  {formatMoney(budget?.total_amount)}
                </p>
              </div>
              <div className="p-stack-md bg-surface rounded-xl border border-outline-variant">
                <p className="text-label-md font-heading text-on-surface-variant">المصروف</p>
                <p className="text-headline-sm font-heading text-on-surface mt-1">{formatMoney(totals.spent)}</p>
              </div>
              <div className="p-stack-md bg-surface rounded-xl border border-outline-variant">
                <p className="text-label-md font-heading text-on-surface-variant">الالتزامات</p>
                <p className="text-headline-sm font-heading text-on-surface mt-1">
                  {formatMoney(totals.committed)}
                </p>
              </div>
              <div className="p-stack-md bg-surface rounded-xl border border-outline-variant">
                <p className="text-label-md font-heading text-on-surface-variant">المتبقي</p>
                <p
                  className={`text-headline-sm font-heading mt-1 ${
                    totals.remaining < 0 ? "text-status-rejected" : "text-primary"
                  }`}
                >
                  {formatMoney(totals.remaining)}
                </p>
              </div>
            </div>
          </Card>

          {/* Items */}
          <div className="flex items-center justify-between mb-stack-md">
            <h3 className="text-headline-sm font-heading text-on-surface">بنود الميزانية</h3>
            <Button size="sm" icon="add" onClick={() => openItem(null)}>
              إضافة بند
            </Button>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon="format_list_bulleted"
              title="لا توجد بنود"
              description="أضف بنودًا لتوزيع الميزانية ومتابعة الصرف."
              action={
                <Button icon="add" onClick={() => openItem(null)}>
                  إضافة بند
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
                        <th className="p-4 font-medium">البند</th>
                        <th className="p-4 font-medium">المعتمد</th>
                        <th className="p-4 font-medium">المصروف</th>
                        <th className="p-4 font-medium">الالتزامات</th>
                        <th className="p-4 font-medium">المتبقي</th>
                        <th className="p-4 font-medium w-52">نسبة الصرف</th>
                        <th className="p-4 font-medium">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="text-body-md text-on-surface divide-y divide-outline-variant">
                      {items.map((i) => {
                        const s = itemStats(i);
                        const fill = s.over
                          ? "bg-status-rejected"
                          : s.near
                          ? "bg-status-pending"
                          : "bg-primary";
                        return (
                          <tr key={i.id} className="hover:bg-surface/60 transition-colors">
                            <td className="p-4 font-bold">{i.name}</td>
                            <td className="p-4">{formatMoney(s.approved)}</td>
                            <td className="p-4 text-on-surface-variant">{formatMoney(s.spent)}</td>
                            <td className="p-4 text-on-surface-variant">{formatMoney(s.committed)}</td>
                            <td
                              className={`p-4 font-medium ${
                                s.remaining < 0 ? "text-status-rejected" : "text-primary"
                              }`}
                            >
                              {formatMoney(s.remaining)}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${fill}`}
                                    style={{ width: `${clampPercent(s.ratio)}%` }}
                                  />
                                </div>
                                <span
                                  className={`text-body-sm font-bold whitespace-nowrap ${
                                    s.over
                                      ? "text-status-rejected"
                                      : s.near
                                      ? "text-status-pending"
                                      : "text-on-surface-variant"
                                  }`}
                                >
                                  {Math.round(s.ratio)}٪
                                </span>
                                {(s.over || s.near) && (
                                  <Icon
                                    name="warning"
                                    className={`text-[18px] ${
                                      s.over ? "text-status-rejected" : "text-status-pending"
                                    }`}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <Button size="sm" variant="ghost" icon="edit" onClick={() => openItem(i)}>
                                تعديل
                              </Button>
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
                {items.map((i) => {
                  const s = itemStats(i);
                  const fill = s.over
                    ? "bg-status-rejected"
                    : s.near
                    ? "bg-status-pending"
                    : "bg-primary";
                  return (
                    <Card key={i.id}>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h4 className="text-label-md font-heading font-bold text-on-surface">{i.name}</h4>
                        <Button size="sm" variant="ghost" icon="edit" onClick={() => openItem(i)}>
                          تعديل
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-body-sm mb-3">
                        <span className="text-on-surface-variant">المعتمد</span>
                        <span className="text-left font-medium">{formatMoney(s.approved)}</span>
                        <span className="text-on-surface-variant">المصروف</span>
                        <span className="text-left">{formatMoney(s.spent)}</span>
                        <span className="text-on-surface-variant">الالتزامات</span>
                        <span className="text-left">{formatMoney(s.committed)}</span>
                        <span className="text-on-surface-variant">المتبقي</span>
                        <span
                          className={`text-left font-medium ${
                            s.remaining < 0 ? "text-status-rejected" : "text-primary"
                          }`}
                        >
                          {formatMoney(s.remaining)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-outline-variant">
                        <div className="flex-1 h-2 bg-surface-container-high rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${fill}`}
                            style={{ width: `${clampPercent(s.ratio)}%` }}
                          />
                        </div>
                        <span
                          className={`text-body-sm font-bold ${
                            s.over
                              ? "text-status-rejected"
                              : s.near
                              ? "text-status-pending"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {Math.round(s.ratio)}٪
                        </span>
                        {(s.over || s.near) && (
                          <Icon
                            name="warning"
                            className={`text-[18px] ${
                              s.over ? "text-status-rejected" : "text-status-pending"
                            }`}
                          />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* Item modal */}
      <Modal
        open={!!itemModal}
        onClose={() => setItemModal(null)}
        title={itemModal?.item ? "تعديل بند الميزانية" : "إضافة بند"}
        footer={
          <>
            <Button type="submit" form="item-form" disabled={itemMutation.isPending} icon="check">
              {itemMutation.isPending ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
            <Button variant="ghost" onClick={() => setItemModal(null)} type="button">
              إلغاء
            </Button>
          </>
        }
      >
        <form id="item-form" onSubmit={submitItem} className="flex flex-col gap-stack-md">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-status-rejected/10 text-status-rejected text-body-sm">
              <Icon name="error" className="text-[18px]" />
              {formError}
            </div>
          )}
          <Field label="اسم البند" required>
            <Input
              value={itemForm.name}
              onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="مثال: مواد بناء"
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
            <Field label="المبلغ المعتمد" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={itemForm.approved_amount}
                onChange={(e) => setItemForm((f) => ({ ...f, approved_amount: e.target.value }))}
                placeholder="0.00"
              />
            </Field>
            <Field label="حد التنبيه (%)" hint="نسبة الصرف التي يظهر عندها التنبيه.">
              <Input
                type="number"
                min="0"
                max="100"
                value={itemForm.alert_threshold}
                onChange={(e) => setItemForm((f) => ({ ...f, alert_threshold: e.target.value }))}
                placeholder="90"
              />
            </Field>
          </div>
        </form>
      </Modal>

      {/* Total modal */}
      <Modal
        open={!!totalModal}
        onClose={() => setTotalModal(null)}
        title="تعديل إجمالي الميزانية"
        footer={
          <>
            <Button type="submit" form="total-form" disabled={totalMutation.isPending} icon="check">
              {totalMutation.isPending ? "جارٍ الحفظ…" : "حفظ"}
            </Button>
            <Button variant="ghost" onClick={() => setTotalModal(null)} type="button">
              إلغاء
            </Button>
          </>
        }
      >
        <form id="total-form" onSubmit={submitTotal} className="flex flex-col gap-stack-md">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-status-rejected/10 text-status-rejected text-body-sm">
              <Icon name="error" className="text-[18px]" />
              {formError}
            </div>
          )}
          <Field label="إجمالي الميزانية" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={totalForm.total_amount}
              onChange={(e) => setTotalForm((f) => ({ ...f, total_amount: e.target.value }))}
              placeholder="0.00"
            />
          </Field>
          <Field label="ملاحظة" hint="سبب التعديل عند تعديل ميزانية معتمدة.">
            <Textarea
              value={totalForm.note}
              onChange={(e) => setTotalForm((f) => ({ ...f, note: e.target.value }))}
              rows={3}
              placeholder="ملاحظات على الميزانية…"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
