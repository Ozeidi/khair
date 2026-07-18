import { Link } from "react-router-dom";
import { Icon, Button, Card } from "@/components/ui";

// «عن المنصة» — brand story: Transparent · Trustworthy · Methodical.

const PILLARS = [
  {
    icon: "visibility",
    tone: "bg-primary/10 text-primary",
    title: "الشفافية",
    body: "كل ريال يُسجَّل بوضوح في سجلات قابلة للتدقيق. نفصل بين التقدّم المالي والإنجاز الميداني حتى تعرف بالضبط أين وصلت مساهمتك.",
  },
  {
    icon: "verified_user",
    tone: "bg-secondary/10 text-secondary",
    title: "الموثوقية",
    body: "منهجية اعتماد صارمة للدفعات والمصروفات، وإيصالات موثّقة بروابط تحقّق فوري، لتمنحك ثقة مؤسسية كاملة في كل خطوة.",
  },
  {
    icon: "account_tree",
    tone: "bg-tertiary-container/20 text-tertiary",
    title: "المنهجية",
    body: "مسار منظّم من التبرّع إلى الأثر: مراحل تنفيذ موزونة، تحديثات دورية موثّقة بالصور، وتقارير مالية دقيقة لكل مشروع.",
  },
];

const TRANSPARENCY_MODEL = [
  {
    icon: "payments",
    title: "توثيق المساهمة",
    body: "تُسجَّل كل مساهمة برقم مرجعي فريد وتُربط بالمشروع، مع خيارات خصوصية تحدّد كيفية ظهور اسمك ومبلغك.",
  },
  {
    icon: "fact_check",
    title: "اعتماد الدفعات",
    body: "تمرّ كل دفعة بمراجعة مالية قبل اعتمادها، ثم يُحدَّث المؤشر المالي للمشروع تلقائيًا ويصدر إيصال موثّق.",
  },
  {
    icon: "timeline",
    title: "تتبّع التنفيذ",
    body: "يُقاس الإنجاز الميداني عبر مراحل موزونة بنِسب دقيقة، وتُنشر تحديثات مصوّرة توثّق تقدّم العمل على الأرض.",
  },
  {
    icon: "receipt_long",
    title: "الرقابة والتقارير",
    body: "تُقيَّد المصروفات مقابل ميزانية معتمدة، وتُتاح تقارير مالية عامة وإيصالات قابلة للتحقّق من صحتها بأي وقت.",
  },
];

const VISIBILITY_LEVELS = [
  {
    icon: "public",
    label: "بيانات عامة",
    desc: "الأهداف، المبالغ المجموعة، ونسب الإنجاز — متاحة للجميع بشفافية كاملة.",
    box: "bg-surface-container-lowest border-outline-variant",
  },
  {
    icon: "groups",
    label: "بيانات للمساهمين",
    desc: "تفاصيل الاشتراك والدفعات والإيصالات تظهر لصاحبها في لوحة التحكم.",
    box: "bg-surface-container-lowest border-outline-variant",
  },
  {
    icon: "visibility_off",
    label: "بيانات محمية",
    desc: "المعلومات الحساسة (كأرقام الحسابات) لا تُعرض علنًا وتخضع لضوابط الوصول.",
    box: "bg-transparency-private/40 border-outline-variant bg-hatched",
  },
];

const wrap =
  "max-w-container-max-width mx-auto px-margin-mobile md:px-margin-desktop";

