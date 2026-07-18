"""Serve the React single-page app from one Django template (SRS §17.1)."""
from django.shortcuts import render


def spa_index(request):
    """Catch-all view that renders the SPA shell.

    The template uses the ``vite_asset`` tag to inject the correct bundle,
    whether from the Vite dev server (HMR) or the built manifest.
    """
    return render(request, "app/index.html")
