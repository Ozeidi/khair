// Material Symbols Outlined wrapper. `flip` mirrors directional icons for RTL.
export default function Icon({ name, className = "", filled = false, flip = false, ...props }) {
  const classes = [
    "material-symbols-outlined",
    filled ? "icon-filled" : "",
    flip ? "rtl-flip" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} aria-hidden="true" {...props}>
      {name}
    </span>
  );
}
