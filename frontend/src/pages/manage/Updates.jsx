import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import PageHeader from "@/components/ui/PageHeader";
import {
  Icon,
  Button,
  Card,
  StatusBadge,
  ProgressBar,
  Modal,
  Loading,
  EmptyState,
  ErrorState,
} from "@/components/ui";
import { Field, Input, Textarea, Select } from "@/components/ui";
import { formatDate, formatDateTime, clampPercent } from "@/lib/format";

const UPDATE_STATUS = {
  draft: { label: "مسودة", style: "bg-status-draft/10 text-status-draft" },
  pending: { label: "بانتظار المراجعة", style: "bg-status-pending/10 text-status-pending" },
  scheduled: { label: "مجدول", style: "bg-secondary/10 text-secondary" },
  published: { label: "منشور", style: "bg-status-completed/10 text-status-completed" },
  archived: { label: "مؤرشف", style: "bg-surface-container-high text-on-surface-variant" },
};

const STAGE_STATUS = {
  pending: { label: "لم يبدأ", style: "bg-status-draft/10 text-status-draft" },
  in_progress: { label: "قيد التنفيذ", style: "bg-status-pending/10 text-status-pending" },
  completed: { label: "مكتمل", style: "bg-status-completed/10 text-status-completed" },
  delayed: { label: "متأخر", style: "bg-status-delayed/10 text-status-delayed" },
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const emptyForm = {
  title: "",
  stage: "",
  body: "",
  new_progress: "",
  visibility: "public",
  notify_contributors: true,
};

export default function Updates() {
  const [params] = useSearchParams();
  const projectId = params.get("project") || "";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState([]);

  const scope = projectId ? { project: projectId } : {};

  const updatesQuery = useQuery({
    queryKey: ["project-updates", projectId],
    queryFn: async () => (await api.get("/project-updates/", { params: scope })).data,
  });
  const stagesQuery = useQuery({
    queryKey: ["project-stages", projectId],
    queryFn: async () => (await api.get("/project-stages/", { params: scope })).data,
  });

  const updates = updatesQuery.data?.results ?? (Array.isArray(updatesQuery.data) ? updatesQuery.data : []);
  const stages = stagesQuery.data?.results ?? (Array.isArray(stagesQuery.data) ? stagesQuery.data : []);

  const totalWeight = stages.reduce((sum, s) => sum + num(s.weight), 0);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: (publish) => {
      const hasFiles = images.length > 0;
      let payload;
      if (hasFiles) {
        payload = new FormData();
        if (projectId) payload.append("project", projectId);
        payload.append("title", form.title);
        if (form.stage) payload.append("stage", form.stage);
        payload.append("body", form.body);
        if (form.new_progress !== "") payload.append("new_progress", form.new_progress);
        payload.append("visibility", form.visibility);
        payload.append("notify_contributors", form.notify_contributors);
        images.forEach((img) => payload.append("images", img));
      } else {
        payload = {
          ...(projectId ? { project: projectId } : {}),
          title: form.title,
          stage: form.stage || null,
          body: form.body,
          new_progress: form.new_progress === "" ? null : form.new_progress,
          visibility: form.visibility,
          notify_contributors: form.notify_contributors,
        };
      }
      return api
        .post("/project-updates/", payload, hasFiles ? { headers: { "Content-Type": "multipart/form-data" } } : {})
        .then(async (res) => {
          if (publish && res.data?.id) {
            await api.post(`/project-updates/${res.data.id}/publish/`);
          }
          return res.data;
        });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-updates", projectId] });
      qc.invalidateQueries({ queryKey: ["project-stages", projectId] });
      setOpen(false);
      setForm(emptyForm);
      setImages([]);
    },
  });

  const publish = useMutation({
    mutationFn: (id) => api.post(`/project-updates/${id}/publish/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-updates", projectId] }),
  });

  return (
    <div>
      <PageHeader
        title="التحديثات والمراحل"
        subtitle="انشر تقدم المشروع للمساهمين وتابع أوزان مراحل التنفيذ."
        actions={
          <Button icon="add" onClick={() => setOpen(true)}>
            تحديث جديد
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        {/* Updates list */}
        <div className="lg:col-span-2 space-y-stack-md">
          <h2 className="text-headline-sm font-heading text-on-surface">آخر التحديثات</h2>
          {updatesQuery.isLoading ? (
            <Loading />
          ) : updatesQuery.isError ? (
            <ErrorState description="تعذّر تحميل التحديثات." onRetry={updatesQuery.refetch} />
          ) : updates.length === 0 ? (
            <Card>
              <EmptyState
                icon="campaign"
                title="لا توجد تحديثات بعد"
                description="أنشئ أول تحديث لإطلاع المساهمين على تقدم المشروع."
              />
            </Card>
          ) : (
            updates.map((u) => (
              <Card key={u.id}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <h3 className="text-headline-sm font-heading text-on-surface">{u.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap text-body-sm text-on-surface-variant mt-1">
                      <span className="flex items-center gap-1">
                        <Icon name="schedule" className="text-[16px]" />
                        {formatDateTime(u.published_at || u.created_at)}
                      </span>
                      {(u.stage_name || u.stage?.name) && (
                        <>
                          <span className="text-outline-variant">•</span>
                          <span className="flex items-center gap-1">
                            <Icon name="layers" className="text-[16px]" />
                            {u.stage_name || u.stage?.name}
                          </span>
                        </>
                      )}
                      <span className="text-outline-variant">•</span>
                      <span className="flex items-center gap-1">
                        <Icon name={u.visibility === "internal" ? "lock" : "public"} className="text-[16px]" />
                        {u.visibility === "internal" ? "داخلي" : "عام"}
                      </span>
                    </div>
                  </div>
                  <StatusBadge map={UPDATE_STATUS} code={u.status} />
                </div>
                <p className="text-body-md text-on-surface whitespace-pre-line line-clamp-4">{u.body}</p>
                {u.new_progress != null && u.new_progress !== "" && (
                  <div className="mt-3">
                    <ProgressBar tone="execution" value={u.new_progress} label="نسبة الإنجاز الجديدة" />
                  </div>
                )}
                {u.status !== "published" && (
                  <div className="mt-4 pt-3 border-t border-outline-variant flex justify-start">
                    <Button
                      size="sm"
                      icon="publish"
                      onClick={() => publish.mutate(u.id)}
                      disabled={publish.isPending}
                    >
                      نشر
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Stages panel */}
        <div className="space-y-stack-md">
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm font-heading text-on-surface">مراحل التنفيذ</h2>
            <span
              className={`text-label-md font-heading font-bold ${
                Math.round(totalWeight) === 100 ? "text-status-completed" : "text-status-pending"
              }`}
            >
              الأوزان: {Math.round(totalWeight)}٪
            </span>
          </div>
          {stagesQuery.isLoading ? (
            <Loading />
          ) : stages.length === 0 ? (
            <Card>
              <EmptyState icon="layers" title="لا توجد مراحل" description="أضف مراحل بأوزان مجموعها 100٪." />
            </Card>
          ) : (
            <div className="space-y-stack-md">
              {stages.map((st) => (
                <Card key={st.id}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <h3 className="text-label-md font-heading font-bold text-on-surface truncate">{st.name}</h3>
                      <p className="text-body-sm text-on-surface-variant">
                        الوزن: {Math.round(num(st.weight))}٪
                        {st.end_date && ` • حتى ${formatDate(st.end_date)}`}
                      </p>
                    </div>
                    <StatusBadge map={STAGE_STATUS} code={st.status} />
                  </div>
                  <ProgressBar tone="execution" value={st.progress} showValue />
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create update modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="تحديث جديد للمشروع"
        size="lg"
        footer={
          <>
            <Button
              icon="publish"
              onClick={() => create.mutate(true)}
              disabled={create.isPending || !form.title || !form.body}
            >
              نشر مباشرة
            </Button>
            <Button
              variant="secondary"
              icon="save"
              onClick={() => create.mutate(false)}
              disabled={create.isPending || !form.title || !form.body}
            >
              حفظ كمسودة
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="عنوان التحديث" required>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="مثال: اكتمال أعمال الحفر" />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="المرحلة">
              <Select value={form.stage} onChange={(e) => set("stage", e.target.value)}>
                <option value="">— غير مرتبط بمرحلة —</option>
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="نسبة الإنجاز الجديدة (٪)" hint="اختياري">
              <Input
                type="number"
                min="0"
                max="100"
                value={form.new_progress}
                onChange={(e) => set("new_progress", e.target.value)}
                placeholder="0 - 100"
              />
            </Field>
          </div>
          <Field label="نص التحديث" required>
            <Textarea rows={5} value={form.body} onChange={(e) => set("body", e.target.value)} placeholder="اكتب تفاصيل التقدم…" />
          </Field>
          <Field label="مستوى الظهور">
            <Select value={form.visibility} onChange={(e) => set("visibility", e.target.value)}>
              <option value="public">عام — يظهر للمساهمين والعامة</option>
              <option value="internal">داخلي — للفريق فقط</option>
            </Select>
          </Field>
          <Field label="الصور" hint="يمكن اختيار أكثر من صورة">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImages(Array.from(e.target.files || []))}
              className="w-full text-body-sm text-on-surface-variant file:mr-0 file:ml-3 file:rounded-lg file:border-0 file:bg-surface-container-high file:px-4 file:py-2 file:text-label-md file:font-heading file:text-on-surface"
            />
            {images.length > 0 && (
              <span className="text-body-sm text-primary">{images.length} صورة محددة</span>
            )}
          </Field>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.notify_contributors}
              onChange={(e) => set("notify_contributors", e.target.checked)}
              className="w-4 h-4 accent-primary"
            />
            <span className="text-body-md text-on-surface">إشعار المساهمين عبر واتساب عند النشر</span>
          </label>
          {create.isError && (
            <p className="text-body-sm text-status-rejected">
              {create.error?.apiMessage || "تعذّر حفظ التحديث. تحقق من الحقول."}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
