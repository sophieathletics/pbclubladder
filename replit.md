# Pickleball Club Ladder

## Overview

Full-stack pickleball club ladder web app where doubles teams form, challenge each other, schedule matches, submit scores, and compete for rankings.

## Architecture

pnpm monorepo with:
- `artifacts/api-server` — Express 5 + Drizzle ORM backend
- `artifacts/pickleball-ladders` — React + Vite + Tailwind frontend
- `lib/db` — Shared Drizzle schema + DB client
- `lib/api-spec` — OpenAPI spec + Orval codegen
- `lib/api-client-react` — Generated React Query hooks

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24
- **TypeScript**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **State**: React Query (@tanstack/react-query)
- **Routing**: Wouter

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Features

- **Seasonal ladder standings** — ladder positions per active season
- **Team management** — create teams, send/accept/decline invitations
- **Challenge workflow** — pending → accepted → scheduling → scheduled → completed
- **Availability submission** — JSONB availability slots for scheduling
- **Score entry** — submit, confirm, and dispute match scores
- **Admin panel** — player management, dispute resolution, cron job triggers, stats
- **17 email notification types** via Resend (gracefully skipped without RESEND_API_KEY)
- **3 cron jobs** — inactivity drop, auto-confirm scores, challenge expiry

## Auth

- Custom HMAC-based JWT stored in `localStorage` under key `pickle_auth_token`
- `setAuthTokenGetter` registered in AuthProvider so the API client attaches the token
- Admin role set directly in DB: `UPDATE players SET role = 'admin' WHERE email = '...'`

## Seed Data

- Season: Spring 2026 (active)
- Players (all password: `password123`):
  - sarah@test.com — Sarah Johnson (The Dinks, #1)
  - mike@test.com — Mike Davis (Pickle Pros, #2)
  - lisa@test.com — Lisa Chen (Pickle Pros, #2)
  - emma@test.com — Emma Rodriguez (Power Smash, #3)
  - carlos@test.com — Carlos Santos (Power Smash, #3)
  - tom@test.com — Tom Wilson (solo)
  - sophie@sophieathletics.com — Sophie (admin role)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (provided by Replit)
- `SESSION_SECRET` — HMAC signing key for JWT tokens
- `RESEND_API_KEY` — (optional) Email sending via Resend
- `ADMIN_EMAIL` — (optional) Admin notification email
- `CRON_SECRET` — (optional) Secret header for cron job endpoints

## Frontend Routes

- `/` — Homepage with hero + top 10 leaderboard preview
- `/login` — Login page
- `/register` — Registration page
- `/leaderboard` — Full public ladder standings
- `/dashboard` — Authenticated dashboard with stats and active challenges
- `/team` — Team management, invitations, ladder position
- `/challenges` — Challenge opponents, view pending/active challenges
- `/challenges/:id` — Challenge detail with availability submission and scheduling
- `/availability` — Manage availability slots
- `/matches/:id` — Match detail with score submission/confirmation
- `/notifications` — Notification center
- `/profile` — Profile settings and password change
- `/admin` — Admin panel (admin role required)

## API Structure

All routes under `/api/`:
- `/api/auth/*` — register, login, logout, me, update-profile, change-password
- `/api/players/*` — list, get by id
- `/api/seasons/*` — list, get active, create, activate/deactivate
- `/api/teams/*` — list, my team, get by id, team matches
- `/api/invitations/*` — list, send, accept, decline
- `/api/ladder/*` — get full ladder, top 10, my position, update position, inactivity log
- `/api/challenges/*` — list, my active, get, create, accept, decline, cancel, book match
- `/api/availability/*` — get, submit
- `/api/matches/*` — list, get, submit/confirm/dispute score
- `/api/notifications/*` — list, mark read, mark all read
- `/api/admin/*` — stats, players, deactivate player, disputes, resolve dispute
- `/api/cron/*` — inactivity-drop, auto-confirm, expire-challenges (protected by x-cron-secret)
