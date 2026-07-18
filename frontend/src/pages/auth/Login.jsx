import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import Brand from "@/components/Brand";
import { Icon, Button, Field, Input } from "@/components/ui";

// OTP time-to-live (backend: OTP_TTL_SECONDS=300) and resend cooldown
// (backend: OTP_RESEND_COOLDOWN_SECONDS=60).
const OTP_TTL = 300;
const RESEND_COOLDOWN = 60;

function MethodTabs({ method, setMethod, disabled }) {
  const tabs = [
    { key: "email", label: "البريد وكلمة المرور", icon: "mail" },
    { key: "phone", label: "رقم الجوال", icon: "smartphone" },
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

export default function Login() {
  const { requestOtp, verifyOtp, loginWithPassword, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/dashboard";

  const [method, setMethod] = useState("email"); // "email" | "phone"

  // Email/password state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Phone/OTP state
  const [step, setStep] = useState("phone"); // "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // If already signed in, skip the form.
  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  // Ticking timer for the OTP flow.
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
  }

  // ---- Email + password ----
  async function submitEmail(e) {
    e?.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("أدخل البريد الإلكتروني وكلمة المرور.");
      return;
    }
    setSubmitting(true);
    try {
      await loginWithPassword(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.apiMessage || "تعذّر تسجيل الدخول. تحقق من البيانات.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---- Phone + OTP ----
  async function sendOtp(e) {
    e?.preventDefault();
    setError("");
    const trimmed = phone.trim();
    if (!trimmed) {
      setError("يرجى إدخال رقم الجوال.");
      return;
    }
    setSubmitting(true);
    try {
      await requestOtp(trimmed);
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
    if (clean.length < 4) {
      setError("أدخل رمز التحقق المكوّن من 4 أرقام.");
      return;
    }
    setSubmitting(true);
    try {
      await verifyOtp(phone.trim(), clean, fullName.trim());
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.apiMessage || "رمز التحقق غير صحيح أو منتهي الصلاحية.");
    } finally {
      setSubmitting(false);
    }
  }

  function changeNumber() {
    setStep("phone");
    setCode("");
    setError("");
    setCountdown(0);
    setExpiresIn(0);
  }

  const heading =
    method === "phone" && step === "otp" ? "تأكيد رمز التحقق" : "تسجيل الدخول";

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
            <h1 className="text-headline-md font-heading text-on-surface">{heading}</h1>
            <p className="text-body-sm text-on-surface-variant mt-1">
              مرحبًا بعودتك إلى منصة الخير
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

          {/* ---- Email + password ---- */}
          {method === "email" && (
            <form onSubmit={submitEmail} className="flex flex-col gap-stack-md">
              <Field label="البريد الإلكتروني" required>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  dir="ltr"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-left"
                />
              </Field>
              <Field label="كلمة المرور" required>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting}
                icon={submitting ? undefined : "login"}
              >
                {submitting ? "جارٍ الدخول…" : "تسجيل الدخول"}
              </Button>
            </form>
          )}

          {/* ---- Phone + OTP: request ---- */}
          {method === "phone" && step === "phone" && (
            <form onSubmit={sendOtp} className="flex flex-col gap-stack-md">
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

          {/* ---- Phone + OTP: verify ---- */}
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
                icon={submitting ? undefined : "login"}
              >
                {submitting ? "جارٍ التحقق…" : "تأكيد ودخول"}
              </Button>

              <button
                type="button"
                onClick={changeNumber}
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
          ليس لديك حساب؟{" "}
          <Link to="/register" className="text-primary font-bold font-heading hover:underline">
            أنشئ حسابًا جديدًا
          </Link>
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
