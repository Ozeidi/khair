import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatNumber, formatDateTime } from "@/lib/format";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Button,
  Card,
  StatusBadge,
  Modal,
  Field,
  Input,
  Textarea,
  Select,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";

// Campaign lifecycle (DOMAIN_CONTRACT §5 communications) — richer than the base
// status maps, so we define it locally.
const S = {
  draft: "bg-status-draft/10 text-status-draft",
  pending: "bg-status-pending/10 text-status-pending",
  approved: "bg-status-approved/10 text-status-approved",
  scheduled: "bg-secondary/10 text-secondary",
  sending: "bg-status-pending/10 text-status-pending",
  completed: "bg-status-completed/10 text-status-completed",
  partial: "bg-status-returned/10 text-status-returned",
  failed: "bg-status-rejected/10 text-status-rejected",
  cancelled: "bg-surface-container-high text-on-surface-variant",
};
const CAMPAIGN_STATUS = {
  draft: { label: "مسودة", style: S.draft },
  pending: { label: "بانتظار الاعتماد", style: S.pending },
  approved: { label: "معتمدة", style: S.approved },
  scheduled: { label: "مجدولة", style: S.scheduled },
  sending: { label: "قيد الإرسال", style: S.sending },
  completed: { label: "مكتملة", style: S.completed },
  partial: { label: "أُرسلت جزئيًا", style: S.partial },
  failed: { label: "فاشلة", style: S.failed },
  cancelled: { label: "ملغاة", style: S.cancelled },
};

const AUDIENCE = {
  all: "جميع المساهمين",
  active: "المساهمون النشطون",
  overdue: "أصحاب المتأخرات",
  custom: "جمهور مخصص",
};

const EMPTY_FORM = {
  name: "",
  project: "",
  audience: "all",
  template: "",
  body: "",
  link: "",
  scheduled_at: "",
};

function projectName(c) {
  return c?.project_name || c?.project?.name || c?.project_title || "—";
}

// Delivery counters — tolerate a few possible field shapes from the API.
function delivery(c) {
  const recipients =
    c?.recipients_count ?? c?.recipients?.length ?? c?.total_recipients ?? null;
  const sent = c?.sent_count ?? c?.sent ?? null;
  const failed = c?.failed_count ?? c?.failed ?? null;
  if (recipients == null && sent == null && failed == null) return null;
  return {
    recipients: recipients ?? 0,
    sent: sent ?? 0,
    failed: failed ?? 0,
  };
}

