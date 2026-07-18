import { Link } from "react-router-dom";
import Icon from "./Icon";
import StatusBadge from "./StatusBadge";
import ProgressBar from "./ProgressBar";
import Button from "./Button";
import { PROJECT_STATUS } from "@/lib/status";
import { formatMoney } from "@/lib/format";

// Project card with cover image, status badge, dual progress (financial vs execution).
export default function ProjectCard({ project }) {
  const {
    public_slug,
    slug,
    name,
    short_description,
    cover_image,
    status,
    financial_progress = 0,
    execution_progress = 0,
    target_amount,
    collected_amount,
    funded,
  } = project;

  const to = `/projects/${public_slug || slug || project.id}`;
  const isFunded = funded || financial_progress >= 100;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl overflow-hidden soft-shadow hover:shadow-soft-lg transition-shadow duration-300 flex flex-col">
      <Link to={to} className="relative h-48 w-full bg-surface-container-high block">
        {cover_image ? (
          <div
            className="bg-cover bg-center w-full h-full"
            style={{ backgroundImage: `url('${cover_image}')` }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-outline">
            <Icon name="image" className="text-4xl" />
          </div>
        )}
        <div className="absolute top-4 left-4">
          <button className="p-2 bg-surface/90 backdrop-blur rounded-full text-on-surface-variant hover:text-primary transition-colors">
            <Icon name="share" className="text-[20px]" />
          </button>
        </div>
        <div className="absolute top-4 right-4">
          <StatusBadge map={PROJECT_STATUS} code={status} className="bg-surface/90 backdrop-blur" />
        </div>
      </Link>

      <div className="p-6 flex-grow flex flex-col justify-between space-y-4">
        <div>
          <Link to={to}>
            <h3 className="text-headline-sm font-heading text-on-surface mb-2 leading-tight hover:text-primary transition-colors">
              {name}
            </h3>
          </Link>
          <p className="text-body-sm text-on-surface-variant line-clamp-2">{short_description}</p>
        </div>

        <div className="space-y-3 pt-4 border-t border-outline-variant/30">
          <div>
            <ProgressBar tone="financial" label="التمويل المالي" value={financial_progress} />
            <div className="flex flex-row-reverse justify-between text-code-ref font-code-ref text-on-surface-variant mt-1">
              <span>الهدف: {formatMoney(target_amount)}</span>
              <span>تم جمع: {formatMoney(collected_amount)}</span>
            </div>
          </div>
          <ProgressBar tone="execution" label="الإنجاز الميداني" value={execution_progress} />
        </div>

        {isFunded ? (
          <Button as={Link} to={to} variant="ghost" className="w-full" icon="lock">
            اكتمل التمويل — تابع التنفيذ
          </Button>
        ) : (
          <Button as={Link} to={`${to}?contribute=1`} variant="soft" className="w-full">
            ساهم بسهم
          </Button>
        )}
      </div>
    </div>
  );
}
