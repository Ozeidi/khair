import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Icon,
  Button,
  Card,
  StatusBadge,
  ProgressBar,
  Field,
  Input,
  Select,
  Loading,
  ErrorState,
} from "@/components/ui";
import { PROJECT_STATUS } from "@/lib/status";
import { formatMoney, formatDate } from "@/lib/format";

// SRS §8.1 — تسجيل المساهمة. Multi-step contribution registration flow.

const CONTRIBUTION_TYPES = [
  {
    key: "share",
    label: "سهم خيري",
    icon: "workspace_premium",
    desc: "اختر نوع السهم وعدد الأسهم التي ترغب بالمساهمة بها.",
  },
  {
    key: "open",
    label: "مبلغ مفتوح",
    icon: "payments",
    desc: "ساهم بأي مبلغ تحدده أنت دفعة واحدة.",
  },
  {
    key: "subscription",
    label: "اشتراك دوري",
    icon: "event_repeat",
    desc: "التزام متكرر يُقسَّم على دفعات حسب الدورية التي تختارها.",
  },
];

const FREQUENCIES = [
  { value: "one_time", label: "مرة واحدة" },
  { value: "weekly", label: "أسبوعي" },
  { value: "monthly", label: "شهري" },
  { value: "quarterly", label: "ربع سنوي" },
  { value: "semiannual", label: "نصف سنوي" },
  { value: "annual", label: "سنوي" },
];

const PRIVACY_OPTIONS = [
  {
    value: "full",
    label: "الاسم الكامل",
    icon: "badge",
    desc: "يظهر اسمك ومبلغ مساهمتك في قائمة المساهمين.",
  },
  {
    value: "anonymous",
    label: "فاعل خير",
    icon: "person_off",
    desc: "لا يظهر اسمك، ويُدرَج ضمن قائمة فاعلي الخير.",
  },
  {
    value: "hidden_amount",
    label: "إخفاء المبلغ",
    icon: "visibility_off",
    desc: "يظهر اسمك دون الإفصاح عن قيمة المساهمة.",
  },
];

const STEPS = [
  { key: "type", label: "نوع المساهمة", icon: "category" },
  { key: "details", label: "تفاصيل الالتزام", icon: "tune" },
  { key: "identity", label: "بيانات المساهم", icon: "person" },
  { key: "review", label: "الملخص والتأكيد", icon: "verified" },
];

