import { clampPercent, formatPercent } from "@/lib/format";

// Two-tone pill progress. tone: "financial" (primary green) | "execution" (secondary blue).
export default function ProgressBar({
  value,
  tone = "financial",
  label,
  showValue = true,
  size = "md",
}) {
  const pct = clampPercent(value);
  const fill = tone === "execution" ? "bg-secondary" : "bg-primary";
  const valueColor = tone === "execution" ? "text-secondary" : "text-primary";
  const height = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";

  return (
    <div className="w-full">
      {label && (
        <div className="flex flex-row-reverse justify-between text-body-sm mb-1">
          <span className="text-on-surface font-medium">{label}</span>
          {showValue && <span className={`${valueColor} font-bold`}>{formatPercent(pct)}</span>}
        </div>
      )}
      <div className={`w-full ${height} bg-surface-container-high rounded-full overflow-hidden`}>
        <div className={`h-full ${fill} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
