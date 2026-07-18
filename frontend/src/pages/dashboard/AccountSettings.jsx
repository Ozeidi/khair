import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import PageHeader from "@/components/ui/PageHeader";
import { Icon, Card, CardHeader, Button, Field, Input } from "@/components/ui";

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-surface-container-high"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-surface-container-lowest shadow-sm transition-transform ${
          checked ? "-translate-x-1" : "-translate-x-5"
        }`}
      />
    </button>
  );
}

function PrefRow({ icon, title, description, checked, onChange, disabled }) {
  return (
    <div className="flex flex-row-reverse items-start justify-between gap-4 py-stack-md border-b border-outline-variant last:border-0">
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      <div className="flex items-start gap-3 flex-1">
        <div className="p-2 bg-surface-container-high rounded-lg text-on-surface-variant shrink-0">
          <Icon name={icon} className="text-[20px]" />
        </div>
        <div>
          <p className="text-label-md font-heading font-bold text-on-surface">{title}</p>
          <p className="text-body-sm text-on-surface-variant mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}

export default function AccountSettings() {
  const { user, setUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [prefs, setPrefs] = useState({
    notify_dues: true,
    notify_updates: true,
    notify_campaigns: false,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name || user.name || "");
    setPrefs({
      notify_dues: user.notify_dues ?? true,
      notify_updates: user.notify_updates ?? true,
      notify_campaigns: user.notify_campaigns ?? false,
    });
  }, [user]);

  const save = useMutation({
    mutationFn: async (payload) => (await api.patch("/me/", payload)).data,
    onMutate: () => {
      setSaved(false);
      setError("");
    },
    onSuccess: (data) => {
      const updated = data?.user || data;
      if (updated && setUser) setUser(updated);
      setSaved(true);
    },
    onError: (err) => setError(err?.apiMessage || "تعذّر حفظ التغييرات. حاول مجددًا."),
  });

  function submit(e) {
    e.preventDefault();
    save.mutate({ full_name: fullName, ...prefs });
  }

  function setPref(key, val) {
    setPrefs((p) => ({ ...p, [key]: val }));
    setSaved(false);
  }

  return (
    <div>
      <PageHeader
        title="الخصوصية والإشعارات"
        subtitle="أدر بياناتك الشخصية وتفضيلات الإشعارات وخصوصيتك."
      />

      <form onSubmit={submit} className="grid grid-cols-1 lg:grid-cols-3 gap-gutter items-start">
        <div className="lg:col-span-2 space-y-gutter">
          {/* Profile */}
          <Card>
            <CardHeader title="البيانات الشخصية" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-stack-md">
              <Field label="الاسم الكامل" required>
                <Input
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setSaved(false);
                  }}
                  placeholder="اكتب اسمك"
                />
              </Field>
              <Field label="رقم الجوال" hint="لا يمكن تغييره من هنا — تواصل مع الدعم.">
                <Input value={user?.phone || ""} disabled className="opacity-70" />
              </Field>
            </div>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader title="تفضيلات الإشعارات" />
            <div>
              <PrefRow
                icon="event_upcoming"
                title="تنبيهات الاستحقاقات"
                description="إشعارك قبل حلول موعد استحقاق القسط وعند تأخره."
                checked={prefs.notify_dues}
                onChange={(v) => setPref("notify_dues", v)}
                disabled={save.isPending}
              />
              <PrefRow
                icon="campaign"
                title="تحديثات المشاريع"
                description="آخر مستجدات المشاريع التي ساهمت فيها."
                checked={prefs.notify_updates}
                onChange={(v) => setPref("notify_updates", v)}
                disabled={save.isPending}
              />
              <PrefRow
                icon="mail"
                title="الحملات والرسائل"
                description="حملات المنصة والدعوات للمساهمة في مشاريع جديدة."
                checked={prefs.notify_campaigns}
                onChange={(v) => setPref("notify_campaigns", v)}
                disabled={save.isPending}
              />
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <Button type="submit" icon="save" disabled={save.isPending}>
              {save.isPending ? "جارٍ الحفظ…" : "حفظ التغييرات"}
            </Button>
            {saved && (
              <span className="flex items-center gap-1 text-body-sm text-status-completed">
                <Icon name="check_circle" className="text-[18px]" />
                تم الحفظ
              </span>
            )}
            {error && (
              <span className="flex items-center gap-1 text-body-sm text-status-rejected">
                <Icon name="error" className="text-[18px]" />
                {error}
              </span>
            )}
          </div>
        </div>

        {/* Privacy note */}
        <aside className="lg:col-span-1">
          <Card className="bg-surface-container-low">
            <div className="flex items-center gap-2 mb-stack-md text-secondary">
              <Icon name="shield" filled className="text-[22px]" />
              <h2 className="text-headline-sm font-heading text-on-surface">خصوصيتك محفوظة</h2>
            </div>
            <ul className="space-y-3 text-body-sm text-on-surface-variant">
              <li className="flex items-start gap-2">
                <Icon name="lock" className="text-[18px] text-primary mt-0.5" />
                لا نعرض رقم جوالك أو حسابك البنكي أو إثباتات الدفع علنًا أبدًا.
              </li>
              <li className="flex items-start gap-2">
                <Icon name="visibility_off" className="text-[18px] text-primary mt-0.5" />
                يمكنك اختيار الظهور كـ«فاعل خير» أو إخفاء المبلغ في كل اشتراك على حدة.
              </li>
              <li className="flex items-start gap-2">
                <Icon name="verified_user" className="text-[18px] text-primary mt-0.5" />
                تُستخدم بياناتك فقط لإصدار الإيصالات والتواصل بشأن مساهماتك.
              </li>
            </ul>
          </Card>
        </aside>
      </form>
    </div>
  );
}
