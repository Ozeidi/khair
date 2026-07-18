import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Icon, Button, ProjectCard, Loading, EmptyState, ErrorState } from "@/components/ui";
import Brand from "@/components/Brand";
import { formatMoney, formatNumber } from "@/lib/format";

// Public landing page (modeled on UI Samples/_4).
// Hero + platform-stats bento + latest projects grid + "transparency first" section.

// Pick the first defined value across several candidate field names — the public
// stats endpoint shape isn't finalized, so stay defensive about key naming.
function pick(obj, keys, fallback = 0) {
  for (const k of keys) {
    if (obj && obj[k] != null) return obj[k];
  }
  return fallback;
}

function StatTile({ icon, tone, label, children }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary-container/40 text-secondary",
    tertiary: "bg-tertiary-container/20 text-tertiary",
  };
  return (
    <div className="bg-surface border border-outline-variant/50 rounded-2xl p-6 flex flex-col items-start gap-4">
      <div className={`p-3 rounded-lg ${tones[tone]}`}>
        <Icon name={icon} filled />
      </div>
      <div>
        <p className="text-label-md font-heading text-on-surface-variant mb-1">{label}</p>
        <h3 className="text-headline-lg font-heading text-on-surface">{children}</h3>
      </div>
    </div>
  );
}

function Feature({ icon, tone, title, description }) {
  const tones = {
    primary: "text-primary",
    secondary: "text-secondary",
    tertiary: "text-tertiary",
  };
  return (
    <li className="flex flex-row-reverse items-start gap-4 text-right">
      <div className={`p-2 bg-surface-variant rounded-lg ${tones[tone]}`}>
        <Icon name={icon} />
      </div>
      <div>
        <h4 className="text-headline-sm font-heading text-on-surface">{title}</h4>
        <p className="text-body-sm text-on-surface-variant">{description}</p>
      </div>
    </li>
  );
}

