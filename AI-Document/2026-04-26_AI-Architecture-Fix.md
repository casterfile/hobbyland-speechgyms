# Speechgyms AI Architecture — Fix Record + QA

**Date applied:** 2026-04-26
**Scope:** All AI features on speechgyms.com (deployed via the `hobbyland-speechgyms` Azure webapp).
**Sister doc:** `slayjobs/AI-Document/2026-04-26_AI-Architecture-Fix.md` — the same fix on slayjobs, applied a few hours earlier.

---

## TL;DR

Speechgyms originally called Google Gemini directly from the browser, with the API key baked into the Vite bundle at Docker build time. The key was **publicly visible** on www.speechgyms.com (anyone could open DevTools → Sources → search for `AIzaSy`). The fix moves all AI calls server-side, swaps the primary provider to **Anthropic Claude**, and uses the **browser's built-in Web Speech API** for live transcription so the app no longer depends on any third-party audio API.

**Live runtime dependency: Anthropic only.** The leaked Gemini key still needs to be rotated in GCP — that's an item for the user to do.

---

## What broke

| Symptom | Root cause |
|---|---|
| `AIzaSy*` Gemini API key visible in the public JS bundle | `vite.config.ts` `define:` inlined `process.env.GEMINI_API_KEY` as a compile-time constant. `Dockerfile` wrote it into `.env` from a build-arg. GitHub Actions workflow passed `secrets.GEMINI_API_KEY` as that build-arg. Net effect: the secret was in the static asset that every visitor loads. |
| Browser made direct calls to `generativelanguage.googleapis.com` | All 9 AI functions in `services/geminiService.ts` used `new GoogleGenAI({apiKey: process.env.API_KEY})` — frontend-direct. |
| (Anticipated, not yet observed) GCP project suspended | Same pattern that killed slayjobs's GCP project. Time-to-abuse on a leaked Gemini key in a public bundle is hours to days. |

---

## Final architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  BROWSER (www.speechgyms.com)                                        │
│                                                                      │
│   • Vite/React frontend                                              │
│   • NO API KEYS in bundle (verified — bundle scan returns 0 matches) │
│   • SpeechRecognition (Chrome / Edge / Safari) captures live         │
│     transcript while user speaks; auto-restart on silence            │
│                                                                      │
│   POST /api/ai/{topic, drill-challenges, analyze-speech,             │
│                 debate-counter, analyze-debate, translate,           │
│                 topic-outline, coach-chat, analyze-drill-batch}      │
│            ▼                                                         │
└────────────┼─────────────────────────────────────────────────────────┘
             │ JSON { transcript, ... }     (audio path removed entirely
             │                               for analyze-speech/debate/drill;
             │                               browser sends transcript only)
             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  AZURE WEBAPP: hobbyland-speechgyms (rg: hobbyland-interview-rg)     │
│                                                                      │
│   Express backend (backend/index.js + backend/ai.js)                 │
│   • Reads keys from Azure App Settings at runtime                    │
│   • Two-key Anthropic rotation on 429/5xx                            │
│                                                                      │
│   ┌─────────────────────────────────────────┐                        │
│   │ FAST_MODEL = claude-haiku-4-5           │                        │
│   │   topic, drill-challenges, debate-      │                        │
│   │   counter, translate, topic-outline     │                        │
│   ├─────────────────────────────────────────┤                        │
│   │ TEXT_MODEL = claude-sonnet-4-6          │                        │
│   │   analyze-speech, analyze-debate,       │                        │
│   │   coach-chat (+ prompt cache),          │                        │
│   │   analyze-drill-batch                   │                        │
│   └─────────────────────────────────────────┘                        │
│                       │                                              │
│            ANTHROPIC_API_KEY (primary)                               │
│            ANTHROPIC_API_KEY_FALLBACK (rotated on 429/5xx)           │
│                       ▼                                              │
└───────────────────────┼──────────────────────────────────────────────┘
                        │
                        ▼
                api.anthropic.com
