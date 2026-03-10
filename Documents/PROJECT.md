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

**Flow:** Push to `main` → Build Docker image → Push to ACR (`:latest` + `:sha`) → Trigger Azure webhook → App Service pulls new image

- **No Azure credentials needed** — uses ACR login + webhook
- Build pushes two tags: `speechgyms-app:latest` and `speechgyms-app:<commit-sha>`
- Azure App Service configured with Continuous Deployment webhook
- GitHub repo: `casterfile/hobbyland-speechgyms`

**GitHub Secrets:**
| Secret | Purpose |
|--------|---------|
| ACR_USERNAME | Azure Container Registry login |
| ACR_PASSWORD | Azure Container Registry password |
| GEMINI_API_KEY | Google Gemini API key (build-time) |
| AZURE_WEBHOOK_URL | App Service container webhook URL |

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
