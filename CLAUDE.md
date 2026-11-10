# CLAUDE.md — Roshan Rozgar (Team TriByte)

Full plan: `docs/IMPLEMENTATION_PLAN.md`. Read the sections for your part before coding.

## Project
Hyper-local marketplace connecting households with nearby skilled trade workers (Islamabad/Rawalpindi).
Roles: CUSTOMER, WORKER, ADMIN. Hackathon: CUI Tech Fest AI Web Forge. Deadline is tight, so reliability beats features.

## Stack
- `frontend/`: Next.js 14 App Router, TypeScript, Tailwind, Framer Motion, TanStack Query, lucide-react, @vapi-ai/web
- `backend/`: NestJS, Prisma, PostgreSQL, JWT (httpOnly cookies), class-validator
- `ai/`: Python 3.11 FastAPI, pytesseract + OpenCV (CNIC OCR), ElevenLabs (STT Scribe + TTS)
- Voice agents: Vapi. SMS OTP: SendPK (+ demo mode). Deploy: Render (`render.yaml`).

## Non-negotiable rules
1. **UI must match the Figma exactly.** Reference images: `design/screens/*.png`. Tokens/typography/animations: plan §4. Urdu copy comes from the designs.
2. **Never invent, hardcode or commit secrets.** When an env var is needed, STOP and ask the user (name, purpose, where to get it). Keep `.env.example` updated with empty values.
3. **The backend enforces every rule** (RBAC, ownership, onboarding state, booking state machine). The frontend only reflects it.
4. Booking confirmation must use the atomic transaction in plan §12 (worker BUSY + `activeBookingId` unique).
5. Follow the security checklist in plan §13 for every endpoint (DTO validation, guards, rate limits, upload checks, PII redaction).
6. Anything mocked (demo OTP numbers, CNIC/NADRA check, seeded data) is labelled "Demo" in the UI and listed in the README.
7. Commit small and often with clear messages (the brief requires commit history after the start time).
8. Mobile-first and responsive: desktop designs ≥ 768 px, mobile designs below. Worker touch targets ≥ 64 px. Urdu = RTL + Noto Nastaliq Urdu.
9. Respect `prefers-reduced-motion` for all animations.
10. If behind schedule, use the cut list in plan §19. Never cut the items marked "Never cut".

## Commands
- Frontend: `cd frontend && npm run dev` (port 3000)
- Backend: `cd backend && npm run start:dev` (port 4000), `npx prisma migrate dev`, `npx prisma db seed`
- AI: `cd ai && uvicorn app.main:app --reload --port 8000`

## API
Prefix `/api/v1`. Contract: `docs/api-contract.md` (backend session writes it first). The frontend calls `/api/*` (Next rewrite → backend) so cookies are same-origin.
