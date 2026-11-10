# Roshan Rozgar — backend

NestJS + Prisma + PostgreSQL API under `/api/v1`. See the [root README](../README.md) for the full setup, API overview and security notes.

```bash
cp .env.example .env         # DATABASE_URL, secrets, SimGate, AI service, Vapi
npm install
npx prisma migrate dev       # create tables
npx prisma db seed           # demo data — WARNING: deletes ALL existing data
npm run start:dev            # http://localhost:4000/api/v1/health
npm run build                # dist/main.js (used by Render)
```

- `scripts/test-worker-session.ts` (dev only) creates a test worker and prints a session cookie, so onboarding and CNIC can be tested without sending an SMS: `npx ts-node --transpile-only scripts/test-worker-session.ts`.
