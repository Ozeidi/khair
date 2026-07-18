"""Populate the database with realistic demo data for all 7 roles (SRS §README).

Usage:
    python manage.py seed_demo          # creates data if absent; idempotent
    python manage.py seed_demo --reset  # wipe demo data and re-create
"""

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.core.roles import Roles

User = get_user_model()

# ---------------------------------------------------------------------------
# Demo accounts — Omani names & +968 numbers.
# (phone, role, full_name, email, password|None)
#   • admin & contributor carry a password so email+password login is testable.
#   • the rest sign in via phone/OTP (password unusable).
# ---------------------------------------------------------------------------
DEMO_USERS = [
    ("+96895000001", Roles.PLATFORM_ADMIN,  "سالم بن سلطان البوسعيدي",   "admin@ataa-oman.org",       "admin12345"),
    ("+96895000002", Roles.ORG_MANAGER,     "خالد بن حمد الغافري",       "manager@ataa-oman.org",     None),
    ("+96895000003", Roles.PROJECT_OWNER,   "منى بنت ناصر الحبسية",      "owner@ataa-oman.org",       None),
    ("+96895000004", Roles.FINANCE_OFFICER, "عبدالله بن راشد الكندي",    "finance@ataa-oman.org",     None),
    ("+96895000005", Roles.AUDITOR,         "حمود بن سيف المعمري",       "auditor@ataa-oman.org",     None),
    ("+96895000006", Roles.CONTENT_OFFICER, "ريّا بنت خميس الزدجالية",   "content@ataa-oman.org",     None),
    ("+96895000010", Roles.CONTRIBUTOR,     "يوسف بن علي البلوشي",       "contributor@example.com",   "user12345"),
]


