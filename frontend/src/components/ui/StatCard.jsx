import Icon from "./Icon";

// Bento-grid statistic tile (samples _1, _4).
export default function StatCard({ icon, label, value, unit, tone = "primary", children, alert = false }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary-container text-on-secondary-container",
    tertiary: "bg-tertiary-container/20 text-tertiary",
    neutral: "bg-surface-container-high text-on-surface-variant",
    danger: "bg-status-rejected/10 text-status-rejected",
  };
  return (
    <div
      className={`bg-surface-container-lowest p-stack-md rounded-xl border soft-shadow flex flex-col justify-between ${
        alert ? "border-status-rejected/30" : "border-outline-variant"
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${tones[tone]}`}>
          <Icon name={icon} />
        </div>
        <span
          className={`text-label-md font-heading ${
            alert ? "text-status-rejected font-bold" : "text-on-surface-variant"
          }`}
        >
          {label}
        </span>
      </div>
      <div>
        <h3 className={`text-headline-lg font-heading ${alert ? "text-status-rejected" : "text-on-surface"}`}>
          {value} {unit && <span className="text-body-sm text-on-surface-variant">{unit}</span>}
        </h3>
        {children}
      </div>
    </div>
  );
}
