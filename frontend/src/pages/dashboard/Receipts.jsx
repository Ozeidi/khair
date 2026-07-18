import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney, formatDateTime } from "@/lib/format";
import PageHeader from "@/components/ui/PageHeader";
import { Icon, Card, Loading, EmptyState, ErrorState } from "@/components/ui";

function receiptProject(r) {
  return r?.project_name || r?.project?.name || r?.project_title || "—";
}

function downloadUrl(r) {
  // Protected download endpoint returns the PDF (DOMAIN_CONTRACT §finance).
  return r?.pdf || (r?.id != null ? `/api/v1/receipts/${r.id}/download/` : null);
}

export default function Receipts() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["receipts"],
    queryFn: async () => (await api.get("/receipts/")).data,
  });

  const rows = data?.results ?? (Array.isArray(data) ? data : []);

  return (
    <div>
      <PageHeader
        title="الإيصالات الرقمية"
        subtitle="إيصالات مساهماتك المعتمدة — قابلة للتحميل والتحقق العلني."
      />

      {isLoading ? (
        <Loading />
      ) : isError ? (
        <ErrorState description="تعذّر تحميل الإيصالات." onRetry={refetch} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="receipt_long"
          title="لا توجد إيصالات بعد"
          description="تُصدر الإيصالات تلقائيًا عند اعتماد دفعاتك."
        />
      ) : (
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-outline-variant">
            {rows.map((r) => {
              const url = downloadUrl(r);
              return (
                <li
                  key={r.id || r.code}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-stack-md hover:bg-surface/60 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-surface-container-high rounded-lg text-on-surface-variant shrink-0">
                      <Icon name="receipt_long" className="text-[22px]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-label-md font-heading font-bold text-on-surface flex items-center gap-2 flex-wrap">
                        <span className="font-code-ref text-code-ref text-secondary">{r.code || "—"}</span>
                        <span className="text-on-surface-variant font-normal">•</span>
                        <span className="truncate">{receiptProject(r)}</span>
                      </p>
                      <p className="text-body-sm text-on-surface-variant mt-0.5">
                        {formatMoney(r.amount)} — {formatDateTime(r.issued_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {r.code && (
                      <Link
                        to={`/verify/${r.code}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-heading text-secondary border border-outline-variant hover:bg-secondary/5 transition-colors"
                      >
                        <Icon name="verified" className="text-[18px]" />
                        تحقق
                      </Link>
                    )}
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm font-heading text-on-primary bg-primary hover:bg-primary/90 transition-colors"
                      >
                        <Icon name="download" className="text-[18px]" />
                        تحميل
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-body-sm text-on-surface-variant bg-surface-container-high">
                        <Icon name="hourglass_empty" className="text-[18px]" />
                        قيد الإصدار
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