export default function Campaigns() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [preview, setPreview] = useState(null); // campaign under preview
  const [busyId, setBusyId] = useState(null); // id + action being run
  const [notice, setNotice] = useState("");

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const listQ = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => (await api.get("/campaigns/")).data,
  });

  const projectsQ = useQuery({
    queryKey: ["campaigns-projects"],
    queryFn: async () => (await api.get("/projects/")).data,
  });

  // Templates are optional — degrade gracefully if the endpoint is missing.
  const templatesQ = useQuery({
    queryKey: ["campaigns-templates"],
    queryFn: async () => {
      try {
        return (await api.get("/templates/")).data;
      } catch {
        return [];
      }
    },
    retry: false,
  });

  const campaigns = listQ.data?.results ?? (Array.isArray(listQ.data) ? listQ.data : []);
  const projects =
    projectsQ.data?.results ?? (Array.isArray(projectsQ.data) ? projectsQ.data : []);
  const templates =
    templatesQ.data?.results ?? (Array.isArray(templatesQ.data) ? templatesQ.data : []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name,
        project: form.project,
        audience: form.audience,
        body: form.body,
      };
      if (form.template) body.template = form.template;
      if (form.link) body.link = form.link;
      if (form.scheduled_at) body.scheduled_at = form.scheduled_at;
      return (await api.post("/campaigns/", body)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      setModalOpen(false);
      flash("تم إنشاء الحملة كمسودة.");
    },
    onError: (err) =>
      setFormError(err?.apiMessage || "تعذّر إنشاء الحملة. تحقق من البيانات وحاول مجددًا."),
  });

  function flash(msg) {
    setNotice(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setNotice(""), 4000);
  }

  function validate() {
    if (!form.name.trim()) return "اسم الحملة مطلوب.";
    if (!form.project) return "يجب اختيار المشروع.";
    if (!form.body.trim() && !form.template) return "أدخل نص الرسالة أو اختر قالبًا.";
    return "";
  }

  function submitCreate(e) {
    e.preventDefault();
    const v = validate();
    if (v) {
      setFormError(v);
      return;
    }
    setFormError("");
    createMutation.mutate();
  }

  // Row-level actions: preview / test_send / approve / send.
  async function runAction(c, action) {
    setBusyId(`${c.id}:${action}`);
    try {
      if (action === "preview") {
        const { data } = await api.post(`/campaigns/${c.id}/preview/`);
        setPreview({ campaign: c, ...data });
      } else if (action === "test_send") {
        await api.post(`/campaigns/${c.id}/test_send/`);
        flash("تم إرسال رسالة اختبار.");
      } else if (action === "approve") {
        await api.post(`/campaigns/${c.id}/approve/`);
        qc.invalidateQueries({ queryKey: ["campaigns"] });
        flash("تم اعتماد الحملة.");
      } else if (action === "send") {
        if (!window.confirm(`تأكيد الإرسال الجماعي لحملة «${c.name}»؟`)) {
          setBusyId(null);
          return;
        }
        await api.post(`/campaigns/${c.id}/send/`);
        qc.invalidateQueries({ queryKey: ["campaigns"] });
        flash("بدأ إرسال الحملة.");
      }
    } catch (err) {
      flash(err?.apiMessage || "تعذّر تنفيذ العملية. حاول مرة أخرى.");
    } finally {
      setBusyId(null);
    }
  }

  const isBusy = (c, action) => busyId === `${c.id}:${action}`;

  return (
    <div>
      <PageHeader
        title="حملات واتساب"
        subtitle="تجهيز حملات التواصل مع المساهمين واعتمادها وإرسالها."
        actions={
          <Button icon="campaign" onClick={openCreate}>
            حملة جديدة
          </Button>
        }
      />

      {notice && (
        <div className="mb-stack-md flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-body-md text-on-surface">
          <Icon name="info" className="text-[18px] text-secondary" />
          <span>{notice}</span>
        </div>
      )}

      {listQ.isLoading ? (
        <Loading />
      ) : listQ.isError ? (
        <ErrorState
          description="تعذّر تحميل الحملات. حاول مرة أخرى."
          onRetry={listQ.refetch}
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon="campaign"
          title="لا توجد حملات بعد"
          description="أنشئ حملة للتواصل مع مساهمي مشاريعك عبر واتساب."
          action={
            <Button icon="add" onClick={openCreate} className="mt-2">
              حملة جديدة
            </Button>
          }
        />
      ) : (
        <div className="space-y-stack-md">
          {campaigns.map((c) => {
            const d = delivery(c);
            const canApprove = ["draft", "pending"].includes(c.status);
            const canSend = ["approved", "scheduled", "partial", "failed"].includes(
              c.status
            );
            return (
              <Card key={c.id}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  {/* Identity */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-headline-sm font-heading font-bold text-on-surface">
                        {c.name || "—"}
                      </h3>
                      <StatusBadge map={CAMPAIGN_STATUS} code={c.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-on-surface-variant">
                      {c.reference && (
                        <span className="font-code-ref text-code-ref text-secondary">
                          {c.reference}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Icon name="folder" className="text-[16px]" />
                        {projectName(c)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="group" className="text-[16px]" />
                        {AUDIENCE[c.audience] || c.audience || "—"}
                      </span>
                      {c.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Icon name="schedule" className="text-[16px]" />
                          {formatDateTime(c.scheduled_at)}
                        </span>
                      )}
                    </div>
                    {(c.body || c.template_name) && (
                      <p className="mt-3 line-clamp-2 max-w-2xl text-body-md text-on-surface-variant">
                        {c.body || `قالب: ${c.template_name}`}
                      </p>
                    )}
                  </div>

                  {/* Delivery summary */}
                  {d && (
                    <div className="flex shrink-0 gap-2">
                      <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-center">
                        <p className="text-body-sm text-on-surface-variant">المستلمون</p>
                        <p className="text-label-md font-heading font-bold text-on-surface">
                          {formatNumber(d.recipients)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-center">
                        <p className="text-body-sm text-on-surface-variant">أُرسلت</p>
                        <p className="text-label-md font-heading font-bold text-status-completed">
                          {formatNumber(d.sent)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-center">
                        <p className="text-body-sm text-on-surface-variant">فشلت</p>
                        <p className="text-label-md font-heading font-bold text-status-rejected">
                          {formatNumber(d.failed)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="visibility"
                    onClick={() => runAction(c, "preview")}
                    disabled={isBusy(c, "preview")}
                  >
                    معاينة
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="send"
                    onClick={() => runAction(c, "test_send")}
                    disabled={isBusy(c, "test_send")}
                  >
                    رسالة اختبار
                  </Button>
                  {canApprove && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="check_circle"
                      onClick={() => runAction(c, "approve")}
                      disabled={isBusy(c, "approve")}
                    >
                      اعتماد
                    </Button>
                  )}
                  {canSend && (
                    <Button
                      variant="contribute"
                      size="sm"
                      icon="rocket_launch"
                      onClick={() => runAction(c, "send")}
                      disabled={isBusy(c, "send")}
                    >
                      إرسال
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* New campaign modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="حملة جديدة"
        size="lg"
        footer={
          <>
            <Button
              variant="contribute"
              icon="save"
              onClick={submitCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "جارٍ الحفظ…" : "حفظ كمسودة"}
            </Button>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
          </>
        }
      >
        <form onSubmit={submitCreate} className="space-y-stack-md">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-status-rejected/10 px-3 py-2 text-body-sm text-status-rejected">
              <Icon name="error" className="text-[18px]" />
              <span>{formError}</span>
            </div>
          )}

          <Field label="اسم الحملة" required>
            <Input
              value={form.name}
              onChange={setField("name")}
              placeholder="مثال: تذكير مساهمي مشروع بئر الخير"
            />
          </Field>

          <div className="grid gap-stack-md md:grid-cols-2">
            <Field label="المشروع" required>
              <Select value={form.project} onChange={setField("project")}>
                <option value="">— اختر المشروع —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="الجمهور" required>
              <Select value={form.audience} onChange={setField("audience")}>
                {Object.entries(AUDIENCE).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="القالب"
            hint={
              templates.length === 0
                ? "لا توجد قوالب متاحة — يمكنك كتابة نص الرسالة أدناه."
                : "اختياري — يُستخدم بدلًا من النص المخصص."
            }
          >
            <Select value={form.template} onChange={setField("template")}>
              <option value="">— بدون قالب —</option>
              {templates.map((t) => (
                <option key={t.id ?? t.key} value={t.id ?? t.key}>
                  {t.name || t.key}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="نص الرسالة"
            hint="يمكنك استخدام متغيرات مثل {اسم_المساهم} و {اسم_المشروع}."
          >
            <Textarea
              value={form.body}
              onChange={setField("body")}
              rows={5}
              placeholder="اكتب نص رسالة الحملة هنا…"
            />
          </Field>

          <div className="grid gap-stack-md md:grid-cols-2">
            <Field label="رابط مرفق">
              <Input
                type="url"
                value={form.link}
                onChange={setField("link")}
                placeholder="https://"
                dir="ltr"
                className="text-left"
              />
            </Field>

            <Field label="موعد الإرسال" hint="اتركه فارغًا للإرسال الفوري بعد الاعتماد.">
              <Input
                type="datetime-local"
                value={form.scheduled_at}
                onChange={setField("scheduled_at")}
              />
            </Field>
          </div>
        </form>
      </Modal>

      {/* Preview modal */}
      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title="معاينة الحملة"
        size="md"
        footer={
          <Button variant="ghost" onClick={() => setPreview(null)}>
            إغلاق
          </Button>
        }
      >
        {preview && (
          <div className="space-y-stack-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-label-md font-heading text-on-surface-variant">
                {preview.campaign?.name}
              </span>
              <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
                <Icon name="group" className="text-[16px]" />
                {formatNumber(
                  preview.recipients_count ??
                    preview.recipients?.length ??
                    delivery(preview.campaign)?.recipients ??
                    0
                )}{" "}
                مستلم
              </span>
            </div>
            <div className="rounded-xl border border-outline-variant bg-surface p-4">
              <p className="whitespace-pre-wrap text-body-md leading-relaxed text-on-surface">
                {preview.body ||
                  preview.preview ||
                  preview.message ||
                  preview.campaign?.body ||
                  "لا يوجد نص لعرضه."}
              </p>
              {(preview.link || preview.campaign?.link) && (
                <a
                  href={preview.link || preview.campaign?.link}
                  target="_blank"
                  rel="noreferrer"
                  dir="ltr"
                  className="mt-3 block text-left text-body-sm text-primary hover:underline"
                >
                  {preview.link || preview.campaign?.link}
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
