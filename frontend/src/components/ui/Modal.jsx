import { useEffect } from "react";
import Icon from "./Icon";

export default function Modal({ open, onClose, title, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-on-surface/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative w-full ${widths[size]} bg-surface-container-lowest rounded-2xl shadow-soft-lg border border-outline-variant max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-center justify-between p-gutter border-b border-outline-variant">
          <h2 className="text-headline-sm font-heading text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="p-gutter overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="flex justify-start gap-3 p-gutter border-t border-outline-variant">{footer}</div>
        )}
      </div>
    </div>
  );
}
