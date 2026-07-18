"""System roles (SRS §5). Kept in ``core`` so any layer can reference them."""


class Roles:
    PLATFORM_ADMIN = "platform_admin"   # مدير المنصة
    ORG_MANAGER = "org_manager"         # مدير الجهة
    PROJECT_OWNER = "project_owner"     # صاحب المشروع
    FINANCE_OFFICER = "finance_officer" # المسؤول المالي
    AUDITOR = "auditor"                 # المدقق
    CONTENT_OFFICER = "content_officer" # مسؤول المحتوى والحملات
    CONTRIBUTOR = "contributor"         # المساهم

    CHOICES = [
        (PLATFORM_ADMIN, "مدير المنصة"),
        (ORG_MANAGER, "مدير الجهة"),
        (PROJECT_OWNER, "صاحب المشروع"),
        (FINANCE_OFFICER, "المسؤول المالي"),
        (AUDITOR, "المدقق"),
        (CONTENT_OFFICER, "مسؤول المحتوى والحملات"),
        (CONTRIBUTOR, "المساهم"),
    ]

    # Roles that operate inside an organization/project workspace.
    STAFF_ROLES = {
        PLATFORM_ADMIN,
        ORG_MANAGER,
        PROJECT_OWNER,
        FINANCE_OFFICER,
        AUDITOR,
        CONTENT_OFFICER,
    }
    FINANCE_ROLES = {PLATFORM_ADMIN, ORG_MANAGER, PROJECT_OWNER, FINANCE_OFFICER}
