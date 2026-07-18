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

RUN python manage.py collectstatic --noinput

EXPOSE 8000

RUN chmod +x entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120"]
