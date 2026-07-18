// Clean outlined inputs with Arabic labels + error states (design system "Input Fields").

export function Field({ label, error, required, children, hint, className = "" }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-label-md font-heading text-on-surface-variant">
          {label}
          {required && <span className="text-status-rejected"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="text-body-sm text-on-surface-variant">{hint}</span>}
      {error && <span className="text-body-sm text-status-rejected">{error}</span>}
    </label>
  );
}

const inputBase =
  "w-full bg-surface-container-lowest border rounded-lg px-3 py-2.5 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors";

export function Input({ error, className = "", ...props }) {
  return (
    <input
      className={`${inputBase} ${error ? "border-status-rejected" : "border-outline-variant"} ${className}`}
      {...props}
    />
  );
}

export function Textarea({ error, className = "", rows = 4, ...props }) {
  return (
    <textarea
      rows={rows}
      className={`${inputBase} resize-y ${error ? "border-status-rejected" : "border-outline-variant"} ${className}`}
      {...props}
    />
  );
}

export function Select({ error, className = "", children, ...props }) {
  return (
    <select
      className={`${inputBase} ${error ? "border-status-rejected" : "border-outline-variant"} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
