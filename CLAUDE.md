# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A new **Angular 22** admin app (`mamut-admin`) for a supplement-inventory business (Mammut Supplements), paired with a **Next.js API-only backend** in `backend/`. The backend is not new: it was copied from a sibling project (`mammutSuplements/mammut-Suplements`, a Vue catalog app for the same business/Supabase project) and is being **reused and extended** here rather than rebuilt. Because of that:

- `backend/README.md` still describes the *old* Vue frontend in places (e.g. "conecta el frontend Vue con Supabase", `ALLOWED_ORIGINS` defaulting to a Vite dev port) — treat it as accurate for the backend's own code, but outdated about who consumes it.
- The data model in `backend/src/db/schema.ts` (`clients`, `consignment_items`, `debtors`, `direct_sales`, `cuts`, `shrinkage`, …) reflects the old project's domain (wholesale clients in consignment). The current project's business vocabulary (administrador/vendedor, bodega, dejar/retirar) does **not** map 1:1 onto it yet — see `specs/M0-base/spec.md` §8 for the open question on whether `vendedor` reuses the `client` concept or is genuinely separate.
- `profiles.role` currently only allows `'admin' | 'client'`. Work that introduces a `'vendedor'` role must extend this check constraint and the `AuthContext['role']` type, not replace it.
- Where the migrations for *this* repo's schema changes should live is itself an open question (see the spec above) — the backend's `drizzle.config.ts` comment points at a `supabase/migrations/` folder that currently only exists in the sibling Vue repo.

Project docs (requirements, mockups, user stories) are **not** local files in this repo — they live in Jira/Confluence on `fernandojavascrip21.atlassian.net` (Jira project `MammutSuplements`, key `SCRUM`; Confluence space `SCRUM`). The `/spec` skill fetches them directly when asked to spec a milestone.

## Commands

### Frontend (repo root — Angular 22, SSR, Tailwind v4 via `@tailwindcss/postcss`)

```bash
npm start              # ng serve — http://localhost:4200
npm run build           # ng build (production by default)
npm run watch           # ng build --watch --configuration development
npm test                # ng test — unit tests via @angular/build:unit-test (vitest runner, jsdom)
```

Running a single test or filtering by name (the test runner is Vitest-based, not Karma/Jasmine):

```bash
ng test --include src/app/auth/services/auth.service.spec.ts
ng test --filter "AuthService"
```

There is no lint script configured in this project (no ESLint config at the root or in `backend/`).

### Backend (`backend/` — independent Next.js project: its own `package.json`, `node_modules`, `.env`)

```bash
cd backend
npm run dev             # next dev — http://localhost:3000/api/health
npm run build / start   # production build / server
npm run type-check      # tsc --noEmit
npm test                # vitest run, against the REAL database (DATABASE_URL) — see below
npm run db:check        # sanity query: select count(*) from categories
npm run db:pull         # regenerate src/db/schema.ts via drizzle-kit introspection
```

Running a single backend test file: `npx vitest run tests/admins.test.ts` (from `backend/`).

Backend tests hit the live Supabase database, not a mock or a separate test DB. Tests that touch accounts need `SUPABASE_SERVICE_ROLE_KEY` set in `backend/.env`; without it those tests are silently skipped, so a green `npm test` doesn't by itself prove auth/account logic passed. Everything these tests create is prefixed `test-auth-` / `test-tx-` and cleaned up before and after each suite (`backend/tests/helpers/users.ts`); an interrupted run is cleaned up by the next one.

