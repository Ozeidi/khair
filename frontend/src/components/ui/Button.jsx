import Icon from "./Icon";

const VARIANTS = {
  // Primary: solid Forest Green.
  primary:
    "bg-primary text-on-primary hover:bg-primary/90 shadow-primary-glow disabled:opacity-50",
  // Secondary: Navy Blue outline.
  secondary:
    "bg-transparent border-2 border-secondary text-secondary hover:bg-secondary/5",
  // Contribute: Tertiary Green, attention-drawing.
  contribute:
    "bg-tertiary text-on-tertiary hover:bg-tertiary-container shadow-sm",
  // Soft tertiary (card CTA in samples).
  soft:
    "bg-tertiary-container/10 text-tertiary hover:bg-tertiary-container/20",
  ghost:
    "bg-surface-container-high text-on-surface border border-outline-variant hover:bg-surface-container",
  danger: "bg-error text-on-error hover:bg-error/90",
  link: "text-primary hover:underline p-0 shadow-none",
};

const SIZES = {
  sm: "px-3 py-1.5 text-body-sm",
  md: "px-4 py-2.5 text-label-md",
  lg: "px-8 py-4 text-label-md",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconFlip = false,
  iconTrailing = false,
  className = "",
  as: Component = "button",
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-bold font-heading transition-all disabled:cursor-not-allowed";
  const iconEl = icon && <Icon name={icon} flip={iconFlip} className="text-[18px]" />;
  return (
    <Component
      className={`${base} ${VARIANTS[variant]} ${variant === "link" ? "" : SIZES[size]} ${className}`}
      {...props}
    >
      {!iconTrailing && iconEl}
      {children}
      {iconTrailing && iconEl}
    </Component>
  );
}
