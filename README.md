# Cheque Tracker

Production-ready web app for cheque, deposit, and withdrawal tracking with dual calendar display (AD/BS), built with React + TypeScript + Vite + Tailwind + Supabase.

## Architecture

- Frontend: React + Vite + TypeScript + Tailwind
- Auth/Data: Supabase Auth + Postgres
- Security: Row Level Security (RLS) on all business tables
- Routing: `react-router-dom` with protected routes
- Deployment: Vercel static deployment (SPA rewrite)

### Core App Modules

- `Auth`: Login, register, password reset
- `Dashboard`: Balance stats + projected cash-flow calendar
- `Transactions`: List and add/edit/delete transactions
- `Settings`: Notifications, calendar preference, export, opening balance, account management

### Calendar Handling (AD/BS)

- All database dates are stored as AD (`date` in Postgres, `YYYY-MM-DD`).
- BS conversion is used only at UI input/display boundaries.
- Toggle is available in app header and persisted in local storage.

### Projection Rule Implemented

For each date `D`:

`projectedBalance[D] = currentBalance + sum(deposits<=D) - sum(cheques<=D) - sum(withdrawals<=D)`

- `currentBalance` uses only `cleared` transactions.
- Projection includes all statuses (`pending`, `deducted`, `cleared`) per spec.

### Midnight Status Transitions Implemented

At local midnight (based on user timezone):

- `pending -> deducted` for `cheque` + `withdrawal` due today
- `pending -> cleared` for `deposit` due today

Implemented via:

- Supabase RPC: `process_due_status_transitions(p_timezone text)`
- Frontend scheduler (`useStatusTransition`) + page refresh calls

## Database Schema + RLS

SQL migration: `supabase/migrations/001_init.sql`

Includes:

- Enums: `transaction_type`, `transaction_status`, `calendar_mode`
- Tables: `profiles`, `accounts`, `transactions`
- Constraints: cheque number required only for cheque type
- Unique guard: duplicate cheque numbers prevented per account
- Trigger: auto-create profile + default account on signup
- Trigger: keep `updated_at` fresh
- RLS policies: users can only select/insert/update/delete their own rows

## File Tree

```text
.
├── .env.example
├── .gitignore
├── README.md
├── index.html
├── package.json
├── postcss.config.cjs
├── tailwind.config.cjs
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
├── vite.config.ts
├── supabase/
│   └── migrations/
│       └── 001_init.sql
└── src/
    ├── App.tsx
    ├── index.css
    ├── main.tsx
    ├── vite-env.d.ts
    ├── components/
    │   ├── common/
    │   │   ├── DateField.tsx
    │   │   └── StatusBadge.tsx
    │   ├── dashboard/
    │   │   ├── CalendarView.tsx
    │   │   └── StatsCards.tsx
    │   ├── layout/
    │   │   ├── AppShell.tsx
    │   │   └── ProtectedRoute.tsx
    │   ├── settings/
    │   │   └── AccountManager.tsx
    │   └── transactions/
    │       ├── TransactionForm.tsx
    │       └── TransactionTable.tsx
    ├── context/
    │   ├── AuthContext.tsx
    │   └── CalendarContext.tsx
    ├── hooks/
    │   └── useStatusTransition.ts
    ├── lib/
    │   └── supabase.ts
    ├── pages/
    │   ├── AuthPage.tsx
    │   ├── DashboardPage.tsx
    │   ├── SettingsPage.tsx
    │   └── TransactionsPage.tsx
    ├── services/
    │   └── transactions.ts
    ├── types/
    │   ├── db.ts
    │   └── domain.ts
    └── utils/
        ├── balance.ts
        ├── csv.ts
        ├── date.ts
        └── nepaliDate.ts
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Fill values in `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

4. Apply DB migration in Supabase SQL Editor (or Supabase CLI):

- Run `supabase/migrations/001_init.sql`

5. Start dev server:

```bash
npm run dev
```

## NPM Scripts

- `npm run dev` - Start local Vite server
- `npm run build` - TypeScript build + production bundle
- `npm run preview` - Preview production build
- `npm run typecheck` - Type-only compile check

## Vercel Deployment

1. Push this project to GitHub.
2. Import repo in Vercel.
3. Framework preset: `Vite`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy.

`vercel.json` already rewrites all routes to `/index.html` for client-side routing.

## Supabase Notes

- Ensure Email auth is enabled.
- Optionally disable email confirmation in dev for faster testing.
- Keep RLS enabled in production.
