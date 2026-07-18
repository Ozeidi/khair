"""صلاحيات النطاق للتقارير: بيانات المشروع لأصحابه وطاقمه فقط."""
from apps.core.roles import Roles


def user_can_view_project(user, project):
    """يحدد إن كان للمستخدم حق الاطّلاع على تقارير مشروع معيّن.

    مسموح لـ:
    - مدير المنصة والمدقق (نطاق كامل للاطّلاع/التدقيق).
    - مدير/صاحب المشروع.
    - مدير الجهة صاحبة المشروع أو مديرها المسجّل.
    - أي عضو طاقم (staff role) ينتمي لجهة المشروع.
    """
    if not (user and user.is_authenticated):
        return False

    role = getattr(user, "role", None)

    # مدير المنصة والمدقق يريان كل شيء (اطّلاع/تدقيق على مستوى المنصة).
    if role in (Roles.PLATFORM_ADMIN, Roles.AUDITOR):
        return True

    # مدير المشروع المسجّل.
    if project.manager_id and project.manager_id == user.pk:
        return True

    organization = project.organization
    if organization is not None:
        # مدير الجهة المسجّل على الجهة.
        if getattr(organization, "manager_id", None) == user.pk:
            return True
        # عضو طاقم ينتمي لنفس جهة المشروع.
        if (
            role in Roles.STAFF_ROLES
            and getattr(user, "organization_id", None) == organization.pk
        ):
            return True
        # عضوية صريحة في الجهة (OrganizationMember).
        if organization.members.filter(user=user).exists():
            return True

    return False
