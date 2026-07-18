#!/usr/bin/env bash
# Container startup (SRS §18.6): wait for DB, migrate, collectstatic, seed, then exec CMD.
set -euo pipefail

echo "==> منصة الخير: container starting"

# 1. Wait for the database (best-effort; skipped for SQLite).
python - <<'PY'
import os, time, sys
url = os.environ.get("DATABASE_URL", "")
if not url:
    print("No DATABASE_URL set -> using SQLite volume; skipping DB wait.")
    sys.exit(0)
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
django.setup()
from django.db import connections
from django.db.utils import OperationalError
for attempt in range(30):
    try:
        connections["default"].cursor().execute("SELECT 1")
        print("Database is ready.")
        sys.exit(0)
    except OperationalError:
        print(f"Waiting for database... ({attempt + 1}/30)")
        time.sleep(2)
print("Database not reachable; continuing anyway.")
PY

# 2. Apply migrations.
echo "==> Applying migrations"
python manage.py migrate --noinput

# 3. Collect static (idempotent; assets already built into the image).
echo "==> Collecting static files"
python manage.py collectstatic --noinput || true

# 4. Optional demo seed (set SEED_DEMO=1 to populate demo data).
if [ "${SEED_DEMO:-0}" = "1" ]; then
  echo "==> Seeding demo data"
  python manage.py seed_demo || true
fi

echo "==> Launching: $*"
exec "$@"
