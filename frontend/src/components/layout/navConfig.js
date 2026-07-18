import { ROLES } from "@/lib/auth";

// Role-aware navigation for the dashboard sidebar.
const CONTRIBUTOR = [
  { to: "/dashboard", label: "لوحتي", icon: "dashboard" },
  { to: "/dashboard/subscriptions", label: "اشتراكاتي", icon: "receipt_long" },
  { to: "/dashboard/receipts", label: "الإيصالات", icon: "verified" },
  { to: "/dashboard/settings", label: "الخصوصية والإشعارات", icon: "settings" },
];

const PROJECT_WORKSPACE = [
  { to: "/manage", label: "لوحة المشاريع", icon: "space_dashboard" },
  { to: "/manage/projects", label: "المشاريع", icon: "foundation" },
  { to: "/manage/contributors", label: "المساهمون والاشتراكات", icon: "groups" },
  { to: "/manage/payments", label: "الدفعات", icon: "payments" },
  { to: "/manage/revenues", label: "الإيرادات", icon: "account_balance" },
  { to: "/manage/expenses", label: "المصروفات", icon: "receipt" },
  { to: "/manage/budget", label: "الميزانية", icon: "savings" },
  { to: "/manage/updates", label: "التحديثات والمراحل", icon: "timeline" },
  { to: "/manage/campaigns", label: "الحملات", icon: "campaign" },
  { to: "/manage/reports", label: "التقارير", icon: "analytics" },
];

const ADMIN = [
  { to: "/admin-console", label: "لوحة الإدارة", icon: "admin_panel_settings" },
  { to: "/admin-console/organizations", label: "الجهات", icon: "corporate_fare" },
  { to: "/admin-console/projects", label: "اعتماد المشاريع", icon: "fact_check" },
  { to: "/admin-console/users", label: "المستخدمون", icon: "manage_accounts" },
  { to: "/admin-console/audit", label: "سجل التدقيق", icon: "history" },
];

export function navFor(role) {
  if (role === ROLES.PLATFORM_ADMIN) {
    return [
      { title: "الإدارة", items: ADMIN },
      { title: "مساحة العمل", items: PROJECT_WORKSPACE },
    ];
  }
  if (
    [ROLES.ORG_MANAGER, ROLES.PROJECT_OWNER, ROLES.FINANCE_OFFICER, ROLES.AUDITOR, ROLES.CONTENT_OFFICER].includes(role)
  ) {
    return [{ title: "مساحة العمل", items: PROJECT_WORKSPACE }];
  }
  return [{ title: "حسابي", items: CONTRIBUTOR }];
}
