# SpeakFlow AI - Project Documentation

## Overview

**SpeakFlow AI** (also referred to as **SpeechGyms**) is an intelligent impromptu speaking coach that simulates real-world pressure and provides deep AI analysis of speech logic, delivery, and structure.

- **Domain:** https://www.speechgyms.com
- **Created:** March 2026
- **Current Version:** v1.0.3
- **Status:** Live on Azure App Service

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 19 + TypeScript             |
| Backend     | Node.js + Express                 |
| Build       | Vite 6.2                          |
| Styling     | Tailwind CSS (CDN)                |
| Icons       | Lucide React                      |
| Charts      | Recharts (Radar charts)           |
| AI          | Google Gemini API (`@google/genai`) |
| Database    | PostgreSQL (Azure)                |
| Auth        | Google OAuth (server-side redirect) |
| Payments    | Stripe (subscriptions)            |
| Hosting     | Azure App Service (Docker)        |
| CI/CD       | GitHub Actions → ACR → Azure Webhook |
| Registry    | Azure Container Registry (n8nhobbylandacr.azurecr.io) |

---

## Azure Resources

| Resource | Name | Resource Group |
|----------|------|----------------|
| App Service | hobbyland-speechgyms | hobbyland-interview-rg |
| Container Registry | n8nhobbylandacr | n8n-hobbyland-rg |
| Database | n8n-hobbyland-pg.postgres.database.azure.com | n8n-hobbyland-rg |
| Database Name | speechgyms_db | — |

---

## CI/CD Pipeline

GitHub Actions workflow: `.github/workflows/main_hobbyland-speechgyms.yml`

**Flow:** Push to `main` → Build Docker image → Push to ACR (`:latest` + `:sha`) → `az login` → `az webapp config container set` to pin App Service to the new SHA → `az webapp restart`.

- Build pushes two tags: `speechgyms-app:latest` and `speechgyms-app:<commit-sha>`
- GitHub repo: `casterfile/hobbyland-speechgyms`
- Resource group: `hobbyland-interview-rg` (despite the name, this is also the speechgyms RG)

**GitHub Secrets:**
| Secret | Purpose |
|--------|---------|
| ACR_USERNAME | Azure Container Registry login |
| ACR_PASSWORD | Azure Container Registry password |
| GEMINI_API_KEY | Google Gemini API key (build-time) |
| AZURE_CREDENTIALS | Service-principal JSON for `azure/login@v2` |

### ⚠️ Known issue: AZURE_CREDENTIALS is currently dead

As of 2026-04-30, the service principal in `AZURE_CREDENTIALS` returns
`No subscriptions found` at the `Log in to Azure` step. The Docker build/push
to ACR still succeeds (it uses ACR_USERNAME/ACR_PASSWORD), but the webapp
update step is skipped, so a green CI run is *not* a deployed run.

**Manual deploy workaround** (run from local where `az` is logged in):

```bash
SHA=$(git rev-parse HEAD)
az webapp config container set \
  --name hobbyland-speechgyms \
  --resource-group hobbyland-interview-rg \
  --container-image-name "n8nhobbylandacr.azurecr.io/speechgyms-app:${SHA}"
az webapp restart \
  --name hobbyland-speechgyms \
  --resource-group hobbyland-interview-rg
```

**Permanent fix:** rotate the service principal and replace `AZURE_CREDENTIALS`
in the GitHub repo secrets:

```bash
SUB=$(az account show --query id -o tsv)
az ad sp create-for-rbac \
  --name "github-speechgyms-deploy" \
  --role contributor \
  --scopes "/subscriptions/$SUB/resourceGroups/hobbyland-interview-rg" \
  --sdk-auth
# Paste the JSON output as the AZURE_CREDENTIALS value in repo settings.
```

---

## Authentication

**Google OAuth** — server-side redirect flow (same pattern as LibriAI)

1. User clicks "Sign in" → redirects to `/api/auth/google`
2. Google OAuth consent → callback to `/api/auth/google/callback`
3. Server exchanges code for tokens, gets user info
4. Upserts user in DB, creates JWT (30-day expiry)
5. Redirects to `/?token=<jwt>` → frontend stores in localStorage

**Google Cloud Console:**
- Client ID: configured in Azure app settings (`GOOGLE_CLIENT_ID`)
- Redirect URI: `https://www.speechgyms.com/api/auth/google/callback`

---

## Subscription / Payment System

**Stripe** — monthly/yearly subscriptions with 7-day free trial

### Plans
| Plan | Price | Stripe Price ID |
|------|-------|-----------------|
| Monthly | $9.90/month | price_1T95LpBuLLY7wVwEh7oWIRju |
| Yearly | $59.90/year | price_1T95M0BuLLY7wVwEbRMUeJQ6 |

