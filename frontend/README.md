# Roshan Rozgar — frontend

Next.js 14 (App Router) web app for customers, workers and admins. See the [root README](../README.md) for the full setup, structure and demo script.

```bash
cp .env.example .env.local   # BACKEND_URL, JWT_ACCESS_SECRET, NEXT_PUBLIC_VAPI_*, NEXT_PUBLIC_MAPBOX_TOKEN
npm install
npm run dev                  # http://localhost:3000
npm run lint && npm run build
```

- `/api/*` is rewritten to `BACKEND_URL/api/*` (`next.config.mjs`), so auth cookies stay first-party.
- `src/middleware.ts` routes by role: `/c/*` customer, `/w/*` worker, `/admin` admin. The backend re-checks every request.
