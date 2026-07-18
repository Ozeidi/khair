// Section header used across dashboard/management pages.
export default function PageHeader({ title, subtitle, actions, className = "" }) {
  return (
    <div
      className={`flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-outline-variant pb-stack-md mb-stack-lg ${className}`}
    >
      <div>
        <h1 className="text-headline-lg font-heading text-on-surface">{title}</h1>
        {subtitle && <p className="text-body-lg text-on-surface-variant mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}
