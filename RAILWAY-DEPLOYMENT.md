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

> ⚠ **Discovered 2026-06-21:** the Railway service is in **local-upload mode** since the 2026-06-17 cutover used `railway up`. `git push` to GitHub no longer triggers a Railway rebuild — the service silently keeps serving the last `railway up` image. Until GitHub auto-deploy is reconnected via the Railway UI, use `railway up` for every deploy.

```bash
# from this dir (already linked to the speechgyms project)
git push origin main          # source-of-truth in git
railway up --service hobbyland-speechgyms --ci   # ships the deploy
# ~2 min build, ~30s rollout
```

To monitor: `railway logs --service hobbyland-speechgyms`.

**Verifying a deploy actually shipped:** the `console.log("SpeechGyms v1.0.3")` banner at `index.tsx:5` is a hardcoded string that nobody bumps — **do not** use it for version inference. Instead grab the bundle filename from `<script src="/assets/index-XXXXX.js">` and compare to the freshly-built one. Old build = old hash, fresh build = new hash.

The old Azure manual-deploy workaround (`az webapp config container set`) is obsolete and should not be run.

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
| `500` from `/api/ai/*`, logs show `[anthropic] error: 401 authentication_error: invalid x-api-key` | Anthropic key revoked (most likely by their anti-leak scanner) or expired | Rotate the Anthropic key — see "Rotating the Anthropic API key" below. Do **not** swap to Gemini. |
| `500` from `POST /api/sessions` with `value too long for type character varying(N)` | Restored DB is missing a column-widening migration | Run all `backend/migrations/*.sql` against Railway PG — the 2026-03-19 dump used at cutover predates the 2026-05-13 and 2026-06-21 widening migrations. Migrations are idempotent. |
| Site loads but UI features call `gemini-2.5-pro` directly from the browser and get `429 RESOURCE_EXHAUSTED` | Stale frontend bundle from before commit `3a5a9ea` is being served. The "SpeechGyms v1.0.3" console banner is misleading — it's a hardcoded string, *not* a real version. | Force a fresh build with `railway up --service hobbyland-speechgyms --ci` from this dir. Don't rely on `git push` (see Deploy flow note). |
| Frontend on a brand-new bundle still showing AI errors | `ANTHROPIC_API_KEY` env var on Railway is empty or holds a revoked key | Verify with `railway variables --service hobbyland-speechgyms`, rotate per procedure below |

---

## Rotating the Anthropic API key

Anthropic's anti-leak scanner can auto-revoke keys that end up in git or any public-ish surface. When that happens, all `/api/ai/*` routes return 500 with `authentication_error: invalid x-api-key` in the Railway logs.

```bash
# 1. Get a new key at https://console.anthropic.com/settings/keys
#    (name it "speechgyms-railway", copy the sk-ant-api03-... string immediately
#    — Anthropic only shows it once)

# 2. Set on Railway (this auto-redeploys the service)
railway variables --service hobbyland-speechgyms --set "ANTHROPIC_API_KEY=sk-ant-api03-..."

# 3. Backup with restrictive permissions
STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
echo "key (created: $STAMP, name: speechgyms-railway): sk-ant-api03-..." \
  > ~/.config/hobbyland-secrets/speechgyms-anthropic-key-${STAMP}.txt
chmod 600 ~/.config/hobbyland-secrets/speechgyms-anthropic-key-${STAMP}.txt

# 4. Smoke test
curl -s -X POST https://www.speechgyms.com/api/ai/topic \
  -H "Content-Type: application/json" \
  -d '{"speechLevel":"intermediate","educationLevel":"university"}' \
  -w "\nHTTP:%{http_code}\n"
# expect: {"topic":"..."} with HTTP:200 — first call after redeploy usually works
```

**Also rotate `ANTHROPIC_API_KEY_FALLBACK`** if you're already in the Anthropic console — the backend rotates to it on 429/5xx (`backend/ai.js:42`). Last incident (2026-06-21) only rotated the primary; fallback still holds an old revoked key.

**Don't propose swapping to Gemini.** Anthropic Claude is the intentional provider — `backend/ai.js` (~470 lines) and the prompts are tuned for Claude's response style. The Gemini code path at `backend/ai.js:110` is **only** for transcription fallback when the browser's Web Speech API fails. The Gemini free tier also has `limit: 0` for `gemini-2.5-pro`, so a Gemini-only backend would hit 429 immediately. See `~/.claude/projects/.../memory/feedback_speechgyms_ai_is_anthropic.md`.

---

## Accounts / access

- Railway: `ops5@hobbyland-group.com` (CLI: `railway login --browserless`)
- GitHub: `hobbyland-tony/hobbyland-speechgyms` (mirror at `casterfile/hobbyland-speechgyms`)
- Cloudflare: zone owner is `Hobbyland.design@gmail.com`. Multi-account user `hkdesignpro.mgt@gmail.com` has membership and can manage it via the legacy Global API Key (`X-Auth-Email` + `X-Auth-Key` headers).
- Anthropic: ask the owner for new keys when current ones are revoked — there's no shared service account; keys come from whichever Anthropic Console account holds the SpeechGyms billing.
- Stripe / Google OAuth / Gemini: unchanged from Azure days.
