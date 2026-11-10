# Roshan Rozgar (روزگار روشن) — Implementation Plan for Claude Code

**Team TriByte · CUI Tech Fest · AI Web Forge**
Time budget: **90 minutes** · Users: **Customer, Worker, Admin** · Deploy: **Render**

- Design source of truth (Figma): https://www.figma.com/design/vScbmyymtYMB3y1qgVZBGR/Roshan-Rozgar---TriByte?node-id=6-4
- Repo: https://github.com/Ali-Hassan-Durrani/roshan-rozgar-tribyte.git

| Part | Stack |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion |
| Backend | NestJS + Prisma + PostgreSQL |
| AI service | Python 3.11 + FastAPI + Tesseract OCR |
| Voice | ElevenLabs (Scribe speech-to-text, text-to-speech) + Vapi (voice agents) |
| SMS | SendPK (OTP) |

> **Rules for Claude Code (read first)**
> 1. **Match the Figma exactly**: colours, fonts, spacing, radius, copy (Urdu + English), icons, layout. The screenshots in `/design/screens/*.png` are the reference. If a value is unclear, use the tokens in §4.
> 2. **Never invent or commit secrets.** When an env var is needed, **stop and ask the user** for it: give the name, which service needs it, and where to get it. Use `.env.example` files with empty values.
> 3. **The backend enforces every rule.** The frontend only hides and shows things.
> 4. **Reliability beats features.** Judges score "works end to end" at 30%. If time runs short, follow the cut list in §19.
> 5. **Disclose mocks.** Anything simulated must be labelled in the UI ("Demo") and in the README.

---

## 0. How to run this with Claude Code (the fastest way)

Run **3 Claude Code sessions in parallel**, one per terminal:

| Terminal | Folder | Session builds |
|---|---|---|
| T1 | `backend/` | NestJS API, Prisma, auth/OTP, RBAC, bookings, admin, Vapi webhook |
| T2 | `frontend/` | Next.js app, design system, all screens for 3 roles, animations, i18n |
| T3 | `ai/` | FastAPI: CNIC OCR, STT/TTS proxy, profile extraction, diagnosis, price estimate, moderation |

- Put this file at `docs/IMPLEMENTATION_PLAN.md` and `CLAUDE.md` at the repo root. Every session reads both.
- Use **Accept-Edits mode** (Shift+Tab in Claude Code) so it doesn't stop to ask about every file edit.
- §18 has a ready-to-paste kickoff prompt for each terminal.
- **Contract first.** T1 writes `docs/api-contract.md` (§10) in its first 5 minutes. T2 and T3 code against it.

---

## 1. What we must prove (judging criteria mapped to features)

| Required outcome | Our feature | Screens (Figma) |
|---|---|---|
| 1. Onboarding without forms | Worker speaks (Vapi Urdu agent) → AI fills profile → worker confirms; photo; CNIC front/back OCR | W1–W5, W5b CNIC, WW1–WW2 |
| 2. Discovery (nearby + free now) | Search shows only `VERIFIED` + `AVAILABLE` workers, by distance; map; AI picks the trade from text, voice or photo | C1–C4, M1–M4 |
| 3. Communication for non-typers | Voice notes (ElevenLabs STT) + read-aloud (TTS) + AI price-offer cards (one tap to accept) | W7, WW4, C5, M5, WM3, WM4, CM4 |
| 4. Booking consistency | Accepting an offer makes the worker **BUSY in the same DB transaction**; a busy worker can't take a 2nd job and is hidden from search; done → free again | W8, WW5, C6, CM5, CM6, A3 |
| 5. Trust after the job | Ratings per aspect + voice review + AI review summary + flagged-review moderation | W9, C7, CM8, C4, A4 |
| AI that matters | Voice onboarding, STT/TTS for low-literacy users, CNIC OCR, trade diagnosis, fair-price range, review summary/moderation | — |

---

## 2. Architecture

```
Browser (Next.js on Render)
   │  same-origin calls to /api/*  (Next rewrites → backend; httpOnly cookies work)
   ▼
NestJS API (Render)  ── Prisma ──► PostgreSQL (Render)
   │  X-Internal-Key                      ▲
   ├────────────► FastAPI AI service (Render, Docker: tesseract)
   │                 ├─ ElevenLabs Scribe (STT) / TTS
   │                 └─ optional LLM (Gemini free tier) for extraction/translation/summary
   ├────────────► SendPK (OTP SMS)
   └◄──────────── Vapi webhook (tool calls) ◄── Vapi agent ◄── browser (@vapi-ai/web)
```

- **Same-origin proxy.** Frontend and backend are on different `onrender.com` subdomains. Cross-site cookies are unreliable there, so Next.js `rewrites()` sends `/api/:path*` to `BACKEND_URL/api/:path*`. Cookies stay first-party, CSRF exposure drops, and no CORS headaches.
- **Live updates by polling.** TanStack Query refetches every 3 s on active screens: incoming requests, chat, booking status. It's reliable for a demo and has no websocket infrastructure to break.

---

## 3. Repo structure (step 1)

```bash
git clone https://github.com/Ali-Hassan-Durrani/roshan-rozgar-tribyte.git
cd roshan-rozgar-tribyte
mkdir -p docs design/screens
# copy IMPLEMENTATION_PLAN.md → docs/, CLAUDE.md → root

# frontend
npx create-next-app@latest frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
# backend
npx @nestjs/cli new backend --package-manager npm --skip-git
# ai
mkdir ai && cd ai && python -m venv .venv && cd ..
```

```
roshan-rozgar-tribyte/
├─ CLAUDE.md
├─ README.md                  # setup, stack, AI services, seeded/mocked, limitations, AI-assistant disclosure
├─ render.yaml
├─ docs/IMPLEMENTATION_PLAN.md, docs/api-contract.md
├─ design/screens/*.png       # exported Figma frames (reference for Claude)
├─ frontend/
│  └─ src/
│     ├─ app/
│     │  ├─ (public)/page.tsx                 # C1 / M1 home
│     │  ├─ login/page.tsx                    # CM1 (also as modal)
│     │  ├─ start/page.tsx                    # W1 choose role
│     │  ├─ c/…                               # customer routes (§11)
│     │  ├─ w/…                               # worker routes
│     │  └─ admin/…                           # admin routes
│     ├─ components/ui/                       # Button, Chip, Badge, Avatar, Stars, IconBox, Switch, Modal, BottomSheet, Waveform, MicButton, LangToggle, TruckStrip, Map…
│     ├─ components/domain/                   # WorkerCard, WorkerCardCompact, PriceOfferCard, VoiceNote, BookingStepper, StartCode, RequestCard…
│     ├─ lib/api.ts, lib/auth.ts, lib/i18n/{en,ur}.json, lib/vapi.ts, lib/recorder.ts
│     └─ middleware.ts                        # role-based route guard
├─ backend/
│  ├─ prisma/schema.prisma, prisma/seed.ts
│  └─ src/
│     ├─ common/ (guards, decorators, filters, pipes, crypto)
│     ├─ auth/ (otp, jwt, sms/sendpk)
│     ├─ users/, workers/, customers/, bookings/, messages/, reviews/, media/, voice/, vapi/, ai-client/, admin/, audit/
│     └─ main.ts
└─ ai/
   ├─ app/main.py, app/ocr_cnic.py, app/voice.py, app/extract.py, app/diagnose.py, app/price.py, app/moderate.py, app/llm.py
   ├─ requirements.txt
   └─ Dockerfile
```