### Subscription Statuses
| Status | Meaning |
|--------|---------|
| EXPIRED | No subscription (free user) |
| PAID_TRIAL | 7-day trial active (from Stripe checkout or trial code) |
| ACTIVE | Paid and active |
| CANCELLED | Cancelled but still active until period end |
| PAST_DUE | Payment failed |

### Paywall Gating (Analysis Page)
Free users see limited content with gradient fade + "Upgrade to Pro" CTA:

| Section | Free | Pro |
|---------|------|-----|
| Score + Radar chart | Full | Full |
| Pacing (WPM) + Fillers | Full | Full |
| Audio playback | Full | Full |
| Transcript | Full | Full |
| Recommended Frameworks | 1 of 3 | All |
| Vocabulary Lab | 50% | Full |
| Structure Analysis | 2 of 4 | Full |
| Model Answer | 40% | Full |
| Strengths/Weaknesses | 50% | Full |
| Virtual Coach | Locked | Full |
| Drill Recommendation | Locked | Full |
| Translation | Locked | Full |

### Stripe Webhook
- Endpoint: `POST /api/stripe/webhook` (raw body, before JSON parser)
- Secret: stored in `STRIPE_WEBHOOK_SECRET` env var
- Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.payment_succeeded`

---

## Trial Code System

Shareable promo codes that give users free Pro trial without credit card.

### How to Share

**Option 1 — Shareable link (auto-opens redeem modal):**
```
https://www.speechgyms.com/?code=SPEECHPRO7
https://www.speechgyms.com/?code=VIPACCESS
```

**Option 2 — Manual entry:**
- Home page → green "Code" button (visible for free users)
- Pricing page → "Have a trial code?" section

### Pre-loaded Codes

| Code | Trial Days | Max Uses | Purpose |
|------|-----------|----------|---------|
| SPEECHPRO7 | 7 days | Unlimited | General sharing |
| SPEAKFREE14 | 14 days | 50 uses | Extended trial promo |
| LAUNCH2026 | 7 days | 100 uses | Launch campaign |
| VIPACCESS | 30 days | 10 uses | VIP/influencer access |

### Creating New Codes

Connect to the database and insert:
```sql
-- Connect
psql "host=n8n-hobbyland-pg.postgres.database.azure.com port=5432 dbname=speechgyms_db user=n8nadmin sslmode=require"
-- Password: N8nSecure2026Hk

-- Create a new code
INSERT INTO trial_codes (code, trial_days, max_uses)
VALUES ('MYCODE', 7, 50);

-- Create unlimited code
INSERT INTO trial_codes (code, trial_days)
VALUES ('UNLIMITED7', 7);

-- Create code with expiry date
INSERT INTO trial_codes (code, trial_days, max_uses, expires_at)
VALUES ('SUMMER2026', 14, 100, '2026-09-01');

-- Check usage stats
SELECT code, trial_days, max_uses, times_used FROM trial_codes;

-- See who redeemed what
SELECT tc.code, u.email, u.name, tcr.redeemed_at
FROM trial_code_redemptions tcr
JOIN trial_codes tc ON tc.id = tcr.code_id
JOIN users u ON u.id = tcr.user_id
ORDER BY tcr.redeemed_at DESC;
```

### Validation Rules
- Case-insensitive matching
- Checks expiry date (if set)
- Checks max uses limit (if set)
- One redemption per user per code
- Cannot redeem if already on active trial or paid subscription

### Database Tables
```sql
trial_codes (id, code, trial_days, max_uses, times_used, expires_at, created_at)
trial_code_redemptions (id, code_id, user_id, redeemed_at) -- unique(code_id, user_id)
```

---

## Project Structure

```
speakflow-ai_speechgyms/
├── App.tsx                    # Main app component, state management, routing
├── index.tsx                  # React root entry point
├── index.html                 # HTML shell (Tailwind CDN, importmap)
├── types.ts                   # All TypeScript types/enums/interfaces
├── vite.config.ts             # Vite config (env vars, port 3000)
├── package.json               # Dependencies and scripts
├── Dockerfile                 # Docker build (frontend + backend)
├── .github/workflows/
│   └── main_hobbyland-speechgyms.yml  # CI/CD pipeline
├── backend/
│   └── index.js               # Express server (auth, subscriptions, API, static files)
├── components/
│   ├── Home.tsx               # Landing page, session history, stats, daily tips
│   ├── SessionSetup.tsx       # Topic selection, mode/level/language config
│   ├── Stage.tsx              # Speech recording stage (audio only, timer)
│   ├── Analysis.tsx           # Full analysis results with paywall gating
│   ├── DebateSession.tsx      # Debate mode (constructive -> AI counter -> rebuttal)
│   ├── DrillSession.tsx       # Quick drill exercises (logic, flow, content, impact)
│   ├── VirtualAudience.tsx    # Visual audience simulation (local portrait images)
│   ├── VirtualCoach.tsx       # AI chat coach for post-analysis Q&A
│   ├── PricingPage.tsx        # Subscription plans + trial code input
│   ├── UpgradePrompt.tsx      # Modal for expired/failed subscription prompts
│   ├── SubscriptionBadge.tsx  # Free/Trial/Pro badge in header
│   └── TrialCodeModal.tsx     # Trial code redemption modal (URL param + manual)
├── services/
│   ├── geminiService.ts       # All Gemini AI API calls
│   ├── historyService.ts      # Session history API calls
│   ├── authService.ts         # Google OAuth (login, callback, JWT, logout)
│   └── subscriptionService.ts # Stripe subscription + trial code API calls
├── public/
│   ├── favicon.png
│   ├── logo.png
│   └── audience/              # Local portrait images for virtual audience
│       ├── sarah.jpg
│       ├── michael.jpg
│       ├── david.jpg
│       ├── emily.jpg
│       └── james.jpg
└── Documents/
    ├── PROJECT.md             # This file
    └── speaker_app_logo.png