export default function About() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative bg-surface overflow-hidden py-20 md:py-28 border-b border-outline-variant/40">
        <div className={`${wrap} relative z-10`}>
          <div className="max-w-3xl mx-auto text-center flex flex-col gap-stack-md">
            <span className="mx-auto inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-label-md font-heading font-bold w-fit">
              <Icon name="favorite" className="text-[18px]" filled />
              منصة الخير للإدارة الشفافة
            </span>
            <h1 className="text-display-lg font-heading text-on-surface">
              نبني الثقة <span className="text-primary">بالوضوح</span> لا بالوعود
            </h1>
            <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
              منصة الخير تربط المتبرّعين بالمشاريع التنموية عبر توثيق مالي دقيق
              وتتبّع ميداني منظّم، لتصل كل مساهمة إلى مستحقّيها بأثرٍ ملموس
              وقابلٍ للتحقّق.
            </p>
          </div>
        </div>
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute -top-1/4 -right-1/4 w-1/2 h-1/2 bg-primary-container rounded-full blur-[100px]" />
          <div className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 bg-secondary-container rounded-full blur-[100px]" />
        </div>
      </section>

      {/* Brand pillars */}
      <section className="py-16 md:py-24 bg-surface-container-lowest border-b border-outline-variant/40">
        <div className={wrap}>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-headline-lg font-heading text-on-surface mb-2">
              قيمنا الثلاث
            </h2>
            <p className="text-body-md text-on-surface-variant">
              شخصية المنصة تجمع دفء العمل الأهلي بدقّة المؤسسات المالية.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {PILLARS.map((p) => (
              <Card key={p.title} className="flex flex-col gap-3">
                <div className={`p-3 rounded-xl w-fit ${p.tone}`}>
                  <Icon name={p.icon} className="text-[26px]" filled />
                </div>
                <h3 className="text-headline-sm font-heading text-on-surface">
                  {p.title}
                </h3>
                <p className="text-body-md text-on-surface-variant leading-relaxed">
                  {p.body}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 md:py-24 bg-surface">
        <div className={wrap}>
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-16">
            <div className="lg:w-1/2 flex flex-col gap-5">
              <h2 className="text-headline-lg font-heading text-on-surface">
                رسالتنا
                <br />
                <span className="text-primary">أثرٌ موثّق لكل مساهمة</span>
              </h2>
              <p className="text-body-lg text-on-surface-variant leading-relaxed">
                نؤمن بأن الثقة تُبنى بالوضوح المالي. نظامنا يفصل بين التقدّم
                المالي والتنفيذ الميداني، ليكون المساهم على اطّلاع دائم بمسار
                عطائه من لحظة التبرّع حتى تحقّق الأثر.
              </p>
              <ul className="flex flex-col gap-4 pt-2">
                <MissionItem
                  icon="receipt_long"
                  tone="text-primary"
                  title="توثيق مالي دقيق"
                  body="كل ريال يُسجَّل في سجلات قابلة للتدقيق بأعلى معايير النزاهة المؤسسية."
                />
                <MissionItem
                  icon="timeline"
                  tone="text-secondary"
                  title="تتبّع مسار الأثر"
                  body="راقب تطوّر التنفيذ الميداني بنِسب مئوية دقيقة وتحديثات دورية مصوّرة."
                />
                <MissionItem
                  icon="qr_code_2"
                  tone="text-tertiary"
                  title="بيانات قابلة للتحقّق"
                  body="رمز تحقّق فوري لكل إيصال يتيح التأكد من صحّته في أي وقت."
                />
              </ul>
            </div>

            <div className="lg:w-1/2 w-full">
              <Card padded={false} className="p-8 flex flex-col gap-4">
                <h3 className="text-headline-sm font-heading text-on-surface text-right">
                  مستويات الظهور
                </h3>
                {VISIBILITY_LEVELS.map((v) => (
                  <div
                    key={v.label}
                    className={`flex flex-row-reverse items-start gap-3 p-4 rounded-lg border ${v.box}`}
                  >
                    <Icon
                      name={v.icon}
                      className="text-[22px] text-on-surface-variant mt-0.5"
                    />
                    <div className="text-right">
                      <p className="text-body-md font-heading font-bold text-on-surface">
                        {v.label}
                      </p>
                      <p className="text-body-sm text-on-surface-variant leading-snug">
                        {v.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Transparency model */}
      <section className="py-16 md:py-24 bg-surface-container-lowest border-y border-outline-variant/40">
        <div className={wrap}>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-headline-lg font-heading text-on-surface mb-2">
              نموذج الشفافية
            </h2>
            <p className="text-body-md text-on-surface-variant">
              أربع مراحل تضمن انتقال مساهمتك من التبرّع إلى الأثر بوضوح كامل.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
            {TRANSPARENCY_MODEL.map((m, i) => (
              <div
                key={m.title}
                className="relative bg-surface border border-outline-variant rounded-xl p-stack-md soft-shadow flex flex-col gap-3"
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

      {/* CTA */}
      <section className="py-16 md:py-20 bg-surface">
        <div className={wrap}>
          <Card className="bg-primary text-on-primary border-primary flex flex-col md:flex-row-reverse items-center justify-between gap-6 text-center md:text-right">
            <div className="flex flex-col gap-2">
              <h2 className="text-headline-md font-heading">
                كن جزءًا من التغيير الشفّاف
              </h2>
              <p className="text-body-md text-on-primary/80">
                تصفّح المشاريع التنموية وساهم بثقة في أثرٍ موثّق.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row-reverse gap-3 flex-shrink-0">
              <Button
                as={Link}
                to="/projects"
                variant="contribute"
                icon="grid_view"
              >
                استعرض المشاريع
              </Button>
              <Button
                as={Link}
                to="/reports/public"
                variant="ghost"
                icon="analytics"
              >
                التقارير العامة
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function MissionItem({ icon, tone, title, body }) {
  return (
    <li className="flex flex-row-reverse items-start gap-4">
      <div className={`p-2 bg-surface-container-high rounded-lg ${tone}`}>
        <Icon name={icon} />
      </div>
      <div className="text-right">
        <h4 className="text-headline-sm font-heading text-on-surface">
          {title}
        </h4>
        <p className="text-body-sm text-on-surface-variant leading-relaxed">
          {body}
        </p>
      </div>
    </li>
  );
}