---

## 4. Design system (match the Figma exactly)

### 4.1 Getting the design into Claude Code (do this in minute 0–5)
The Figma AI connection has hit its Starter-plan limit, so **export images instead**. That works on any plan:

1. Open the Figma file. On page **01 · All Screens**, select each section (Worker Web, Worker Mobile, Worker Modals, Customer Web, Customer Mobile, Customer Modals, Admin), then **Export → PNG 1x**.
2. Put the PNGs in `design/screens/`, named like the frames (e.g. `C1-home.png`, `W6-home.png`).
3. Tell each Claude session: *"Open `design/screens/<file>.png` and build it pixel-close."* Claude Code can read images.
4. Optional: if your own Figma account has spare AI calls, connect the Figma MCP in Claude Code and use `get_variable_defs` once to confirm the tokens.

### 4.2 Tokens (Tailwind `theme.extend.colors`)
Truck-art palette. **If your team kept the original green in Figma, swap `brand*` to `#0B7A5C / #064E3B / #E8F5EF / #CDEBDD` and `purple*` to `#7C3AED / #F2ECFF`.**

| Token | Hex | Use |
|---|---|---|
| brand | `#1B1F4B` | primary buttons, active nav, headers |
| brandDark | `#0E1130` | hero gradient start, text on brand50 |
| brand50 | `#EBECF6` | soft backgrounds, ghost buttons |
| brand100 | `#C9CBE6` | text on dark hero, borders |
| amber | `#FFB703` | accent CTA ("Find help", "Accept" on dark), stars |
| amber50 | `#FFF3D1` | listen pill, start-code card |
| purple (AI) | `#E63973` | everything AI (sparkle badges, AI cards, price offer border) |
| purple50 | `#FDE7EF` | AI card backgrounds |
| ink | `#14152B` | body text |
| ink2 | `#475467` | secondary text |
| ink3 | `#98A2B3` | captions, placeholders |
| line | `#EFE4D2` | borders, dividers |
| bg | `#FFF8EC` | page background |
| white | `#FFFFFF` | cards |
| red / red50 | `#E5484D` / `#FDECEC` | decline, cancel, errors |
| blue / blue50 | `#2F6FED` / `#EAF1FE` | verified badge, "You" pin |
| orange / orange50 | `#F97316` / `#FFF0E5` | BUSY state |
| teal | `#12A39A` | truck-art strip, success accents |

Gradients: hero `linear-gradient(135deg, #0E1130, #1B1F4B)`. **Truck-art strip**: a repeating row of triangles in pink `#E63973` / marigold `#FFB703` / teal `#12A39A` / white on navy. Build it as an SVG pattern component `<TruckStrip height={12} />`, placed at the bottom of heroes, under the customer nav, and at the top of the worker/admin sidebars.

### 4.3 Typography
- Latin: **Plus Jakarta Sans** (`next/font/google`), weights 400/500/600/700/800.
- Urdu: **Noto Nastaliq Urdu** (`next/font/google`), weights 400/500/600/700. Give Urdu text `line-height: 1.9` and `dir="rtl"`.

| Style | Size/weight |
|---|---|
| Display | 52/800, tracking −2% (desktop hero), 26/800 mobile hero |
| H1 | 34/800 |
| H2 | 28/800 |
| Title | 18–22/700–800 |
| Body | 14–16/400 |
| Caption | 11–13/500–600 |
| Urdu worker title | 28–34/700 Nastaliq |
| Urdu body | 15–20/500 Nastaliq |

### 4.4 Shapes, spacing, sizes
- Radius: cards 16–24, buttons 12–20, chips/badges pill (999), icon boxes 12–22.
- Shadow: `0 6px 20px -4px rgba(16,24,40,.07)` (cards); modals `0 24px 60px -8px rgba(16,24,40,.2)`.
- Button heights: **XL 68** (worker primary, radius 20, text 20/700), L 52, M 44, S 36.
- Worker touch targets **≥ 64 px**. Keypad keys 64–68 px tall.
- Frames: desktop 1440 wide (content padding 64); mobile 390 wide (padding 20–24). Breakpoints: `md: 768`, `lg: 1200`. Layouts collapse to the mobile designs below `md`.
- Icons: **lucide-react**, stroke 2. Names: mic, camera, map-pin, star, check, shield-check, phone, play, clock, zap, droplet, snowflake, hammer, car, paint-roller, search, sliders-horizontal, arrows, x, send, message-square, home, user, calendar, bell, sparkles, volume-2, image, plus, minus, navigation, globe, triangle-alert, circle-check, briefcase, wallet, lock, map, list, power, banknote, keyboard, delete, share-2, users, refresh-cw, flag, layout-grid, settings, eye, pencil.

### 4.5 Shared components (build once in `components/ui`)
`Button(kind: primary|secondary|ghost|accent|danger|dark, size: XL|L|M|S, icon, iconRight)` · `IconBox` · `Chip(selected)` · `Badge(dot, icon, tone)` · `Avatar(initials, size)` · `Stars(value)` · `Switch` · `LangToggle (EN | اردو)` · `ListenButton (سنیں 🔊 → plays TTS)` · `Waveform(animated)` · `MicButton (pulse rings)` · `VoiceNote(play, waveform, duration, transcript)` · `Modal` (desktop centered, 480–620 wide, dim `rgba(16,24,40,.55)`) · `BottomSheet` (mobile, top radius 28, drag handle) · `MapView` (stylised: Leaflet + OSM tiles, or the static stylised map from Figma if short on time) · `TruckStrip` · `StatusBar` (only in mockups, not real app) · `CustomerNav` (desktop) · `CustomerTabBar` (mobile) · `WorkerSideNav` (desktop, RTL) · `WorkerBottomBar` (mobile) · `AdminSideNav` (dark).

### 4.6 Animations (Framer Motion, respect `prefers-reduced-motion`)
| Where | Animation |
|---|---|
| Page transitions | fade + 12 px slide-up, 220 ms ease-out |
| Mic button (W3, WW2, chat hold-to-talk) | 2 pulse rings scale 1→1.45, opacity .35→0, 1.6 s loop while recording |
| Waveform | bars animate height (random 30–100%) while recording/playing |
| Incoming job (WM1) | ring pulse + zap icon wiggle; 45 s countdown ring |
| Availability switch | spring knob (stiffness 500, damping 30); card colour cross-fade |
| Cards | hover lift `y:-2` + shadow; list stagger 40 ms |
| AI analysing (CM2) | scanning line moving top→bottom; checklist items tick in sequence |
| Success (CM5, W9) | check-mark SVG `pathLength` 0→1, scale-in circle, confetti-lite (6 dots) |
| Numbers (stats, earnings) | count-up 600 ms |
| Booking stepper | progress line grows to the current step |
| Skeletons | shimmer while loading |
| Modals / sheets | backdrop fade; modal scale .96→1; sheet slides up |

### 4.7 i18n + RTL
- `lib/i18n/en.json`, `lib/i18n/ur.json`. Use a `useT()` hook and a `lang` cookie. The `<html dir>` switches to `rtl` for Urdu.
- Defaults: **workers → Urdu**, **customers and admin → English**. The `LangToggle` appears on every worker screen and in the customer nav/home, as in Figma.
- Copy comes from the Figma frames (Urdu strings included). Don't machine-translate the Urdu UI labels; copy them from the designs.

---

