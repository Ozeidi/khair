import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { Icon, Button, Modal, Field, Input, Select } from "@/components/ui";
import { Loading, ErrorState, EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

function rows(data) {
  return Array.isArray(data) ? data : data?.results ?? [];
}

// أدوار النظام (apps/core/roles.py).
const ROLE_OPTIONS = [
  { value: "platform_admin", label: "مدير المنصة" },
  { value: "org_manager", label: "مدير الجهة" },
  { value: "project_owner", label: "صاحب المشروع" },
  { value: "finance_officer", label: "المسؤول المالي" },
  { value: "auditor", label: "المدقق" },
  { value: "content_officer", label: "مسؤول المحتوى والحملات" },
  { value: "contributor", label: "المساهم" },
];
const ROLE_LABELS = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

const ROLE_STYLES = {
  platform_admin: "bg-status-rejected/10 text-status-rejected",
  org_manager: "bg-secondary/10 text-secondary",
  project_owner: "bg-primary/10 text-primary",
  finance_officer: "bg-status-completed/10 text-status-completed",
  auditor: "bg-status-pending/10 text-status-pending",
  content_officer: "bg-status-returned/10 text-status-returned",
  contributor: "bg-surface-container-high text-on-surface-variant",
};

const ACTIVE_OPTS = [
  { value: "", label: "الكل" },
  { value: "true", label: "نشط فقط" },
  { value: "false", label: "معطّل فقط" },
];

export default function AdminUsers() {
  const qc = useQueryClient();
  const [role, setRole] = useState("");
  const [active, setActive] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // user being edited (role/org)
  const [confirmToggle, setConfirmToggle] = useState(null); // user to toggle active

  const params = { page };
  if (role) params.role = role;
  if (active) params.is_active = active;
  if (search.trim()) params.search = search.trim();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "users", role, active, search, page],
    queryFn: async () => (await api.get("/users/", { params })).data,
    keepPreviousData: true,
  });

  // الجهات المعتمدة، لعرض أسمائها وربطها عند تحرير المستخدم.
  const { data: orgData } = useQuery({
    queryKey: ["admin", "orgs-lite"],
    queryFn: async () =>
      rows((await api.get("/organizations/", { params: { status: "approved" } })).data),
  });
  const orgs = orgData ?? [];
  const orgName = (id) => orgs.find((o) => o.id === id)?.name || "—";

  const toggleMutation = useMutation({
    mutationFn: async (id) => (await api.post(`/users/${id}/toggle_active/`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setConfirmToggle(null);
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, body }) => (await api.patch(`/users/${id}/`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setEditing(null);
    },
  });

  const users = rows(data);
  const count = data?.count ?? users.length;
  const numPages = data?.num_pages ?? 1;
  const currentPage = data?.current_page ?? page;

  function resetPage(fn) {
    return (v) => { fn(v); setPage(1); };
  }

  return (
    <div className="space-y-stack-md">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-outline-variant pb-stack-md">
        <div>
          <h1 className="text-headline-lg font-heading text-on-surface">المستخدمون</h1>
          <p className="text-body-lg text-on-surface-variant mt-1">
            إدارة الحسابات والأدوار والجهات وتفعيل أو تعطيل المستخدمين.
          </p>
        </div>
        <span className="text-body-sm text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant whitespace-nowrap">
          {count.toLocaleString("ar-SA")} مستخدم
        </span>
      </div>

      {/* الفلاتر */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow p-stack-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="بحث">
            <Input
              value={search}
              onChange={resetPage(setSearch)}
              placeholder="الاسم أو الهاتف أو البريد…"
            />
          </Field>
          <Field label="الدور">
            <Select value={role} onChange={resetPage(setRole)}>
              <option value="">جميع الأدوار</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="الحالة">
            <Select value={active} onChange={resetPage(setActive)}>
              {ACTIVE_OPTS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            {(role || active || search) && (
              <Button
                variant="ghost"
                icon="filter_alt_off"
                onClick={() => { setRole(""); setActive(""); setSearch(""); setPage(1); }}
                className="w-full"
              >
                مسح الفلاتر
              </Button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Loading label="جارٍ تحميل المستخدمين…" />
      ) : isError ? (
        <ErrorState description="تعذّر تحميل المستخدمين." onRetry={refetch} />
      ) : users.length === 0 ? (
        <EmptyState icon="group" title="لا يوجد مستخدمون" description="لا توجد نتائج مطابقة للفلاتر الحالية." />
      ) : (
        <>
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant soft-shadow overflow-hidden">
            {/* جدول لسطح المكتب */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="p-4 font-medium">الهاتف</th>
                    <th className="p-4 font-medium">الاسم</th>
                    <th className="p-4 font-medium">الدور</th>
                    <th className="p-4 font-medium">الجهة</th>
                    <th className="p-4 font-medium">الحالة</th>
                    <th className="p-4 font-medium">آخر دخول</th>
                    <th className="p-4 font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-body-md text-on-surface">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-surface/50 transition-colors">
                      <td className="p-4 font-code-ref text-body-sm text-on-surface-variant" dir="ltr">{u.phone}</td>
                      <td className="p-4">
                        <span className="font-bold">{u.full_name || "—"}</span>
                        {u.email && <p className="text-body-sm text-on-surface-variant">{u.email}</p>}
                      </td>
                      <td className="p-4">
                        <span className={`text-label-md px-2.5 py-0.5 rounded-full font-heading ${ROLE_STYLES[u.role] || "bg-surface-container-high text-on-surface-variant"}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="p-4 text-on-surface-variant">{u.organization ? orgName(u.organization) : "—"}</td>
                      <td className="p-4"><ActivePill active={u.is_active} /></td>
                      <td className="p-4 text-on-surface-variant text-body-sm whitespace-nowrap">
                        {u.last_login ? formatDateTime(u.last_login) : "لم يسجّل بعد"}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditing(u)}
                            className="p-1.5 rounded hover:bg-secondary/10 text-on-surface-variant hover:text-secondary transition-colors"
                            title="تعديل الدور والجهة"
                          >
                            <Icon name="manage_accounts" className="text-[18px]" />
                          </button>
                          <button
                            onClick={() => setConfirmToggle(u)}
                            className={`p-1.5 rounded transition-colors ${
                              u.is_active
                                ? "hover:bg-status-rejected/10 text-status-rejected"
                                : "hover:bg-status-approved/10 text-status-approved"
                            }`}
                            title={u.is_active ? "تعطيل" : "تفعيل"}
                          >
                            <Icon name={u.is_active ? "block" : "check_circle"} className="text-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* بطاقات للهاتف */}
            <div className="md:hidden divide-y divide-outline-variant">
              {users.map((u) => (
                <div key={u.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-on-surface">{u.full_name || "—"}</p>
                      <p className="font-code-ref text-body-sm text-on-surface-variant" dir="ltr">{u.phone}</p>
                    </div>
                    <ActivePill active={u.is_active} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-body-sm">
                    <span className={`px-2.5 py-0.5 rounded-full font-heading text-label-md ${ROLE_STYLES[u.role] || "bg-surface-container-high text-on-surface-variant"}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                    <span className="text-on-surface-variant">{u.organization ? orgName(u.organization) : "بدون جهة"}</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant">
                    آخر دخول: {u.last_login ? formatDateTime(u.last_login) : "لم يسجّل بعد"}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="ghost" icon="manage_accounts" onClick={() => setEditing(u)}>
                      تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant={u.is_active ? "danger" : "primary"}
                      icon={u.is_active ? "block" : "check_circle"}
                      onClick={() => setConfirmToggle(u)}
                    >
                      {u.is_active ? "تعطيل" : "تفعيل"}
                    </Button>
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

      {/* نافذة تعديل الدور والجهة */}
      {editing && (
        <EditUserModal
          user={editing}
          orgs={orgs}
          roles={ROLE_OPTIONS}
          onClose={() => setEditing(null)}
          onSave={(body) => editMutation.mutate({ id: editing.id, body })}
          saving={editMutation.isPending}
          error={editMutation.error?.apiMessage}
        />
      )}

      {/* نافذة تأكيد التفعيل/التعطيل */}
      {confirmToggle && (
        <Modal
          title={confirmToggle.is_active ? "تعطيل المستخدم" : "تفعيل المستخدم"}
          onClose={() => setConfirmToggle(null)}
        >
          <div className="space-y-4">
            <p className="text-body-md text-on-surface">
              {confirmToggle.is_active ? "سيتم تعطيل" : "سيتم تفعيل"} حساب{" "}
              <strong>{confirmToggle.full_name || confirmToggle.phone}</strong>.
              {confirmToggle.is_active && " لن يتمكن من تسجيل الدخول، ولن تُحذف عملياته السابقة."}
            </p>
            {toggleMutation.isError && (
              <p className="text-body-sm text-status-rejected">
                {toggleMutation.error?.apiMessage || "حدث خطأ."}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setConfirmToggle(null)}>إلغاء</Button>
              <Button
                variant={confirmToggle.is_active ? "danger" : "primary"}
                onClick={() => toggleMutation.mutate(confirmToggle.id)}
                disabled={toggleMutation.isPending}
              >
                {toggleMutation.isPending ? "جارٍ…" : confirmToggle.is_active ? "تعطيل" : "تفعيل"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ActivePill({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-label-md font-heading font-bold ${
        active ? "bg-status-approved/10 text-status-approved" : "bg-surface-container-high text-on-surface-variant"
      }`}
    >
      <Icon name={active ? "check_circle" : "block"} className="text-[16px]" />
      {active ? "نشط" : "معطّل"}
    </span>
  );
}

function EditUserModal({ user, orgs, roles, onClose, onSave, saving, error }) {
  const [role, setRole] = useState(user.role || "contributor");
  const [organization, setOrganization] = useState(user.organization ?? "");

  const unchanged = role === user.role && String(organization) === String(user.organization ?? "");

  return (
    <Modal title="تعديل المستخدم" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-outline-variant">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-heading font-bold shrink-0">
            {(user.full_name || user.phone || "?")[0]}
          </div>
          <div>
            <p className="font-bold text-on-surface">{user.full_name || "—"}</p>
            <p className="font-code-ref text-body-sm text-on-surface-variant" dir="ltr">{user.phone}</p>
          </div>
        </div>

        <Field label="الدور" required>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </Field>

        <Field label="الجهة" hint="اترك الحقل فارغًا لإزالة ارتباط المستخدم بأي جهة.">
          <Select value={organization} onChange={(e) => setOrganization(e.target.value)}>
            <option value="">بدون جهة</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>
        </Field>

        {error && <p className="text-body-sm text-status-rejected">{error}</p>}

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button
            variant="primary"
            icon="save"
            disabled={saving || unchanged}
            onClick={() =>
              onSave({ role, organization: organization === "" ? null : Number(organization) })
            }
          >
            {saving ? "جارٍ الحفظ…" : "حفظ التغييرات"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
