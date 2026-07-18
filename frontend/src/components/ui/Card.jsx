// White surface with soft shadow + 1px outline — the "paper-like" record card.
export default function Card({ children, className = "", padded = true, ...props }) {
  return (
    <div
      className={`bg-surface-container-lowest border border-outline-variant rounded-xl soft-shadow ${
        padded ? "p-stack-md md:p-gutter" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action, icon, className = "" }) {
  return (
    <div className={`flex justify-between items-center mb-stack-md ${className}`}>
      <h2 className="text-headline-sm font-heading text-on-surface">{title}</h2>
      {action}
    </div>
  );
}
