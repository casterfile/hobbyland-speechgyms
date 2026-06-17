# SpeechGyms — Railway Deployment

**This is the current source of truth.** SpeechGyms migrated off Azure on **2026-06-17**. The legacy Azure setup in [`Documents/PROJECT.md`](Documents/PROJECT.md) is historical reference only — the App Service is dead and the Postgres server it depended on (`n8n-hobbyland-pg`) was deleted from DNS.

---

## Public access

- **https://www.speechgyms.com/** — primary
- **https://speechgyms.com/** — apex, same site
- **https://hobbyland-speechgyms-production.up.railway.app/** — Railway service URL, bypasses Cloudflare (useful for direct origin testing)

SSL is terminated at Cloudflare with the Universal SSL cert (Google Trust Services, `CN=speechgyms.com`). Railway's auto Let's Encrypt for the custom domain never issued (`certificates: []` after hours) — same stuck pattern Slayjobs hit. The Cloudflare Worker proxy below sidesteps that entirely.

---

## Topology

```
client
  │  https://www.speechgyms.com
  ▼
Cloudflare edge (Universal SSL, proxy ON)
  │  Worker route *speechgyms.com/* + *.speechgyms.com/*
  ▼
Worker speechgyms-proxy
  │  rewrites Host: hobbyland-speechgyms-production.up.railway.app
  │  fetch upstream HTTPS
  ▼
Railway service hobbyland-speechgyms (Node 20, port 8080)
  │  Express serves /api/* + static dist/
  │  postgres.railway.internal
  ▼
Railway service Postgres (postgres-volume)
```

### Railway

- Project: `speechgyms` (`49053cbf-7cbe-4c73-934f-734466422ede`), Workspace "My Projects" (ops5@hobbyland-group.com)
- Service `hobbyland-speechgyms` — Dockerfile build from `hobbyland-tony/hobbyland-speechgyms` `main`
- Service `Postgres` — Railway-managed Postgres 17, volume `postgres-volume`. Restored 2026-06-17 from `Documents/n8n_Azure/db_backups/speechgyms_db.dump` (dated 2026-03-19). ~3 months of session/user data lost; subscription status reconciled via Stripe webhooks.
- `DATABASE_URL` on the app is a reference variable `${{Postgres.DATABASE_URL}}` (internal `postgres.railway.internal:5432`)

### Cloudflare

- Zone: `speechgyms.com` (ID `828208a00b38863ecda4f3c882b6bf09`) on account `Hobbyland.design@gmail.com's Account` (ID `e7dac8a1c8816c0f3303f1935e422a10`)
- DNS:
  - `CNAME www.speechgyms.com → hobbyland-speechgyms-production.up.railway.app` — **proxied (orange-cloud) ON, required for Worker route to fire**
  - `CNAME speechgyms.com → hobbyland-speechgyms-production.up.railway.app` — same
  - Zoho MX + DKIM + SPF + `asuid.*` Azure-leftover TXT records left in place (harmless)
- Worker:
  - Account-level script `speechgyms-proxy` on the same Hobbyland.design account
  - Routes: `*speechgyms.com/*` and `*.speechgyms.com/*` → script `speechgyms-proxy`
  - Source-of-truth Worker code lives at [`infra/cloudflare-worker.js`](infra/cloudflare-worker.js). To redeploy, paste it in the Cloudflare dashboard at Workers & Pages → `speechgyms-proxy` → Edit code → Deploy.

---

## Deploy flow

`git push` to `hobbyland-tony/hobbyland-speechgyms` `main` is the whole flow. Railway watches the branch, builds the Dockerfile, and ships. The old Azure manual-deploy workaround (`az webapp config container set`) is obsolete and should not be run.

```bash
git push origin main
# Railway picks it up, ~2 min build, ~30s rollout
```

To monitor: `railway logs --service hobbyland-speechgyms` from `workflows/speakflow-ai_speechgyms/` (the dir is linked).

---

## Environment variables

