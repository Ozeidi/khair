import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import Brand from "@/components/Brand";
import { Icon, Button, Field, Input } from "@/components/ui";

const OTP_TTL = 300;
const RESEND_COOLDOWN = 60;

function MethodTabs({ method, setMethod, disabled }) {
  const tabs = [
    { key: "email", label: "بالبريد وكلمة المرور", icon: "mail" },
    { key: "phone", label: "برقم الجوال", icon: "smartphone" },
  ];
  return (
    <div className="flex gap-1 p-1 mb-stack-md rounded-xl bg-surface-container-low">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          disabled={disabled}
          onClick={() => setMethod(t.key)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-label-md font-heading transition-colors disabled:opacity-50 ${
            method === t.key
              ? "bg-surface-container-lowest text-primary font-bold soft-shadow"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Icon name={t.icon} className="text-[18px]" />
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function Register() {
  const { register, requestOtp, verifyOtp, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  const [method, setMethod] = useState("email"); // "email" | "phone"

  // Email registration fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneOpt, setPhoneOpt] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // Phone/OTP registration
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [otpName, setOtpName] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);

  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  useEffect(() => {
    if (method !== "phone" || step !== "otp") return undefined;
    const id = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : 0));
      setExpiresIn((e) => (e > 0 ? e - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [method, step]);

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function switchMethod(m) {
    setMethod(m);
    setError("");
    setFieldErrors({});
  }

  // ---- Email registration ----
  async function submitEmail(e) {
    e?.preventDefault();
    setError("");
    setFieldErrors({});
    if (!fullName.trim()) return setError("يرجى إدخال الاسم الكامل.");
    if (!email.trim()) return setError("يرجى إدخال البريد الإلكتروني.");
    if (password.length < 8) return setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
    if (password !== confirm) return setError("كلمتا المرور غير متطابقتين.");

    setSubmitting(true);
    try {
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        phone: phoneOpt.trim(),
      });
      navigate(from, { replace: true });
    } catch (err) {
      setFieldErrors(err.apiFields || {});
      setError(err.apiMessage || "تعذّر إنشاء الحساب. تحقق من البيانات.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Phone/OTP registration ----
  async function sendOtp(e) {
    e?.preventDefault();
    setError("");
    if (!phone.trim()) return setError("يرجى إدخال رقم الجوال.");
    setSubmitting(true);
    try {
      await requestOtp(phone.trim(), "register");
      setStep("otp");
      setCode("");
      setCountdown(RESEND_COOLDOWN);
      setExpiresIn(OTP_TTL);
    } catch (err) {
      setError(err.apiMessage || "تعذّر إرسال رمز التحقق. حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitOtp(e) {
    e?.preventDefault();
    setError("");
    const clean = code.replace(/\D/g, "");
    if (clean.length < 4) return setError("أدخل رمز التحقق المكوّن من 4 أرقام.");
    setSubmitting(true);
    try {
      await verifyOtp(phone.trim(), clean, otpName.trim(), "register");
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.apiMessage || "رمز التحقق غير صحيح أو منتهي الصلاحية.");
    } finally {
      setSubmitting(false);
    }
  }

  const fe = (name) => fieldErrors?.[name]?.[0] || fieldErrors?.[name];

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-background flex flex-col items-center justify-center px-stack-md py-stack-lg"
    >
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-stack-lg">
          <Brand to="/" size="lg" />
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow p-stack-lg">
          <div className="text-center mb-stack-md">
            <h1 className="text-headline-md font-heading text-on-surface">
              {method === "phone" && step === "otp" ? "تأكيد رمز التحقق" : "إنشاء حساب جديد"}
            </h1>
            <p className="text-body-sm text-on-surface-variant mt-1">
              انضم إلى منصة الخير وابدأ المساهمة
            </p>
          </div>

          {!(method === "phone" && step === "otp") && (
            <MethodTabs method={method} setMethod={switchMethod} disabled={submitting} />
          )}

          {error && (
            <div className="flex items-start gap-2 mb-stack-md rounded-lg bg-status-rejected/10 text-status-rejected px-3 py-2.5">
              <Icon name="error" className="text-[18px] mt-0.5" />
              <span className="text-body-sm">{error}</span>
            </div>
          )}

          {/* ---- Email registration ---- */}
          {method === "email" && (
            <form onSubmit={submitEmail} className="flex flex-col gap-stack-md">
              <Field label="الاسم الكامل" required error={fe("full_name")}>
                <Input
                  type="text"
                  autoComplete="name"
                  placeholder="مثال: سالم بن سلطان البوسعيدي"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  error={fe("full_name")}
                />
              </Field>
              <Field label="البريد الإلكتروني" required error={fe("email")}>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={fe("email")}
                  className="text-left"
                />
              </Field>
              <Field
                label="رقم الجوال (اختياري)"
                hint="لتلقّي الإشعارات والتذكيرات عبر واتساب."
                error={fe("phone")}
              >
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="+968 9XXX XXXX"
                  value={phoneOpt}
                  onChange={(e) => setPhoneOpt(e.target.value)}
                  error={fe("phone")}
                  className="text-center font-code-ref"
                />
              </Field>
              <Field label="كلمة المرور" required hint="8 أحرف على الأقل." error={fe("password")}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={fe("password")}
                />
              </Field>
              <Field label="تأكيد كلمة المرور" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting}
                icon={submitting ? undefined : "person_add"}
              >
                {submitting ? "جارٍ إنشاء الحساب…" : "إنشاء الحساب"}
              </Button>
            </form>
          )}

          {/* ---- Phone/OTP: request ---- */}
          {method === "phone" && step === "phone" && (
            <form onSubmit={sendOtp} className="flex flex-col gap-stack-md">
              <Field label="الاسم الكامل" required>
                <Input
                  type="text"
                  autoComplete="name"
                  placeholder="مثال: سالم بن سلطان البوسعيدي"
                  value={otpName}
                  onChange={(e) => setOtpName(e.target.value)}
                />
              </Field>
              <Field label="رقم الجوال" required>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  placeholder="+968 9XXX XXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-center font-code-ref"
                />
              </Field>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting}
                icon={submitting ? undefined : "sms"}
              >
                {submitting ? "جارٍ الإرسال…" : "إرسال رمز التحقق"}
              </Button>
            </form>
          )}

          {/* ---- Phone/OTP: verify ---- */}
          {method === "phone" && step === "otp" && (
            <form onSubmit={submitOtp} className="flex flex-col gap-stack-md">
              <p className="text-center text-body-sm text-on-surface-variant -mt-2">
                أرسلنا رمزًا إلى{" "}
                <span dir="ltr" className="font-code-ref text-on-surface font-bold">
                  {phone.trim()}
                </span>
              </p>
              <Field label="رمز التحقق" required>
                <Input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={4}
                  dir="ltr"
                  placeholder="••••"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  className="text-center text-headline-md tracking-[0.6em] font-code-ref"
                />
              </Field>

              <div className="flex items-center justify-between text-body-sm text-on-surface-variant">
                <span>
                  {expiresIn > 0 ? (
                    <>
                      صالح لمدة{" "}
                      <span className="font-code-ref text-on-surface" dir="ltr">
                        {fmtTime(expiresIn)}
                      </span>
                    </>
                  ) : (
                    <span className="text-status-rejected">انتهت صلاحية الرمز</span>
                  )}
                </span>
                {countdown > 0 ? (
                  <span>
                    إعادة الإرسال بعد{" "}
                    <span className="font-code-ref" dir="ltr">
                      {countdown}ث
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={sendOtp}
                    disabled={submitting}
                    className="text-primary font-bold font-heading hover:underline disabled:opacity-50"
                  >
                    إعادة إرسال الرمز
                  </button>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting}
                icon={submitting ? undefined : "check"}
              >
                {submitting ? "جارٍ التحقق…" : "تأكيد وإنشاء الحساب"}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                  setError("");
                }}
                className="mx-auto inline-flex items-center gap-1.5 text-body-sm text-secondary font-bold hover:underline"
              >
                <Icon name="edit" className="text-[16px]" />
                تغيير الرقم
              </button>

              <p className="text-body-sm text-on-surface-variant text-center rounded-lg bg-surface-container-low px-3 py-2 mt-stack-sm">
                <Icon name="terminal" className="text-[16px] align-middle ml-1" />
                في بيئة التطوير يُطبع رمز التحقق في سجل الخادم (console).
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-body-md text-on-surface-variant mt-stack-lg">
          لديك حساب بالفعل؟{" "}
          <Link to="/login" className="text-primary font-bold font-heading hover:underline">
            تسجيل الدخول
          </Link>
        </p>
        <p className="text-center text-body-sm text-on-surface-variant mt-stack-sm">
          بالمتابعة فأنت توافق على شروط الاستخدام وسياسة الخصوصية.
        </p>
        <div className="text-center mt-stack-md">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant hover:text-primary"
          >
            <Icon name="arrow_forward" flip className="text-[16px]" />
            العودة إلى الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
