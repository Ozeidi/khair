import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Icon, Button, Card, StatCard, Loading, ErrorState } from "@/components/ui";
import { formatMoney, formatNumber } from "@/lib/format";

// التقارير العامة — public transparency landing backed by /public/stats/.

const wrap =
  "max-w-container-max-width mx-auto px-margin-mobile md:px-margin-desktop";

// Pull a value from the stats object across a few likely key names.
function pick(stats, keys, fallback = 0) {
  for (const k of keys) {
    if (stats?.[k] !== undefined && stats?.[k] !== null) return stats[k];
  }
  return fallback;
}

const MODEL_STEPS = [
  {
    icon: "payments",
    title: "توثيق كل مساهمة",
    body: "تُسجَّل المساهمات برقم مرجعي فريد وتُربط بالمشروع مباشرة.",
  },
  {
    icon: "fact_check",
    title: "اعتماد مالي مراجَع",
    body: "لا يُحتسب أي مبلغ ضمن المجموع إلا بعد مراجعته واعتماده.",
  },
  {
    icon: "timeline",
    title: "تتبّع الإنجاز الميداني",
    body: "نِسب موزونة وتحديثات مصوّرة توثّق تقدّم العمل على الأرض.",
  },
  {
    icon: "verified",
    title: "إيصالات قابلة للتحقّق",
    body: "كل إيصال يحمل رمز تحقّق يتيح التأكد من صحّته فورًا.",
  },
];

export default function PublicReports() {
  const statsQuery = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => (await api.get("/public/stats/")).data,
  });

  const stats = statsQuery.data || {};

  const totalCollected = pick(stats, [
    "total_collected",
    "collected_amount",
    "total_contributions",
    "total_raised",
  ]);
  const activeProjects = pick(stats, [
    "active_projects",
    "projects_count",
    "total_projects",
    "projects",
  ]);
  const beneficiaries = pick(stats, [
    "beneficiaries",
    "beneficiaries_count",
    "total_beneficiaries",
  ]);
  const contributors = pick(stats, [
    "contributors",
    "contributors_count",
    "total_contributors",
  ]);
  const organizations = pick(stats, [
    "organizations",
    "organizations_count",
    "total_organizations",
  ]);
  const completedProjects = pick(stats, [
    "completed_projects",
    "projects_completed",
  ]);

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="bg-surface border-b border-outline-variant/40 py-16 md:py-20">
        <div className={wrap}>
          <div className="max-w-3xl flex flex-col gap-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-label-md font-heading font-bold w-fit">
              <Icon name="analytics" className="text-[18px]" filled />
              التقارير العامة والشفافية
            </span>
            <h1 className="text-display-lg font-heading text-on-surface">
              أرقامٌ <span className="text-primary">موثّقة</span> لأثرٍ حقيقي
            </h1>
            <p className="text-body-lg text-on-surface-variant">
              نعرض هنا إجماليات المنصة كما هي في سجلاتنا المالية القابلة
              للتدقيق. كل رقم يعكس مساهمات معتمدة ومشاريع موثّقة، لتطمئن إلى أن
              عطاءك يصل حيث يجب.
            </p>
          </div>
        </div>
      </section>

      {/* Aggregate cards */}
      <section className="py-16 md:py-20 bg-surface-container-lowest border-b border-outline-variant/40">
        <div className={wrap}>
          {statsQuery.isLoading ? (
            <Loading label="جارٍ تحميل الإحصاءات…" />
          ) : statsQuery.isError ? (
            <ErrorState
              title="تعذّر تحميل الإحصاءات"
              description="حدث خطأ أثناء جلب بيانات المنصة، يرجى المحاولة مجددًا."
              onRetry={() => statsQuery.refetch()}
            />
          ) : (
            <div className="flex flex-col gap-gutter">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                <StatCard
                  icon="payments"
                  tone="primary"
                  label="إجمالي المساهمات الموثّقة"
                  value={formatMoney(totalCollected)}
                />
                <StatCard
                  icon="view_cozy"
                  tone="secondary"
                  label="المشاريع التنموية النشطة"
                  value={formatNumber(activeProjects)}
                  unit="مشروع"
                />
                <StatCard
                  icon="group"
                  tone="tertiary"
                  label="المستفيدون الموثّقون"
                  value={formatNumber(beneficiaries)}
                  unit="مستفيد"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
                <StatCard
                  icon="volunteer_activism"
                  tone="primary"
                  label="عدد المساهمين"
                  value={formatNumber(contributors)}
                  unit="مساهم"
                />
                <StatCard
                  icon="corporate_fare"
                  tone="neutral"
                  label="الجهات المشاركة"
                  value={formatNumber(organizations)}
                  unit="جهة"
                />
                <StatCard
                  icon="task_alt"
                  tone="secondary"
                  label="المشاريع المكتملة"
                  value={formatNumber(completedProjects)}
                  unit="مشروع"
                />
              </div>
              <p className="text-body-sm text-on-surface-variant flex items-center gap-2 pt-1">
                <Icon name="update" className="text-[16px]" />
                تُحدَّث هذه الأرقام تلقائيًا مع كل دفعة معتمدة في سجلات المنصة.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Transparency model */}
      <section className="py-16 md:py-24 bg-surface">
        <div className={wrap}>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-headline-lg font-heading text-on-surface mb-2">
              كيف نضمن الشفافية؟
            </h2>
            <p className="text-body-md text-on-surface-variant">
              نموذج من أربع مراحل يربط كل مساهمة بأثرها الموثّق.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {MODEL_STEPS.map((m, i) => (
              <div
                key={m.title}
                className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-md soft-shadow flex flex-col gap-3"
              >
                <div className="flex flex-row-reverse justify-between items-start">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary w-fit">
                    <Icon name={m.icon} />
                  </div>
                  <span className="text-display-lg font-heading text-outline-variant leading-none">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-headline-sm font-heading text-on-surface">
                  {m.title}
                </h3>
                <p className="text-body-sm text-on-surface-variant leading-relaxed">
                  {m.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verify + explore */}
      <section className="pb-16 md:pb-20 bg-surface">
        <div className={wrap}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
            <Card className="flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-tertiary-container/20 text-tertiary w-fit">
                <Icon name="qr_code_2" className="text-[26px]" />
              </div>
              <h3 className="text-headline-sm font-heading text-on-surface">
                تحقّق من إيصالك
              </h3>
              <p className="text-body-md text-on-surface-variant">
                أدخل رمز الإيصال للتأكد من صحّته وربطه بالمشروع والمبلغ الموثّق.
              </p>
              <Button
                as={Link}
                to="/verify"
                variant="secondary"
                icon="verified"
                className="w-fit mt-1"
              >
                التحقّق من إيصال
              </Button>
            </Card>

            <Card className="flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-primary/10 text-primary w-fit">
                <Icon name="grid_view" className="text-[26px]" />
              </div>
              <h3 className="text-headline-sm font-heading text-on-surface">
                استعرض المشاريع
              </h3>
              <p className="text-body-md text-on-surface-variant">
                لكل مشروع صفحته الخاصة بمؤشراته المالية والتنفيذية وتحديثاته
                الميدانية.
              </p>
              <Button
                as={Link}
                to="/projects"
                variant="primary"
                icon="arrow_back"
                iconFlip
                className="w-fit mt-1"
              >
                تصفّح المشاريع
              </Button>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