Set on Railway service `hobbyland-speechgyms`. **None of these live in this repo or in `.env.local`.** A snapshot of the prod set is kept at `~/.config/hobbyland-secrets/speechgyms-railway-env-2026-06-17.json` for disaster recovery.

| Var | Purpose | Source |
|---|---|---|
| `DATABASE_URL` | Postgres connection | Reference: `${{Postgres.DATABASE_URL}}` |
| `NODE_ENV` | App env | `production` |
| `FRONTEND_URL` | Used for OAuth redirects | `https://www.speechgyms.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth | Carried over from Azure backup |
| `GOOGLE_REDIRECT_URI` | OAuth callback | `https://www.speechgyms.com/api/auth/google/callback` |
| `JWT_SECRET` | Session signing | Carried over (do not rotate without invalidating sessions) |
| `GEMINI_API_KEY` | AI analysis | Same key as Azure |
| `ANTHROPIC_API_KEY` / `ANTHROPIC_API_KEY_FALLBACK` | AI fallbacks | Same |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments | Same |
| `STRIPE_MONTHLY_PRICE_ID` / `STRIPE_YEARLY_PRICE_ID` | Subscription plans | Same |

---

## Why the Cloudflare Worker (not Railway's custom domain directly)?

Tried, in this order, before landing on the Worker:

1. **Railway custom domain + LE cert.** Added `www.speechgyms.com` + apex as Railway custom domains. Status reached `DNS_RECORD_STATUS_PROPAGATED` but `certificates: []` stayed empty for hours. This is the same LE-stuck pattern that hit Slayjobs for 4 days. Deleting + recreating the domain entry didn't help.
2. **Cloudflare Tunnel.** Created `speechgyms-railway` tunnel + deployed `cloudflare/cloudflared` as a sibling Railway service. Tunnel reached `healthy` with 4 connections. But the tunnel was on the `hkdesignpro` Cloudflare account while `speechgyms.com` zone lives on the `Hobbyland.design` account → CF edge returned `1033` because cross-account tunnel routing is not supported. Deleted both.
3. **Cloudflare Worker.** Final solution. Worker is on the same `Hobbyland.design` account as the zone, routes intercept before origin lookup, SSL is CF Universal so Railway's broken LE is irrelevant.

Two custom domains (`www.speechgyms.com`, `speechgyms.com`) remain registered on the Railway service from attempt #1. They're harmless and ignored — the Worker route fires first.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cloudflare 1033 Tunnel error` on `www.speechgyms.com` | DNS got repointed at a dead tunnel | Reset CNAME to `hobbyland-speechgyms-production.up.railway.app`, proxy ON |
| `404 Application not found` (Railway fallback page) at the custom domain | Worker route is missing or broken; CF reached Railway directly | Verify routes `*speechgyms.com/*` and `*.speechgyms.com/*` both bound to script `speechgyms-proxy` |
| `500` from app, logs show `getaddrinfo ENOTFOUND ...azure...` | Stale `DATABASE_URL` still pointing at the dead Azure PG | Reset `DATABASE_URL=${{Postgres.DATABASE_URL}}` and redeploy |
| Origin URL (`hobbyland-speechgyms-production.up.railway.app`) works but `www.speechgyms.com` returns Worker 5xx | Worker script broken or upstream service hostname changed | Re-paste `infra/cloudflare-worker.js` in dashboard, redeploy |

---

## Accounts / access

- Railway: `ops5@hobbyland-group.com` (CLI: `railway login --browserless`)
- GitHub: `hobbyland-tony/hobbyland-speechgyms` (mirror at `casterfile/hobbyland-speechgyms`)
- Cloudflare: zone owner is `Hobbyland.design@gmail.com`. Multi-account user `hkdesignpro.mgt@gmail.com` has membership and can manage it via the legacy Global API Key (`X-Auth-Email` + `X-Auth-Key` headers).
- Stripe / Google OAuth / Gemini / Anthropic: unchanged from Azure days.