```

---

## Files changed

### Backend

| File | Purpose |
|---|---|
| `backend/ai.js` | **NEW.** All 9 AI endpoint handlers + Anthropic wrapper with key rotation + JSON parser. |
| `backend/index.js` | Imports `registerAIRoutes`, mounts on app. JSON body limit raised 10mb→50mb. Health version bumped to `1.0.5`. |
| `backend/package.json` | Added `@anthropic-ai/sdk`. |

### Frontend

| File | Purpose |
|---|---|
| `services/geminiService.ts` | All 9 exported functions now `fetch('/api/ai/...')`. Drops `@google/genai` and `GoogleGenAI`/`Type`/`GenerateContentResponse`. `analyzeSpeech`/`analyzeDebateSession`/`analyzeDrillBatch` accept optional `transcript` params. WPM/`improvements` computed client-side from the transcript Claude echoes back. |
| `components/Stage.tsx` | Web Speech API parallel to MediaRecorder. `onend` auto-restart while recording. Live transcript strip below the stage. `onFinish` signature gains `transcript`. |
| `components/DrillSession.tsx` | Same Web Speech pattern. Each round's transcript stored on the recording. |
| `components/DebateSession.tsx` | Same pattern, twice (constructive + rebuttal). `onFinishDebate` signature gains both transcripts. |
| `components/Home.tsx` | New `BrowserCompatBanner` — amber alert at top when `window.SpeechRecognition` is missing. |
| `components/VirtualCoach.tsx` | Removed `@google/genai` import. |
| `App.tsx` | Plumbs transcripts from Stage/DebateSession through to `analyzeSpeech`/`analyzeDebateSession`. |
| `vite.config.ts` | Removed `define:` entries that inlined `GEMINI_API_KEY` / `API_KEY`. |
| `Dockerfile` | Removed `GEMINI_API_KEY` build-arg + `.env` write step. Added `backend/ai.js` to production stage copy. |
| `.github/workflows/main_hobbyland-speechgyms.yml` | Removed `GEMINI_API_KEY` from `build-args`. |
| `package.json` | Removed `@google/genai`. |

---

## Azure App Settings

`hobbyland-speechgyms` webapp in `hobbyland-interview-rg`:

| Setting | Status | Used? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Set | ✅ Live primary |
| `ANTHROPIC_API_KEY_FALLBACK` | Set | ✅ Rotates on 429/5xx |
| `GEMINI_API_KEY` | Was set as a GitHub Actions secret only (build-arg) | Should be **deleted from GitHub Actions secrets** to prevent future rebuilds from re-baking it |

**Rotate keys without rebuild:**
```bash
az webapp config appsettings set \
  --name hobbyland-speechgyms --resource-group hobbyland-interview-rg \
  --settings ANTHROPIC_API_KEY=sk-ant-...
az webapp restart \
  --name hobbyland-speechgyms --resource-group hobbyland-interview-rg
```

---

## QA results — 2026-04-26

Run after manual deploy of commit `3a5a9ea` (CI deploy step failed at
`az login`, see Known Issues; image was manually pinned via
`az webapp config container set`). All checks below ran against the live
production webapp.

### Phase C — Bundle & security

| Check | Result |
|---|---|
| Live bundle hash | `assets/index-B9Mi6EC-.js` |
| Leaked-key matches (`AIzaSy` / `sk-ant-` / `sk-or-` / `sk-proj-`) | **0** ✅ |
| Direct provider markers (`generativelanguage` / `googleapis.com`) | **0** ✅ |
| `/api/ai/` present in bundle | yes ✅ |
| `SpeechRecognition` + `webkitSpeechRecognition` present | yes ✅ |
| Health endpoint version | `1.0.5` ✅ |

### Phase A — Endpoint coverage (9/9)

| Endpoint | Result |
|---|---|
| `POST /api/ai/topic` (ELEMENTARY level) | ✅ Returned age-appropriate topic about animals |
| `POST /api/ai/drill-challenges` (IMPACT type) | ✅ 2 prompts, both substantive |
| `POST /api/ai/coach-chat` (multi-turn × 3) | ✅ Both turns returned coherent 1-sentence replies |
| `POST /api/ai/analyze-speech` | ✅ overallScore 52, 5 strengths, 5 weaknesses, 12 vocab upgrades, 3 frameworks, 1280-char model answer |
| `POST /api/ai/debate-counter` | ✅ 141-word counter, took NEGATIVE side correctly |
| `POST /api/ai/analyze-debate` | ✅ overallScore 42, both `debateAnalysis.constructive` and `debateAnalysis.rebuttal` populated, 3 strengths + 5 weaknesses |
| `POST /api/ai/translate` (EN→ES) | ✅ Real Spanish translation, not pass-through |
| `POST /api/ai/topic-outline` | ✅ 7 outline points returned for "Future of Remote Work" |
| `POST /api/ai/analyze-drill-batch` (3 rounds) | ✅ All 3 rounds scored individually + nextSteps populated |

### Phase B — Edge cases

| Probe | Expected | Result |
|---|---|---|
| `analyze-speech` empty transcript | HTTP 400 with `{ error: "transcript is required" }` | ✅ Match |
| `analyze-debate` missing rebuttal | HTTP 400 with descriptive error | ✅ `"both constructiveTranscript and rebuttalTranscript are required"` |
| `analyze-speech` empty body `{}` | HTTP 400 | ✅ Match |
| `coach-chat` empty body `{}` | HTTP 400 | ✅ `"systemContext and messages are required"` |
| `analyze-drill-batch` empty body `{}` | HTTP 400 | ✅ `"recordings array required"` |
| `analyze-drill-batch` 1 round silent | HTTP 200, graceful degradation | ✅ Round 1 scored 2, Round 2 scored 1 with `(silence)` substitute |

**All edge cases return clean 4xx errors. No 500s, no fallback strings posing as valid responses.**

### Phase D — Browser end-to-end

I cannot drive a real microphone from CLI. Tester must verify:

1. https://www.speechgyms.com loads in Chrome / Edge / Safari with **no** amber compat banner.
2. Stage.tsx live-transcript strip shows words as the user speaks.
3. Final analysis report shows non-zero scores referencing what was said.
4. Debate flow: counter-argument appears, both transcripts feed into final analysis.
5. Firefox shows the amber compat banner.

If the report comes back 0% with "Service experiencing high traffic" critique, that's the empty-transcript fallback — likely a SpeechRecognition mic-permission failure. Investigate from there.

---

## Smoke-test commands (copy-paste)

```bash
B=https://www.speechgyms.com/api/ai

