import Icon from "./Icon";

export function Spinner({ className = "" }) {
  return (
    <div
      className={`inline-block h-6 w-6 animate-spin rounded-full border-2 border-outline-variant border-t-primary ${className}`}
      role="status"
      aria-label="جارٍ التحميل"
    />
  );
}

export function Loading({ label = "جارٍ التحميل…" }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-on-surface-variant">
      <Spinner />
      <span className="text-body-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="p-4 bg-surface-container-high rounded-full text-on-surface-variant">
        <Icon name={icon} className="text-3xl" />
      </div>
      <h3 className="text-headline-sm font-heading text-on-surface">{title}</h3>
      {description && <p className="text-body-sm text-on-surface-variant max-w-sm">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "حدث خطأ", description, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="p-4 bg-status-rejected/10 rounded-full text-status-rejected">
        <Icon name="error" className="text-3xl" />
      </div>
      <h3 className="text-headline-sm font-heading text-on-surface">{title}</h3>
      {description && <p className="text-body-sm text-on-surface-variant max-w-sm">{description}</p>}
      {onRetry && (
        <button onClick={onRetry} className="text-primary font-bold hover:underline">
          إعادة المحاولة
        </button>
      )}
    </div>
  );
}
