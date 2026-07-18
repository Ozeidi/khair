import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { PAYMENT_STATUS } from "@/lib/status";
import { formatMoney, formatDate } from "@/lib/format";
import { Icon, Button, StatusBadge, Field, Input, Loading } from "@/components/ui";

// Public receipt verification (SRS §8.1). The endpoint intentionally returns
// only {status, project, organization, amount, date} — NEVER phone / bank
// account / proof. We never render those even if the payload leaks them.
export default function ReceiptVerify() {
  const { code: routeCode } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(routeCode || "");

  useEffect(() => {
    setInput(routeCode || "");
  }, [routeCode]);

  const code = (routeCode || "").trim();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["receipt-verify", code],
    enabled: !!code,
    retry: false,
    queryFn: async () => {
      const res = await api.get(`/public/receipts/${encodeURIComponent(code)}/verify/`);
      return res.data;
    },
  });

  const notFound = isError && error?.response?.status === 404;

  function onSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed) navigate(`/verify/${encodeURIComponent(trimmed)}`);
  }

  return (
    <div dir="rtl" className="max-w-2xl mx-auto py-stack-lg">
      {/* Intro */}
      <div className="text-center mb-stack-lg">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-primary/10 text-primary mb-stack-md">
          <Icon name="verified" filled className="text-3xl" />
        </div>
        <h1 className="text-headline-lg font-heading text-on-surface">التحقق من إيصال</h1>
        <p className="text-body-md text-on-surface-variant mt-2 max-w-lg mx-auto">
          أدخل رقم الإيصال الظاهر على المستند أو رمز الاستجابة السريعة (QR) للتأكد من صحته
          ومطابقته لسجلات المنصة.
        </p>
      </div>

      {/* Lookup form */}
      <form
        onSubmit={onSubmit}
        className="bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow p-stack-md md:p-gutter mb-stack-lg"
      >
        <div className="flex flex-col md:flex-row-reverse gap-stack-md md:items-end">
          <Button type="submit" size="lg" icon="search" className="md:mb-[1px]">
            تحقّق
          </Button>
          <Field label="رقم الإيصال" className="flex-1">
            <Input
              type="text"
              dir="ltr"
              placeholder="RCP-2026-000456"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="text-center font-code-ref"
            />
          </Field>
        </div>
      </form>

      {/* Result states */}
      {!code && (
        <div className="text-center text-body-sm text-on-surface-variant">
          <Icon name="qr_code_scanner" className="text-4xl text-outline" />
          <p className="mt-2">في انتظار إدخال رقم الإيصال.</p>
        </div>
      )}

      {code && isLoading && <Loading label="جارٍ التحقق من الإيصال…" />}

      {code && notFound && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow p-stack-lg text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-status-rejected/10 text-status-rejected mb-stack-md">
            <Icon name="search_off" className="text-3xl" />
          </div>
          <h2 className="text-headline-sm font-heading text-on-surface">إيصال غير موجود</h2>
          <p className="text-body-md text-on-surface-variant mt-2">
            لم نتمكن من العثور على إيصال بالرقم{" "}
            <span className="font-code-ref text-on-surface" dir="ltr">
              {code}
            </span>
            . تأكد من الرقم وحاول مجددًا.
          </p>
        </div>
      )}

      {code && isError && !notFound && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow p-stack-lg text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-status-rejected/10 text-status-rejected mb-stack-md">
            <Icon name="error" className="text-3xl" />
          </div>
          <h2 className="text-headline-sm font-heading text-on-surface">تعذّر التحقق</h2>
          <p className="text-body-md text-on-surface-variant mt-2">
            {error?.apiMessage || "حدث خطأ أثناء الاتصال بالخادم. حاول مرة أخرى."}
          </p>
        </div>
      )}

      {code && !isLoading && !isError && data && <VerifiedReceipt code={code} data={data} />}
    </div>
  );
}

// Clean "paper" verification card — mimics the QR verification certificate.
function VerifiedReceipt({ code, data }) {
  const status = data?.status;
  const projectName = data?.project?.title || data?.project?.name || data?.project || "—";
  const orgName =
    data?.organization?.name || data?.organization?.title || data?.organization || "—";
  const amount = data?.amount;
  const date = data?.date || data?.issued_at || data?.created_at;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow overflow-hidden">
      {/* Verified banner */}
      <div className="bg-status-completed/10 border-b border-outline-variant px-stack-md md:px-gutter py-stack-md flex items-center gap-3">
        <div className="inline-flex items-center justify-center h-11 w-11 rounded-full bg-status-completed/15 text-status-completed shrink-0">
          <Icon name="verified" filled className="text-2xl" />
        </div>
        <div className="flex-1">
          <p className="text-headline-sm font-heading text-status-completed leading-tight">
            إيصال موثّق
          </p>
          <p className="text-body-sm text-on-surface-variant">
            هذا الإيصال مطابق لسجلات منصة الخير.
          </p>
        </div>
        {status && <StatusBadge map={PAYMENT_STATUS} code={status} />}
      </div>

      {/* Body: QR-style badge + record details */}
      <div className="p-stack-md md:p-gutter">
        <div className="flex flex-col sm:flex-row-reverse gap-stack-lg">
          {/* QR-like emblem */}
          <div className="flex flex-col items-center gap-2 shrink-0 mx-auto sm:mx-0">
            <div className="h-28 w-28 rounded-xl border border-outline-variant bg-surface-container-low flex items-center justify-center text-on-surface-variant">
              <Icon name="qr_code_2" className="text-6xl" />
            </div>
            <span className="text-code-ref font-code-ref text-on-surface-variant" dir="ltr">
              {code}
            </span>
          </div>

          {/* Details */}
          <dl className="flex-1 divide-y divide-outline-variant">
            <Row icon="volunteer_activism" label="المشروع" value={projectName} />
            <Row icon="apartment" label="الجهة المنفّذة" value={orgName} />
            <Row
              icon="payments"
              label="المبلغ"
              value={
                <span className="font-heading font-bold text-primary">{formatMoney(amount)}</span>
              }
            />
            <Row icon="calendar_month" label="التاريخ" value={formatDate(date)} />
          </dl>
        </div>

        {/* Privacy note — explicitly no personal / banking data. */}
        <div className="mt-stack-lg flex items-start gap-2 rounded-lg bg-surface-container-low px-3 py-2.5 text-on-surface-variant">
          <Icon name="lock" className="text-[18px] mt-0.5 text-secondary" />
          <p className="text-body-sm">
            حرصًا على الخصوصية، لا تُعرض بيانات المتبرّع أو أرقام الجوال أو الحسابات البنكية أو
            صور الإثبات في صفحة التحقق العامة.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name={icon} className="text-[20px]" />
        <span className="text-label-md font-heading">{label}</span>
      </div>
      <span className="text-body-md text-on-surface text-left">{value}</span>
    </div>
  );
}