After every `npm run db:pull`, two manual fixups are needed in `src/db/schema.ts` before committing (and delete the Drizzle migration files it generates — `src/db/0000_*.sql`, `src/db/meta/` — they aren't used):

1. Empty string defaults come out as `.default(')`; fix to `.default('')`.
2. `drizzle-kit pull` only introspects `public`, so it drops the `auth.users` reference needed for `profiles`' FK — re-add at the top of the file: `const authSchema = pgSchema("auth")`, `export const usersInAuth = authSchema.table("users", { id: uuid().primaryKey() })`, `const users = usersInAuth`.

## Architecture

### Frontend

Standalone-component Angular app with SSR (`provideClientHydration`, `src/server.ts`, `outputMode: "server"` in `angular.json`). `specs/M0-base/spec.md` is the design for the first real slice (login, role-based navigation, session persistence) and is the reference for the business rules behind `auth/` and `pages/`.

### Frontend conventions

**Architecture — feature-based folders, not by file type:**

- `src/app/pages/`: components tied to a route, one subfolder per page (`pages/login-page/login-page.component.ts`). A page that itself hosts a `<router-outlet>` (e.g. `admin-page`, `vendedor-page`) still lives here — it's a page, not a separate "layout" concept.
- `src/app/<funcionalidad>/`: everything about one functional area, with its own `services/`, `guards/`, `interfaces/` (add `components/` inside it if that area ever needs its own non-page components). Example: `auth/` (`auth/services/auth.service.ts`, `auth/services/auth.interceptor.ts`, `auth/guards/role.guard.ts`, `auth/interfaces/auth.models.ts`).
- `src/app/shared/`: code reused across functional areas (e.g. `shared/api-base-url.ts`, `shared/initials.ts`) — not tied to one feature or one page.
- Inside a page or component that grows subcomponents purely for visual composition (e.g. a skeleton), put those under its own `ui/` subfolder.
- No global `src/app/components/` or `src/app/services/` catch-alls at the root — everything lives inside a page or a feature folder.
- Create a new feature's whole folder (and its `services/`/`guards/`/`interfaces/` subfolders) before adding files into it, not file-by-file.

**Comments:** every non-trivial function (auth flows, guards, interceptors, anything with a non-obvious rule) gets a short comment explaining what it does and why — not a restatement of the code, something a reader can't get from the signature alone.

**Styling:** all styles are Tailwind utility classes in the template — no per-component `.css` files (generate components with `--style=none`, or delete the generated stylesheet and drop `styleUrl`). Brand colors and fonts are defined once as Tailwind v4 theme tokens in `src/styles.css` (`@theme`: `--color-*`, `--font-*`), used as plain utilities (`bg-page`, `text-ink`, `border-danger`, `font-display`, …) instead of repeating hex values or font stacks per component. One-off sizes that don't need a token (e.g. a specific `h-[50px]`) stay as Tailwind arbitrary values. A non-visual class used only as a test hook (e.g. `field-error` to query it in a spec) is fine alongside the utility classes — it carries no styling of its own.

**Components:**

- Always create components with `ng generate component`, never by hand-writing the files.
- Selectors use the `app-` prefix (configured as `prefix` in `angular.json`).
- Name components in kebab-case describing function and context: `grid-client`, `inventory-list`, `cash-register-summary`.
- Don't include the word "component" in the component name — the `.component` file suffix already says that.
- Files end up as `nombre.component.ts`, `nombre.component.html` and `nombre.component.css`.

### Backend (`backend/`)

Next.js App Router, **API routes only** (`app/api/**`, no pages). Thin-route pattern: every route handler in `app/api/**/route.ts` just validates the request and calls into a use case under `src/`; no business logic in the routes themselves.

```
proxy.ts         CORS for /api/** (Next 16 renamed "middleware" to "proxy")
app/api/         thin routes
src/db/          Drizzle connection (client.ts), introspected schema.ts, withTransaction + lockRows (select … for update)
src/auth/        context.ts (getAuthContext: validates Supabase JWT, loads profiles fresh per request),
                 guards.ts (requireAuth, requireRole, requireOwnClient), session.ts (login/refresh/logout)
src/accounts/    use cases: clients.ts, logins.ts, admins.ts — all built on accounts.ts's createAccount/toView
src/lib/         errors.ts (AppError + {error:{code,message}} format), cors.ts, supabase.ts, handler.ts (readJson/requireString/parseId/parseUuid helpers)
tests/           Vitest, against the real DB (see Commands above)
```

Key patterns to follow when adding backend code:

- **Auth is re-checked on every request, never trusted from JWT claims.** `getAuthContext` loads `profiles` fresh each time specifically so that deactivating an account takes effect immediately.
- **Account creation is two uncoordinated steps** (Supabase Auth, then `profiles`) with manual compensation: if the `profiles` insert fails, the just-created Auth user is deleted (`createAccount` in `src/accounts/accounts.ts`). Follow this pattern for any new account-creating use case.
- **Transactional use cases go through `withTransaction`/`lockRows`** (`src/db/transaction.ts`) rather than raw queries, especially anything needing `select … for update`.
- **Rows with history are deactivated, never deleted** — `DELETE` endpoints rely on Postgres FK `restrict` to surface a 409 rather than hand-checking every referencing table.
- **Error responses are always `{ error: { code, message } }`** via `AppError`/`toResponse` in `src/lib/errors.ts`, with a fixed HTTP status per `code` (401/403/404/409/422/500). Login/refresh return the same generic message for "wrong password", "no such account", and "deactivated account" — don't leak which case it was.
- **CORS origins come from `ALLOWED_ORIGINS`** in `backend/.env` (comma-separated) — this still lists the old Vue dev port and needs the Angular dev origin added when the frontend starts calling it.
- `src/db/schema.ts` is a generated reflection of the database, not a source of truth — never hand-edit it beyond the two fixups above, and never add Drizzle-generated migrations.

### Specs workflow

This repo uses the `/spec` and `/spec-impl` skills. `specs/.spec-config.yml` controls whether `/spec-impl` creates its git branch automatically (`AutoCreateBranch: true`, the default). `specs/M0-base/spec.md` is the only milestone-wide spec; later specs (e.g. `specs/M0-hu03-rutas-por-rol/spec.md`) are scoped to a single Jira user story (`HU-NN`) instead.

**Jira sync — apply whenever a spec maps to a Jira user story:**

- **While implementing:** post progress as comments on that Jira issue (via the Atlassian MCP tools) describing which step of the spec's implementation plan is underway, and the current status (✅ done / ❌ pending / ⏳ deferred) of each of the story's own acceptance criteria — not just a single comment at the end. Follow the pattern already used on `SCRUM-17`'s comments.
- **On 100% completion:** once every item in the spec's "Acceptance criteria" / "Criterios de aceptación" checklist is checked and its own tests pass, transition the Jira story to done (`Finalizada`) — don't leave it sitting in `En curso` once the code and tests are actually in.
