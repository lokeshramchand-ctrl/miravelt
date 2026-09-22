# Miravelt Admin Dashboard

A Next.js admin dashboard for [miravelt-backend](../README.md): user management, job/statement
monitoring, and Android release publishing.

## Architecture

This is a **backend-for-frontend (BFF)**, not a plain SPA calling the API from the browser:

- The browser only ever holds an **httpOnly, encrypted session cookie** (`iron-session`). It
  never sees `MIRAVELT_API_KEY`, `MIRAVELT_ADMIN_KEY`, or either JWT directly.
- Every call to miravelt-backend goes through `src/lib/backend.ts`, on the server, which attaches
  `X-Miravelt-API-Key` / `X-Miravelt-Admin-Key` / `Authorization: Bearer <token>` itself.
- `src/proxy.ts` (Next 16's renamed `middleware.ts`) proactively refreshes the access token
  before it expires, so pages don't have to think about token lifetime. `src/lib/dal.ts`'s
  `requireAdminSession()` is the actual per-request auth check every page/action calls.
- Login (`src/app/login/actions.ts`) confirms admin access by calling a real admin-scope-gated
  backend route (`GET /admin/overview`) - not by trusting the JWT's own claims - and revokes the
  token pair immediately if the caller isn't an admin.

## Setup

1. Make sure miravelt-backend itself is running with `ADMIN_API_KEY` set (see `../.env.example`) -
   `/admin/*` 503s otherwise.
2. Bootstrap your first admin account: register normally through the mobile app or
   `POST /auth/register`, then from the **backend** directory run:
   ```
   python scripts/create_admin.py you@example.com
   ```
3. Copy this app's env file and fill in the values (`BACKEND_URL`, `MIRAVELT_API_KEY`,
   `MIRAVELT_ADMIN_KEY` must match the backend's own `.env`; generate a fresh `SESSION_SECRET` with
   `openssl rand -hex 32`):
   ```
   cp .env.example .env.local
   ```
4. Install and run:
   ```
   npm install
   npm run dev
   ```
5. Sign in at <http://localhost:3000> with the account you promoted in step 2.

## Promoting more admins

Once you have one admin, promote further admins from **Users** in the dashboard itself
(`PATCH /admin/users/{id}/role`) - `scripts/create_admin.py` is only needed to bootstrap the
very first one, since there's deliberately no self-serve "become an admin" endpoint.

## Pages

| Route                  | What it does                                                          |
| ----------------------- | ---------------------------------------------------------------------- |
| `/dashboard`            | KPIs: user/job/statement counts, latest release per platform           |
| `/dashboard/users`      | List, search, enable/disable, promote/demote, soft-delete users        |
| `/dashboard/users/[id]` | One user's profile and tracked devices                                 |
| `/dashboard/jobs`       | Cross-user statement-processing job list, filterable by status         |
| `/dashboard/statements` | Cross-user uploaded-statement list, filterable by status                |
| `/dashboard/releases`   | Every published Android build, plus a form to publish a new one        |