## 5. Data model (`backend/prisma/schema.prisma`)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { CUSTOMER WORKER ADMIN }
enum Lang { UR EN }
enum WorkerStatus { ONBOARDING PENDING_REVIEW VERIFIED REJECTED SUSPENDED }
enum Availability { AVAILABLE BUSY OFFLINE }
enum Trade { ELECTRICIAN PLUMBER AC_TECHNICIAN CARPENTER MECHANIC PAINTER }
enum BookingStatus { REQUESTED NEGOTIATING CONFIRMED IN_PROGRESS COMPLETED CANCELLED DECLINED EXPIRED }
enum Party { CUSTOMER WORKER }
enum OfferStatus { PENDING ACCEPTED REJECTED SUPERSEDED }
enum MsgType { TEXT VOICE PRICE_OFFER SYSTEM }
enum MediaKind { VOICE PHOTO WORK_PHOTO CNIC_FRONT CNIC_BACK PROBLEM_PHOTO }
enum ReviewStatus { PUBLISHED HIDDEN }

model User {
  id        String   @id @default(cuid())
  phone     String   @unique            // normalised 923XXXXXXXXX
  role      Role
  name      String?
  lang      Lang     @default(EN)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  worker    WorkerProfile?
  customer  CustomerProfile?
  refresh   RefreshToken[]
}

model OtpChallenge {
  id         String    @id @default(cuid())
  phone      String
  codeHash   String                      // HMAC-SHA256(OTP_PEPPER, phone:code)
  attempts   Int       @default(0)
  expiresAt  DateTime
  consumedAt DateTime?
  ip         String?
  createdAt  DateTime  @default(now())
  @@index([phone, createdAt])
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime  @default(now())
}

model WorkerProfile {
  id              String        @id @default(cuid())
  userId          String        @unique
  user            User          @relation(fields: [userId], references: [id])
  status          WorkerStatus  @default(ONBOARDING)
  availability    Availability  @default(OFFLINE)
  activeBookingId String?       @unique        // at most ONE active job (DB-enforced)
  trade           Trade?
  experienceYears Int?
  areas           String[]
  baseRate        Int?
  workHours       String?
  voiceTranscript String?
  photoMediaId    String?
  lat             Float?
  lng             Float?
  ratingAvg       Float         @default(0)
  ratingCount     Int           @default(0)
  jobsDone        Int           @default(0)
  aiSummary       String?
  rejectReason    String?
  cnic            Cnic?
  bookings        Booking[]     @relation("WorkerBookings")
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  @@index([status, availability, trade])
}

model Cnic {
  id             String        @id @default(cuid())
  workerId       String        @unique
  worker         WorkerProfile @relation(fields: [workerId], references: [id])
  numberEnc      String        // AES-256-GCM
  numberHmac     String        @unique   // blocks the same CNIC on 2 accounts
  last4          String
  nameOnCard     String?
  fatherName     String?
  dob            DateTime?
  expiry         DateTime?
  frontMediaId   String
  backMediaId    String
  ocrConfidence  Float
  nameMatchScore Float
  checks         Json          // {format, notExpired, adult, frontBackMatch, nameMatch, quality}
  createdAt      DateTime      @default(now())
}

model CustomerProfile {
  id      String  @id @default(cuid())
  userId  String  @unique
  user    User    @relation(fields: [userId], references: [id])
  address String?
  area    String?
  lat     Float?
  lng     Float?
  bookings Booking[]
}

model Booking {
  id             String        @id @default(cuid())
  code           String        @unique         // RR-2048
  customerId     String
  customer       CustomerProfile @relation(fields: [customerId], references: [id])
  workerId       String
  worker         WorkerProfile @relation("WorkerBookings", fields: [workerId], references: [id])
  trade          Trade
  problemText    String
  problemVoiceId String?
  problemPhotoId String?
  urgency        String        // NOW | TODAY | SCHEDULED
  scheduledAt    DateTime?
  address        String
  area           String
  lat            Float?
  lng            Float?
  aiPriceMin     Int?
  aiPriceMax     Int?
  agreedPrice    Int?
  status         BookingStatus @default(REQUESTED)
  startCodeHash  String?
  startAttempts  Int           @default(0)
  startedAt      DateTime?
  completedAt    DateTime?
  cancelledBy    Party?
  cancelReason   String?
  messages       Message[]
  offers         PriceOffer[]
  review         Review?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  @@index([workerId, status])
  @@index([customerId, status])
}

model PriceOffer {
  id        String      @id @default(cuid())
  bookingId String
  booking   Booking     @relation(fields: [bookingId], references: [id])
  by        Party
  amount    Int
  status    OfferStatus @default(PENDING)
  createdAt DateTime    @default(now())
}

model Message {
  id          String   @id @default(cuid())
  bookingId   String
  booking     Booking  @relation(fields: [bookingId], references: [id])
  senderId    String?  // null for SYSTEM
  type        MsgType
  text        String?
  audioId     String?
  transcript  String?
  translation String?
  lang        Lang?
  offerId     String?
  createdAt   DateTime @default(now())
  @@index([bookingId, createdAt])
}

model Review {
  id         String       @id @default(cuid())
  bookingId  String       @unique
  booking    Booking      @relation(fields: [bookingId], references: [id])
  customerId String
  workerId   String
  overall    Int
  quality    Int
  onTime     Int
  fairPrice  Int
  behaviour  Int
  tags       String[]
  text       String?
  voiceId    String?
  transcript String?
  flagged    Boolean      @default(false)
  flagReason String?
  status     ReviewStatus @default(PUBLISHED)
  createdAt  DateTime     @default(now())
}

model Media {
  id        String    @id @default(cuid())
  ownerId   String
  kind      MediaKind
  mime      String
  size      Int
  data      Bytes     // demo: stored in Postgres (no external bucket needed)
  createdAt DateTime  @default(now())
}

