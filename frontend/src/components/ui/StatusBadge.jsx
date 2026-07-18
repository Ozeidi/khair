import { statusInfo } from "@/lib/status";

// Compact pill: subtle tinted background + bold status color.
export default function StatusBadge({ map, code, className = "" }) {
  const { label, style } = statusInfo(map, code);
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-label-md font-heading font-bold ${style} ${className}`}
    >
      {label}
    </span>
  );
}
