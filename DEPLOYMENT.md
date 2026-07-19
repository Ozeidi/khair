# Deployment — منصة الخير (Khair) on the ozeidi.io VPS

CI/CD via GitHub Actions → GHCR → the Contabo VPS behind the central nginx.
Read alongside [`VPS_Handover.md`](VPS_Handover.md) (the server's operations guide).

| Env | Branch | Subdomain | Image tag | VPS dir | nginx alias |
|-----|--------|-----------|-----------|---------|-------------|
| production | `main` | `khair.ozeidi.io` | `ghcr.io/ozeidi/khair:prod` | `/root/apps/khair-prod` | `khair-prod` |
| staging | `develop` | `khair-test.ozeidi.io` | `ghcr.io/ozeidi/khair:staging` | `/root/apps/khair-staging` | `khair-staging` |

**Flow:** push to `main`/`develop` → Actions builds the single Docker image, pushes it to GHCR, then SSHes to the VPS and runs `docker compose pull && up -d` in the matching directory.

> The app image, `entrypoint.sh`, and `config.settings.production` are unchanged from the app repo. Only the files under [`deploy/vps/`](deploy/vps/) and [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) are deploy-specific.

---

## 0. One-time prerequisites (who does what)

| Step | Owner | Blocking? |
|------|-------|-----------|
| Re-authenticate GitHub CLI (`gh auth login`) | **You** | Yes — needed to create/push the repo |
| Add DNS A records at DreamHost | **You** (DreamHost creds) | Yes — needed before TLS issuance |
| Everything else (repo, secrets, VPS provisioning, TLS, deploy) | Can be scripted | No |

---

## 1. DNS (DreamHost) — do this first

DreamHost → Manage Domains → DNS for `ozeidi.io`. **Host = prefix only** (it appends `.ozeidi.io`):

```
A   khair        → <VPS_IP>
A   khair-test   → <VPS_IP>
```

Verify before continuing (must return the VPS IP):

```bash
dig +short khair.ozeidi.io
dig +short khair-test.ozeidi.io
```

---

## 2. GitHub repository + secrets

1. **Create & push**:
   ```bash
   gh auth login                      # if the local token is invalid
   cd /path/to/Khair
   gh repo create ozeidi/khair --public --source=. --remote=origin --push
   git push -u origin main
   git push origin develop            # create the staging branch too
   ```

2. **CI deploy key** — a *dedicated* key for Actions (do NOT reuse `id_ozeidi_vps`):
   ```bash
   ssh-keygen -t ed25519 -f ./ci_deploy_key -N '' -C 'github-actions-khair'
   # authorize it on the VPS:
   ssh -i ~/.ssh/id_ozeidi_vps root@<VPS_IP> \
     "echo '$(cat ci_deploy_key.pub)' >> /root/.ssh/authorized_keys"
   ```

3. **Repository secrets** (used by both environments):
   ```bash
   gh secret set SSH_HOST       -b "<VPS_IP>"
   gh secret set SSH_USER       -b "root"
   gh secret set SSH_DEPLOY_KEY < ci_deploy_key      # the PRIVATE key
   # Pin the VPS host key so CI verifies it (no blind accept-new). Verified value:
   gh secret set SSH_KNOWN_HOSTS -b "$(ssh-keyscan -t ed25519 <VPS_IP>)"
   rm -f ci_deploy_key ci_deploy_key.pub             # keep only the GitHub copy
   ```
   > Re-verify the host key any time with `ssh-keyscan -t ed25519 <VPS_IP>`.

4. **GitHub Environments** `production` and `staging` (Settings → Environments). Optional but recommended: add a **required reviewer** on `production` so prod deploys need approval. (The workflow already targets these environments.)

---

## 3. VPS provisioning (once per environment)

SSH in: `ssh -i ~/.ssh/id_ozeidi_vps root@<VPS_IP>`

**a) Dedicated Postgres db + user** on the shared instance (per `VPS_Handover.md §7`):
```bash
# strong passwords — save them for the .env files below
docker exec -i postgres psql -U admin <<'SQL'
CREATE USER khair_prod    WITH PASSWORD 'PROD_DB_PASSWORD';
CREATE DATABASE khair_prod    OWNER khair_prod;
CREATE USER khair_staging WITH PASSWORD 'STAGING_DB_PASSWORD';
CREATE DATABASE khair_staging OWNER khair_staging;
SQL
```

