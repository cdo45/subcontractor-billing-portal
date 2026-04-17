# Vance Corp Sub Billing Portal

Next.js 14 (App Router) + TypeScript + Tailwind, Prisma on **Neon Postgres**,
and **Clerk** for authentication.

## Setup

```bash
# 1. Install
npm install --legacy-peer-deps

# 2. Configure env — copy and fill in real values
cp .env.example .env.local
# Required:
#   DATABASE_URL                         Neon Postgres connection string
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY    from Clerk dashboard
#   CLERK_SECRET_KEY                     from Clerk dashboard

# 3. Initialize DB
npx prisma migrate deploy            # apply init migration to Neon
npx prisma db seed                   # seed Prisma users + projects
npx tsx scripts/seed-clerk-users.ts  # create Clerk users + link to Prisma

# 4. Run
npm run dev
# open http://localhost:3000/login
```

## Test users

Seeded by `prisma/seed.ts` + `scripts/seed-clerk-users.ts`.
The Clerk seed uses a shared password: `Test1234!Vance`

| Role         | Email             |
| ------------ | ----------------- |
| Admin        | admin@vance.com   |
| PM           | pm1@vance.com     |
| PM           | pm2@vance.com     |
| Sub (Acme)   | sub1@acme.com     |
| Sub (Elite)  | sub2@paving.com   |
| Sub (Titan)  | sub3@grading.com  |

Roles are stored in Clerk `publicMetadata.role`. Each Clerk user's
`publicMetadata.prismaUserId` points back to the corresponding Prisma User row,
which is the ID used across the data model.

## Auth architecture

- `middleware.ts` — `clerkMiddleware` gates `/dashboard`, `/projects`,
  `/sub-portal`, and `/api/*`. Public paths: `/login`, `/sign-in`, `/sign-up`,
  `/after-login`.
- `lib/auth.ts` — `getSessionUser()` resolves the Clerk session → Prisma user,
  reading role from `publicMetadata.role`. `requireRole` / `apiResponse` are
  the same helpers used in every API route.
- `app/login/page.tsx` — hosts Clerk's `<SignIn />` component.
- `app/after-login/page.tsx` — server component that reads `publicMetadata.role`
  and redirects to `/sub-portal` or `/dashboard`.

## Tests

```bash
npm test
```

- `__tests__/billing-calculations.test.ts` — pure math (lump sum / unit price,
  cumulative, balance, CO impact, formatting). Always run.
- `__tests__/api.test.ts` — live API integration suite. Auto-skips unless
  `CLERK_TEST_JWT` is set to a valid Clerk session token and the dev server
  is running on `TEST_BASE_URL` (default `http://localhost:3000`).

## Data model (`prisma/schema.prisma`)

```
User(admin | pm | subcontractor) — clerkId links to Clerk
  ↓
Project --< Contract --< LineItem (lump_sum or unit_price)
   ↓           ↓
   ↓           └-- BillingPeriod --< BillingLineItem
   └-- ChangeOrder
          ↓
       Approval
```

## API quick reference

All `/api/*` routes require a signed-in Clerk session (cookies sent
automatically by the browser). For curl testing, use a `__session` cookie from
a real browser session, or set up a Clerk JWT template and use
`Authorization: Bearer <token>`.

## Routes (UI)

- `/login` — Clerk `<SignIn />`
- `/after-login` — role-based post-login redirect
- `/dashboard` — PM/Admin dashboard
- `/projects` — PM/Admin project list
- `/projects/[id]` — Overview / Billing / Change Orders / Contracts tabs
- `/sub-portal` — sub's contracts + billing status
- `/sub-portal/billing/[id]` — sub billing entry

## Status flow

**Billing period:** `draft → submitted → approved` or `rejected` (→ `draft`)
**Change order:** `pending → pm_approved → customer_approved`, or `rejected`

## Environment variables

See `.env.example` for the full list.

## Known limitations

- No file upload for CO attachments yet (description / notes only).
- Role is re-read from Clerk on every request; for scale, configure a Clerk
  JWT template to include `publicMetadata.role` so middleware can gate by role
  without a Clerk API call.
