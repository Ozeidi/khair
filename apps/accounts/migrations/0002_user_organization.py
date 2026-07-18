"""Add organization FK to User — split out to break the accounts ↔ organizations
circular dependency in 0001_initial."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        ("organizations", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="organization",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="users",
                to="organizations.organization",
                verbose_name="الجهة",
            ),
        ),
    ]