**b) GHCR login** so `docker compose pull` can read the (private) image:
```bash
# PAT with read:packages scope, from the Ozeidi GitHub account
echo 'GHCR_PAT' | docker login ghcr.io -u ozeidi --password-stdin
```

**c) App directories + compose + env** (copy the files from this repo's `deploy/vps/`):
```bash
mkdir -p /root/apps/khair-prod /root/apps/khair-staging
# scp deploy/vps/prod/docker-compose.yml   → /root/apps/khair-prod/docker-compose.yml
# scp deploy/vps/staging/docker-compose.yml → /root/apps/khair-staging/docker-compose.yml
```
Create each `.env` from the matching `.env.example` and fill in real secrets:
```bash
# on the VPS, per env dir — generate secrets:
python3 -c "import secrets; print(secrets.token_urlsafe(64))"                      # SECRET_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # FIELD_ENCRYPTION_KEY
```
Set `DATABASE_URL` to the dedicated db/user from step (a).

**d) nginx vhosts** — copy the two conf files, validate, reload:
```bash
# scp deploy/vps/nginx/khair.conf      → /root/stack/nginx/conf.d/khair.conf
# scp deploy/vps/nginx/khair-test.conf → /root/stack/nginx/conf.d/khair-test.conf
docker exec nginx nginx -t && docker exec nginx nginx -s reload
```
> The vhosts' ACME `root /var/www/certbot;` is **verified correct** — the nginx
> container mounts `/root/stack/nginx/certbot-webroot → /var/www/certbot`, matching
> every existing vhost (mail/pgadmin/portainer/uptime-kuma). No edit needed.

---

## 4. TLS certificate

Add both subdomains to the shared Let's Encrypt cert (webroot method, per `VPS_Handover.md §6`):
```bash
certbot certonly --webroot -w /root/stack/nginx/certbot-webroot \
  --cert-name portainer.ozeidi.io --expand \
  -d portainer.ozeidi.io -d pgadmin.ozeidi.io -d status.ozeidi.io -d mail.ozeidi.io \
  -d khair.ozeidi.io -d khair-test.ozeidi.io \
  --non-interactive
sh /etc/letsencrypt/renewal-hooks/deploy/copy-to-nginx.sh   # deploy certs + reload nginx
```
(Or, once a `*.ozeidi.io` wildcard is set up per handover §11, no cert change is needed.)

---

## 5. First deploy

Either push to the branches (CI does it) or bring them up manually the first time:
```bash
cd /root/apps/khair-staging && docker compose pull && docker compose up -d
cd /root/apps/khair-prod    && docker compose pull && docker compose up -d
docker exec nginx nginx -t && docker exec nginx nginx -s reload
curl -I https://khair-test.ozeidi.io/health/ready/
curl -I https://khair.ozeidi.io/health/ready/
```
After this, every push to `develop` → staging and `main` → production deploys automatically.

**Create the platform admin** (no demo seed in prod):
```bash
cd /root/apps/khair-prod
docker compose exec app python manage.py createsuperuser   # prompts for phone (USERNAME_FIELD)
# then set a password/role, or seed a first org via the admin at /admin/
```
> Staging seeds demo data automatically (`SEED_DEMO=1`), so `khair-test.ozeidi.io` has the Omani demo accounts from `README.md`.

---

## 6. Operations

```bash
# per env dir on the VPS
docker compose ps
docker compose logs app --tail 100 -f
docker compose exec app python manage.py migrate      # ad-hoc (entrypoint already runs it)

# roll back to a specific build (images are also tagged with the git SHA)
#   edit image: ghcr.io/ozeidi/khair:<sha> in docker-compose.yml, then pull && up -d
```

**Security invariants (from `VPS_Handover.md`):** no `ports:` on app containers (nginx is the only entrypoint; Docker bypasses ufw); `.env` files never leave the server; app talks to shared Postgres/Redis only over `stack_backend`.