```

---

## Session Modes

| Mode      | Description                                                    |
|-----------|----------------------------------------------------------------|
| SPEECH    | Classic impromptu speech - choose topic, record, get analyzed  |
| EXPRESS   | Quick expression practice                                      |
| COMEDY    | Comedy/humor-focused speech practice                           |
| DEBATE    | Structured debate: Constructive -> AI Counter -> Rebuttal      |

---

## Drill Types

| Drill    | Focus                                    |
|----------|------------------------------------------|
| LOGIC    | Connect unrelated words logically        |
| FLOW     | Anti-filler words, pacing focus          |
| CONTENT  | Rapid fire, zero prep speaking           |
| IMPACT   | Metaphors and emotional delivery         |

---

## Education Levels

| Level        | Target Audience    | CEFR  |
|--------------|-------------------|-------|
| ELEMENTARY   | 7-9 year old      | A1    |
| MIDDLE_SCHOOL| 11-13 year old    | A2/B1 |
| HIGH_SCHOOL  | 14-17 year old    | B2    |
| UNIVERSITY   | Adult/Professional| C1/C2 |

---

## AI Integration (Gemini)

All AI calls go through `services/geminiService.ts`:

| Function                  | Model                      | Purpose                                        |
|---------------------------|----------------------------|-------------------------------------------------|
| `generateTopic`           | gemini-3-flash-preview     | Generate random speech topics                   |
| `generateDrillChallenges` | gemini-3-flash-preview     | Generate drill prompts                          |
| `analyzeSpeech`           | gemini-3-pro-preview       | Full speech analysis from audio (multimodal)    |
| `analyzeDebateSession`    | gemini-3-pro-preview       | Debate round analysis (dual audio + text)       |
| `generateDebateCounter`   | gemini-3-flash-preview     | AI opponent counter-argument from audio         |
| `translateText`           | gemini-3-flash-preview     | Translate analysis to other languages           |
| `generateTopicOutline`    | gemini-3-flash-preview     | Generate topic mindmap/outline                  |
| `createCoachChat`         | gemini-3-flash-preview     | Create interactive coaching chat session        |
| `analyzeDrillBatch`       | gemini-3-flash-preview     | Analyze batch of drill recordings               |

**Key patterns:**
- Audio is converted to base64 and sent as `inlineData` parts
- Responses use structured JSON schema (`responseMimeType: "application/json"`)
- Retry logic with exponential backoff for 503/429 errors
- WPM calculated from transcript (word count for English, character count for CJK)
- Enhanced 12-point evaluation rubric for detailed scoring

---

## Backend API Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/auth/google` | No | Redirect to Google OAuth |
| GET | `/api/auth/google/callback` | No | Google OAuth callback |
| GET | `/api/auth/me` | Yes | Get current user |
| GET | `/api/subscription/config` | No | Get Stripe publishable key + prices |
| GET | `/api/subscription/status` | Yes | Get subscription status/tier |
| POST | `/api/subscription/checkout` | Yes | Create Stripe checkout session |
| POST | `/api/subscription/portal` | Yes | Create Stripe billing portal |
| POST | `/api/stripe/webhook` | No | Stripe webhook handler |
| POST | `/api/trial-code/redeem` | Yes | Redeem a trial code |
| GET | `/api/health` | No | Health check |
| GET | `/api/sessions` | Optional | Get session history |
| POST | `/api/sessions` | Optional | Save session |
| POST | `/api/drills` | Optional | Save drill result |
| POST | `/api/chats` | Optional | Save chat log |

---

## Environment Variables (Azure App Settings)

