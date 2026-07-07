# Your Finance Manager

A real, running full-stack double-entry accounting demo — **[live app](https://your-finance-manager-demo.onrender.com)**.

This is a deliberately simplified public rewrite of a larger private finance platform I use daily. It is not a mock: every figure on screen is computed from balanced journal entries stored in Postgres.

## Try it

No sign-up. On first visit you get an anonymous private workspace (an httpOnly session cookie) pre-loaded with realistic starter data — accounts, categories, and balanced sample entries. Everything you do is isolated to your session, and **Reset demo** restores the starter dataset at any time.

> ⏱ Hosted on a free tier: the first visit after idle can take ~30–60 s to cold-start.

## Features

- **Quick Add** — a floating action button with user-definable shortcuts (Expense, Income, Transfer, Card Payment). One tap posts a real balanced Dr/Cr journal entry.
- **Journal Entries** — list, create, and edit multi-line entries with a live balance check: the form won't submit until debits equal credits, and the server independently re-validates.
- **CSV Import** — upload a bank export, map columns (auto-suggested), and review rows in four tabs — Ready / Needs review / Duplicates / Errors — with fuzzy account matching (exact → substring → Levenshtein) and in-file duplicate detection. Each imported row is validated independently server-side.
- **Account Balances** — nature-aware running balances (Asset/Expense debit-normal, Liability/Revenue credit-normal) computed from posted lines, with net-worth and net-income roll-ups.
- **Settings** — full CRUD for the chart of accounts, categories, income sources, and Quick Add shortcuts.

## How the no-login model works

A random session id in an httpOnly `SameSite=Lax` cookie is the entire auth story. Every table carries `session_id`; every query filters by it. New session → auto-seeded starter data. There are no user accounts, no passwords, and no personal data.

## Tech

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite, TanStack Query |
| Backend | Node + Express + TypeScript, Zod validation |
| Database | Postgres (Neon) — money stored as integer cents |
| Hosting | Render (single service serves the SPA + API) |

Double-entry integrity is enforced in one place (`server/src/domain/balance.ts`): ≥ 2 lines, positive integer-cent amounts, and Σdebits === Σcredits exactly — no floating point, no rounding tolerance.

## Run locally

```bash
npm install
cp server/.env.example server/.env   # add your Postgres URL
npm run migrate
npm run dev                          # client :5173 (proxies /api) + server :3001
```

## Relation to the private app

The full private version adds multi-currency (CAD/USD/HKD) reconciliation, an ACB stock-portfolio engine, brokerage imports, recurring entries, and dashboards. This repo shares no code with it — it's a clean-room rewrite of the core bookkeeping ideas at a fraction of the scope.
