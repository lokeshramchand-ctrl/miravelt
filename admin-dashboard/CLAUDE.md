# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scoped to `admin-dashboard/`. See the repo root `CLAUDE.md` and `ARCHITECTURE.md` for the backend
this app talks to and the two-key auth model. This app is a **BFF (backend-for-frontend)**, not a
second backend: it holds no business logic and no direct datastore access - every page/action
calls the FastAPI backend over HTTP, server-side.

## Commands

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint      # eslint
```

Setup: backend must be running with `ADMIN_API_KEY` set; `cp .env.example .env.local` and fill in
`BACKEND_URL`/`VELAR_API_KEY`/`VELAR_ADMIN_KEY` to match the backend's own `.env`, plus a fresh
`SESSION_SECRET` (`openssl rand -hex 32`). Bootstrap the first admin from the **backend** directory
with `python scripts/create_admin.py you@example.com` - further admins are promoted from the
dashboard's own Users page (`PATCH /admin/users/{id}/role`); there's deliberately no self-serve
"become an admin" endpoint.

No automated test suite exists in this app yet.

## Architecture

- The browser only ever holds an **httpOnly, encrypted session cookie** (`iron-session`). It never
  sees `VELAR_API_KEY`, `VELAR_ADMIN_KEY`, or either JWT directly - client components must never
  fetch the backend directly or hold a credential.
- `src/lib/backend.ts` (`"server-only"`) is the single place that calls velar-backend; its
  `adminBackendFetch`/`adminBackendJson` attach `X-Velar-API-Key` / `X-Velar-Admin-Key` /
  `Authorization: Bearer <token>` server-side. New backend calls go through here, not a new fetch
  call scattered in a page/action.
- `src/lib/session.ts` / `src/lib/session-shared.ts` (`"server-only"`) hold the iron-session
  cookie shape and read/write helpers.
- `src/lib/dal.ts`'s `requireAdminSession()` is the actual per-request auth check every
  Server Component/Action calls before touching the backend.
- `src/proxy.ts` is Next 16's renamed `middleware.ts` - it proactively refreshes the access token
  before it expires so pages don't have to think about token lifetime.
- `src/app/login/actions.ts` confirms admin access by calling a real admin-scope-gated backend
  route (`GET /admin/overview`), not by trusting the JWT's own claims, and revokes the token pair
  immediately if the caller isn't an admin.

**Pattern for a new page/action:** a Server Component for reads (via `dal.ts`), a Server Action for
writes (via `backend.ts`). Never fetch the backend from a client component (`"use client"` files
under `src/app/**` and `src/components/`).

## Pages

| Route | What it does |
|---|---|
| `/dashboard` | KPIs: user/job/statement counts, latest release per platform |
| `/dashboard/users` | List, search, enable/disable, promote/demote, soft-delete users |
| `/dashboard/users/[id]` | One user's profile and tracked devices |
| `/dashboard/jobs` | Cross-user statement-processing job list, filterable by status |
| `/dashboard/statements` | Cross-user uploaded-statement list, filterable by status |
| `/dashboard/releases` | Every published Android build, plus a form to publish a new one |
