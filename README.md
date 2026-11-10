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

## Demo / mocked items
- `DEMO_MODE=true`, `OTP_MODE=demo`: demo OTP numbers (labelled "Demo" in the UI).
- Details are added here as features land.

## AI-assistant disclosure
This project was built with help from Claude Code (Anthropic).
