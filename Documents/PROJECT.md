# SpeakFlow AI - Project Documentation

## Overview

**SpeakFlow AI** (also referred to as **SpeechGyms**) is an intelligent impromptu speaking coach that simulates real-world pressure and provides deep AI analysis of speech logic, delivery, and structure.

- **Origin:** Exported from Google AI Studio (https://ai.studio/apps/drive/1oeUtiOA0Hrq-OCkpirrN4q5yaSbOUFMJ)
- **Created:** March 2026
- **Status:** Local development, pending Azure deployment

---

## Tech Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 19 + TypeScript             |
| Build       | Vite 6.2                          |
| Styling     | Tailwind CSS (CDN)                |
| Icons       | Lucide React                      |
| Charts      | Recharts (Radar charts)           |
| AI          | Google Gemini API (`@google/genai`) |
| Storage     | localforage (IndexedDB)           |
| Font        | Inter (Google Fonts)              |

---

## Project Structure

```
speakflow-ai_speechgyms/
├── App.tsx                    # Main app component, state management, routing
├── index.tsx                  # React root entry point
├── index.html                 # HTML shell (Tailwind CDN, importmap)
├── types.ts                   # All TypeScript types/enums/interfaces
├── metadata.json              # AI Studio metadata (camera/mic permissions)
├── vite.config.ts             # Vite config (env vars, port 3000)
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript config
├── .env.local                 # GEMINI_API_KEY (gitignored via *.local)
├── .gitignore                 # Standard Vite gitignore
├── components/
│   ├── Home.tsx               # Landing page, session history, stats, daily tips
│   ├── SessionSetup.tsx       # Topic selection, mode/level/language config
│   ├── Stage.tsx              # Speech recording stage (camera, timer, audio)
│   ├── Analysis.tsx           # Full speech analysis results (radar chart, scores)
│   ├── DebateSession.tsx      # Debate mode (constructive -> AI counter -> rebuttal)
│   ├── DrillSession.tsx       # Quick drill exercises (logic, flow, content, impact)
│   ├── VirtualAudience.tsx    # Visual audience simulation during speeches
│   ├── VirtualCoach.tsx       # AI chat coach for post-analysis Q&A
│   └── Onboarding.tsx         # First-time user onboarding
├── services/
│   ├── geminiService.ts       # All Gemini AI API calls
│   └── historyService.ts      # IndexedDB history persistence
└── Documents/                 # Project documentation
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

Each level constrains vocabulary, topic complexity, and AI feedback appropriateness.

---

## Speech Levels

- **BEGINNER** - Basic speaking practice
- **ADVANCED** - Intermediate challenges
- **EXPERT** - Professional-level evaluation

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

---

## Analysis Output (AnalysisResult)

Each speech analysis returns:

- **overallScore** (0-100)
- **subScores** - logic, delivery, structure, vocabulary, emotion (0-100 each)
- **transcript** - AI-generated transcript from audio
- **modelAnswer** - Ideal reference speech for the topic
- **wpm** - Words per minute
- **fillerWordCount** - Count of filler words detected
- **structure** - PREP framework analysis (Point, Reason, Example, Point restated)
- **sentiment** - Overall emotional tone
- **speechFramework** - 2-3 polished script alternatives
- **vocabUpgrades** - Specific word/phrase improvement suggestions
- **grammarAnalysis** - Grammar corrections with reasons
- **strengths** / **weaknesses** - Summary lists
- **debateAnalysis** (debate mode only) - Separate constructive/rebuttal breakdowns

---

## Data Storage

- Uses **localforage** (IndexedDB wrapper) for browser-local persistence
- Database name: `InstantSpeechDB`, store: `history`
- Stores up to 50 session history items
- No server-side database (fully client-side)

---

## App Flow

```
HOME -> SETUP -> STAGE (record) -> Analysis (AI processing) -> ANALYSIS (results)
                    |                                               |
                    +-> DEBATE_SESSION (debate flow)                +-> DRILL (targeted practice)
                                                                    +-> VirtualCoach (chat)
```

1. **Home** - View stats, history, daily tip, choose mode
2. **Setup** - Configure topic (random or custom), duration, language, level
3. **Stage** - Optional prep time -> Countdown -> Record speech (camera + audio)
4. **Analysis** - Full AI breakdown with radar chart, transcript, model answer, vocab upgrades
5. **Drills** - Targeted practice exercises from analysis weaknesses
6. **Coach** - Chat with AI coach about your performance

---

## Environment Variables

| Variable        | File       | Description          |
|-----------------|------------|----------------------|
| GEMINI_API_KEY  | .env.local | Google Gemini API key |

The key is injected at build time via `vite.config.ts` as `process.env.API_KEY`.

---

## Development

```bash
# Install dependencies
npm install

# Run locally (default port 3000, override with --port)
npm run dev
# or
npx vite --port 4205

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Deployment Plan (Pending)

- **Target:** Azure App Service (Docker container)
- **Region:** Southeast Asia (Singapore)
- **Resource Group:** hobbyland-speechgyms-rg (to be created)
- **App Name:** hobbyland-speechgyms (to be created)
- **ACR:** n8nhobbylandacr.azurecr.io
- **Domain:** TBD (Cloudflare DNS pending)
- **Azure Account Required:** admin@hobbyland-group.com (Owner role)
  - dev@adminhobbylandgroup.onmicrosoft.com does NOT have permission to create resource groups

### Docker Requirements
- Need to create a Dockerfile (static site build + serve)
- Need to create GitHub Actions workflow for CI/CD
- Need to set GEMINI_API_KEY as build-time secret (it's embedded in the JS bundle)

> **SECURITY NOTE:** The Gemini API key is injected at build time into the client-side JavaScript bundle via Vite's `define` config. For production, consider moving AI calls to a backend proxy to protect the API key.

---

## Known Considerations

1. **API Key Exposure:** The Gemini API key is embedded in the client bundle. For production, a backend proxy should be used.
2. **Tailwind via CDN:** Uses `cdn.tailwindcss.com` script tag, not a build-time Tailwind setup. Fine for dev/prototyping, should be configured properly for production builds.
3. **Import Map in HTML:** The `index.html` contains an import map pointing to `aistudiocdn.com` — this is from the AI Studio export and is overridden by Vite's bundling in dev/build mode.
4. **Browser APIs:** Requires camera and microphone permissions (WebRTC `getUserMedia`).
5. **Audio Format:** Records in WebM format via MediaRecorder API.
6. **No Backend:** Fully client-side SPA — all AI calls go directly from browser to Gemini API.
