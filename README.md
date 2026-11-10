# Roshan Rozgar (روزگار روشن) — Team TriByte

**A hyper-local marketplace that connects households in Islamabad and Rawalpindi with nearby skilled trade workers: electricians, plumbers, AC technicians, carpenters, mechanics and painters.**

Built for **CUI Tech Fest — AI Web Forge**. Workers who can't read or type well can still join and work: they sign up by talking, hear every request read aloud in Urdu, and agree on a price with one tap. Customers describe a problem in English, Roman Urdu or Urdu (typed, spoken or as a photo). AI picks the right trade and a fair price and shows who is free right now.

---

## Contents
1. [What it proves](#what-it-proves)
2. [Architecture](#architecture)
3. [Repository structure](#repository-structure)
4. [Tech stack](#tech-stack)
5. [Run it locally](#run-it-locally)
6. [Environment variables](#environment-variables)
7. [Demo accounts and demo script](#demo-accounts-and-demo-script)
8. [Screens](#screens)
9. [API overview](#api-overview)
10. [AI and voice](#ai-and-voice)
11. [Booking consistency (no double-booking)](#booking-consistency-no-double-booking)
12. [Security](#security)
13. [Seeded and mocked data](#seeded-and-mocked-data)
14. [Deploy (Render)](#deploy-render)
15. [Known limitations](#known-limitations)
16. [AI-assistant disclosure](#ai-assistant-disclosure)

---

## What it proves

| Required outcome | How Roshan Rozgar does it |
|---|---|
| **1. Onboarding without forms** | The worker talks to a Vapi voice agent in Urdu → AI extracts name, trade, years, areas, rate and hours → the worker confirms each field (🔊 listen / ✏️ edit) → face photo → CNIC front and back read by OCR → admin approval. |
| **2. Discovery: nearby and free now** | Search shows only **verified** workers, sorted by distance, on a Mapbox map. Busy workers are greyed out. AI picks the trade from text, voice or photo. |
| **3. Communication for non-typers** | Voice notes (ElevenLabs speech-to-text), read-aloud (ElevenLabs TTS), automatic EN↔UR translation (Gemini), and price-offer cards accepted with one tap. AI also spots a price said in a voice note ("1000 rupay") and offers to send it. |
| **4. Booking consistency** | Accepting a price confirms the booking **and** makes the worker BUSY in one database transaction. A busy worker can't take a second job and disappears from search. Finishing the job frees them again. The admin dashboard shows a live **double-booking count (always 0)**. |
| **5. Trust after the job** | Ratings per aspect (quality, on time, fair price, behaviour), tags, typed or spoken reviews, AI review summaries, and AI and burst-pattern moderation of fake or abusive reviews. |
| **AI that matters** | Voice onboarding, STT/TTS for low-literacy users, CNIC OCR, trade diagnosis, fair-price range from real booking history, translation, review summary and moderation. |

---

## Architecture

```
Browser ── Next.js 14 (frontend, :3000)
              │  same-origin /api/*  → rewrite → backend (httpOnly cookies stay first-party)
              ▼
        NestJS API (backend, :4000, prefix /api/v1) ── Prisma ──► PostgreSQL
              │ X-Internal-Key
              ├──────────► FastAPI AI service (ai, :8000)
              │               ├─ Tesseract + OpenCV  (CNIC OCR)
              │               ├─ ElevenLabs          (speech-to-text, text-to-speech)
              │               └─ Gemini              (extraction, diagnosis, translation, summaries, moderation)
              ├──────────► SimGate                   (OTP SMS)
              └◄────────── Vapi webhook (tool calls, signed voice token)
Browser ── @vapi-ai/web voice agents · Mapbox GL maps
```

- **Same-origin proxy:** the browser only talks to `/api/*` on the frontend, so auth cookies are first-party and there's no CORS setup.
- **Live updates by polling:** active screens refetch every 3 s (incoming requests, chat, booking status). No websocket infrastructure to break during a demo.
- **Graceful degradation:** every AI call has a rule-based fallback, so the app keeps working if a provider is down.

---

## Repository structure

```
roshan-rozgar-tribyte/
├─ README.md                      ← this file
├─ CLAUDE.md                      ← rules for AI coding sessions
├─ package.json                   ← `npm run dev` starts all three apps (concurrently)
├─ render.yaml                    ← Render blueprint: Postgres + 3 services
├─ docs/
│  └─ IMPLEMENTATION_PLAN.md      ← full product and technical plan
├─ design/
│  └─ screens/*.png               ← exported Figma frames (C*, M*, W*, WW*, WM*, CM*, A*)
│
├─ frontend/                      ← Next.js 14 · TypeScript · Tailwind · Framer Motion
│  ├─ next.config.mjs             ← /api/:path* → BACKEND_URL rewrite
│  ├─ tailwind.config.ts          ← design tokens (truck-art palette, fonts, shadows)
│  └─ src/
│     ├─ middleware.ts            ← role-based route guard (/c customer, /w worker, /admin)
│     ├─ app/
│     │  ├─ page.tsx              ← C1/M1 home: AI search, voice agent, trade tiles, map
│     │  ├─ login/page.tsx        ← CM1 phone + 4-digit OTP, role choice, demo accounts
│     │  ├─ c/diagnose/           ← C2/CM2 AI diagnosis + fair price
│     │  ├─ c/workers/            ← C3/M3 search list + map
│     │  ├─ c/workers/[id]/       ← C4/M4 worker profile, aspect ratings, AI summary
│     │  ├─ c/bookings/           ← C8/M8 my bookings (active / past / cancelled)
│     │  ├─ c/bookings/[id]/      ← C5/C6/C7 chat, offers, tracking map, start code, review
│     │  ├─ w/page.tsx            ← W6/WM1/WM6 worker home: availability, incoming requests
│     │  ├─ w/onboarding/         ← W3/W4/W5/W5b voice profile, confirm, photos, CNIC
│     │  ├─ w/jobs/               ← worker job list
│     │  ├─ w/jobs/[id]/          ← W7/W8/W9 job chat, start code, complete
│     │  └─ admin/page.tsx        ← A1–A5 overview, workers, bookings, reviews and AI flags
│     ├─ components/
│     │  ├─ ui.tsx                ← Button, Card, Modal, Avatar, Stars, Badge, TruckStrip,
│     │  │                           ListenButton (TTS), MicRecorder, VoicePlayer, Waveform…
│     │  ├─ shell.tsx             ← CustomerNav/TabBar, WorkerShell (RTL), AdminShell
│     │  ├─ booking-room.tsx      ← shared chat + price offers + stepper + booking map
│     │  ├─ request-modal.tsx     ← CM3 confirm request / CM6 worker just got booked
│     │  ├─ voice-agent.tsx       ← Vapi call UI: pulse mic + live transcript
│     │  ├─ map-view.tsx          ← Mapbox GL map with free/busy/you/job pins
│     │  └─ worker-card.tsx       ← worker list card
│     └─ lib/
│        ├─ api.ts                ← fetch client (CSRF header, session refresh), polling hook
│        ├─ i18n.tsx              ← EN/اردو provider, <T> component, LangToggle
│        └─ vapi.ts               ← Vapi web SDK hook (session token, transcript)
│
├─ backend/                       ← NestJS · Prisma · PostgreSQL
│  ├─ prisma/
│  │  ├─ schema.prisma            ← User, WorkerProfile, Cnic, CustomerProfile, Booking,
│  │  │                              PriceOffer, Message, Review, Media, OtpChallenge,
│  │  │                              RefreshToken, AuditLog
│  │  ├─ migrations/              ← SQL migrations
│  │  └─ seed.ts                  ← demo data (wipes the database, see below)
│  ├─ scripts/
│  │  └─ test-worker-session.ts   ← dev-only: test worker session without sending an SMS
│  └─ src/
│     ├─ main.ts                  ← /api/v1 prefix, helmet, cookies, validation pipe
│     ├─ app.module.ts            ← wiring, global auth guard, throttler, error filter
│     ├─ common/                  ← auth guard + @Roles/@Public, crypto (AES-GCM, HMAC),
│     │                              upload checks (magic bytes, sharp re-encode), geo,
│     │                              audit log, uniform error filter, Prisma service
│     ├─ auth/                    ← OTP request/verify, JWT + rotating refresh cookies,
│     │                              SMS adapter (SimGate, SendPK)
│     ├─ customers/               ← customer profile (address, sector)
│     ├─ workers/                 ← onboarding, CNIC checks, availability, search, profile
│     ├─ bookings/                ← state machine, offers, atomic confirm, chat, reviews
│     ├─ media/                   ← uploads and guarded downloads
│     ├─ ai/                      ← AI client (+ fallbacks), voice/STT/TTS routes, Vapi webhook
│     └─ admin/                   ← stats, worker approval, bookings, review moderation, audit
│
└─ ai/                            ← FastAPI (Python 3.11+)
   ├─ Dockerfile                  ← python:3.11-slim + tesseract-ocr
   ├─ requirements.txt
   └─ app/
      ├─ main.py                  ← internal-key auth; /ocr/cnic /stt /tts /extract/profile
      │                              /diagnose /moderate/review /summary/reviews /translate
      ├─ ocr_cnic.py              ← OpenCV preprocessing + Tesseract, CNIC field parsing
      ├─ llm.py                   ← Gemini JSON calls + prompts
      └─ text.py                  ← rule-based fallbacks (keywords, Urdu numerals, word lists)
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, lucide-react, Mapbox GL, @vapi-ai/web, jose |
| Backend | NestJS 11, Prisma 6, PostgreSQL, @nestjs/jwt, @nestjs/throttler, class-validator, helmet, sharp |
| AI service | FastAPI, pytesseract + OpenCV, httpx |
| External services | Vapi (voice agents), ElevenLabs (Scribe STT + multilingual TTS), Google Gemini (`gemini-3.1-flash-lite`), SimGate (SMS), Mapbox (maps) |
| Fonts | Plus Jakarta Sans (Latin), Noto Nastaliq Urdu (Urdu, RTL) |

---

## Run it locally

### Prerequisites
- **Node.js 20+**
- **Python 3.11+** (on Windows use the python.org install, not MSYS)
- **PostgreSQL** (local, or a hosted URL)
- **Tesseract OCR** for CNIC scanning. On Windows: [UB-Mannheim installer](https://github.com/UB-Mannheim/tesseract/wiki). It's detected automatically in `C:\Program Files\Tesseract-OCR`, or set `TESSERACT_CMD`.

### 1. Install
```bash
npm install                 # root: concurrently
npm run install:all         # frontend + backend dependencies

cd ai
python -m venv .venv
.venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd ..
```

### 2. Configure
Copy each example file and fill it in (see [Environment variables](#environment-variables)):
```bash
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env.local
cp ai/.env.example       ai/.env
```
`AI_INTERNAL_KEY` must be the same in `backend/.env` and `ai/.env`. `JWT_ACCESS_SECRET` must be the same in `backend/.env` and `frontend/.env.local`.

### 3. Database
```bash
cd backend
npx prisma migrate dev      # create tables
npx prisma db seed          # load demo data (WARNING: deletes ALL existing data)
cd ..
```

### 4. Start
One terminal:
```bash
npm run dev                 # web :3000 · api :4000 · ai :8000
```
Or three terminals:
```bash
cd frontend && npm run dev                                         # http://localhost:3000
cd backend  && npm run start:dev                                   # http://localhost:4000/api/v1/health
cd ai && .venv\Scripts\activate && uvicorn app.main:app --port 8000  # http://localhost:8000/health
```
`dev:ai` in the root `package.json` uses the Windows venv path (`ai\.venv\Scripts\python`). On macOS/Linux change it to `.venv/bin/python`.

---

## Environment variables

Never commit real values. Only the `.env.example` files are tracked.

### `backend/.env`
| Variable | Purpose |
|---|---|
| `PORT` | API port (4000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `VOICE_TOKEN_SECRET`, `OTP_PEPPER` | Session, voice-token and OTP secrets (`openssl rand -base64 48`) |
| `CNIC_ENC_KEY`, `CNIC_HMAC_KEY` | AES-256-GCM key and HMAC key for CNIC numbers (`openssl rand -base64 32`) |
| `FRONTEND_URL`, `BACKEND_PUBLIC_URL` | Public URLs (the Vapi webhook uses the backend one) |
| `ADMIN_PHONES` | Phone numbers that become ADMIN on first login (there is no admin signup) |
| `DEMO_MODE`, `DEMO_PHONES` | Judge accounts with fixed OTP 1234; on-screen code if SMS fails |
| `OTP_MODE` | `simgate` (real SMS), `sendpk`, or `demo` (no SMS, code on screen) |
| `SIMGATE_API_KEY`, `SIMGATE_DEVICE_ID`, `SIMGATE_URL` | SimGate SMS gateway |
| `SENDPK_API_KEY` / `SENDPK_USERNAME` / `SENDPK_PASSWORD`, `SENDPK_SENDER` | Optional SendPK alternative |
| `AI_SERVICE_URL`, `AI_INTERNAL_KEY` | AI service URL and shared key |
| `VAPI_WEBHOOK_SECRET` | Must match the server secret set on both Vapi assistants |

### `frontend/.env.local`
| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Target of the `/api/*` rewrite |
| `JWT_ACCESS_SECRET` | Lets `middleware.ts` read the role (same value as backend) |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY` | Vapi **public** key |
| `NEXT_PUBLIC_VAPI_WORKER_ASSISTANT_ID` | Urdu worker-onboarding assistant |
| `NEXT_PUBLIC_VAPI_CUSTOMER_ASSISTANT_ID` | Customer booking assistant |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox public token (`pk.…`) |

### `ai/.env`
| Variable | Purpose |
|---|---|
| `AI_INTERNAL_KEY` | Only the backend may call this service |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_UR`, `ELEVENLABS_VOICE_ID_EN`, `ELEVENLABS_TTS_MODEL` | Speech-to-text and read-aloud |
| `LLM_API_KEY`, `LLM_MODEL` | Gemini key and model (default `gemini-3.1-flash-lite`) |
| `TESSERACT_CMD` | Path to `tesseract.exe` if it's not auto-detected |
| `DEMO_MODE` | Shown on `/health` |

---

## Demo accounts and demo script

| Phone | OTP | Role |
|---|---|---|
| `03000000001` | `1234` | Customer: Sara Ahmed (G-10) |
| `03000000002` | `1234` | Worker: Imran Khan, Electrician (verified, available) |
| `03000000003` | `1234` | Admin |

The login page has one-tap buttons for all three. Demo numbers work only while `DEMO_MODE=true`. **Any other number receives a real SMS** through SimGate.

**Five-minute judge demo:**
1. **Customer:** type *"Switch se chingari"* (or tap the mic and talk to the assistant) → AI picks Electrician and a fair price → see who is free on the map → request Imran.
2. **Worker** (second browser or incognito): Imran's phone rings with the request (read aloud in Urdu) → accept → send a price offer (typed, or by voice: AI detects the amount).
3. **Customer:** accept the offer → booking confirmed, start code shown. Imran is now **Busy** and greyed out in search, and a second customer gets *"worker just got booked"*.
4. **Worker:** enter the start code → work → *Job done* → available again.
5. **Customer:** rate by aspect and leave a voice review. **Admin:** 0 double-bookings, approve a new worker (CNIC OCR checks), remove a flagged review.

---

## Screens

| Route | Who | Figma frames |
|---|---|---|
| `/` | everyone | C1, M1 |
| `/login` | everyone | CM1, WM2 |
| `/c/diagnose` | customer | C2, CM2 |
| `/c/workers`, `/c/workers/[id]` | customer | C3, M3, C4, M4 |
| `/c/bookings`, `/c/bookings/[id]` | customer | C5, C6, C7, C8, CM3–CM8, M5–M8 |
| `/w` | worker | W6, WW3, WM1, WM6 |
| `/w/onboarding` | worker | W3, W4, W5, W5b, WW1, WW2 |
| `/w/jobs`, `/w/jobs/[id]` | worker | W7, W8, W9, WW4, WW5, WM3–WM5 |
| `/admin` | admin | A1–A5 |

**Languages:** an EN / اردو toggle on every customer and worker screen. The choice is saved per user. Workers default to Urdu (RTL + Nastaliq) with 64 px touch targets. The admin console is English.

---

## API overview

Base path `/api/v1`. JSON throughout. Every write needs the header `X-Requested-With: roshan`. Errors look like `{ "error": { "code", "message" } }`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/otp/request` · `POST /auth/otp/verify` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `PATCH /users/me` |
| Customer | `GET/PATCH /customers/me` |
| Worker | `GET /workers/me` · `PUT /workers/me/profile` · `POST /workers/me/photo` · `POST /workers/me/work-photos` · `POST /workers/me/cnic` · `POST /workers/me/submit` · `PATCH /workers/me/availability` · `GET /workers/me/requests` · `GET /workers/me/earnings` |
| Discovery | `GET /workers/search?trade&lat&lng&radiusKm&availableNow&minRating&sort` · `GET /workers/:id` · `POST /ai/diagnose` |
| Bookings | `POST /bookings` · `GET /bookings` · `GET /bookings/:id` · `POST /bookings/:id/accept\|decline\|start\|complete\|cancel` · `POST /bookings/:id/offers` · `POST /bookings/:id/offers/:offerId/accept` · `GET/POST /bookings/:id/messages` · `POST /bookings/:id/review` |
| Voice / media | `POST /media` · `GET /media/:id` · `POST /voice/stt` · `POST /voice/tts` · `POST /voice/session` · `POST /ai/extract-profile` · `POST /vapi/webhook` |
| Admin | `GET /admin/stats` · `GET /admin/workers` · `GET /admin/workers/:id` · `POST /admin/workers/:id/approve\|reject\|suspend` · `GET /admin/bookings` · `GET /admin/reviews` · `POST /admin/reviews/:id/hide\|keep` · `GET /admin/audit` |

Full contract and rules: [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) §10.

---

## AI and voice

| Feature | How it works | Fallback |
|---|---|---|
| Voice onboarding | Vapi Urdu assistant interviews the worker. The transcript goes to Gemini for extraction, then the worker confirms every field. | Record one voice note → ElevenLabs STT → extraction, or type |
| Voice search | Vapi customer assistant → AI diagnosis | Voice note → STT, or type |
| Speech-to-text | ElevenLabs Scribe (Urdu and English) | Typing |
| Read-aloud (🔊 سنیں) | ElevenLabs multilingual TTS, cached per text | Browser speech synthesis |
| Trade diagnosis | Gemini | Keyword classifier (EN / Roman Urdu / Urdu) |
| Fair price | p25–p75 of completed bookings (same trade, area, last 90 days) | Default range per trade |
| Profile extraction | Gemini | Rules: Urdu numerals and number words, sector names |
| Chat translation | Gemini EN↔UR | Original text + read-aloud |
| Review summary / moderation | Gemini | Tag counting / Urdu and English word lists + burst detection |
| CNIC OCR | OpenCV (resize → grayscale / Otsu / adaptive) + Tesseract; parses number, name, father's name, DOB, expiry | Retake prompt; admin reviews manually |

**CNIC checks:** format `#####-#######-#`, front matches back, not expired, age 18+, name matches the spoken name (≥ 70), OCR quality, and not used by another account.

**Vapi webhook** (`/api/v1/vapi/webhook`, needs a public URL): checks the `x-vapi-secret` header and a 10-minute signed voice token, never trusts a user ID sent by the call, and handles each `toolCallId` only once. Tools: `save_worker_profile`, `find_workers`. Locally (where Vapi can't reach `localhost`), the browser sends the call transcript for extraction instead.

---

## Booking consistency (no double-booking)

```
REQUESTED → (worker accepts) → NEGOTIATING → (other party accepts an offer) → CONFIRMED → (start code) → IN_PROGRESS → COMPLETED
                ↘ DECLINED                       ↘ CANCELLED                     ↘ CANCELLED          other open requests → EXPIRED
```

Accepting an offer runs **one serializable transaction**:
1. It claims the worker with a conditional update: only if `VERIFIED`, `AVAILABLE` and `activeBookingId IS NULL`. The worker becomes `BUSY` with `activeBookingId = booking`, and that column is `@unique` in the database.
2. It marks the booking CONFIRMED and stores the agreed price and a hashed start code.
3. It expires the worker's other open requests and sends those customers a *"worker just got booked"* message.

If two customers accept at the same moment, only one claim succeeds; the other gets `409 WORKER_UNAVAILABLE`. Completing or cancelling frees the worker in the same transaction. The admin overview computes double-bookings live; the count is always 0.

---

## Security

- **Auth:** phone OTP (4 digits, HMAC-hashed with a pepper, 5-minute expiry, single use, 5 attempts, rate-limited per phone and per IP); 15-minute access JWT and a 7-day refresh token in httpOnly SameSite cookies, rotated on every refresh with reuse detection; logout revokes.
- **Authorization:** deny-by-default global guard. Every route declares `@Roles` or `@Public`. Ownership checks on bookings, messages, media and reviews. `ADMIN` can never be self-assigned. Every admin action and CNIC view is written to the audit log.
- **Input:** class-validator DTOs with whitelisting; enums; price and length limits; phone regex; Prisma only (no raw string SQL).
- **CSRF:** same-origin proxy, SameSite cookies, and a required `X-Requested-With` header on writes.
- **Uploads:** type detected from magic bytes; 5 MB image and 2 MB audio limits; every image re-encoded with sharp (EXIF/GPS stripped); random IDs; `nosniff`; CNIC images are `no-store` and visible to the owner and admins only.
- **Sensitive data:** CNIC number AES-256-GCM encrypted, with an HMAC for uniqueness; only masked numbers are ever shown; phone numbers masked in public responses; no PII in logs or errors.
- **Service-to-service:** the AI service rejects any call without `X-Internal-Key`; Vapi webhook protection as described above; outbound timeouts.
- **Business rules:** the state machine is checked on every booking action; start code hashed with 5 attempts; one review per completed booking by its customer; nobody can accept their own offer.

---

## Seeded and mocked data

`npx prisma db seed` **deletes all data** and loads:
- 1 admin, 3 customers (Sara Ahmed, Ali Raza, Hina Malik)
- 20 workers across 6 trades in G-9, G-10, G-11, F-10, I-8 and Saddar: 2 busy, 2 pending approval
- ~85 completed bookings (fair-price history), ~60 reviews with aspect scores and tags
- A set of burst-flagged reviews, an abusive voice review, and an over-priced booking for the moderation demo

**Mocked or limited (labelled "Demo" in the UI):**
- **CNIC:** OCR runs for real, but there is **no NADRA check**.
- **Locations:** sector centres plus a small offset, not live GPS.
- **Payments:** out of scope (cash on completion).
- **Judge accounts:** fixed OTP `1234`.

---

## Deploy (Render)

`render.yaml` defines a free Postgres database plus three web services:

| Service | Runtime | Build / start |
|---|---|---|
| `rr-ai` | Docker (`ai/Dockerfile`, includes Tesseract) | `uvicorn app.main:app --port $PORT` |
| `rr-backend` | Node | `npm ci && npx prisma generate && npm run build` → `npx prisma migrate deploy && node dist/main.js` |
| `rr-frontend` | Node | `npm ci && npm run build` → `npm start` |

Set every `sync: false` variable in the Render dashboard. Then run the seed once, set the Vapi assistants' server URL to `https://<backend>/api/v1/vapi/webhook`, and open all three URLs a few minutes before judging (free services sleep).

---

## Known limitations
- Vapi tool calls need a public backend URL. Locally, the transcript-based flow is used instead.
- Positions are sector-based; there's no live worker GPS tracking.
- Real CNIC photos with glare or a steep angle may need a retake.
- The admin console is English only.

---

## AI-assistant disclosure
This project was built with help from **Claude Code** (Anthropic): scaffolding, backend, frontend, AI service, tests and documentation, directed and reviewed by Team TriByte.
