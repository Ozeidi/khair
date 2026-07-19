# ===== Stage 1: build the React frontend =====
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Build without the dev-server hint so the manifest path is used in prod.
ENV VITE_DEV_SERVER=""
RUN npm run build

# ===== Stage 2: Django runtime (single application image) =====
FROM python:3.11-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Bring in the built SPA assets from stage 1 (vite outDir = ../static/frontend => /static/frontend).
COPY --from=frontend-build /static/frontend /app/static/frontend

# Collect static at build under DEV settings so the production fail-fast guards
# (which require real secrets/DB) don't run here. The WhiteNoise manifest storage
# is defined in base settings, so the built manifest is identical for production.
RUN DJANGO_SETTINGS_MODULE=config.settings.development python manage.py collectstatic --noinput

# Drop to a non-root user (least privilege). Do this AFTER all build-time writes,
# and give it ownership of /app + the media mountpoint (a fresh named volume
# inherits this ownership on first mount).
RUN chmod +x entrypoint.sh \
    && adduser --system --group --uid 10001 appuser \
    && mkdir -p /app/media \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]
