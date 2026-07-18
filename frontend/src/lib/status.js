// Maps backend status codes → Arabic label + Tailwind classes (design system
// "Status Badges": subtle tinted background + bold status color).

const STYLES = {
  draft: "bg-status-draft/10 text-status-draft",
  pending: "bg-status-pending/10 text-status-pending",
  approved: "bg-status-approved/10 text-status-approved",
  rejected: "bg-status-rejected/10 text-status-rejected",
  returned: "bg-status-returned/10 text-status-returned",
  completed: "bg-status-completed/10 text-status-completed",
  delayed: "bg-status-delayed/10 text-status-delayed",
  info: "bg-secondary/10 text-secondary",
  neutral: "bg-surface-container-high text-on-surface-variant",
};

// Project lifecycle (SRS §6.1)
export const PROJECT_STATUS = {
  draft: { label: "مسودة", style: STYLES.draft },
  pending_approval: { label: "بانتظار الاعتماد", style: STYLES.pending },
  returned: { label: "معاد للتعديل", style: STYLES.returned },
  approved: { label: "معتمد", style: STYLES.approved },
  active: { label: "نشط", style: STYLES.approved },
  funded: { label: "مكتمل التمويل", style: STYLES.completed },
  in_progress: { label: "قيد التنفيذ", style: STYLES.pending },
  suspended: { label: "موقوف مؤقتًا", style: STYLES.neutral },
  cancelled: { label: "ملغى", style: STYLES.rejected },
  closing: { label: "طلب إغلاق", style: STYLES.info },
  financial_review: { label: "بانتظار المراجعة المالية", style: STYLES.info },
  execution_review: { label: "بانتظار المراجعة التنفيذية", style: STYLES.info },
  completed: { label: "مكتمل", style: STYLES.completed },
  financially_closed: { label: "مغلق ماليًا", style: STYLES.neutral },
};

// Payment lifecycle (SRS §9.3)
export const PAYMENT_STATUS = {
  draft: { label: "مسودة", style: STYLES.draft },
  pending: { label: "بانتظار المراجعة", style: STYLES.pending },
  approved: { label: "معتمدة", style: STYLES.approved },
  returned: { label: "معادة للاستكمال", style: STYLES.returned },
  rejected: { label: "مرفوضة", style: STYLES.rejected },
  reversed: { label: "معكوسة", style: STYLES.neutral },
};

// Expense lifecycle (SRS §9.4)
export const EXPENSE_STATUS = {
  draft: { label: "مسودة", style: STYLES.draft },
  under_review: { label: "قيد المراجعة", style: STYLES.pending },
  approved: { label: "معتمد", style: STYLES.approved },
  returned: { label: "معاد للتعديل", style: STYLES.returned },
  rejected: { label: "مرفوض", style: STYLES.rejected },
  paid: { label: "مدفوع", style: STYLES.completed },
};

// Subscription lifecycle
export const SUBSCRIPTION_STATUS = {
  active: { label: "نشط", style: STYLES.approved },
  completed: { label: "مكتمل ماليًا", style: STYLES.completed },
  paused: { label: "موقوف", style: STYLES.neutral },
  cancelled: { label: "ملغى", style: STYLES.rejected },
};

// Organization lifecycle
export const ORG_STATUS = {
  draft: { label: "مسودة", style: STYLES.draft },
  pending: { label: "بانتظار التحقق", style: STYLES.pending },
  approved: { label: "معتمدة", style: STYLES.approved },
  returned: { label: "معادة للتعديل", style: STYLES.returned },
  rejected: { label: "مرفوضة", style: STYLES.rejected },
  suspended: { label: "موقوفة", style: STYLES.neutral },
};

export function statusInfo(map, code) {
  return map[code] || { label: code || "—", style: STYLES.neutral };
}