class Command(BaseCommand):
    help = "Seed demo accounts, organisation, projects, subscriptions and payments."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Delete existing demo data before re-creating.",
        )

    def handle(self, *args, **options):
        if options["reset"]:
            self._reset()

        with transaction.atomic():
            users = self._create_users()
            org   = self._create_org(users)
            self._link_users_to_org(users, org)
            cats  = self._create_categories()
            projs = self._create_projects(org, users, cats)
            self._create_share_types(projs)
            self._create_subscriptions(projs, users)

        self.stdout.write(self.style.SUCCESS(
            "\n✅  Demo data seeded successfully.\n"
            "   Login at /login — OTP will print in server log.\n"
            "   Admin: admin@ataa-oman.org / admin12345 (or phone +96895000001)"
        ))

    # -----------------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------------

    def _reset(self):
        phones = [p for p, *_ in DEMO_USERS]
        count, _ = User.objects.filter(phone__in=phones).delete()
        self.stdout.write(f"  Deleted {count} demo user(s).")

    def _create_users(self):
        created = {}
        for phone, role, name, email, password in DEMO_USERS:
            user, new = User.objects.get_or_create(
                phone=phone,
                defaults={
                    "full_name": name,
                    "role": role,
                    "email": email,
                    "is_active": True,
                },
            )
            if new:
                if password:
                    user.set_password(password)
                else:
                    user.set_unusable_password()  # phone/OTP login only.
                if role == Roles.PLATFORM_ADMIN:
                    user.is_staff = True
                    user.is_superuser = True
                user.email = email
                user.phone_verified = True
                user.save()
                self.stdout.write(f"  Created user {phone} [{role}]")
            else:
                self.stdout.write(f"  Exists  user {phone} [{role}]")
            created[role] = user
        return created

    def _create_org(self, users):
        from apps.organizations.models import Organization

        org, new = Organization.objects.get_or_create(
            name="فريق عطاء عُمان التطوعي",
            defaults={
                "org_type": "team",
                "description": "فريق تطوعي عُماني يعمل على تنفيذ مشاريع خيرية في مجالات التعليم والصحة والبيئة والحفاظ على التراث في محافظات السلطنة.",
                "manager": users.get(Roles.ORG_MANAGER),
                "phone": "+96895000002",
                "status": "approved",
            },
        )
        if new:
            self.stdout.write("  Created organisation: فريق عطاء عُمان التطوعي")
        return org

    def _link_users_to_org(self, users, org):
        from apps.organizations.models import OrganizationMember

        staff_roles = [
            Roles.ORG_MANAGER,
            Roles.PROJECT_OWNER,
            Roles.FINANCE_OFFICER,
            Roles.AUDITOR,
            Roles.CONTENT_OFFICER,
        ]
        for role in staff_roles:
            user = users.get(role)
            if not user:
                continue
            member, created = OrganizationMember.objects.get_or_create(
                organization=org,
                user=user,
                defaults={"role": role},
            )
            if user.organization_id is None:
                user.organization = org
                user.save(update_fields=["organization"])

    def _create_categories(self):
        from apps.projects.models import ProjectCategory

        cats_data = [
            ("تعليم", "school", 1),
            ("صحة", "local_hospital", 2),
            ("بيئة", "eco", 3),
            ("إسكان", "home", 4),
            ("طوارئ", "emergency", 5),
        ]
        cats = {}
        for name, icon, order in cats_data:
            cat, _ = ProjectCategory.objects.get_or_create(
                name=name, defaults={"icon": icon, "order": order}
            )
            cats[name] = cat
        self.stdout.write(f"  Categories: {len(cats)}")
        return cats

    def _create_projects(self, org, users, cats):
        from apps.projects.models import Project, ProjectStage, TransparencySetting

        owner = users.get(Roles.PROJECT_OWNER)
        now = timezone.now().date()

        projects_data = [
            {
                "name": "بناء مسجد في ولاية نزوى",
                "description": "إنشاء مسجد جامع يستوعب ٣٠٠ مصلٍّ في إحدى قرى ولاية نزوى بمحافظة الداخلية، يشمل دورات المياه ومرافق الوضوء والمكتبة.",
                "status": Project.Status.ACTIVE,
                "target_amount": Decimal("350000.00"),
                "collected_amount": Decimal("215000.00"),
                "financial_progress": Decimal("61.43"),
                "execution_progress": Decimal("40"),
                "category": cats.get("تعليم"),
                "start_date": now.replace(month=1, day=1),
                "stages": [
                    ("تصميم وترخيص", 20, "completed"),
                    ("أعمال الحفر والأساسات", 30, "completed"),
                    ("الهيكل والبناء", 35, "in_progress"),
                    ("التشطيبات والتأثيث", 15, "pending"),
                ],
            },
            {
                "name": "كفالة ١٠٠ يتيم في محافظة ظفار",
                "description": "توفير الرعاية الشاملة لمئة طفل يتيم في محافظة ظفار تشمل التعليم والصحة والسكن على مدار عام.",
                "status": Project.Status.FUNDED,
                "target_amount": Decimal("600000.00"),
                "collected_amount": Decimal("600000.00"),
                "financial_progress": Decimal("100"),
                "execution_progress": Decimal("65"),
                "category": cats.get("صحة"),
                "start_date": now.replace(month=3, day=1),
                "stages": [
                    ("التسجيل والتحقق", 10, "completed"),
                    ("توزيع الكفالات الفصل الأول", 30, "completed"),
                    ("توزيع الكفالات الفصل الثاني", 30, "in_progress"),
                    ("توزيع الكفالات الفصل الثالث", 30, "pending"),
                ],
            },
            {
                "name": "ترميم فلج دارس بولاية نزوى",
                "description": "ترميم وصيانة أحد الأفلاج التاريخية في ولاية نزوى للحفاظ على التراث المائي العُماني وخدمة ٥٠٠ أسرة من المزارعين.",
                "status": Project.Status.IN_PROGRESS,
                "target_amount": Decimal("80000.00"),
                "collected_amount": Decimal("80000.00"),
                "financial_progress": Decimal("100"),
                "execution_progress": Decimal("75"),
                "category": cats.get("بيئة"),
                "start_date": now.replace(month=2, day=15),
                "stages": [
                    ("المسح الهندسي للفلج", 15, "completed"),
                    ("ترميم القنوات والسواقي", 50, "completed"),
                    ("إعادة التشغيل والاختبار", 25, "in_progress"),
                    ("التسليم والتوثيق", 10, "pending"),
                ],
            },
            {
                "name": "دعم أسر محتاجة في محافظة مسندم",
                "description": "توزيع سلات غذائية وكسوة العيد على ٢٠٠ أسرة محتاجة في محافظة مسندم قبيل شهر رمضان المبارك.",
                "status": Project.Status.DRAFT,
                "target_amount": Decimal("40000.00"),
                "collected_amount": Decimal("0.00"),
                "financial_progress": Decimal("0"),
                "execution_progress": Decimal("0"),
                "category": cats.get("طوارئ"),
                "start_date": None,
                "stages": [],
            },
        ]

        projects = []
        for pdata in projects_data:
            stages_spec = pdata.pop("stages", [])
            cat = pdata.pop("category", None)

            proj, new = Project.objects.get_or_create(
                name=pdata["name"],
                organization=org,
                defaults={
                    **pdata,
                    "manager": owner,
                    "category": cat,
                    "organization": org,
                    "open_contribution": True,
                    "currency": "OMR",
                },
            )
            if new:
                # Ensure transparency settings exist.
                TransparencySetting.objects.get_or_create(project=proj)
                # Create stages.
                total_pct = 0
                for s_name, s_weight, s_status in stages_spec:
                    ProjectStage.objects.get_or_create(
                        project=proj,
                        name=s_name,
                        defaults={"weight": s_weight, "status": s_status, "order": total_pct},
                    )
                    total_pct += s_weight
                self.stdout.write(f"  Created project: {proj.name}")
            projects.append(proj)

        return projects

    def _create_share_types(self, projects):
        from apps.contributions.models import ShareType, FREQUENCY_CHOICES

        share_specs = {
            "بناء مسجد في ولاية نزوى": [
                ("سهم بناء", Decimal("5000.000"), "one_time", "مساهمة بسهم واحد في بناء المسجد"),
                ("طابوقة", Decimal("500.000"), "one_time", "تكلفة طابوقة واحدة من الطابوق"),
                ("سهم شهري", Decimal("200.000"), "monthly", "اشتراك شهري لدعم البناء", 12),
            ],
            "كفالة ١٠٠ يتيم في محافظة ظفار": [
                ("كفالة يتيم سنوية", Decimal("6000.000"), "one_time", "كفالة يتيم كاملة لمدة عام"),
                ("كفالة يتيم شهرية", Decimal("500.000"), "monthly", "مساهمة شهرية في كفالة الأيتام", 12),
                ("دعم تعليم", Decimal("1500.000"), "one_time", "تغطية مستلزمات تعليم يتيم لفصل دراسي"),
            ],
            "ترميم فلج دارس بولاية نزوى": [
                ("سهم ترميم الفلج", Decimal("8000.000"), "one_time", "تمويل مرحلة كاملة من ترميم الفلج"),
                ("حصة من الترميم", Decimal("400.000"), "one_time", "حصة من عشرين في تمويل ترميم الفلج"),
            ],
        }

        for proj in projects:
            specs = share_specs.get(proj.name, [])
            for i, spec in enumerate(specs):
                name, value, freq = spec[0], spec[1], spec[2]
                desc = spec[3] if len(spec) > 3 else ""
                n_inst = spec[4] if len(spec) > 4 else None
                ShareType.objects.get_or_create(
                    project=proj,
                    name=name,
                    defaults={
                        "value": value,
                        "frequency": freq,
                        "description": desc,
                        "installments_count": n_inst,
                        "order": i,
                    },
                )

    def _create_subscriptions(self, projects, users):
        from apps.contributions.models import ShareType, Subscription, Installment

        contributor = users.get(Roles.CONTRIBUTOR)
        if not contributor:
            return

        active_projects = [p for p in projects if p.status in ("active", "funded", "in_progress")]
        for proj in active_projects[:2]:
            share_type = ShareType.objects.filter(project=proj).first()
            if not share_type:
                continue
            sub, new = Subscription.objects.get_or_create(
                project=proj,
                user=contributor,
                share_type=share_type,
                defaults={
                    "quantity": 1,
                    "total_value": share_type.value,
                    "unit_value": share_type.value,
                    "paid_amount": Decimal("0.00"),
                    "status": "active",
                    "start_date": timezone.now().date(),
                },
            )
            if new and share_type.installments_count:
                # Create installment schedule (monthly).
                from datetime import date
                import calendar
                today = timezone.now().date()
                for seq in range(1, share_type.installments_count + 1):
                    month = (today.month + seq - 2) % 12 + 1
                    year  = today.year + ((today.month + seq - 2) // 12)
                    last_day = calendar.monthrange(year, month)[1]
                    due = date(year, month, min(today.day, last_day))
                    inst_status = "paid" if seq <= 2 else "pending"
                    Installment.objects.get_or_create(
                        subscription=sub,
                        sequence=seq,
                        defaults={
                            "amount": share_type.value / share_type.installments_count,
                            "due_date": due,
                            "paid_amount": share_type.value / share_type.installments_count if inst_status == "paid" else Decimal("0.00"),
                            "status": inst_status,
                        },
                    )
        self.stdout.write("  Subscriptions seeded.")