| Variable | Purpose |
|----------|---------|
| DATABASE_URL | PostgreSQL connection string |
| JWT_SECRET | JWT signing secret |
| GOOGLE_CLIENT_ID | Google OAuth client ID |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret |
| GOOGLE_REDIRECT_URI | OAuth callback URL |
| STRIPE_SECRET_KEY | Stripe secret key |
| STRIPE_PUBLISHABLE_KEY | Stripe publishable key |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret |
| STRIPE_MONTHLY_PRICE_ID | Stripe monthly price ID |
| STRIPE_YEARLY_PRICE_ID | Stripe yearly price ID |
| FRONTEND_URL | Frontend URL for redirects |
| PORT | Server port (default 8080) |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| users | User accounts (Google OAuth) |
| subscriptions | Subscription status per user |
| sessions | Speech session history + full analysis |
| drills | Drill exercise results |
| chat_logs | Virtual coach chat history |
| trial_codes | Promo/trial codes |
| trial_code_redemptions | Code redemption tracking |

### sessions schema notes

- `user_id` — nullable; null when the user wasn't signed in at save time.
- `device_id` — nullable text; stable per-browser UUID so anonymous saves stay
  scoped to the device that made them. Auto-added on backend boot via
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id TEXT`. An index
  `idx_sessions_device_id` is created alongside.

Pre-existing rows from before the migration have `device_id IS NULL`, so they
no longer appear to anyone (previously they were visible to *all* anonymous
viewers — a bug). To revive an old anon session, set its `user_id` manually.

---

## Session History & Save Resilience

### Anonymous + post-login claim flow

Every browser stores a UUID at `localStorage.speechgyms_device_id` and sends
it as `X-Device-Id` on every API call (`services/authService.ts:getDeviceId`).
This is the identity used by the backend when the JWT is missing or expired.

**`GET /api/sessions`:**
- Logged in: returns `WHERE user_id = $userId OR (user_id IS NULL AND device_id = $deviceId)` and *also* runs `claimDeviceSessions` (see below) before the SELECT.
- Anonymous + device id: returns `WHERE user_id IS NULL AND device_id = $deviceId`.
- No identity at all: returns `[]` (no more global anon pool).

**`POST /api/sessions`:** stores both `user_id` (nullable) and `device_id`. If
the user is authed, it also runs `claimDeviceSessions` so the moment they save
something while signed in, any anonymous rows from this device get attributed
to them.

**`claimDeviceSessions(userId, deviceId)`** in `backend/index.js`:

```sql
UPDATE sessions SET user_id = $1
WHERE user_id IS NULL AND device_id = $2
```

Triggered on three paths:
1. `GET /api/sessions` when authed.
2. `POST /api/sessions` when authed.
3. `GET /api/auth/me` when called with `X-Device-Id` (this is the natural
   moment immediately after the OAuth redirect).

### Save retry + offline queue

`services/historyService.ts`:

- `saveHistoryItem` retries the POST once after 800ms.
- If both attempts fail, the unsaved item is appended to
  `localStorage.speechgyms_pending_saves` and the function returns
  `{ ok: false, error }` (instead of swallowing the error like the old
  fire-and-forget version did).
- `getHistory` calls `flushPending` first, so opening Recent Sessions is the
  natural moment we re-try anything queued.
- `retryPendingSaves` is the manual retry hook used by the Analysis page banner.

### Analysis page banner

When `App.handleSessionFinish` / `handleDebateFinish` get a non-ok save, they
set `saveError` + `lastUnsavedItem`. The Analysis page renders a red banner
with a "Retry now" button at the top of the page. The retry calls
`saveHistoryItem(lastUnsavedItem)`; on success the banner clears.

### History view

`components/History.tsx` renders the full list (up to 50 rows from the API),
with three states: loading, empty (`There are no sessions yet.`), and populated.
The Home page hides its "View All" link entirely when `history.length === 0`
to avoid landing on an empty page.

---

## App Flow

```
HOME -> SETUP -> STAGE (record audio) -> Analysis (AI processing) -> ANALYSIS (results)
                    |                                                      |
                    +-> DEBATE_SESSION (debate flow)                       +-> DRILL (targeted practice)
                                                                           +-> VirtualCoach (chat)
                                                                           +-> PRICING (upgrade)
```

1. **Home** - View stats, history, daily tip, choose mode, redeem trial code
2. **Setup** - Configure topic (random or custom), duration, language, level
3. **Stage** - Optional prep time → Countdown → Record speech (audio only, virtual audience)
4. **Analysis** - Full AI breakdown with paywall gating (free vs Pro)
5. **Drills** - Targeted practice exercises from analysis weaknesses (Pro)
6. **Coach** - Chat with AI coach about your performance (Pro)
7. **Pricing** - Subscription plans + trial code redemption

---

## Development

```bash
# Install dependencies
npm install

# Run locally (default port 3000)
npm run dev

# Run backend locally
node backend/index.js

# Build for production
npm run build

# Docker build
docker build -t speechgyms-app .
```
