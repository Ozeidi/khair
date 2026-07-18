import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Icon,
  Button,
  ProgressBar,
  StatusBadge,
  Loading,
  ErrorState,
  EmptyState,
} from "@/components/ui";
import { PROJECT_STATUS } from "@/lib/status";
import {
  formatMoney,
  formatNumber,
  formatDate,
  formatDateTime,
  clampPercent,
} from "@/lib/format";

// Public project detail — models UI Samples/_2: breadcrumb + two-column RTL layout
// (main details on the right, sticky financial/contribution sidebar on the left).
export default function ProjectDetail() {
  const { slug } = useParams();

  const {
    data: project,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["public-project", slug],
    queryFn: async () => (await api.get(`/public/projects/${slug}/`)).data,
    enabled: !!slug,
  });

  // Share types come from a dedicated public endpoint (degrade gracefully if absent).
  const { data: shareTypesRaw } = useQuery({
    queryKey: ["public-project-share-types", slug],
    queryFn: async () =>
      (await api.get(`/public/projects/${slug}/share-types/`)).data,
    enabled: !!slug,
    retry: false,
  });

  if (isLoading) return <Loading label="جارٍ تحميل تفاصيل المشروع…" />;
  if (isError || !project) {
    return (
      <div className="max-w-container-max-width mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
        <ErrorState
          title="تعذّر تحميل المشروع"
          description="قد يكون المشروع غير متاح للعرض العام. حاول مرة أخرى."
          onRetry={refetch}
        />
      </div>
    );
  }

  const {
    name,
    reference,
    short_description,
    description,
    cover_image,
    status,
    location,
    state,
    beneficiaries_count,
    start_date,
    end_date,
    target_amount,
    collected_amount = 0,
    financial_progress = 0,
    execution_progress = 0,
    contributors_count,
    transparency = {},
    stages = [],
    updates = [],
    recent_contributors = [],
  } = project;

  // Transparency flags: default to true when not explicitly disabled.
  const show = (key, fallback = true) =>
    transparency && key in transparency ? !!transparency[key] : fallback;

  const showTarget = show("show_target");
  const showCollected = show("show_collected");
  const showRemaining = show("show_remaining");
  const showStages = show("show_stages");
  const showUpdates = show("show_updates");

  const remaining =
    project.remaining_amount != null
      ? project.remaining_amount
      : Math.max(0, Number(target_amount || 0) - Number(collected_amount || 0));

  const shareTypes = Array.isArray(shareTypesRaw)
    ? shareTypesRaw
    : shareTypesRaw?.results ?? [];

  const contributors = Array.isArray(recent_contributors)
    ? recent_contributors
    : recent_contributors?.results ?? [];

  const contributeTo = `/projects/${slug}/contribute`;

  return (
    <div className="max-w-container-max-width mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-label-md text-on-surface-variant mb-stack-md flex-row-reverse">
        <Link to="/projects" className="hover:text-primary transition-colors">
          المشاريع
        </Link>
        <Icon name="chevron_left" className="text-[16px]" />
        <span className="text-on-surface font-semibold truncate max-w-[60vw]">
          {name}
        </span>
      </nav>

      <div className="flex flex-col lg:flex-row-reverse gap-gutter">
        {/* Right column — main project details */}
        <div className="flex-grow flex flex-col gap-gutter lg:w-2/3">
          {/* Cover + header */}
          <div className="bg-surface-container-lowest rounded-xl soft-shadow border border-outline-variant overflow-hidden flex flex-col">
            <div className="relative w-full h-64 md:h-96 bg-surface-container-high">
              {cover_image ? (
                <div
                  className="bg-cover bg-center w-full h-full"
                  style={{ backgroundImage: `url('${cover_image}')` }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-outline">
                  <Icon name="image" className="text-5xl" />
                </div>
              )}
              <div className="absolute top-4 right-4">
                <StatusBadge
                  map={PROJECT_STATUS}
                  code={status}
                  className="bg-surface/90 backdrop-blur-sm border border-outline-variant"
                />
              </div>
            </div>

            <div className="p-gutter flex flex-col gap-stack-md">
              <div className="flex justify-between items-start gap-4 flex-row-reverse">
                <div className="flex flex-col gap-1 text-right">
                  <h1 className="text-headline-lg font-heading text-on-surface leading-tight">
                    {name}
                  </h1>
                  {reference && (
                    <span className="text-code-ref font-code-ref text-on-surface-variant">
                      {reference}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => shareProject(name)}
                  aria-label="مشاركة"
                  className="shrink-0 p-2 border border-outline-variant rounded-full text-on-surface-variant hover:text-primary hover:border-primary transition-all flex items-center justify-center"
                >
                  <Icon name="share" className="text-[20px]" />
                </button>
              </div>

              <p className="text-body-md text-on-surface-variant leading-relaxed text-right whitespace-pre-line">
                {description || short_description}
              </p>

              {/* Quick stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-stack-sm mt-stack-sm border-t border-outline-variant pt-stack-md">
                <QuickStat
                  icon="location_on"
                  label="الموقع"
                  value={location || state || "—"}
                />
                <QuickStat
                  icon="group"
                  label="المستفيدون"
                  value={
                    beneficiaries_count != null
                      ? formatNumber(beneficiaries_count)
                      : "—"
                  }
                />
                <QuickStat
                  icon="calendar_today"
                  label="البداية"
                  value={formatDate(start_date)}
                />
                <QuickStat
                  icon="flag"
                  label="النهاية المتوقعة"
                  value={formatDate(end_date)}
                />
              </div>
            </div>
          </div>

          {/* Transparency & execution */}
          {(showStages || showUpdates) && (
            <div className="bg-surface-container-lowest rounded-xl soft-shadow border border-outline-variant p-gutter flex flex-col gap-stack-md">
              <div className="flex items-center gap-2 border-b border-outline-variant pb-stack-sm flex-row-reverse">
                <Icon name="visibility" className="text-primary text-[22px]" />
                <h2 className="text-headline-md font-heading text-on-surface">
                  الشفافية والتنفيذ
                </h2>
              </div>

              <div className="flex flex-col gap-stack-lg mt-2">
                {showStages && (
                  <div>
                    <ProgressBar
                      tone="execution"
                      value={execution_progress}
                      label="نسبة الإنجاز التنفيذي"
                    />
                    {stages.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-sm mt-stack-md">
                        {stages.map((stage) => (
                          <StageRow key={stage.id} stage={stage} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-label-md text-on-surface-variant mt-3 text-right">
                        لم تُضف مراحل تنفيذية بعد.
                      </p>
                    )}
                  </div>
                )}

                {showUpdates && (
                  <div>
                    <h3 className="text-body-lg font-heading font-semibold text-on-surface mb-stack-sm text-right">
                      آخر التحديثات الميدانية
                    </h3>
                    {updates.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-sm">
                        {updates.slice(0, 6).map((update) => (
                          <UpdateCard key={update.id} update={update} />
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        icon="photo_library"
                        title="لا توجد تحديثات بعد"
                        description="سيتم نشر مستجدات التنفيذ الميداني هنا فور توفرها."
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Left column — financial + contribution sidebar */}
        <div className="lg:w-1/3 flex flex-col gap-gutter lg:sticky lg:top-gutter h-fit">
          {/* Financial summary */}
          <div className="bg-surface-container-lowest rounded-xl soft-shadow border border-outline-variant p-gutter flex flex-col gap-stack-md">
            <h3 className="text-headline-sm font-heading font-semibold text-on-surface border-b border-outline-variant pb-stack-sm text-right">
              الموقف المالي
            </h3>

            <div className="flex flex-col gap-3">
              {showTarget && (
                <div className="flex justify-between items-center flex-row-reverse">
                  <span className="text-label-md text-on-surface-variant">
                    الهدف الإجمالي
                  </span>
                  <span className="text-body-lg font-bold text-on-surface">
                    {formatMoney(target_amount)}
                  </span>
                </div>
              )}

              {showCollected && (
                <div>
                  <ProgressBar
                    tone="financial"
                    value={financial_progress}
                    label="تم جمعه"
                    size="lg"
                  />
                  <div className="flex justify-between items-center mt-1 flex-row-reverse">
                    <span className="text-label-md text-on-surface-variant">
                      المُحصّل
                    </span>
                    <span className="text-body-md font-semibold text-primary">
                      {formatMoney(collected_amount)}
                    </span>
                  </div>
                </div>
              )}

              {showRemaining && showTarget && (
                <div className="flex justify-between items-center bg-surface-container-low p-2 rounded-lg border border-outline-variant mt-2 flex-row-reverse">
                  <span className="text-label-md text-on-surface-variant">
                    المبلغ المتبقي
                  </span>
                  <span className="text-body-md font-bold text-status-pending">
                    {formatMoney(remaining)}
                  </span>
                </div>
              )}

              {contributors_count != null && (
                <div className="flex justify-between items-center flex-row-reverse">
                  <span className="text-label-md text-on-surface-variant">
                    عدد المساهمين
                  </span>
                  <span className="text-body-md font-semibold text-on-surface">
                    {formatNumber(contributors_count)}
                  </span>
                </div>
              )}
            </div>

            <Button
              as={Link}
              to={contributeTo}
              variant="contribute"
              size="lg"
              icon="volunteer_activism"
              iconFlip
              className="w-full mt-1"
            >
              ساهم الآن
            </Button>

            <div className="flex items-center justify-center gap-2 text-label-md text-on-surface-variant">
              <Icon
                name="verified_user"
                className="text-[16px] text-status-approved"
              />
              <span>مدفوعات آمنة وموثّقة</span>
            </div>
          </div>

          {/* Share types */}
          <div className="bg-surface-container-lowest rounded-xl soft-shadow border border-outline-variant p-gutter flex flex-col gap-stack-sm">
            <h3 className="text-body-lg font-heading font-semibold text-on-surface text-right">
              أنواع المساهمة
            </h3>
            {shareTypes.length > 0 ? (
              <div className="flex flex-col border border-outline-variant rounded-lg overflow-hidden">
                {shareTypes.map((st, i) => (
                  <Link
                    key={st.id ?? i}
                    to={contributeTo}
                    className={`flex items-center justify-between p-3 flex-row-reverse hover:bg-surface-container-low transition-colors ${
                      i < shareTypes.length - 1
                        ? "border-b border-outline-variant"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-row-reverse min-w-0">
                      <div className="w-8 h-8 shrink-0 rounded-lg bg-tertiary-container/10 border border-outline-variant flex items-center justify-center">
                        <Icon
                          name="workspace_premium"
                          className="text-tertiary text-[18px]"
                        />
                      </div>
                      <span className="text-body-md font-semibold text-on-surface truncate">
                        {st.name}
                      </span>
                    </div>
                    <span className="text-body-md text-on-surface-variant whitespace-nowrap">
                      {formatMoney(st.value)}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-label-md text-on-surface-variant text-right py-2">
                لا توجد أنواع مساهمة محددة — يمكنك المساهمة بمبلغ مفتوح.
              </p>
            )}
          </div>

          {/* Recent contributors */}
          {contributors.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl soft-shadow border border-outline-variant p-gutter flex flex-col gap-stack-sm">
              <h3 className="text-body-lg font-heading font-semibold text-on-surface text-right">
                أحدث المساهمين
              </h3>
              <div className="flex flex-col gap-3">
                {contributors.slice(0, 6).map((c, i) => (
                  <ContributorRow key={c.id ?? i} contributor={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickStat({ icon, label, value }) {
  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2 text-on-surface-variant text-label-md flex-row-reverse">
        <Icon name={icon} className="text-[16px]" />
        <span>{label}</span>
      </div>
      <span className="text-body-md font-semibold text-on-surface mt-1 text-right">
        {value}
      </span>
    </div>
  );
}

const STAGE_TONE = {
  completed: "bg-status-completed",
  in_progress: "bg-status-pending",
  delayed: "bg-status-delayed",
  pending: "bg-outline-variant",
};
const STAGE_LABEL = {
  completed: "مكتمل",
  in_progress: "جارٍ",
  delayed: "متأخر",
  pending: "قادم",
};

function StageRow({ stage }) {
  const tone = STAGE_TONE[stage.status] || STAGE_TONE.pending;
  return (
    <div className="border border-outline-variant rounded-lg p-3 flex flex-col gap-2 bg-surface">
      <div className="flex items-center justify-between gap-2 flex-row-reverse">
        <div className="flex items-center gap-2 flex-row-reverse min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${tone}`} />
          <span className="text-label-md font-semibold text-on-surface truncate">
            {stage.name}
          </span>
        </div>
        <span className="text-label-md text-on-surface-variant whitespace-nowrap">
          {STAGE_LABEL[stage.status] || "—"}
        </span>
      </div>
      <ProgressBar
        tone="execution"
        value={stage.progress}
        showValue={false}
        size="sm"
      />
      <span className="text-code-ref font-code-ref text-on-surface-variant text-right">
        {Math.round(clampPercent(stage.progress))}٪
      </span>
    </div>
  );
}

function UpdateCard({ update }) {
  const image =
    update.images?.[0]?.image || update.cover_image || update.image || null;
  return (
    <div className="border border-outline-variant rounded-lg overflow-hidden bg-surface flex flex-col">
      {image ? (
        <div
          className="bg-cover bg-center w-full h-32"
          style={{ backgroundImage: `url('${image}')` }}
        />
      ) : (
        <div className="w-full h-32 bg-surface-container-high flex items-center justify-center text-outline">
          <Icon name="photo_camera" className="text-3xl" />
        </div>
      )}
      <div className="p-3 flex flex-col gap-1">
        <h4 className="text-label-md font-semibold text-on-surface text-right line-clamp-1">
          {update.title}
        </h4>
        {update.body && (
          <p className="text-body-sm text-on-surface-variant text-right line-clamp-2">
            {update.body}
          </p>
        )}
        <span className="text-code-ref font-code-ref text-on-surface-variant text-right mt-1">
          {formatDateTime(update.published_at || update.created_at)}
        </span>
      </div>
    </div>
  );
}

function ContributorRow({ contributor }) {
  // Respect privacy: hidden name -> "فاعل خير", hidden amount -> "مبلغ مخفي".
  const pref = contributor.public_name_preference;
  const anonymous = pref === "anonymous" || contributor.is_anonymous;
  const hiddenAmount = pref === "hidden_amount" || contributor.hide_amount;

  const displayName = anonymous
    ? "فاعل خير"
    : contributor.public_name || contributor.name || "مساهم";
  const initial = anonymous ? null : displayName.trim().charAt(0);

  return (
    <div className="flex items-center justify-between flex-row-reverse">
      <div className="flex items-center gap-2 flex-row-reverse min-w-0">
        {anonymous ? (
          <div className="w-8 h-8 shrink-0 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center">
            <Icon
              name="person_off"
              className="text-[16px] text-on-surface-variant"
            />
          </div>
        ) : (
          <div className="w-8 h-8 shrink-0 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-sm">
            {initial}
          </div>
        )}
        <span
          className={`text-body-sm text-on-surface truncate ${
            anonymous ? "italic text-on-surface-variant" : ""
          }`}
        >
          {displayName}
        </span>
      </div>

      {hiddenAmount || contributor.amount == null ? (
        <div className="flex items-center gap-1 text-on-surface-variant flex-row-reverse shrink-0">
          <Icon name="visibility_off" className="text-[14px]" />
          <span className="text-code-ref font-code-ref text-xs">مبلغ مخفي</span>
        </div>
      ) : (
        <span className="text-body-sm font-semibold text-on-surface-variant whitespace-nowrap">
          {formatMoney(contributor.amount)}
        </span>
      )}
    </div>
  );
}

// Native share sheet with clipboard fallback.
function shareProject(title) {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {});
  }
}
