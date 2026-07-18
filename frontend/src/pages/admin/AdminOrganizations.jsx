import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Icon,
  Button,
  Card,
  StatusBadge,
  Modal,
  Field,
  Textarea,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import PageHeader from "@/components/ui/PageHeader";
import { ORG_STATUS } from "@/lib/status";
import { formatDate } from "@/lib/format";

function rows(data) {
  return Array.isArray(data) ? data : data?.results ?? [];
}

const STATUS_TABS = [
  { value: "pending", label: "بانتظار الاعتماد" },
  { value: "approved", label: "معتمدة" },
  { value: "returned", label: "معادة للتعديل" },
  { value: "rejected", label: "مرفوضة" },
  { value: "suspended", label: "موقوفة" },
  { value: "", label: "الكل" },
];

const ORG_TYPE_LABELS = {
  committee: "لجنة",
  association: "جمعية",
  foundation: "مؤسسة",
  individual: "فرد",
  team: "فريق تطوعي",
};

// Lifecycle actions available from the review drawer.
const ACTIONS = {
  approve: {
    endpoint: "approve",
    title: "اعتماد الجهة",
    verb: "اعتماد",
    icon: "check_circle",
    variant: "primary",
    needsNote: false,
    note: "سيتم اعتماد الجهة وتمكينها من إنشاء المشاريع.",
  },
  return_for_edits: {
    endpoint: "return_for_edits",
    title: "إعادة للتعديل",
    verb: "إعادة",
    icon: "undo",
    variant: "secondary",
    needsNote: true,
    note: "ستعاد الجهة لمسؤولها لاستكمال البيانات أو المستندات.",
  },
  reject: {
    endpoint: "reject",
    title: "رفض الجهة",
    verb: "رفض",
    icon: "cancel",
    variant: "danger",
    needsNote: true,
    note: "سيتم إشعار الجهة بسبب الرفض.",
  },
  suspend: {
    endpoint: "suspend",
    title: "تعليق الجهة",
    verb: "تعليق",
    icon: "pause_circle",
    variant: "danger",
    needsNote: true,
    note: "سيتم تعليق نشاط الجهة على المنصة.",
  },
};

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex justify-between gap-3 py-1.5">
      <span className="text-body-sm text-on-surface-variant shrink-0">{label}</span>
      <span
        className={`text-body-sm text-on-surface text-left ${
          mono ? "font-code-ref text-code-ref text-secondary" : "font-medium"
        }`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

export default function AdminOrganizations() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [selected, setSelected] = useState(null); // org under review (drawer)
  const [action, setAction] = useState(null); // action key
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "organizations", status],
    queryFn: async () =>
      rows((await api.get("/organizations/", { params: status ? { status } : {} })).data),
  });

  const mutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/organizations/${selected.id}/${ACTIONS[action].endpoint}/`, {
          review_note: note,
        })
      ).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
      qc.invalidateQueries({ queryKey: ["admin", "overview"] });
      closeReview();
    },
    onError: (err) => setFormError(err?.apiMessage || "تعذّر تنفيذ الإجراء. حاول مرة أخرى."),
  });

  const orgs = data ?? [];

  function openReview(org) {
    setSelected(org);
    setAction(null);
    setNote("");
    setFormError("");
  }
  function closeReview() {
    setSelected(null);
    setAction(null);
    setNote("");
    setFormError("");
  }
  function submit(e) {
    e.preventDefault();
    setFormError("");
    if (!action) return;
    if (ACTIONS[action].needsNote && !note.trim()) {
      setFormError("يرجى إدخال ملاحظة للجهة.");
      return;
    }
    mutation.mutate();
  }

  const cfg = action ? ACTIONS[action] : null;

  return (
    <div>
      <PageHeader
        title="الجهات"
        subtitle="مراجعة الجهات المقدّمة للتحقق واعتمادها أو رفضها أو إعادتها للتعديل."
      />

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2 mb-gutter">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value || "all"}
            onClick={() => setStatus(t.value)}
            className={`px-4 py-2 rounded-full text-label-md font-heading font-bold transition-colors ${
              status === t.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading label="جارٍ تحميل الجهات…" />
      ) : isError ? (
        <ErrorState description="تعذّر تحميل الجهات." onRetry={refetch} />
      ) : orgs.length === 0 ? (
        <EmptyState icon="domain" title="لا توجد جهات" description="لا توجد جهات بهذه الحالة." />
      ) : (
        <>
          {/* Desktop table */}
          <Card padded={false} className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-surface-container-low text-label-md font-heading text-on-surface-variant border-b border-outline-variant">
                  <tr>
                    <th className="p-4 font-medium">الجهة</th>
                    <th className="p-4 font-medium">النوع</th>
                    <th className="p-4 font-medium">المسؤول</th>
                    <th className="p-4 font-medium">المستندات</th>
                    <th className="p-4 font-medium">الحالة</th>
                    <th className="p-4 font-medium">تاريخ التقديم</th>
                    <th className="p-4 font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant text-body-md text-on-surface">
                  {orgs.map((org) => (
                    <tr key={org.id} className="hover:bg-surface/60 transition-colors">
                      <td className="p-4">
                        <p className="font-bold">{org.name}</p>
                        <p className="text-code-ref font-code-ref text-secondary">
                          {org.reference}
                        </p>
                      </td>
                      <td className="p-4 text-on-surface-variant">
                        {org.org_type_display || ORG_TYPE_LABELS[org.org_type] || org.org_type}
                      </td>
                      <td className="p-4 text-on-surface-variant">{org.manager_name || "—"}</td>
                      <td className="p-4 text-on-surface-variant">
                        {org.documents?.length ? `${org.documents.length} ملف` : "—"}
                      </td>
                      <td className="p-4">
                        <StatusBadge map={ORG_STATUS} code={org.status} />
                      </td>
                      <td className="p-4 text-on-surface-variant">{formatDate(org.created_at)}</td>
                      <td className="p-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon="reviews"
                          onClick={() => openReview(org)}
                        >
                          مراجعة
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-stack-md">
            {orgs.map((org) => (
              <Card key={org.id}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <h3 className="text-label-md font-heading font-bold text-on-surface truncate">
                      {org.name}
                    </h3>
                    <span className="text-code-ref font-code-ref text-secondary">
                      {org.reference}
                    </span>
                  </div>
                  <StatusBadge map={ORG_STATUS} code={org.status} />
                </div>
                <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-body-sm mb-3 pb-3 border-b border-outline-variant">
                  <span className="text-on-surface-variant">النوع</span>
                  <span className="text-left">
                    {org.org_type_display || ORG_TYPE_LABELS[org.org_type] || org.org_type}
                  </span>
                  <span className="text-on-surface-variant">المسؤول</span>
                  <span className="text-left">{org.manager_name || "—"}</span>
                  <span className="text-on-surface-variant">المستندات</span>
                  <span className="text-left">
                    {org.documents?.length ? `${org.documents.length} ملف` : "—"}
                  </span>
                  <span className="text-on-surface-variant">التقديم</span>
                  <span className="text-left">{formatDate(org.created_at)}</span>
                </div>
                <Button size="sm" variant="ghost" icon="reviews" onClick={() => openReview(org)}>
                  مراجعة
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Review drawer/modal */}
      <Modal
        open={!!selected}
        onClose={closeReview}
        size="lg"
        title={selected ? `مراجعة الجهة — ${selected.name}` : ""}
        footer={
          cfg ? (
            <>
              <Button
                type="submit"
                form="org-review-form"
                disabled={mutation.isPending}
                variant={cfg.variant}
                icon={cfg.icon}
              >
                {mutation.isPending ? "جارٍ التنفيذ…" : cfg.verb}
              </Button>
              <Button variant="ghost" type="button" onClick={() => setAction(null)}>
                رجوع
              </Button>
            </>
          ) : (
            <Button variant="ghost" type="button" onClick={closeReview}>
              إغلاق
            </Button>
          )
        }
      >
        {selected && (
          <div className="space-y-stack-md">
            {/* Header meta */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-code-ref font-code-ref text-secondary">
                {selected.reference}
              </span>
              <StatusBadge map={ORG_STATUS} code={selected.status} />
            </div>

            {/* Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-gutter">
              <div className="divide-y divide-outline-variant">
                <InfoRow
                  label="النوع"
                  value={
                    selected.org_type_display ||
                    ORG_TYPE_LABELS[selected.org_type] ||
                    selected.org_type
                  }
                />
                <InfoRow label="المسؤول" value={selected.manager_name} />
                <InfoRow label="الهاتف" value={selected.phone} />
                <InfoRow label="البريد" value={selected.email} />
              </div>
              <div className="divide-y divide-outline-variant">
                <InfoRow label="الموقع" value={selected.location} />
                <InfoRow label="البنك" value={selected.bank_name} />
                <InfoRow label="اسم الحساب" value={selected.bank_account_name} />
                <InfoRow label="تاريخ التقديم" value={formatDate(selected.created_at)} />
              </div>
            </div>

            {selected.description && (
              <div>
                <p className="text-label-md font-heading text-on-surface-variant mb-1">الوصف</p>
                <p className="text-body-md text-on-surface whitespace-pre-line">
                  {selected.description}
                </p>
              </div>
            )}

            {/* Documents */}
            <div>
              <p className="text-label-md font-heading text-on-surface-variant mb-2">
                مستندات التحقق
              </p>
              {selected.documents?.length ? (
                <ul className="space-y-2">
                  {selected.documents.map((doc) => (
                    <li key={doc.id}>
                      <a
                        href={doc.file}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-outline-variant bg-surface hover:bg-surface-container-low transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-secondary/10 text-secondary">
                          <Icon name="description" className="text-[20px]" />
                        </div>
                        <span className="flex-1 text-body-md text-on-surface truncate">
                          {doc.title || "مستند"}
                        </span>
                        <Icon
                          name="download"
                          className="text-[20px] text-on-surface-variant group-hover:text-primary transition-colors"
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-sm text-on-surface-variant">لا توجد مستندات مرفقة.</p>
              )}
            </div>

            {selected.review_note && (
              <div className="p-3 rounded-lg bg-status-returned/10 text-status-returned text-body-sm flex items-start gap-2">
                <Icon name="sticky_note_2" className="text-[18px] mt-0.5" />
                <span>ملاحظة سابقة: {selected.review_note}</span>
              </div>
            )}

            {/* Decision */}
            <div className="border-t border-outline-variant pt-stack-md">
              {!action ? (
                <div>
                  <p className="text-label-md font-heading text-on-surface mb-2">القرار</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.status === "pending" || selected.status === "returned" ? (
                      <>
                        <Button icon="check_circle" onClick={() => setAction("approve")}>
                          اعتماد
                        </Button>
                        <Button
                          variant="secondary"
                          icon="undo"
                          onClick={() => setAction("return_for_edits")}
                        >
                          إعادة للتعديل
                        </Button>
                        <Button variant="danger" icon="cancel" onClick={() => setAction("reject")}>
                          رفض
                        </Button>
                      </>
                    ) : selected.status === "approved" ? (
                      <Button
                        variant="danger"
                        icon="pause_circle"
                        onClick={() => setAction("suspend")}
                      >
                        تعليق الجهة
                      </Button>
                    ) : (
                      <p className="text-body-sm text-on-surface-variant">
                        لا توجد إجراءات متاحة لهذه الحالة.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <form id="org-review-form" onSubmit={submit} className="space-y-stack-md">
                  <div className="flex items-center gap-2 text-label-md font-heading text-on-surface">
                    <Icon name={cfg.icon} className="text-primary" />
                    {cfg.title}
                  </div>
                  {formError && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-status-rejected/10 text-status-rejected text-body-sm">
                      <Icon name="error" className="text-[18px]" />
                      {formError}
                    </div>
                  )}
                  <p className="text-body-sm text-on-surface-variant flex items-start gap-2">
                    <Icon name="info" className="text-[18px] mt-0.5" />
                    {cfg.note}
                  </p>
                  <Field
                    label="ملاحظة للجهة"
                    required={cfg.needsNote}
                    hint={cfg.needsNote ? "" : "اختياري"}
                  >
                    <Textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="اكتب ملاحظتك لمسؤول الجهة…"
                    />
                  </Field>
                </form>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