export default function Home() {
  const statsQuery = useQuery({
    queryKey: ["public", "stats"],
    queryFn: async () => (await api.get("/public/stats/")).data,
  });

  const projectsQuery = useQuery({
    queryKey: ["public", "projects", "latest"],
    queryFn: async () =>
      (await api.get("/public/projects/", { params: { ordering: "-published_at" } })).data,
  });

  const stats = statsQuery.data ?? {};
  const projects = (projectsQuery.data?.results ?? projectsQuery.data ?? []).slice(0, 6);

  const totalContributions = pick(stats, [
    "total_documented_contributions",
    "total_contributions",
    "documented_total",
    "total_collected",
    "collected_amount",
  ]);
  const activeProjects = pick(stats, [
    "active_projects",
    "active_projects_count",
    "projects_count",
    "total_projects",
  ]);
  const beneficiaries = pick(stats, [
    "beneficiaries",
    "beneficiaries_count",
    "total_beneficiaries",
  ]);

  return (
    <div className="bg-background text-on-background">
      {/* Hero */}
      <section className="relative bg-surface overflow-hidden py-24 md:py-32">
        {/* Blurred background blobs */}
        <div className="absolute inset-0 w-full h-full pointer-events-none opacity-30" aria-hidden="true">
          <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-primary-container rounded-full blur-[100px]" />
          <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-secondary-container rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 w-full max-w-container-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="max-w-3xl mx-auto text-center space-y-stack-lg">
            <h1 className="text-display-lg font-heading text-on-surface">
              شارك في تغيير العالم بأسهم خيرية <span className="text-primary">شفافة</span>
            </h1>
            <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              منصة الخير للإدارة الشفافة تربط المتبرعين بالمشاريع التنموية مع توثيق مالي دقيق
              لضمان وصول كل مساهمة لمستحقيها بفاعلية.
            </p>
            <div className="flex flex-col sm:flex-row-reverse justify-center items-center gap-4 pt-4">
              <Button
                as={Link}
                to="/projects"
                variant="primary"
                size="lg"
                icon="arrow_forward"
                iconFlip
                iconTrailing
                className="w-full sm:w-auto"
              >
                ابدأ المساهمة الآن
              </Button>
              <Button
                as={Link}
                to="/login"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                ابدأ مشروعاً
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Platform statistics — bento grid */}
      <section className="py-16 bg-surface-container-lowest border-y border-outline-variant/30">
        <div className="w-full max-w-container-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          {statsQuery.isError ? (
            <ErrorState
              title="تعذّر تحميل الإحصائيات"
              description="سنعرضها بمجرد توفرها."
              onRetry={statsQuery.refetch}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatTile icon="payments" tone="primary" label="إجمالي المساهمات الموثقة">
                {statsQuery.isLoading ? "…" : formatMoney(totalContributions)}
              </StatTile>
              <StatTile icon="view_cozy" tone="secondary" label="مشاريع تنموية نشطة">
                {statsQuery.isLoading ? "…" : `${formatNumber(activeProjects)} مشروع`}
              </StatTile>
              <StatTile icon="group" tone="tertiary" label="المستفيدين الموثقين">
                {statsQuery.isLoading ? "…" : `${formatNumber(beneficiaries)} مستفيد`}
              </StatTile>
            </div>
          )}
        </div>
      </section>

      {/* Latest projects */}
      <section className="py-24 bg-surface">
        <div className="w-full max-w-container-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="flex flex-row-reverse justify-between items-end mb-12 gap-4">
            <div className="text-right">
              <h2 className="text-headline-lg font-heading text-on-surface mb-2">
                أحدث المشاريع التنموية
              </h2>
              <p className="text-body-md text-on-surface-variant">
                ساهم في مشاريع موثقة وشفافة ذات أثر مستدام.
              </p>
            </div>
            <Link
              to="/projects"
              className="hidden sm:flex items-center gap-2 text-primary font-heading text-label-md hover:underline whitespace-nowrap"
            >
              عرض جميع المشاريع
              <Icon name="arrow_forward" flip className="text-sm" />
            </Link>
          </div>

          {projectsQuery.isLoading ? (
            <Loading label="جارٍ تحميل المشاريع…" />
          ) : projectsQuery.isError ? (
            <ErrorState
              title="تعذّر تحميل المشاريع"
              description="يرجى المحاولة مرة أخرى."
              onRetry={projectsQuery.refetch}
            />
          ) : projects.length === 0 ? (
            <EmptyState
              icon="view_cozy"
              title="لا توجد مشاريع بعد"
              description="ستظهر هنا أحدث المشاريع التنموية عند إطلاقها."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {projects.map((project) => (
                <ProjectCard key={project.public_slug || project.id} project={project} />
              ))}
            </div>
          )}

          <div className="mt-10 flex sm:hidden justify-center">
            <Button as={Link} to="/projects" variant="secondary" icon="arrow_forward" iconFlip iconTrailing>
              عرض جميع المشاريع
            </Button>
          </div>
        </div>
      </section>

      {/* Why us — transparency first */}
      <section className="py-24 bg-surface-container-lowest border-t border-outline-variant/30">
        <div className="w-full max-w-container-max-width mx-auto px-margin-mobile md:px-margin-desktop">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-16">
            <div className="lg:w-1/2 space-y-6 text-right">
              <h2 className="text-headline-lg font-heading text-on-surface">
                لماذا نحن؟ <br />
                <span className="text-primary">الشفافية أولاً</span>
              </h2>
              <p className="text-body-lg text-on-surface-variant">
                نحن نؤمن بأن الثقة تُبنى بالوضوح المالي. منصتنا تتبنى نموذجاً دقيقاً يفصل بين التقدم
                المالي والتنفيذ الميداني، لتكون على اطلاع دائم بمسار مساهمتك من لحظة التبرع وحتى تحقيق
                الأثر.
              </p>
              <ul className="space-y-4 pt-4">
                <Feature
                  icon="receipt_long"
                  tone="primary"
                  title="توثيق مالي دقيق"
                  description="كل ريال يُسجل بوضوح في سجلات قابلة للتدقيق، مما يضمن أعلى معايير النزاهة المؤسسية."
                />
                <Feature
                  icon="timeline"
                  tone="secondary"
                  title="تتبع مسار الأثر"
                  description="راقب تطور التنفيذ الميداني للمشاريع بنسب مئوية دقيقة وتحديثات دورية موثقة بالصور."
                />
                <Feature
                  icon="verified_user"
                  tone="tertiary"
                  title="بيانات قابلة للتحقق"
                  description="نظام مزود برمز استجابة سريعة (QR) لكل إيصال للتحقق من صحته فورياً."
                />
              </ul>
            </div>

            {/* Abstract trust / data visual */}
            <div className="lg:w-1/2 w-full">
              <div className="relative w-full aspect-square max-w-md mx-auto bg-surface border border-outline-variant/40 rounded-3xl p-8 flex flex-col justify-center items-center soft-shadow overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#bfc9c2_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
                <div className="mb-8 z-10 opacity-90">
                  <Brand to={null} showText={false} size="lg" />
                </div>

                <div className="w-full space-y-4 z-10">
                  {/* Public / verified */}
                  <div className="h-12 w-full border border-outline-variant/50 rounded-lg flex items-center justify-between px-4 bg-surface-container-lowest">
                    <div className="h-2 w-1/3 bg-surface-variant rounded-full" />
                    <div className="flex items-center gap-2">
                      <Icon name="check_circle" className="text-status-approved text-sm" />
                      <div className="h-2 w-16 bg-primary-container rounded-full" />
                    </div>
                  </div>
                  {/* Public / visible */}
                  <div className="h-12 w-full border border-outline-variant/50 rounded-lg flex items-center justify-between px-4 bg-surface-container-lowest">
                    <div className="h-2 w-1/2 bg-surface-variant rounded-full" />
                    <div className="flex items-center gap-2">
                      <Icon name="visibility" className="text-on-surface-variant text-sm" />
                      <div className="h-2 w-12 bg-secondary-container rounded-full" />
                    </div>
                  </div>
                  {/* Private / hatched */}
                  <div className="h-12 w-full border border-outline-variant/50 rounded-lg flex items-center justify-between px-4 bg-surface-container-lowest bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(226,232,240,0.5)_4px,rgba(226,232,240,0.5)_8px)]">
                    <div className="h-2 w-1/4 bg-surface-variant rounded-full" />
                    <div className="flex items-center gap-2">
                      <Icon name="visibility_off" className="text-outline text-sm" />
                      <div className="h-2 w-8 bg-surface-variant rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
