# Roshan Rozgar (روزگار روشن) — Team TriByte

Hyper-local marketplace connecting households in Islamabad/Rawalpindi with nearby skilled trade workers.
Full plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

| App | Folder | Stack | Local port |
|---|---|---|---|
| Web | `frontend/` | Next.js 14, TypeScript, Tailwind | 3000 |
| API | `backend/` | NestJS, Prisma, PostgreSQL (prefix `/api/v1`) | 4000 |
| AI | `ai/` | FastAPI (Python 3.11+), Tesseract OCR | 8000 |

## Prerequisites
- Node.js 20+
- Python 3.11+ (on Windows use the python.org install, not MSYS)
- PostgreSQL (local, or a Render Postgres URL)
- Tesseract OCR (only for CNIC OCR; Windows installer: https://github.com/UB-Mannheim/tesseract/wiki)

## Setup (once)
```bash
npm install                 # root: concurrently
npm run install:all         # frontend + backend deps

cd ai
python -m venv .venv
.venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cd ..
```
Copy each `.env.example` to `.env` (`frontend/`, `backend/`, `ai/`) and fill in the values.

## How to run locally (3 terminals)
```bash
# Terminal 1 — web (http://localhost:3000)
cd frontend && npm run dev

# Terminal 2 — API (http://localhost:4000/api/v1)
cd backend && npm run start:dev

# Terminal 3 — AI (http://localhost:8000/health)
cd ai && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000
```

Or start all three in one terminal:
```bash
npm run dev
```
(`dev:ai` uses the Windows venv path `ai\.venv\Scripts\python`; on macOS/Linux change it to `.venv/bin/python`.)

The frontend calls `/api/*`; Next.js rewrites it to `BACKEND_URL/api/*` so auth cookies stay same-origin.

## Deploy
`render.yaml` defines the Render blueprint (Postgres + 3 services). Not deployed yet.

## Database
```bash
cd backend
npx prisma migrate dev      # create tables
npx prisma db seed          # reset + load demo data (safe to re-run before a demo)
```

## Demo accounts (OTP `1234`, only when `DEMO_MODE=true`)
| Phone | Role |
|---|---|
| 03000000001 | Customer — Sara Ahmed (G-10) |
| 03000000002 | Worker — Imran Khan, Electrician (verified, available) |
| 03000000003 | Admin |

Any other number works too: in `OTP_MODE=demo` the code is shown in a "Demo OTP" banner instead of being sent by SMS.

## Seeded and mocked (labelled "Demo" in the UI)
- **Seeded:** 1 admin, 3 customers, 20 workers across 6 trades in Islamabad/Rawalpindi (2 busy, 2 pending approval), ~85 completed bookings (fair-price history), ~60 reviews, 3 burst-flagged reviews, 1 abusive voice review, 1 over-priced booking.
- **OTP:** demo mode shows the code on screen; real SMS via SendPK is wired (`OTP_MODE=sendpk`).
- **CNIC:** OCR runs for real (Tesseract), but there's no NADRA check.
- **Maps:** a stylised map; distances are real (haversine from sector centres).
- **Payments:** out of scope (cash on completion).
- **AI without keys:** diagnosis, profile extraction, moderation and review summaries use rule-based fallbacks. Speech (STT/TTS) needs an ElevenLabs key. Without one, read-aloud falls back to the browser's speech synthesis, and typing still works everywhere.

## Security
Deny-by-default role guard on every route; CSRF header and SameSite cookies on a same-origin proxy; rotating hashed refresh tokens in httpOnly cookies; OTP is HMAC-hashed, single-use, rate-limited and capped at 5 attempts; DTO validation with whitelisting; uploads are checked by magic bytes and size-capped; CNIC numbers are AES-256-GCM encrypted with an HMAC uniqueness check; CNIC images are visible only to their owner and admins, and every admin view is audited; the AI service requires an internal key; the Vapi webhook requires a shared secret plus a signed voice token; booking confirmation is one serializable transaction (worker BUSY + unique `activeBookingId`), so double-booking is impossible.

## AI-assistant disclosure
This project was built with help from Claude Code (Anthropic).