model AuditLog {
  id       String   @id @default(cuid())
  actorId  String
  action   String
  entity   String
  entityId String
  meta     Json?
  createdAt DateTime @default(now())
}
```

---

## 6. Auth & OTP (SendPK) — secure, free to demo

### 6.1 OTP flow
1. `POST /api/v1/auth/otp/request { phone }`
   - Normalise and validate a Pakistani mobile: `^(?:\+92|0092|92|0)?3\d{9}$` → store as `923XXXXXXXXX`.
   - Rate limits: **1 per 60 s per phone, 5 per hour per phone, 20 per hour per IP** (`@nestjs/throttler` plus a DB check).
   - Code: **4 digits** (the Figma has 4 boxes), from `crypto.randomInt(0, 10000)` padded. Store `HMAC-SHA256(OTP_PEPPER, phone + ':' + code)`. Expiry **5 min**. Older open challenges for that phone get invalidated.
   - Send via SendPK, using the message in the user's language: `Roshan Rozgar code: 4827. Valid 5 min. Do not share.`
   - The response is always the same generic `{ ok: true, resendIn: 60 }` (no user enumeration).
2. `POST /api/v1/auth/otp/verify { phone, code, role? }`
   - **Max 5 attempts per challenge**, then the challenge is locked. Use timing-safe comparison. Mark it consumed when used (single use).
   - New user: `role` must be `CUSTOMER` or `WORKER`. **`ADMIN` is never accepted from the client.** Admins exist only through the seed or `ADMIN_PHONES`.
   - Issue an access JWT (15 min) and a refresh token (7 days, random 32 bytes, stored hashed, **rotated on every refresh**, reuse detection revokes all). Both go in **httpOnly, Secure, SameSite=Lax cookies**.
3. `POST /auth/refresh`, `POST /auth/logout` (revoke), `GET /auth/me`.

### 6.2 SendPK adapter (`backend/src/auth/sms/sendpk.service.ts`)
```ts
// Confirm the exact endpoint/params in your SendPK dashboard → API section.
// Common format: GET https://sendpk.com/api/sms.php?api_key=KEY&sender=SENDER&mobile=923XXXXXXXXX&message=TEXT
// Older accounts use username=&password= instead of api_key — support both via env.
```
- Env: `SENDPK_API_KEY` (or `SENDPK_USERNAME` + `SENDPK_PASSWORD`), `SENDPK_SENDER`.
- Timeout 8 s. Never log the code or the full URL (it contains secrets). Log `{phoneMasked, status}` only.
- Urdu SMS needs unicode. Keep the OTP text in English/Roman Urdu to save credits.

### 6.3 Demo-safe mode (so the live demo can't fail)
- `OTP_MODE=sendpk|demo`. In `demo` mode **no SMS is sent**. The API returns `demoCode`, but **only when `DEMO_MODE=true`**, and the UI shows a banner: **"Demo OTP: 4827"** (the WM2 "auto-filled" sheet design).
- `DEMO_PHONES` (e.g. `03000000001` customer, `03000000002` worker, `03000000003` admin) with fixed code `1234`. Accepted **only when `DEMO_MODE=true`**, for the judges.
- In the README and in the demo, say it out loud: *"Real SMS via SendPK is wired; for the judges we use demo numbers so the demo doesn't depend on network SMS."*

### 6.4 CSRF and sessions
- SameSite=Lax cookies on a same-origin proxy. Every state-changing request must also carry the header `X-Requested-With: roshan`, and the backend checks `Origin` against `FRONTEND_URL`.
- `middleware.ts` in Next verifies the access JWT with `jose` (`JWT_ACCESS_SECRET`) and redirects by role: `/c/*` CUSTOMER, `/w/*` WORKER, `/admin/*` ADMIN. **The backend re-checks everything.**

---

## 7. RBAC + ownership (backend guards)

- `@Roles(...)` decorator + `RolesGuard` (global, after `JwtAuthGuard`). Routes are deny-by-default: every controller declares its roles; public routes are marked `@Public()`.
- Ownership guards stop one user reading another user's data:
  - `BookingPartyGuard`: the user must be the booking's customer or worker (admin read-only allowed).
  - `MediaAccessGuard`: `VOICE`/`PROBLEM_PHOTO` → booking parties. `CNIC_*` → **owner + ADMIN only**, and every admin view is written to `AuditLog`. `PHOTO`/`WORK_PHOTO` → public only if the worker is VERIFIED.
- `WorkerStatusGuard` (`@RequireWorkerStatus('VERIFIED')`): only verified workers can go AVAILABLE, appear in search, or accept jobs.

| Action | Customer | Worker | Admin |
|---|---|---|---|
| Search/view verified workers | ✅ | ✅ (own public view) | ✅ |
| Create booking | ✅ (own) | ❌ | ❌ |
| Accept/decline request | ❌ | ✅ (own, VERIFIED, not busy) | ❌ |
| Send price offer / accept the other side's offer | ✅ (party) | ✅ (party) | ❌ |
| Start job with code / complete | ❌ | ✅ (own) | ❌ |
| Cancel | ✅ (party, allowed states) | ✅ (party, allowed states) | ✅ (force, audited) |
| Chat / voice notes | ✅ party | ✅ party | 👁 read (audited) |
| Review | ✅ (own booking, COMPLETED, once) | ❌ | hide/keep (audited) |
| Toggle availability | ❌ | ✅ VERIFIED only, never sets BUSY manually | ❌ |
| Approve/reject/suspend worker, view CNIC | ❌ | ❌ | ✅ (audited) |
| Admin stats | ❌ | ❌ | ✅ |

---

## 8. Onboarding rules (state machines)

### 8.1 Worker (status: ONBOARDING → PENDING_REVIEW → VERIFIED | REJECTED; SUSPENDED by admin)
Steps (stored as derived completeness, shown as the progress dots in the design):
1. **Phone OTP** (W2 keypad / WW1). Role WORKER. Urdu UI by default.
2. **Voice profile** (W3 / WW2) using the Vapi Urdu agent (§9.3). It produces `name, trade, experienceYears, areas[], baseRate, workHours`. Fallback: record → ElevenLabs STT → `/extract/profile`.
   - Validation: trade ∈ enum, `0 ≤ experienceYears ≤ 60`, `100 ≤ baseRate ≤ 50000` PKR, 1–5 areas from the known sector list (G-9, G-10, G-11, F-10, I-8, Saddar…), name 2–60 chars.
3. **Confirm AI profile** (W4): each field has 🔊 listen and ✏️ re-speak. Nothing is saved until the worker taps **"جی ہاں، ٹھیک ہے"**.
4. **Face photo + work photos** (W5): JPEG/PNG only, ≤ 5 MB, re-encoded with `sharp` (**strips EXIF/GPS**), min 400×400. Optional AI check "face clear".
5. **CNIC front + back** (W5b, new screen; build it in the same style as W5): upload both → AI OCR (§9.1) → server checks:
   - `format`: `^\d{5}-\d{7}-\d$`
   - `frontBackMatch`: the number on the back (barcode area text) equals the front, when readable
   - `notExpired`: expiry > today; `adult`: age ≥ 18 from DOB
   - `nameMatch`: fuzzy (rapidfuzz token_sort_ratio) between the card name and the spoken name ≥ 70
   - `quality`: OCR confidence ≥ 60 and not blurry (Laplacian variance threshold)
   - `unique`: `numberHmac` not used by another account
   - On failure, show a friendly Urdu message + 🔊 + retake. Never echo the full CNIC back; show `xxxxx-xxxxxxx-1`.
   - Store the number **AES-256-GCM encrypted** (`CNIC_ENC_KEY`) + HMAC (`CNIC_HMAC_KEY`). Images go in `Media` with CNIC access rules.
   - UI label: **"ID verification is demo — not checked against NADRA"** (that check is out of scope in the brief).
6. **Submit** → `PENDING_REVIEW` (worker sees "waiting for approval" screen with 🔊). The admin approves in A2/A5 → `VERIFIED`; only then do the availability switch and incoming requests turn on.
- `POST /workers/me/submit` re-validates that **every** step is complete server-side; the client can't skip steps.

### 8.2 Customer
1. Phone OTP (CM1) with role CUSTOMER → 2. Name (one field, or say it with the mic) → 3. Location: browser geolocation **or** pick a sector, plus an address line. Booking is blocked until name + address exist (server check).

### 8.3 Admin
- Seeded from `ADMIN_PHONES` only. OTP login. Every admin mutation goes to `AuditLog`. There is no admin signup route.

---

## 9. AI + voice (Python service + Vapi + ElevenLabs)

All AI endpoints are **internal**. Every request needs header `X-Internal-Key: AI_INTERNAL_KEY`; anything else gets 401. Only the NestJS backend calls them. Timeouts are 15 s, and the backend has graceful fallbacks.

### 9.1 CNIC OCR — `POST /ocr/cnic` (multipart `front`, `back`)
- `pytesseract` + OpenCV preprocessing: grayscale → resize ×2 → bilateral filter → adaptive threshold; deskew if needed. Use `lang=eng` (the CNIC's key fields are in English).
- Parse with regex: CNIC `\d{5}-\d{7}-\d`, dates `\d{2}\.\d{2}\.\d{4}`, Name/Father Name lines after the labels "Name" / "Father Name". Take DOB as the earliest date, expiry as the latest.
- Return `{cnicNumber, name, fatherName, dob, expiry, confidence, blurScore, backCnicNumber}`. Never log the values.
- Docker: `apt-get install -y tesseract-ocr libgl1` (`Dockerfile` in `ai/`).

### 9.2 ElevenLabs
- **STT**: `POST /stt` (audio webm/ogg/mp4 ≤ 2 MB, ≤ 60 s) → ElevenLabs Speech-to-Text **Scribe** (`scribe_v1`/`scribe_v2`), language hint `ur` or `en`. It supports Urdu. Returns `{text, language}`.
- **TTS**: `POST /tts {text, lang}` → mp3 stream. Used for 🔊 **سنیں** buttons, reading the incoming request aloud to the worker (WM1), and reading customer chat messages in Urdu. Pick a multilingual model and voice from your ElevenLabs dashboard that speaks Urdu (**check that your plan's model supports Urdu**). Cache audio by `hash(text+voice)` to save credits.
- Env: `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_UR`, `ELEVENLABS_VOICE_ID_EN`, `ELEVENLABS_TTS_MODEL`.

### 9.3 Vapi (voice agents in the browser via `@vapi-ai/web`)
Create **2 assistants** in the Vapi dashboard. Use ElevenLabs as the voice provider, and pick a transcriber that supports Urdu.

**A. Worker onboarding agent (Urdu)**, used on W3/WW2
- First message: `السلام علیکم! میں روشن روزگار سے بول رہی ہوں۔ اپنا نام بتائیں۔`
- System prompt: ask one short question at a time, in simple Urdu: name → kaam (trade) → kitne saal → kis ilaqay mein → rate → timings. Confirm back. Then call the tool `save_worker_profile`. Never ask for CNIC numbers or money details by voice.
- Tool `save_worker_profile` (server URL = `BACKEND_PUBLIC_URL/api/v1/vapi/webhook`):
  `{ name: string, trade: "ELECTRICIAN|PLUMBER|AC_TECHNICIAN|CARPENTER|MECHANIC|PAINTER", experience_years: number, areas: string[], base_rate: number, work_hours: string }`

**B. Customer booking agent (English / Roman Urdu / Urdu)**, used on C1/M1 mic and the C2 flow
- Collects the problem, urgency, and address/sector. Calls `find_workers` → backend returns `{trade, priceRange, top3}`, and the agent reads them out. **The final booking is confirmed by a tap in the UI (CM3)**; voice never confirms a booking or a price on its own.
- Tool `find_workers`: `{ problem_summary: string, trade: enum, urgency: "NOW|TODAY|SCHEDULED", area: string }`

**Webhook security** (`POST /api/v1/vapi/webhook`):
- Set the assistant **server secret** in Vapi. The backend checks header `x-vapi-secret === VAPI_WEBHOOK_SECRET` (timing-safe); anything else → 401.
- **Never trust a userId from the call.** Before starting a call, the frontend asks `POST /voice/session`, which returns a **short-lived signed voice token** (JWT 10 min, bound to userId + purpose). It's passed to Vapi via `assistantOverrides.variableValues.voiceToken` / `metadata`. The webhook verifies the token and uses its userId.
- The webhook validates tool args with the same DTOs as the REST API, and is idempotent per `toolCallId`.
- Frontend: `vapi.on('message')` shows live `transcript` text in the transcript bubble (W3 design). On `call-end`, poll `/workers/me` and go to W4.
- Env: `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_WORKER_ASSISTANT_ID`, `NEXT_PUBLIC_VAPI_CUSTOMER_ASSISTANT_ID`, `VAPI_WEBHOOK_SECRET`.
- Fallback if Vapi fails live: the mic records with `MediaRecorder` → `/voice/stt` → `/ai/extract-profile`. **Build this fallback; it's your safety net.**

### 9.4 Other AI endpoints (Python)
| Endpoint | Does | Without an LLM key |
|---|---|---|
| `POST /extract/profile {transcript}` | Urdu/Roman-Urdu transcript → profile JSON | keyword + number parser (Urdu numerals ۰-۹ and words like "بارہ" → 12) |
| `POST /diagnose {text, image?}` | trade + likely issue + confidence | keyword classifier (EN/Roman/Urdu: "ac, thanda, gas" → AC; "nalka, leak, paani, pipe" → PLUMBER; "bijli, switch, pankha, wire" → ELECTRICIAN …) |
| `POST /price {trade, area}` | fair range = p25–p75 of completed bookings (same trade/area, 90 days, from backend data) | default table per trade |
| `POST /moderate/review {text}` | abusive words (ur/en lists), spam patterns | wordlist |
| `POST /summary/reviews {reviews[]}` | 2-sentence summary + top tags | top tags template |
| `POST /translate {text, to}` | chat translation EN↔UR | show original + TTS only |

- **Optional LLM** (`LLM_API_KEY`, e.g. Gemini free tier) improves extraction, diagnosis, translation and summaries. Ask the user whether they want it. Everything must work without it.
- The backend also flags fake-looking reviews: same device/IP or phone reviewing 3+ workers within 10 minutes → `flagged=true`.

---

## 10. API contract (`/api/v1`, JSON, all inputs validated with class-validator DTOs)

**Auth**: `POST /auth/otp/request` · `POST /auth/otp/verify` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `PATCH /users/me {name, lang}`

**Customer**: `GET|PATCH /customers/me {address, area, lat, lng}`

**Worker (role WORKER)**
- `GET /workers/me` (profile + onboarding completeness + activeBooking)
- `PUT /workers/me/profile` (confirmed fields from W4)
- `POST /workers/me/photo` (multipart) · `POST /workers/me/work-photos`
- `POST /workers/me/cnic` (multipart front, back) → `{checks, masked, ok}`
- `POST /workers/me/submit`
- `PATCH /workers/me/availability {AVAILABLE|OFFLINE}` → 409 if not VERIFIED or has an active job
- `GET /workers/me/requests` (REQUESTED/NEGOTIATING for me) · `GET /workers/me/earnings`

**Discovery (CUSTOMER, public read)**: `GET /workers/search?trade&lat&lng&radiusKm=5&availableNow=true&minRating&sort=best|distance|price` (VERIFIED only; returns distance + ETA, masked phone) · `GET /workers/:id` (public profile, aspect ratings, aiSummary, recent reviews) · `POST /ai/diagnose {text, photoMediaId?}` → `{trade, issue, confidence, priceMin, priceMax, basis}`

**Bookings**
- `POST /bookings` (CUSTOMER) `{workerId, trade, problemText, problemVoiceId?, problemPhotoId?, urgency, address, area, lat?, lng?}` → status REQUESTED, `aiPriceMin/Max` stored. 409 `WORKER_UNAVAILABLE` if the worker isn't AVAILABLE (frontend shows **CM6**).
- `GET /bookings?role-aware` · `GET /bookings/:id`
- `POST /bookings/:id/accept` (WORKER) → NEGOTIATING · `POST /bookings/:id/decline {reason: FAR|BUSY|NOT_MY_WORK|LOW_PRICE}` (WM6 icons)
- `POST /bookings/:id/offers {amount}` (party; supersedes the previous pending offer)
- `POST /bookings/:id/offers/:offerId/accept` (**the other** party) → **CONFIRMED + worker BUSY** (§12)
- `POST /bookings/:id/start {code}` (WORKER; 5 attempts) → IN_PROGRESS
- `POST /bookings/:id/complete` (WORKER) → COMPLETED + worker AVAILABLE
- `POST /bookings/:id/cancel {reason}` (party: REQUESTED/NEGOTIATING/CONFIRMED only)
- `GET /bookings/:id/messages?after=` · `POST /bookings/:id/messages {type: TEXT|VOICE, text?, audioId?}` (voice → STT transcript + optional translation; AI detects a price like "1000 rupay" in the transcript and proposes a PRICE_OFFER card the sender confirms with one tap)
- `POST /bookings/:id/review {overall, quality, onTime, fairPrice, behaviour, tags[], text?, voiceId?}`

**Voice/media**: `POST /media` (multipart, kind) · `GET /media/:id` (guarded, `Cache-Control: private, no-store` for CNIC) · `POST /voice/stt` · `POST /voice/tts {text, lang}` · `POST /voice/session {purpose}` · `POST /vapi/webhook`

**Admin (role ADMIN)**: `GET /admin/stats` · `GET /admin/workers?status` · `GET /admin/workers/:id` (CNIC masked + image links; audited) · `POST /admin/workers/:id/approve|reject {reason}|suspend` · `GET /admin/bookings?status` · `GET /admin/reviews?flagged=true` · `POST /admin/reviews/:id/hide|keep` · `GET /admin/audit`

Errors: `{ error: { code: 'WORKER_UNAVAILABLE' | 'INVALID_STATE' | 'RATE_LIMITED' | 'OTP_INVALID' | 'FORBIDDEN' | ..., message } }`. No stack traces in responses.

---

## 11. Frontend routes ↔ Figma frames

| Route | Desktop frame | Mobile frame | Notes |
|---|---|---|---|
| `/` | C1 Home | M1 Home | AI input (text + mic + camera), trade tiles with live counts, nearby workers, trust cards, truck strip |
| `/login` (+ modal) | CM1 | sheet | phone + 4-box OTP; "Demo OTP" banner in demo mode |
| `/start` | WW1 (left) | W1 | choose role + language |
| `/c/diagnose` | C2 (+ CM2 while loading) | M2 | photo/voice transcript, AI issue, trade, fair price, urgency chips, "worker will hear this in Urdu" |
| `/c/workers` | C3 | M3 | list + map, filters; busy card greyed → CM6 |
| `/c/workers/[id]` | C4 | M4 | aspect bars, AI summary, reviews (voice), sticky request card → CM3 |
| `/c/bookings` | C8 | M8 | tabs Active/Past/Cancelled |
| `/c/bookings/[id]` | C6 (tracking) | M6 | stepper, map, start code 4 digits, busy note, share trip, cancel → CM7 |
| `/c/bookings/[id]/chat` | C5 | M5 | translated voice notes, AI price card → CM4 counter, accept → CM5 |
| `/c/bookings/[id]/review` | C7 → CM8 | M7 | stars, aspects, tags, voice review |
| `/w/onboarding/phone` | WW1 | W2 (+ WM2) | big keypad, mic-to-speak number |
| `/w/onboarding/voice` | WW2 | W3 (+ WM4) | Vapi agent, pulse mic, live transcript |
| `/w/onboarding/review` | WW2 (right card) | W4 | each field 🔊 + ✏️ |
| `/w/onboarding/photo` | — | W5 | face + work photos |
| `/w/onboarding/cnic` | new (W5 style) | W5b new | front/back capture, OCR chips, masked number |
| `/w/onboarding/pending` | — | new simple | "waiting for approval" + 🔊 |
| `/w` | WW3 | W6 | availability switch, stats, requests; incoming request → WM1; decline → WM6 |
| `/w/jobs/[id]/chat` | WW4 | W7 (+ WM3, WM4) | hold-to-talk, quick replies, price card |
| `/w/jobs/[id]` | WW5 | W8 (+ WM5) | busy banner, map, customer card, start code entry, complete |
| `/w/jobs/[id]/done` | — | W9 | earnings, rating, voice review summary, "available again" |
| `/admin` | A1 | responsive | KPIs, chart (recharts), live free/busy, AI alerts, recent bookings |
| `/admin/workers` | A2 (+ A5 modal) | responsive | tabs, approve/reject, voice intro playback, OCR checks |
| `/admin/bookings` | A3 | responsive | booking vs worker-now status, start-code time |
| `/admin/reviews` | A4 | responsive | flagged items, remove/keep |

- Worker desktop layout = right-side `WorkerSideNav` (RTL) + main. Worker mobile = `WorkerBottomBar`.
- Customer desktop = top `CustomerNav`. Customer mobile = `CustomerTabBar`.
- **Incoming request (WM1)**: on `/w`, poll `/workers/me/requests` every 3 s. A new one opens WM1 full-screen and auto-plays the TTS of the customer's request (user gesture needed: the first tap on "Available" unlocks audio).

---

## 12. Booking consistency (the core of outcome 4)

```ts
// accept offer → confirm booking (BookingsService.acceptOffer)
await this.prisma.$transaction(async (tx) => {
  const b = await tx.booking.findUniqueOrThrow({ where: { id }, include: { offers: true } });
  assertParty(user, b); assertOtherParty(user, offer);           // ownership
  if (b.status !== 'NEGOTIATING') throw new ConflictException('INVALID_STATE');
  // atomic claim: only succeeds if the worker is still free
  const claimed = await tx.workerProfile.updateMany({
    where: { id: b.workerId, status: 'VERIFIED', availability: 'AVAILABLE', activeBookingId: null },
    data:  { availability: 'BUSY', activeBookingId: b.id },
  });
  if (claimed.count !== 1) throw new ConflictException('WORKER_UNAVAILABLE');
  const code = randomInt(0, 10000).toString().padStart(4, '0');
  await tx.booking.update({ where: { id }, data: {
    status: 'CONFIRMED', agreedPrice: offer.amount, startCodeHash: hmac(code) } });
  await tx.priceOffer.update({ where: { id: offer.id }, data: { status: 'ACCEPTED' } });
  // every other open request for this worker → EXPIRED + system message ("worker just got booked")
  await tx.booking.updateMany({ where: { workerId: b.workerId, id: { not: b.id },
    status: { in: ['REQUESTED', 'NEGOTIATING'] } }, data: { status: 'EXPIRED' } });
  // return code to the CUSTOMER only (shown in CM5/C6); never to the worker
}, { isolationLevel: 'Serializable' });
```
- `activeBookingId @unique` + the conditional `updateMany` guarantee **at most one active job per worker**, even with double clicks or two customers at once.
- `complete` (and `cancel` from CONFIRMED) frees the worker in the same transaction: `availability: AVAILABLE, activeBookingId: null`. Also update `jobsDone` and rating aggregates.
- Worker availability toggle can't set BUSY, and can't go OFFLINE while `activeBookingId` is set.
- Search filters `availability = AVAILABLE AND status = VERIFIED`. The UI shows busy workers greyed with "Busy until ~" (C3 design).
- Admin A3 shows "0 double-bookings" computed live: `count(workers with >1 booking in CONFIRMED|IN_PROGRESS)` should be 0.

---

## 13. Security checklist (implement all; mention in the pitch)

**Transport & headers**: HTTPS on Render; `helmet()` with CSP on Next (`next.config` headers: default-src 'self'; connect-src 'self' https://*.vapi.ai wss://*.vapi.ai https://api.elevenlabs.io; media-src 'self' blob:; img-src 'self' data: blob: https://*.tile.openstreetmap.org); `X-Frame-Options: DENY`; `Referrer-Policy: strict-origin-when-cross-origin`; `Permissions-Policy: microphone=(self), camera=(self), geolocation=(self)`.

**Input**: global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`; enums for trade/status; integer PKR price bounds 100–100000; string length caps; phone regex; Prisma only (no raw SQL with string concatenation).

**Rate limiting**: `@nestjs/throttler` global 100/min/IP; OTP request/verify limits (§6); STT/TTS 20/min/user; booking create 10/hour/customer; review 5/hour.

**Uploads**: multer memory storage, size limits (images 5 MB, audio 2 MB), **magic-byte check** with `file-type` (not just the extension/mime header), images re-encoded with `sharp` (EXIF/GPS stripped), random IDs, never served with the user-supplied filename, `X-Content-Type-Options: nosniff`.

**Auth/session**: short access JWT, rotating hashed refresh tokens, httpOnly Secure SameSite cookies, logout revokes, separate `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`VOICE_TOKEN_SECRET`, `isActive=false` users blocked, suspended workers blocked from worker endpoints.

**Authorization**: deny-by-default `RolesGuard`, ownership guards (IDOR protection) on bookings/messages/media/reviews, `ADMIN` never self-assignable, admin actions audited.

**Sensitive data**: CNIC number AES-256-GCM + HMAC uniqueness; CNIC images owner/admin only; phones masked in public responses (`0300•••4567`); pino logger with `redact: ['req.headers.cookie','*.phone','*.code','*.cnic*','*.otp']`; no PII in errors.

**Service-to-service**: AI service requires `X-Internal-Key` and rejects everything else; Vapi webhook `x-vapi-secret` + signed voice token; outbound timeouts and retries (1).

**Business rules**: state machine checks on every booking action; start code hashed, 5 attempts; the review only by that booking's customer after COMPLETED, once; offers only by parties; nobody accepts their own offer.

**Frontend**: no `dangerouslySetInnerHTML`; React escapes output; secrets never in `NEXT_PUBLIC_*` except the Vapi **public** key and assistant IDs; mic/camera only on user gesture.

**Ops**: `.env*` in `.gitignore`; `npm audit --omit=dev` once; README "Security" section listing the above.

---

## 14. Seed data (`prisma/seed.ts`), required by the brief

- 1 admin (from `ADMIN_PHONES`), 3 customers (Sara Ahmed G-10/2, Ali Raza G-10/4, Hina Malik G-11), **20 workers** across 6 trades in Islamabad/Rawalpindi sectors with real-ish lat/lng (G-9, G-10, G-11, F-10, I-8, Saddar RWP). Use the names from Figma: Imran Khan (Electrician, 12 yrs, Rs 800, 4.8), Bilal Ahmed (AC, 4.9), Shakeel Abbasi (Plumber, 4.7), Naveed Iqbal (Carpenter, 4.6), Usman Tariq, Kamran Ali, Faisal Mehmood (busy), Asif Mehmood & Rizwan Shah (PENDING_REVIEW)…
- ~80 completed past bookings (used for the fair-price p25–p75), ~60 reviews with aspect scores + tags, 1 flagged review set (same phone, 3 five-star reviews in 10 min), 1 abusive voice review, 1 over-priced booking (Rs 6,000 for fan repair).
- Demo accounts: customer `03000000001`, worker `03000000002` (VERIFIED, AVAILABLE, = Imran), admin `03000000003`, all OTP `1234` when `DEMO_MODE=true`.
- The README lists exactly what is seeded and mocked: seeded workers/bookings/reviews, demo OTP numbers, CNIC/NADRA check not real, map tiles OSM, payments out of scope (cash).

---

## 15. Environment variables (ask the user for these, at the step that needs them)

| Var | Where | Needed at step | Notes |
|---|---|---|---|
| `DATABASE_URL` | backend | T+5 | Render Postgres (or local `docker run postgres`) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `VOICE_TOKEN_SECRET`, `OTP_PEPPER` | backend | T+5 | generate: `openssl rand -base64 48` (Claude may generate locally for dev; user sets prod values) |
| `CNIC_ENC_KEY` (32-byte base64), `CNIC_HMAC_KEY` | backend | CNIC step | `openssl rand -base64 32` |
| `FRONTEND_URL`, `BACKEND_PUBLIC_URL` | backend | deploy | for Origin check, Vapi server URL |
| `ADMIN_PHONES`, `DEMO_MODE`, `DEMO_PHONES`, `OTP_MODE` | backend | T+5 | `DEMO_MODE=true` for the event |
| `SENDPK_API_KEY` (or `SENDPK_USERNAME`/`SENDPK_PASSWORD`), `SENDPK_SENDER` | backend | OTP step | from the SendPK dashboard |
| `AI_SERVICE_URL`, `AI_INTERNAL_KEY` | backend + ai | AI step | same key on both sides |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID_UR`, `ELEVENLABS_VOICE_ID_EN`, `ELEVENLABS_TTS_MODEL` | ai | voice step | from the ElevenLabs dashboard |
| `LLM_API_KEY` (optional) | ai | AI step | e.g. Gemini free tier; ask if wanted |
| `VAPI_WEBHOOK_SECRET` | backend | Vapi step | set the same secret on both assistants |
| `NEXT_PUBLIC_VAPI_PUBLIC_KEY`, `NEXT_PUBLIC_VAPI_WORKER_ASSISTANT_ID`, `NEXT_PUBLIC_VAPI_CUSTOMER_ASSISTANT_ID` | frontend | Vapi step | public key only |
| `BACKEND_URL` | frontend (server) | T+5 | used by Next rewrites |
| `JWT_ACCESS_SECRET` | frontend (middleware) | auth step | same as backend, to verify role in middleware |

---

## 16. Deploy on Render (`render.yaml`)

```yaml
databases:
  - name: rr-db
    plan: free
services:
  - type: web
    name: rr-ai
    runtime: docker
    rootDir: ai
    plan: free
    envVars:
      - { key: AI_INTERNAL_KEY, sync: false }
      - { key: ELEVENLABS_API_KEY, sync: false }
      - { key: LLM_API_KEY, sync: false }
  - type: web
    name: rr-backend
    runtime: node
    rootDir: backend
    plan: free
    buildCommand: npm ci && npx prisma generate && npm run build
    startCommand: npx prisma migrate deploy && node dist/main.js
    envVars:
      - { key: DATABASE_URL, fromDatabase: { name: rr-db, property: connectionString } }
      - { key: AI_SERVICE_URL, sync: false }
      # …all backend vars from §15 with sync:false
  - type: web
    name: rr-frontend
    runtime: node
    rootDir: frontend
    plan: free
    buildCommand: npm ci && npm run build
    startCommand: npm start
    envVars:
      - { key: BACKEND_URL, sync: false }
      # …NEXT_PUBLIC_* vars
```
- `ai/Dockerfile`: `python:3.11-slim`, `apt-get install -y tesseract-ocr libgl1 && rm -rf /var/lib/apt/lists/*`, `pip install -r requirements.txt`, `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Backend listens on `process.env.PORT`; `app.setGlobalPrefix('api/v1')`; `app.set('trust proxy', 1)` for real IPs behind Render.
- **Free Render services sleep.** Open all 3 URLs 5 minutes before judges arrive. **Also keep a local run ready** (`npm run dev` ×2 + `uvicorn`); the brief accepts local.
- Run the seed once: `npx prisma db seed` (Render shell or locally against the Render DB URL).

---

## 17. 90-minute schedule (3 parallel Claude Code sessions)

| Time | T1 Backend | T2 Frontend | T3 AI + Vapi |
|---|---|---|---|
| 0–10 | clone, folders, Nest + Prisma schema, `api-contract.md`, migrate | Next app, Tailwind tokens, fonts, i18n, `components/ui` base | FastAPI skeleton + internal key, Dockerfile, `/stt` `/tts` |
| 10–30 | auth/OTP (SendPK + demo), JWT cookies, RBAC guards, users/customers | layout shells (nav, tab bar, side navs), C1/M1 home, login CM1, `middleware.ts` | `/ocr/cnic` with preprocessing + parser; `/diagnose`, `/price` |
| 30–50 | workers (onboarding, CNIC, submit, availability, search), media upload security | customer flow C2→C8 + modals CM2–CM8 | Vapi: create 2 assistants (user does the dashboard part with your instructions), `/extract/profile` fallback |
| 50–65 | bookings state machine (§12), offers, messages (voice → STT), reviews, Vapi webhook, voice token | worker flow W1–W9 + WM1–WM6 (mobile) + WW1–WW5 (desktop), Vapi hook, recorder | `/moderate`, `/summary`, help T1 integrate |
| 65–75 | admin endpoints + audit, seed.ts | admin A1–A5, animations polish | README AI section |
| 75–85 | **integration test of the full flow** (§20) on local | same | same |
| 85–90 | deploy on Render (render.yaml), seed, warm-up | deploy | deploy |

Checkpoints: at **T+30** login works for all 3 roles. At **T+65** one full booking runs end to end locally. If either is late, apply §19 immediately.

---

## 18. Kickoff prompts (paste into each Claude Code terminal)

**T0 (one terminal, first 3 min)**
> Clone https://github.com/Ali-Hassan-Durrani/roshan-rozgar-tribyte.git, create `frontend/` (Next.js 14 TS Tailwind App Router src-dir), `backend/` (NestJS), `ai/` (FastAPI), `docs/`, `design/screens/`. Move `IMPLEMENTATION_PLAN.md` into `docs/` and `CLAUDE.md` to the root. Add `.gitignore` for node/python/env. Add `.env.example` in each app with empty values from §15. Commit "chore: scaffold" (the brief requires commits after the start time).

**T1 Backend**
> Read `CLAUDE.md` and `docs/IMPLEMENTATION_PLAN.md` §5–§8, §10, §12–§14. In `backend/`: install `@nestjs/config @nestjs/jwt @nestjs/throttler prisma @prisma/client class-validator class-transformer helmet cookie-parser multer file-type sharp pino nestjs-pino axios`. Create the Prisma schema exactly as §5, write `docs/api-contract.md` from §10 first, then implement modules in this order: auth (OTP + SendPK adapter + demo mode + JWT cookies + refresh rotation), common guards (Roles, ownership, worker status), users/customers, workers (onboarding, CNIC with AES-GCM + HMAC + all checks, submit, availability, search with distance), media (secure upload), bookings (state machine + the §12 transaction), messages (voice → AI STT, price detection), reviews (+ flagging), voice (session token, stt/tts proxy), vapi webhook (secret + token), admin (+ audit), seed.ts (§14). Apply the full §13 security checklist. Ask me for any env var when you reach the step that needs it. Commit after each module.

**T2 Frontend**
> Read `CLAUDE.md` and `docs/IMPLEMENTATION_PLAN.md` §4, §6.4, §9.3, §11. Match the Figma exactly using `design/screens/*.png` and the tokens in §4. In `frontend/`: install `framer-motion lucide-react @tanstack/react-query jose @vapi-ai/web recharts leaflet react-leaflet clsx`. Set fonts (Plus Jakarta Sans + Noto Nastaliq Urdu), Tailwind tokens, i18n EN/UR with RTL, Next rewrites `/api/:path*` → `BACKEND_URL`, `middleware.ts` role guard. Build `components/ui` (§4.5) with animations (§4.6), then screens in this order: home C1/M1 + login CM1 → customer C2–C8 + CM2–CM8 → worker W1–W9 + W5b CNIC + WM1–WM6 (mobile-first) and WW1–WW5 (desktop) → admin A1–A5. Fully responsive (desktop frames ≥768 px, mobile frames below). Use the API contract in `docs/api-contract.md`; until an endpoint exists, use typed mock data behind the same interface. Ask me for env vars when needed. Commit after each flow.

**T3 AI**
> Read `CLAUDE.md` and `docs/IMPLEMENTATION_PLAN.md` §9. In `ai/`: FastAPI with `X-Internal-Key` dependency on every route; endpoints `/ocr/cnic` (pytesseract + OpenCV preprocessing + regex parser + blur score), `/stt` and `/tts` (ElevenLabs), `/extract/profile`, `/diagnose`, `/price`, `/moderate/review`, `/summary/reviews`, `/translate` each with a no-LLM fallback and optional LLM via `LLM_API_KEY`. Write the Dockerfile (tesseract-ocr). Then write `docs/vapi-setup.md` with exact steps, system prompts and tool JSON schemas for the 2 Vapi assistants from §9.3 so I can paste them in the Vapi dashboard. Ask me for env vars when needed.

---

## 19. Cut list (if behind schedule, cut in this order)

1. Translation of chat text (keep voice notes + TTS 🔊).
2. Leaflet live map → the static stylised map from Figma with pins.
3. Work photos (keep the face photo).
4. Customer Vapi agent (keep customer mic → STT into the text box; the worker Vapi agent stays because onboarding is outcome 1).
5. Admin A3/A4 pages (keep A1 + A2 approve; outcome 4 is shown in C6/W8).
6. Desktop worker screens WW* → responsive versions of the mobile W* screens.

**Never cut:** OTP login for 3 roles, worker voice onboarding, CNIC upload + checks, search showing only available workers, price offer + accept → BUSY transaction, start code, complete → AVAILABLE, review + AI summary, admin approve.

---

## 20. Demo script (run it at T+75, and again for the judges)

1. **Worker (phone screen, Urdu)**: W1 choose "میں کاریگر ہوں" → phone + demo OTP → **speak profile to Vapi** → W4 AI-built profile (tap 🔊) → photo → **CNIC front/back → OCR checks shown** → submitted.
2. **Admin (laptop)**: A2 → open the new worker → A5 shows the voice intro + OCR checks → Approve.
3. **Customer (laptop)**: C1 type/speak "AC thanda nahi kar raha" or upload a photo → C2 AI says AC Technician + fair Rs range → C3 only **free** workers (one greyed Busy) → C4 profile with AI review summary → send request.
4. **Worker**: WM1 incoming request **reads aloud** → accept → voice note "1000 rupay" → **AI price card**.
5. **Customer**: accept → CM5 booked + start code. **Show a second customer trying to book the same worker → CM6 "just got booked"**. That's outcome 4 proven live.
6. Worker enters the start code → complete → W9 "available again". Customer review (voice) → CM8 → C4 summary updated. Admin A3 shows 0 double-bookings.
7. Close: "Remove the AI and a worker who can't read can't sign up, can't understand requests, and can't negotiate. That's the barrier we remove."

README must include: setup, stack, **every AI service** (ElevenLabs STT/TTS, Vapi, Tesseract, optional LLM), **AI coding assistant disclosure (Claude Code)**, what is seeded/mocked (§14), known limitations, credits (Leaflet/OSM, lucide, fonts).