# Health
curl -sS https://www.speechgyms.com/api/health

# Bundle scan
LB=$(curl -sS https://www.speechgyms.com/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -sS "https://www.speechgyms.com/$LB" | grep -cE "AIzaSy[A-Za-z0-9_-]{20}|sk-ant-|sk-or-|sk-proj-"  # must be 0

# Topic
curl -sS -X POST $B/topic -H 'Content-Type: application/json' \
  -d '{"interests":["tech"],"goal":"x","language":"English","mode":"IMPROMPTU","level":"INTERMEDIATE","eduLevel":"UNIVERSITY"}'

# Analyze speech (transcript path)
curl -sS -X POST $B/analyze-speech -H 'Content-Type: application/json' \
  -d '{"transcript":"My speech about leadership starts with a story...","topic":"Leadership","duration":30,"mode":"IMPROMPTU","language":"English","level":"INTERMEDIATE","eduLevel":"UNIVERSITY"}'

# Coach chat
curl -sS -X POST $B/coach-chat -H 'Content-Type: application/json' \
  -d '{"systemContext":"You are a brief coach.","messages":[{"role":"user","content":"hi"}]}'
```

---

## Browser support matrix

| Browser | Status |
|---|---|
| Chrome (desktop + Android) | ✅ Supported |
| Edge (Chromium) | ✅ Supported |
| Safari (macOS + iOS) | ✅ Supported |
| Firefox | ❌ No SpeechRecognition — banner warns user |

---

## Cost expectation

| Feature | Model | ~$/req |
|---|---|---|
| Generate topic / drill challenges / outline / counter / translate | Haiku 4.5 | $0.001–0.005 |
| Coach chat (with prompt cache) | Sonnet 4.6 | $0.005 |
| Analyze speech / debate / drill-batch | Sonnet 4.6 | $0.04–0.06 |

A full session with one speech analysis + 5 coach turns ≈ **$0.07** in Anthropic spend. Set a billing alert at $20/day for early monitoring on https://console.anthropic.com/.

---

## Known issues / follow-ups

- **CI deploy step is broken.** GitHub Actions in `casterfile/hobbyland-speechgyms` builds + pushes the image fine but fails at `az login` because the `AZURE_CREDENTIALS` service principal has no subscription role. Workaround: manually run `az webapp config container set --name hobbyland-speechgyms -g hobbyland-interview-rg --container-image-name n8nhobbylandacr.azurecr.io/speechgyms-app:<sha>` after each deploy. **Proper fix:** grant the SP Contributor on `hobbyland-speechgyms`.
- **Mirror push to `hobbyland-tony/hobbyland-speechgyms` failed** — stale GitHub PAT embedded in `.git/config`. Either rotate the token in `git remote set-url --push --add origin <new-url>` or remove the second push URL.
- **Rotate the leaked Gemini key in GCP.** Open https://console.cloud.google.com/apis/credentials, find the `AIzaSy*` key tied to the speechgyms project, **delete it**. The new bundle doesn't expose it but the value itself is in the wild from prior bundles. Speechgyms no longer needs it — we're on Claude.
- **Delete `GEMINI_API_KEY` from GitHub Actions secrets** in `casterfile/hobbyland-speechgyms` so a future rebuild doesn't accidentally re-introduce it via the Dockerfile path (already removed from the workflow YAML, but defense-in-depth).

---

## Repo + commits

GitHub primary: https://github.com/casterfile/hobbyland-speechgyms (main branch deploys via Azure Deployment Center; deploy step currently broken — see Known Issues).
GitHub mirror: https://github.com/hobbyland-tony/hobbyland-speechgyms (push currently failing — stale token).

Key commit: `3a5a9ea` — "Move AI to backend proxy + Web Speech API for transcription"

---

## Future work / nice-to-haves

- Per-IP rate limiting on `/api/ai/*` to prevent abuse from anonymous traffic.
- If Firefox support matters, integrate a WASM-based local Whisper fallback (~30 MB asset cost) so the audio path doesn't strand Firefox users.
- Move the live-transcript strip to a more prominent position so the user notices it during recording (currently below the stage; could be a sidebar).
