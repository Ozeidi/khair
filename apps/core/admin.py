from django.contrib import admin

from apps.core.models import ReferenceSequence


@admin.register(ReferenceSequence)
class ReferenceSequenceAdmin(admin.ModelAdmin):
    list_display = ("prefix", "year", "last_value")
    list_filter = ("prefix", "year")
