# Ethos — Charity Platform

A transparent digital platform for managing charitable projects and shares: from creating, approving, and publishing a project, through
shares, subscriptions, payments, revenues, expenses, and budgets, all the way to reports and financial closure.

> **Django 4.2 + Django REST Framework + React 18 (Vite) + Tailwind — Arabic RTL — a single Docker image.**
> [`DECISIONS.md`](DECISIONS.md) summarizes all architectural decisions, and [`docs/DOMAIN_CONTRACT.md`](docs/DOMAIN_CONTRACT.md)
> covers the data model and the API contract. The full specifications are in [`claude.md`](claude.md).

---

## Architecture

```
Single repository (Monorepo)
├── Django (backend)          Application engine + REST API under /api/v1/
│   └── apps/                  core · accounts · organizations · projects ·
│                              contributions · finance · communications · reports · audit
├── React (frontend/)         SPA built with Vite into static/frontend/
├── Django template           templates/app/index.html serves the SPA
└── Docker image (single)     Django + built React + Gunicorn + WhiteNoise
```

- **Authentication:** Secure Django session (HttpOnly + CSRF) + login via OTP on the phone number. No tokens in the browser.
- **Notifications:** **Outbox** pattern for WhatsApp messages — financial approval does not fail if sending fails.
- **Money:** Always `Decimal`, SAR currency, reference numbers such as `PRJ-2026-0001` / `PAY-2026-000456`.
- **Audit:** A non-deletable log for every sensitive operation.
- **Database:** SQLite for development/trial, external PostgreSQL for production.

## Design System (Ethos)

- Colors: Forest green `#004331` (primary) + navy blue `#455f88` (secondary) + a bright green for contributions.
- Fonts: `IBM Plex Sans Arabic` for headings, `Plus Jakarta Sans` for body text, `JetBrains Mono` for reference numbers.
- Character: Transparent · trustworthy · methodical, and a fully Arabic RTL interface. The tokens are in `frontend/tailwind.config.js`.

---

## Quick Start (development)

Requires Python 3.9+ and Node 18+.

### 1) Backend (Django)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # demo accounts and data
python manage.py runserver          # http://localhost:8000
```

### 2) Frontend (React) — in another terminal

```bash
cd frontend
npm install
npm run dev                         # http://localhost:5173 (proxies /api to :8000)
```

Open <http://localhost:5173> for development with HMR, or build the frontend (`npm run build`) and open
<http://localhost:8000> to have Django serve it from a single template.

### Processing notifications and reminders (optional in development)

```bash
python manage.py process_outbox        # sends pending WhatsApp messages (Console backend in development)
python manage.py send_due_reminders    # creates installment reminders
```

---

## Running via Docker (single image)

```bash
# A single application image + PostgreSQL + a scheduled worker
docker compose up --build
# Application: http://localhost:8000   |   Django admin: http://localhost:8000/admin/
```

Health checks: `GET /health/live/` and `GET /health/ready/`.

---

## Demo Accounts

After `seed_demo` (fictitious Omani `+968` numbers; phone login shows the OTP in the server log). Two accounts also carry an email + password so you can test the email/password login and registration flow:

| Role | Phone | Email + password | Notes |
|---|---|---|---|
| Platform Admin | `+96895000001` | `admin@ataa-oman.org` / `admin12345` | Also a superuser for the `/admin/` panel |
| Organization Manager | `+96895000002` | `manager@ataa-oman.org` (OTP) | Organization "فريق عطاء عُمان التطوعي" |
| Project Owner | `+96895000003` | `owner@ataa-oman.org` (OTP) | Manages several projects |
| Finance Officer | `+96895000004` | `finance@ataa-oman.org` (OTP) | Approves payments and expenses |
| Auditor | `+96895000005` | `auditor@ataa-oman.org` (OTP) | Reviews operations |
| Contributor | `+96895000010` | `contributor@example.com` / `user12345` | Demo subscriptions and payments |

> **Two ways to sign in at `/login`:**
> - **Email + password** — e.g. `admin@ataa-oman.org` / `admin12345` (works immediately, no OTP).
> - **Phone + OTP** — enter the `+968…` number, then read the code from the server log (`OTP for +968… = ####`).
>
> New users can self-register at `/register` with email + password (phone optional) or with phone + OTP.
> The Platform Admin can also log in to `/admin/` with the password above. The platform currency is the **Omani Rial (OMR / ر.ع.)**.

---

## Project Structure

```
config/            Django settings (base/development/production) + urls/wsgi
apps/core/         base models · money · reference numbers · permissions · health · Vite integration
apps/accounts/     users · OTP · sessions · roles
apps/organizations/ organizations · members · verification
apps/projects/     projects · categories · stages · updates · transparency
apps/contributions/ share types · subscriptions · installments
apps/finance/      payments · allocations · revenues · in-kind · expenses · suppliers · budget · receipts
apps/communications/ WhatsApp · Outbox · campaigns · notifications
apps/reports/      financial and operational reports · PDF/Excel export
apps/audit/        non-deletable audit log
frontend/          React application (Vite + Tailwind + React Router + React Query)
templates/app/     the SPA-serving template
docs/              the domain and API contract
```

## Tests

```bash
python manage.py test          # business-rule tests (payment allocation, approval, balances)
```

## Roadmap

A complete MVP (registration, projects, shares, payments, revenues/expenses, budget, dashboards, transparency, reports, WhatsApp,
audit) — then a payment gateway, PWA, Celery/Redis, Object Storage, and advanced analytics (see `claude.md §23`).
