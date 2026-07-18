"""Minimal Vite integration for Django (no extra dependency).

In development (``VITE_DEV_SERVER`` set) it points at the Vite dev server for HMR.
In production it reads ``static/frontend/.vite/manifest.json`` to resolve hashed
asset filenames served by WhiteNoise.
"""
import json

from django import template
from django.conf import settings
from django.templatetags.static import static
from django.utils.safestring import mark_safe

register = template.Library()

_manifest_cache = None
ENTRY = "src/main.jsx"


def _load_manifest():
    global _manifest_cache
    if _manifest_cache is None:
        try:
            with open(settings.VITE_MANIFEST_PATH, "r", encoding="utf-8") as fh:
                _manifest_cache = json.load(fh)
        except (FileNotFoundError, json.JSONDecodeError):
            _manifest_cache = {}
    return _manifest_cache


@register.simple_tag
def vite_client():
    """Inject the HMR client in dev; nothing in prod."""
    if settings.DEBUG and settings.VITE_DEV_SERVER:
        return mark_safe(
            f'<script type="module" src="{settings.VITE_DEV_SERVER}/@vite/client"></script>'
        )
    return ""


@register.simple_tag
def vite_asset(entry=ENTRY):
    """Emit the <script>/<link> tags for the SPA entry point."""
    if settings.DEBUG and settings.VITE_DEV_SERVER:
        return mark_safe(
            f'<script type="module" src="{settings.VITE_DEV_SERVER}/{entry}"></script>'
        )

    manifest = _load_manifest()
    chunk = manifest.get(entry)
    if not chunk:
        return mark_safe(
            '<!-- vite manifest missing: run `npm run build` in frontend/ -->'
        )

    tags = []
    for css_file in chunk.get("css", []):
        href = static(f"frontend/{css_file}")
        tags.append(f'<link rel="stylesheet" href="{href}">')
    src = static(f"frontend/{chunk['file']}")
    tags.append(f'<script type="module" src="{src}"></script>')
    return mark_safe("\n".join(tags))