function frequencyLabel(value) {
  return FREQUENCIES.find((f) => f.value === value)?.label || value || "—";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Contribute() {
  const { slug } = useParams();
  const { user, requestOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState(0);

  // Step 1 — contribution type
  const [type, setType] = useState(null);

  // Step 2 — details
  const [shareTypeId, setShareTypeId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [openAmount, setOpenAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [startDate, setStartDate] = useState(todayIso());
  const [installments, setInstallments] = useState(12);

  // Step 3 — identity + preferences
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [privacy, setPrivacy] = useState("anonymous");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeAccuracy, setAgreeAccuracy] = useState(false);

  const [formError, setFormError] = useState("");
  const [createdRef, setCreatedRef] = useState(null);

  const projectQuery = useQuery({
    queryKey: ["public-project", slug],
    queryFn: async () => (await api.get(`/public/projects/${slug}/`)).data,
    enabled: !!slug,
  });

  const shareTypesQuery = useQuery({
    queryKey: ["public-share-types", slug],
    queryFn: async () =>
      (await api.get(`/public/projects/${slug}/share-types/`)).data,
    enabled: !!slug,
  });

  const project = projectQuery.data || {};
  const shareTypes = useMemo(() => {
    const raw = shareTypesQuery.data;
    const list = Array.isArray(raw) ? raw : raw?.results ?? [];
    return list.filter((s) => s?.is_active !== false);
  }, [shareTypesQuery.data]);

  const selectedShare = useMemo(
    () => shareTypes.find((s) => String(s.id) === String(shareTypeId)),
    [shareTypes, shareTypeId]
  );

  // Commitment total (إجمالي الالتزام)
  const totalCommitment = useMemo(() => {
    if (type === "share" && selectedShare) {
      return Number(selectedShare.value || 0) * Number(quantity || 0);
    }
    if (type === "open") return Number(openAmount || 0);
    if (type === "subscription") {
      if (selectedShare) {
        return Number(selectedShare.value || 0) * Number(quantity || 0);
      }
      return Number(openAmount || 0);
    }
    return 0;
  }, [type, selectedShare, quantity, openAmount]);

  const installmentAmount = useMemo(() => {
    const n = Number(installments || 1);
    if (type !== "subscription" || n <= 0) return totalCommitment;
    return totalCommitment / n;
  }, [type, installments, totalCommitment]);

  const isLoggedIn = !!user;
  const financialPct = Number(project.financial_progress || 0);

  // ── Mutation ───────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async () => {
      const body = {
        project: project.id,
        contribution_type: type,
        public_name_preference: privacy,
        start_date: startDate,
      };
      if (type === "share") {
        body.share_type = selectedShare?.id;
        body.quantity = Number(quantity || 1);
        body.frequency = selectedShare?.frequency || "one_time";
        body.installments_count = 1;
      } else if (type === "open") {
        body.unit_value = Number(openAmount || 0);
        body.total_value = Number(openAmount || 0);
        body.quantity = 1;
        body.frequency = "one_time";
        body.installments_count = 1;
      } else {
        if (selectedShare) {
          body.share_type = selectedShare.id;
          body.quantity = Number(quantity || 1);
        } else {
          body.unit_value = Number(openAmount || 0);
          body.total_value = Number(openAmount || 0);
          body.quantity = 1;
        }
        body.frequency = frequency;
        body.installments_count = Number(installments || 1);
      }
      return (await api.post("/subscriptions/", body)).data;
    },
    onSuccess: (data) => {
      setCreatedRef(data?.reference || data?.id || "—");
    },
    onError: (err) => {
      setFormError(
        err?.apiMessage || "تعذّر تسجيل المساهمة، يرجى المحاولة مرة أخرى."
      );
    },
  });

  // ── OTP handlers ───────────────────────────────────────────
  async function handleRequestOtp() {
    setOtpError("");
    if (!phone.trim()) {
      setOtpError("يرجى إدخال رقم الهاتف.");
      return;
    }
    setOtpBusy(true);
    try {
      await requestOtp(phone.trim(), "login");
      setOtpSent(true);
    } catch (err) {
      setOtpError(err?.apiMessage || "تعذّر إرسال رمز التحقق.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyOtp() {
    setOtpError("");
    if (!otpCode.trim()) {
      setOtpError("يرجى إدخال رمز التحقق.");
      return;
    }
    setOtpBusy(true);
    try {
      await verifyOtp(phone.trim(), otpCode.trim(), fullName.trim());
    } catch (err) {
      setOtpError(err?.apiMessage || "رمز التحقق غير صحيح.");
    } finally {
      setOtpBusy(false);
    }
  }

  // ── Step validation ────────────────────────────────────────
  function canProceed() {
    if (step === 0) return !!type;
    if (step === 1) {
      if (type === "share") return !!selectedShare && Number(quantity) >= 1;
      if (type === "open") return Number(openAmount) > 0;
      if (type === "subscription") {
        const hasBase = selectedShare
          ? Number(quantity) >= 1
          : Number(openAmount) > 0;
        return hasBase && !!startDate && Number(installments) >= 1;
      }
      return false;
    }
    if (step === 2) {
      return isLoggedIn && agreeTerms && agreeAccuracy;
    }
    return true;
  }

  function next() {
    setFormError("");
    if (canProceed()) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function back() {
    setFormError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  // ── Layout gates ───────────────────────────────────────────
  const pageWrap =
    "max-w-container-max-width mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg";

  if (projectQuery.isLoading) {
    return (
      <div className={pageWrap}>
        <Loading label="جارٍ تحميل بيانات المشروع…" />
      </div>
    );
  }

  if (projectQuery.isError) {
    return (
      <div className={pageWrap}>
        <ErrorState
          title="تعذّر تحميل المشروع"
          description="قد يكون الرابط غير صحيح أو أن المشروع لم يعد متاحًا للمساهمة."
          onRetry={() => projectQuery.refetch()}
        />
      </div>
    );
  }

  // Success screen
  if (createdRef) {
    return (
      <div className={pageWrap}>
        <div className="max-w-xl mx-auto">
          <Card className="text-center flex flex-col items-center gap-stack-md">
            <div className="p-4 bg-status-approved/10 rounded-full text-status-approved">
              <Icon name="task_alt" className="text-4xl" filled />
            </div>
            <h1 className="text-headline-lg font-heading text-on-surface">
              تم تسجيل مساهمتك بنجاح
            </h1>
            <p className="text-body-md text-on-surface-variant max-w-md">
              شكرًا لمساهمتك في «{project.name}». سيصلك تأكيد عبر واتساب، ويمكنك
              متابعة التزامك ودفعاتك من لوحة التحكم.
            </p>
            <div className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-stack-md flex flex-col gap-2">
              <span className="text-label-md text-on-surface-variant">
                الرقم المرجعي للاشتراك
              </span>
              <span className="text-headline-sm font-code-ref text-primary">
                {createdRef}
              </span>
            </div>
            <div className="w-full flex flex-col sm:flex-row-reverse gap-3 pt-2">
              <Button
                as={Link}
                to="/dashboard"
                variant="primary"
                icon="dashboard"
                className="w-full sm:w-auto"
              >
                الانتقال إلى لوحة التحكم
              </Button>
              <Button
                as={Link}
                to={`/projects/${slug}`}
                variant="ghost"
                className="w-full sm:w-auto"
              >
                العودة للمشروع
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={pageWrap}>
      <div className="mb-stack-lg">
        <Link
          to={`/projects/${slug}`}
          className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <Icon name="arrow_forward" flip className="text-[18px]" />
          العودة إلى المشروع
        </Link>
        <h1 className="text-headline-lg font-heading text-on-surface mt-2">
          تسجيل المساهمة
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          أكمل الخطوات التالية للمساهمة في «{project.name}».
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter items-start">
        {/* Main form column */}
        <div className="lg:col-span-2 flex flex-col gap-gutter">
          {/* Stepper */}
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <div key={s.key} className="flex-1 flex items-center gap-2">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                        active
                          ? "bg-primary text-on-primary border-primary"
                          : done
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-surface-container-high text-on-surface-variant border-outline-variant"
                      }`}
                    >
                      <Icon
                        name={done ? "check" : s.icon}
                        className="text-[18px]"
                      />
                    </div>
                    <span
                      className={`text-label-md hidden sm:block ${
                        active
                          ? "text-primary font-bold"
                          : "text-on-surface-variant"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 rounded-full ${
                        done ? "bg-primary/40" : "bg-outline-variant"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <Card className="flex flex-col gap-stack-md">
            {/* STEP 1 — Type */}
            {step === 0 && (
              <>
                <h2 className="text-headline-sm font-heading text-on-surface">
                  اختر نوع المساهمة
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {CONTRIBUTION_TYPES.map((t) => {
                    const disabled =
                      t.key === "share" && shareTypes.length === 0;
                    const active = type === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        disabled={disabled}
                        onClick={() => setType(t.key)}
                        className={`text-right p-stack-md rounded-xl border transition-all flex flex-col gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-outline-variant hover:border-primary/40 bg-surface-container-lowest"
                        }`}
                      >
                        <div
                          className={`p-2 rounded-lg w-fit ${
                            active
                              ? "bg-primary text-on-primary"
                              : "bg-surface-container-high text-on-surface-variant"
                          }`}
                        >
                          <Icon name={t.icon} />
                        </div>
                        <span className="text-body-lg font-heading font-bold text-on-surface">
                          {t.label}
                        </span>
                        <span className="text-body-sm text-on-surface-variant leading-relaxed">
                          {t.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {shareTypes.length === 0 && (
                  <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
                    <Icon name="info" className="text-[18px]" />
                    لا توجد أنواع أسهم مُعرّفة لهذا المشروع، يمكنك المساهمة بمبلغ
                    مفتوح أو اشتراك دوري.
                  </p>
                )}
              </>
            )}

            {/* STEP 2 — Details */}
            {step === 1 && (
              <>
                <h2 className="text-headline-sm font-heading text-on-surface">
                  تفاصيل الالتزام
                </h2>

                {(type === "share" ||
                  (type === "subscription" && shareTypes.length > 0)) && (
                  <>
                    <Field label="نوع السهم" required>
                      <Select
                        value={shareTypeId}
                        onChange={(e) => setShareTypeId(e.target.value)}
                      >
                        <option value="">— اختر نوع السهم —</option>
                        {shareTypes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} · {formatMoney(s.value)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    {selectedShare && (
                      <Field
                        label="عدد الأسهم"
                        required
                        hint={
                          selectedShare.max_quantity
                            ? `الحد الأقصى ${selectedShare.max_quantity} سهم`
                            : undefined
                        }
                      >
                        <Input
                          type="number"
                          min={selectedShare.min_quantity || 1}
                          max={selectedShare.max_quantity || undefined}
                          value={quantity}
                          onChange={(e) =>
                            setQuantity(Math.max(1, Number(e.target.value) || 1))
                          }
                        />
                      </Field>
                    )}
                  </>
                )}

                {(type === "open" ||
                  (type === "subscription" && shareTypes.length === 0)) && (
                  <Field
                    label="المبلغ (ريال عُماني)"
                    required
                    hint={
                      Number(project.minimum_contribution) > 0
                        ? `الحد الأدنى للمساهمة ${formatMoney(
                            project.minimum_contribution
                          )}`
                        : undefined
                    }
                  >
                    <Input
                      type="number"
                      min={project.minimum_contribution || 1}
                      placeholder="0"
                      value={openAmount}
                      onChange={(e) => setOpenAmount(e.target.value)}
                    />
                  </Field>
                )}

                {type === "subscription" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="الدورية" required>
                      <Select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                      >
                        {FREQUENCIES.filter((f) => f.value !== "one_time").map(
                          (f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          )
                        )}
                      </Select>
                    </Field>
                    <Field label="تاريخ البداية" required>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </Field>
                    <Field label="عدد الدفعات" required>
                      <Input
                        type="number"
                        min={1}
                        value={installments}
                        onChange={(e) =>
                          setInstallments(
                            Math.max(1, Number(e.target.value) || 1)
                          )
                        }
                      />
                    </Field>
                  </div>
                )}

                {type === "subscription" && totalCommitment > 0 && (
                  <div className="bg-surface-container-low border border-outline-variant rounded-lg p-stack-md flex flex-row-reverse justify-between items-center">
                    <span className="text-label-md text-on-surface-variant">
                      قيمة الدفعة الواحدة تقريبًا
                    </span>
                    <span className="text-body-lg font-bold text-primary">
                      {formatMoney(installmentAmount)}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* STEP 3 — Identity + preferences */}
            {step === 2 && (
              <>
                <h2 className="text-headline-sm font-heading text-on-surface">
                  بيانات المساهم
                </h2>

                {isLoggedIn ? (
                  <div className="flex flex-row-reverse items-center gap-3 bg-status-approved/5 border border-status-approved/20 rounded-lg p-stack-md">
                    <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold font-heading">
                      {(user.full_name || user.phone || "؟")
                        .toString()
                        .charAt(0)}
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-body-md font-semibold text-on-surface">
                        {user.full_name || "مساهم"}
                      </p>
                      <p className="text-body-sm text-on-surface-variant font-code-ref">
                        {user.phone}
                      </p>
                    </div>
                    <Icon
                      name="verified"
                      className="text-status-approved"
                      filled
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-stack-md bg-surface-container-low border border-outline-variant rounded-lg p-stack-md">
                    <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
                      <Icon name="sms" className="text-[18px]" />
                      سجّل الدخول عبر رمز التحقق لإتمام المساهمة.
                    </p>
                    <Field label="الاسم الكامل">
                      <Input
                        value={fullName}
                        placeholder="الاسم كما تود ظهوره"
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </Field>
                    <Field label="رقم الهاتف" required>
                      <div className="flex flex-row-reverse gap-2">
                        <Input
                          type="tel"
                          dir="ltr"
                          className="text-right"
                          placeholder="+9689xxxxxxx"
                          value={phone}
                          disabled={otpSent}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                        {!otpSent && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleRequestOtp}
                            disabled={otpBusy}
                            className="flex-shrink-0"
                          >
                            {otpBusy ? "..." : "إرسال الرمز"}
                          </Button>
                        )}
                      </div>
                    </Field>
                    {otpSent && (
                      <Field label="رمز التحقق" required>
                        <div className="flex flex-row-reverse gap-2">
                          <Input
                            dir="ltr"
                            className="text-center tracking-widest"
                            placeholder="••••"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="primary"
                            onClick={handleVerifyOtp}
                            disabled={otpBusy}
                            className="flex-shrink-0"
                          >
                            {otpBusy ? "..." : "تأكيد"}
                          </Button>
                        </div>
                      </Field>
                    )}
                    {otpError && (
                      <p className="text-body-sm text-status-rejected">
                        {otpError}
                      </p>
                    )}
                  </div>
                )}

                {/* Privacy preference */}
                <div className="flex flex-col gap-2">
                  <span className="text-label-md font-heading text-on-surface-variant">
                    تفضيل ظهور الاسم
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {PRIVACY_OPTIONS.map((p) => {
                      const active = privacy === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setPrivacy(p.value)}
                          className={`text-right p-3 rounded-lg border transition-all flex flex-col gap-1 ${
                            active
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-outline-variant hover:border-primary/40"
                          }`}
                        >
                          <span className="flex flex-row-reverse items-center gap-2 text-body-md font-semibold text-on-surface">
                            <Icon name={p.icon} className="text-[18px]" />
                            {p.label}
                          </span>
                          <span className="text-body-sm text-on-surface-variant leading-snug">
                            {p.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Consents */}
                <div className="flex flex-col gap-3 border-t border-outline-variant pt-stack-md">
                  <label className="flex flex-row-reverse items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeAccuracy}
                      onChange={(e) => setAgreeAccuracy(e.target.checked)}
                      className="mt-1 accent-primary w-4 h-4 flex-shrink-0"
                    />
                    <span className="text-body-sm text-on-surface-variant text-right">
                      أقرّ بصحة البيانات المُدخلة والتزامي بقيمة المساهمة
                      المذكورة.
                    </span>
                  </label>
                  <label className="flex flex-row-reverse items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-1 accent-primary w-4 h-4 flex-shrink-0"
                    />
                    <span className="text-body-sm text-on-surface-variant text-right">
                      أوافق على شروط المنصة وسياسة الخصوصية وأتيح التواصل معي
                      بشأن مساهمتي.
                    </span>
                  </label>
                </div>
              </>
            )}

            {/* STEP 4 — Review */}
            {step === 3 && (
              <>
                <h2 className="text-headline-sm font-heading text-on-surface">
                  ملخص الالتزام
                </h2>
                <div className="flex flex-col divide-y divide-outline-variant">
                  <SummaryRow
                    label="نوع المساهمة"
                    value={
                      CONTRIBUTION_TYPES.find((t) => t.key === type)?.label ||
                      "—"
                    }
                  />
                  {selectedShare && (
                    <SummaryRow
                      label="نوع السهم"
                      value={`${selectedShare.name} × ${quantity}`}
                    />
                  )}
                  {type === "open" && (
                    <SummaryRow label="المبلغ" value={formatMoney(openAmount)} />
                  )}
                  {type === "subscription" && (
                    <>
                      <SummaryRow
                        label="الدورية"
                        value={frequencyLabel(frequency)}
                      />
                      <SummaryRow
                        label="تاريخ البداية"
                        value={formatDate(startDate)}
                      />
                      <SummaryRow
                        label="عدد الدفعات"
                        value={`${installments} دفعة`}
                      />
                      <SummaryRow
                        label="قيمة الدفعة"
                        value={formatMoney(installmentAmount)}
                      />
                    </>
                  )}
                  <SummaryRow
                    label="ظهور الاسم"
                    value={
                      PRIVACY_OPTIONS.find((p) => p.value === privacy)?.label ||
                      "—"
                    }
                  />
                </div>

                <div className="bg-primary/5 border border-primary/20 rounded-xl p-stack-md flex flex-row-reverse justify-between items-center">
                  <span className="text-body-md font-heading text-on-surface">
                    إجمالي الالتزام
                  </span>
                  <span className="text-headline-md font-heading font-bold text-primary">
                    {formatMoney(totalCommitment)}
                  </span>
                </div>

                {formError && (
                  <p className="text-body-sm text-status-rejected flex items-center gap-2">
                    <Icon name="error" className="text-[18px]" />
                    {formError}
                  </p>
                )}
              </>
            )}

            {/* Nav buttons */}
            <div className="flex flex-row-reverse justify-between items-center border-t border-outline-variant pt-stack-md">
              {step < STEPS.length - 1 ? (
                <Button
                  variant="primary"
                  icon="arrow_back"
                  iconFlip
                  onClick={next}
                  disabled={!canProceed()}
                >
                  التالي
                </Button>
              ) : (
                <Button
                  variant="contribute"
                  icon="volunteer_activism"
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? "جارٍ التسجيل…" : "تأكيد المساهمة"}
                </Button>
              )}
              {step > 0 ? (
                <Button variant="ghost" icon="arrow_forward" onClick={back}>
                  السابق
                </Button>
              ) : (
                <span />
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar — project + commitment summary */}
        <div className="lg:sticky lg:top-gutter flex flex-col gap-gutter h-fit">
          <Card className="flex flex-col gap-stack-md">
            <div className="flex flex-row-reverse justify-between items-start gap-2">
              <h3 className="text-headline-sm font-heading text-on-surface leading-tight text-right">
                {project.name}
              </h3>
              <StatusBadge map={PROJECT_STATUS} code={project.status} />
            </div>
            {project.reference && (
              <span className="text-code-ref font-code-ref text-on-surface-variant text-right">
                {project.reference}
              </span>
            )}
            <ProgressBar
              tone="financial"
              value={financialPct}
              label="نسبة التمويل"
            />
            <div className="flex flex-row-reverse justify-between text-body-sm">
              <span className="text-on-surface-variant">الهدف</span>
              <span className="font-semibold text-on-surface">
                {formatMoney(project.target_amount)}
              </span>
            </div>
            <div className="flex flex-row-reverse justify-between text-body-sm">
              <span className="text-on-surface-variant">تم جمعه</span>
              <span className="font-semibold text-primary">
                {formatMoney(project.collected_amount)}
              </span>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <span className="text-label-md font-heading text-on-surface-variant">
              إجمالي الالتزام
            </span>
            <span className="text-headline-lg font-heading font-bold text-primary">
              {formatMoney(totalCommitment)}
            </span>
            {type === "subscription" && totalCommitment > 0 && (
              <span className="text-body-sm text-on-surface-variant">
                {installments} دفعة × {formatMoney(installmentAmount)}
              </span>
            )}
            <div className="flex items-center justify-center gap-2 text-label-md text-on-surface-variant border-t border-outline-variant pt-3 mt-1">
              <Icon
                name="verified_user"
                className="text-[16px] text-status-approved"
              />
              <span>مساهمة آمنة وموثقة</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex flex-row-reverse justify-between items-center py-2.5">
      <span className="text-body-sm text-on-surface-variant">{label}</span>
      <span className="text-body-md font-semibold text-on-surface">
        {value}
      </span>
    </div>
  );
}
