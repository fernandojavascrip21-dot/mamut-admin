# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A new **Angular 22** admin app (`mamut-admin`) for a supplement-inventory business (Mammut Supplements), paired with a **Next.js API-only backend** in `backend/`. The backend is not new: it was copied from a sibling project (`mammutSuplements/mammut-Suplements`, a Vue catalog app for the same business/Supabase project) and is being **reused and extended** here rather than rebuilt. Because of that:

- `backend/README.md` still describes the *old* Vue frontend in places (e.g. "conecta el frontend Vue con Supabase", `ALLOWED_ORIGINS` defaulting to a Vite dev port) — treat it as accurate for the backend's own code, but outdated about who consumes it.
- The data model in `backend/src/db/schema.ts` (`clients`, `consignment_items`, `debtors`, `direct_sales`, `cuts`, `shrinkage`, …) reflects the old project's domain (wholesale clients in consignment). The current project's business vocabulary (administrador/vendedor, bodega, dejar/retirar) does **not** map 1:1 onto it yet — see `specs/M0-base/spec.md` §8 for the open question on whether `vendedor` reuses the `client` concept or is genuinely separate.
- `profiles.role` currently only allows `'admin' | 'client'`. Work that introduces a `'vendedor'` role must extend this check constraint and the `AuthContext['role']` type, not replace it.
- Schema changes for *this* repo live as timestamped SQL files in `supabase/migrations/` at the repo root (the folder the backend's `drizzle.config.ts` comment points at).

Project docs (requirements, mockups, user stories) are **not** local files in this repo — they live in Jira/Confluence on `fernandojavascrip21.atlassian.net` (Jira project `MammutSuplements`, key `SCRUM`; Confluence space `SCRUM`). The `/spec` skill fetches them directly when asked to spec a milestone. Local design references (HTML/Vue catalog exports, page references, the inventory Excel) live in `references/`.

`AGENTS.md` mirrors this file for non-Claude agents — keep both in sync when changing project rules.

## Commands

### Frontend (repo root — Angular 22, SSR, Tailwind v4 via `@tailwindcss/postcss`)

```bash
npm start              # ng serve — http://localhost:4200
npm run dev            # frontend + backend at once (concurrently): :4200 and :3000
npm run dev:all        # db:start (Docker Supabase; no-op if already up) and then dev
npm run build           # ng build (production by default)
npm run watch           # ng build --watch --configuration development
npm test                # ng test — unit tests via @angular/build:unit-test (vitest runner, jsdom)
npm run check:architecture # layer boundaries of src/app (core/shared/features), see «Architecture»
```

Running a single test or filtering by name (the test runner is Vitest-based, not Karma/Jasmine):

```bash
ng test --include src/app/core/auth/services/auth.service.spec.ts
ng test --filter "AuthService"
```

There is no lint script configured in this project (no ESLint config at the root or in `backend/`); `check:architecture` and `backend/tests/architecture.test.ts` cover the import boundaries.

### Backend (`backend/` — independent Next.js project: its own `package.json`, `node_modules`, `.env`)

```bash
cd backend
npm run dev             # next dev — http://localhost:3000/api/health
npm run build / start   # production build / server
npm run type-check      # tsc --noEmit
npm test                # vitest run, against the real database in DATABASE_URL — see below
npm run db:check        # sanity query: select count(*) from categories
npm run db:pull         # regenerate src/db/schema.ts via drizzle-kit introspection (point .env at PRODUCCIÓN first)
```

Running a single backend test file: `npx vitest run tests/admins.test.ts` (from `backend/`).

Backend tests hit whichever real database `backend/.env` points to — the local Docker one by default, production if that block is active (see "Local environment" below); never a mock. Tests that touch accounts need `SUPABASE_SERVICE_ROLE_KEY` set in `backend/.env`; without it those tests are silently skipped, so a green `npm test` doesn't by itself prove auth/account logic passed. Everything these tests create is prefixed `test-auth-` / `test-tx-` and cleaned up before and after each suite (`backend/tests/helpers/users.ts`); an interrupted run is cleaned up by the next one.

After every `npm run db:pull`, two manual fixups are needed in `src/db/schema.ts` before committing (and delete the Drizzle migration files it generates — `src/db/0000_*.sql`, `src/db/meta/` — they aren't used):

1. Empty string defaults come out as `.default(')`; fix to `.default('')`.
2. `drizzle-kit pull` only introspects `public`, so it drops the `auth.users` reference needed for `profiles`' FK — re-add at the top of the file: `const authSchema = pgSchema("auth")`, `export const usersInAuth = authSchema.table("users", { id: uuid().primaryKey() })`, `const users = usersInAuth`.

### Local environment (Docker — Supabase local)

The backend needs Postgres **and** Supabase Auth and Storage, so the local environment is the official Supabase stack run by the Supabase CLI (a root devDependency) in Docker, not a bare Postgres. Angular and Next keep running on the host with `npm run dev`.

```bash
npm run db:start        # (repo root) start Postgres + Auth + Storage + Studio; needs Docker Desktop running
npm run db:reset        # wipe the local DB and re-apply supabase/migrations + supabase/seed.sql
npm run db:status       # local URLs and keys
npm run db:stop         # stop the containers (data is kept until db:reset)
```

- **Switching between production and Docker:** `backend/.env` holds two connection blocks, `PRODUCCIÓN` and `LOCAL`; keep one active and comment out the other. Next, Vitest, `db:check` and drizzle all read that same file, so the switch applies everywhere (restart `npm run dev` after switching). `backend/.env.example` has the same layout. The LOCAL block uses the Supabase CLI demo keys, identical on every machine.
- Studio: http://127.0.0.1:54323 · Mailpit (auth emails): http://127.0.0.1:54324 · DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- **Seed** (`supabase/seed.sql`, all fake data): `admin@mammut.local` / `Admin-123456!`; `vendedor1@mammut.local`, `vendedor2@mammut.local` / `Vendedor-123456!`; `inactivo@mammut.local` (deactivated, login must fail); every `vendedor` has a 10-digit phone (`5510000001`…`03`), which the database requires (spec `M2-t10`); 5 categories, demo products (one archived, two fractionable with their portion products) and an `initial` movement backing each stock.
- **Baseline migration:** `supabase/migrations/20261024000000_baseline_schema.sql` is a schema-only `supabase db dump` of production with the objects later migrations add stripped out, plus the `ensure_rls` event trigger (`supabase db dump` omits event triggers). It exists only so an empty DB can replay every migration — never apply it to production. A local dump after `db:reset` matched production with no differences when this was set up.
- **New migrations:** write the `.sql` in `supabase/migrations/`, check it with `npm run db:reset` locally, and only then apply it to production.

## Architecture

### Frontend

Standalone-component Angular app with SSR (`provideClientHydration`, `src/server.ts`, `outputMode: "server"` in `angular.json`). `specs/M0-base/spec.md` is the design for the first real slice (login, role-based navigation, session persistence) and is the reference for the business rules behind `core/auth/`, `core/layout/` and `features/auth/`.

### Frontend conventions

**Architecture — component-based, grouped by feature.** The app is a tree of components in three layers, with dependencies in one direction only: `features → core / shared`, `core → shared`, `shared → nothing internal`. A feature never imports another feature. `npm run check:architecture` (`scripts/check-architecture.mjs`; the project has no lint) fails on any import that breaks these rules — run it with the build.

- `src/app/core/`: app-wide singletons, loaded once. Never imports `features/`, except `core/layout/routes/`, which mounts the features' route tables.
  - `core/auth/`: `services/auth.service.ts`, `services/auth.interceptor.ts`, `guards/role.guard.ts`, `guards/guest.guard.ts`, `interfaces/auth.models.ts`, `constants/auth.constants.ts`.
  - `core/layout/`: the shells that host a `<router-outlet>` (`admin-shell/`, `seller-shell/`), `top-nav/` (with `top-nav.models.ts`), `constants/` (the `admin-shell`/`seller-shell` menus) and `routes/` (`admin.routes.ts`, `seller.routes.ts`: the child route tables of `/admin` and `/vendedor`). They stay separate from `app.routes.ts` on purpose: `app.routes.ts` loads them with `loadChildren` only after `roleGuard` (`canMatch`) accepts the role, so a seller never downloads the admin branch. `admin.routes.ts` only mounts each feature's routes on its URL (`productos` → `PRODUCT_ROUTES`, `vendedores` → `SELLER_ADMIN_ROUTES`) plus the «coming soon» items.
  - `core/toast/`: `toast.service.ts`, `components/toast/` (rendered once in `app.html`), `constants/toast.constants.ts`.
  - `core/api-base-url.ts`.
- `src/app/shared/`: reusable, stateless code not tied to any feature: `utils/` (`initials.ts`, `normalize-text.ts`, `phone.ts`, `money.ts` (dinero sin flotantes, see «Dinero e inventario»), `http-errors.ts` (`isOffline`, `httpStatus`, `isNotFound`, `httpErrorMessage`, the only place that reads `HttpErrorResponse`; components never compare `status`)), `validators/validators.ts` (`notBlank`), `pipes/phone.pipe.ts` (`phone`: the **only** way to display a stored phone anywhere in the UI, always «55 2468 1357»; display only, since the API and the database keep the 10 digits and inputs never reformat what the user types), `constants/`, `components/confirm-dialog/` (the single confirmation dialog: focus on open, trapped `Tab`, `Escape` cancels, focus returns) and `pages/coming-soon-page/` (the generic placeholder page used by the route tables).
- `src/app/features/<feature>/`: everything about one functional area (`auth` = the login screen, `account`, `products`, `sellers`). Each feature has:
  - `pages/<name>-page/`: container components tied to a route. They inject services, and they hold the page's state and save flow. **A page folder only holds its component** (`.component.ts`, `.component.html`, `.component.spec.ts`) and, if needed, its `ui/` subfolder (user preference). Its types go in the feature's `models/<page>.models.ts` and its constants in the feature's `constants/<page>.constants.ts` (e.g. `features/sellers/models/create-seller-page.models.ts`, `features/sellers/constants/create-seller-page.constants.ts`).
  - `components/`: presentational components. They only take `input()` and emit `output()`, never inject data services or `Router` (e.g. `features/products/components/product-form`, used by `create-product-page` and `edit-product-page`; `product-card`, `product-card-skeleton`).
  - `<feature>.routes.ts` when the feature has routes (`features/products/products.routes.ts`: `PRODUCT_ROUTES`, with `unsavedChangesGuard` on the edit route). Pages are lazy-loaded with `loadComponent` from there.
  - When needed: `services/` (data services, plus services that orchestrate a screen's save flow and translate HTTP errors into a typed result, e.g. `features/products/services/product-save.service.ts`, provided per page in `providers` so its state dies with the screen), `guards/`, `interfaces/` (backend models shared across the feature), `validators/` (Reactive Forms validators for its forms), `rules/` (pure business-rule functions, testable without Angular, e.g. `features/products/rules/product.rules.ts`: `hasProductChanges`, `filterProductsByName`), `constants/`, `models/`.
- Inside a page or component that grows subcomponents purely for visual composition, put those under its own `ui/` subfolder. If another page needs them, move them to the feature's `components/`.
- **Types and interfaces live apart from classes:** a class file (component, page, service, guard, interceptor) never declares a `type` or `interface`. Types shared across a feature go in `<feature>/interfaces/*.models.ts` (e.g. `features/products/interfaces/product.models.ts`, `features/products/interfaces/unsaved-changes.models.ts`). Types used by a single page go in the feature's `models/<page>.models.ts` (e.g. `features/auth/models/login-page.models.ts`). Types used by a single non-page component go in a `<name>.models.ts` file next to it (e.g. `core/layout/top-nav/top-nav.models.ts`, `features/products/components/product-form/product-form.models.ts`). `type` and `interface` may coexist in the same models file. Import them with `import type`. **Constants live apart too** (user preference): a class file never declares module-level constants such as a messages map, a field→message lookup or a minimum length. This applies to **all** code, frontend and backend. Frontend: constants used by a single page go in the feature's `constants/<page>.constants.ts` (e.g. `features/sellers/constants/create-seller-page.constants.ts`). Constants of a single non-page component go in a `<name>.constants.ts` file next to it (e.g. `features/products/components/product-form/product-form.constants.ts`). Constants of a feature's or a core area's services, guards or rules go in its `constants/` folder (e.g. `core/auth/constants/auth.constants.ts`, `features/products/constants/products.constants.ts`, `shared/constants/money.constants.ts`). Backend: one `constants.ts` per module (`backend/src/accounts/constants.ts`, `backend/src/lib/constants.ts`, …). Not constants in this sense: functions stored in a `const` (guards, interceptors, error helpers), runtime instances (`db`, `sql`, the Express `app`), config objects a framework requires (`proxy.ts` `config`, `nextConfig`), route arrays (`*.routes.ts`), `core/api-base-url.ts` (already a constants-only file), and values local to a test file.
- No global `src/app/components/`, `src/app/services/` or `src/app/pages/` catch-alls: everything lives in `core/`, `shared/` or a feature.
- Create a new feature's whole folder (`features/<name>/` and its `pages/`/`components/`/`services/`/`interfaces/` subfolders) before adding files into it, not file by file.
- **Imports between areas use the `tsconfig.json` path aliases** `@core/*`, `@shared/*`, `@features/*` (e.g. `import { ToastService } from '@core/toast/toast.service'`, lazy routes `import('@features/products/products.routes')`). Imports inside the same area (one feature, one `core/<area>`, or `shared`) stay relative (`./`, `../interfaces/…`). A new feature needs no new alias.

**Comments:** every non-trivial function (auth flows, guards, interceptors, anything with a non-obvious rule) gets a short comment explaining what it does and why — not a restatement of the code, something a reader can't get from the signature alone.

**Styling:** all styles are Tailwind utility classes in the template — no per-component `.css` files (the component schematic in `angular.json` already uses `style: "none"`). Brand colors and fonts are defined once as Tailwind v4 theme tokens in `src/styles.css` (`@theme`: `--color-*`, `--font-*`), used as plain utilities (`bg-page`, `text-ink`, `border-danger`, `font-display`, …) instead of repeating hex values or font stacks per component. One-off sizes that don't need a token (e.g. a specific `h-[50px]`) stay as Tailwind arbitrary values. A non-visual class used only as a test hook (e.g. `field-error` to query it in a spec) is fine alongside the utility classes — it carries no styling of its own. New UI combines the Jira/Confluence mockups with the local `references/`, translated into the app's tokens — never copy mockup colors or Vue code verbatim.

**Components:**

- Always create components with `ng generate component`, never by hand-writing the files.
- Selectors use the `app-` prefix (configured as `prefix` in `angular.json`).
- Name components in kebab-case describing function and context: `grid-client`, `inventory-list`, `cash-register-summary`.
- Don't include the word "component" in the component name — the `.component` file suffix already says that.
- Files end up as `name.component.ts`, `name.component.html` and `name.component.spec.ts` — no `.css` (see Styling). `angular.json` sets the component schematic to `type: "component"` (Angular 22 otherwise drops the `.component` suffix) and `style: "none"`, so plain `ng generate component <path>` already produces this.

### Backend (`backend/`)

Next.js App Router, **API routes only** (`app/api/**`, no pages), organized as a **modular monolith**: one deployable app and one database, split into business modules with explicit public APIs. It is deliberately **not** microservices. Stock is kept by Postgres triggers and constraints in the one Supabase database, the business operations (delivery, sales, cuts) cross modules inside a single `withTransaction`, and auth is re-read from `profiles` on every request. Splitting into services would mean sagas, duplicated auth and a shared database. Thin-route pattern: every route handler in `app/api/**/route.ts` just validates the request and calls into a use case under `src/`; no business logic in the routes themselves.

```
proxy.ts         CORS for /api/** (Next 16 renamed "middleware" to "proxy")
app/api/         thin routes
src/db/          (infra) Drizzle connection (client.ts), introspected schema.ts, withTransaction + lockRows (select … for update)
src/lib/         (infra) errors.ts (AppError + {error:{code,message}} format), cors.ts, supabase.ts, handler.ts (readJson/requireString/requireMoney/parseId/parseUuid helpers), money.ts (money in integer minor units)
src/auth/        module: context.ts (getAuthContext: validates Supabase JWT, loads profiles fresh per request),
                 guards.ts (requireAuth, requireRole, requireOwnClient), session.ts (login/refresh/logout)
src/accounts/    module: clients.ts, logins.ts, admins.ts, sellers.ts — all built on the internal accounts.ts (createAccount/toView)
src/products/    module: products.ts, photos.ts
src/categories/  module: categories.ts
src/stock/       module: movements.ts (insertMovements: the only way inventory changes)
tests/           Vitest, against the real DB (see Commands above); architecture.test.ts checks the module boundaries without touching it
```

**Module boundaries** (enforced by `tests/architecture.test.ts`):

- Each business module (`src/<module>/`) exposes its public API in `src/<module>/index.ts`. Anything not exported there is internal (e.g. `accounts/accounts.ts`).
- **Imports between areas use the `backend/tsconfig.json` path aliases**, like the frontend: `@db/*`, `@lib/*` (infrastructure), `@auth`, `@accounts`, `@products`, `@categories`, `@stock` (business modules) and `@api/*` (routes, used by the tests). A module alias points only at its `index.ts` (`import { requireRole } from '@auth'`, `products` → `import { insertMovements } from '@stock'`), so a module's internal files can't be imported from outside it. Imports inside the same area (one `src/<module>`, `app/`, `tests/`) stay relative; root files like `proxy.ts` have no alias. Infrastructure never depends on a business module, and `src/` never imports `app/`. Next and Vitest (`resolve.tsconfigPaths` in `vitest.config.mts`) both read the aliases from `tsconfig.json`; a new module adds its `@<module>` line there.
- A new area (sales, deliveries, cuts…) is a new `src/<module>/` with its `index.ts` and `constants.ts`. A use case that writes to several modules in one transaction lives in the module that owns the operation, opens the `withTransaction` there and calls the other modules' public functions with that `tx` (as `createProduct` does with `insertMovements`).

Key patterns to follow when adding backend code:

- **Auth is re-checked on every request, never trusted from JWT claims.** `getAuthContext` loads `profiles` fresh each time specifically so that deactivating an account takes effect immediately.
- **Account creation is two uncoordinated steps** (Supabase Auth, then `profiles`) with manual compensation: if the `profiles` insert fails, the just-created Auth user is deleted (`createAccount` in `src/accounts/accounts.ts`). Follow this pattern for any new account-creating use case.
- **Transactional use cases go through `withTransaction`/`lockRows`** (`src/db/transaction.ts`) rather than raw queries, especially anything needing `select … for update`.
- **Inventory only changes by inserting `stock_movements`, via `insertMovements`** (`src/stock/movements.ts`). Never write `products.stock` or `vendor_stock.qty`: they are a cache kept by Postgres triggers (migration `20261027000000_stock_from_movements.sql`), and the database rejects direct writes — from the backend, Supabase Studio or any other client (including the sibling Vue site if it ever connects). Products are inserted with `stock = 0`; their first movement raises it. `insertMovements` turns a balance that would go negative (`products_stock_check` / `vendor_stock_qty_check`) into `409` «No hay piezas suficientes». Movements are never updated (correct with `*_void` or `adjustment`); deleting one (test cleanup only) reverts its effect, so delete newest first.
- **Movement sign convention** (check `stock_movements_qty_sign_check`, spec `M1-t07` §3): one row per holder (`holder_profile_id` null = warehouse), signed `qty` — in `> 0`, out `< 0`. A transfer is two rows in the same transaction (deliver 10 to a seller = `delivery` warehouse `−10` + `delivery` seller `+10`). `initial`/`purchase`: warehouse only, `> 0`; `delivery`: warehouse `< 0`, seller `> 0`; `return`: warehouse `> 0`, seller `< 0`; `direct_sale`/`shrinkage`/`fraction_out`: `< 0`; `direct_sale_void`/`shrinkage_void`/`fraction_in`: `> 0`; `adjustment`: `≠ 0`.
- **Rows with history are deactivated, never deleted** — `DELETE` endpoints rely on Postgres FK `restrict` to surface a 409 rather than hand-checking every referencing table.
- **Error responses are always `{ error: { code, message } }`** via `AppError`/`toResponse` in `src/lib/errors.ts`, with a fixed HTTP status per `code` (401/403/404/409/422/500). Login/refresh return the same generic message for "wrong password", "no such account", and "deactivated account" — don't leak which case it was.
- **CORS origins come from `ALLOWED_ORIGINS`** in `backend/.env` (comma-separated) — this still lists the old Vue dev port and needs the Angular dev origin added when the frontend starts calling it.
- `src/db/schema.ts` is a generated reflection of the database, not a source of truth — never hand-edit it beyond the two fixups above, and never add Drizzle-generated migrations. Schema changes go in `supabase/migrations/`.

### Specs workflow

This repo uses the `/spec` and `/spec-impl` skills. `specs/.spec-config.yml` controls whether `/spec-impl` creates its git branch automatically (`AutoCreateBranch: true`, the default). `specs/M0-base/spec.md` is the only milestone-wide spec; later specs (e.g. `specs/M0-hu03-rutas-por-rol/spec.md`) are scoped to a single Jira user story (`HU-NN`) instead.

**Spec index:** `specs/README.md` lists every spec with its type, Jira key, status, dependencies and one-line objective, plus the cross-spec relationships that "Depends on" doesn't capture (e.g. a later spec changing an earlier one's rule). Whenever a spec is created, changes status, or turns out to affect another spec, update that index in the same change.

**Jira sync — apply whenever a spec maps to a Jira user story:**

- **While implementing:** post progress as comments on that Jira issue (via the Atlassian MCP tools) describing which step of the spec's implementation plan is underway, and the current status (✅ done / ❌ pending / ⏳ deferred) of each of the story's own acceptance criteria — not just a single comment at the end. Follow the pattern already used on `SCRUM-17`'s comments.
- **On 100% completion:** once every item in the spec's "Acceptance criteria" / "Criterios de aceptación" checklist is checked and its own tests pass, transition the Jira story to done (`Finalizada`) — don't leave it sitting in `En curso` once the code and tests are actually in.

## Buenas prácticas de código

### Principios
- Aplicar SOLID: una responsabilidad por clase o componente, dependencias por inyección, interfaces pequeñas.
- La lógica de negocio va en servicios, no en componentes ni en plantillas.
- Los componentes solo presentan datos y emiten eventos.

### Angular
- Componentes standalone; no crear NgModules nuevos.
- Inyectar dependencias con `inject()`.
- Usar `input()`, `output()` y `computed()` en lugar de decoradores y propiedades calculadas en la plantilla.
- OnPush en todos los componentes: en Angular 22 ya es el valor por defecto, así que no se declara `changeDetection`; nunca usar `ChangeDetectionStrategy.Eager` ni `Default`.
- Plantillas con `@if`, `@for` (con `track`) y `@switch`.
- No anidar `subscribe`. Lo que se carga al entrar a una pantalla va con `rxResource` (su `status()`/`error()` da el estado cargando/error y «Reintentar» es `reload()`) o `toSignal()`. Las acciones del usuario (enviar un formulario, cerrar sesión, guardar) usan un solo `subscribe` con `takeUntilDestroyed()`; si una llamada depende de otra, se encadenan con `switchMap` dentro del mismo `pipe`.
- Lazy loading en todas las rutas de funcionalidades.

### Formularios

Todo formulario reactivo (nuevo o existente) sigue este patrón. Ejemplos: `features/products/components/product-form` (presentacional) y `features/auth/pages/login-page` (llama al servicio).

- **Orden del componente**, cada sección con un comentario breve: 1) dependencias con `inject()`; 2) formulario y estados; 3) getters y setters; 4) ciclo de vida e inicialización; 5) carga de datos; 6) métodos que agregan, quitan o modifican controles; 7) validación, preparación del payload y envío.
- **Construcción:** formularios tipados con `FormBuilder` (`.nonNullable` cuando tenga sentido), `FormGroup` para objetos anidados y `FormArray` para colecciones. La estructura y las validaciones van en un método dedicado, `createEmptyForm()`. En `ngOnInit()` se ven las dos etapas: primero `createEmptyForm()` y después la carga de datos (`loadInitialValue()`/`loadX()`). Los validadores van en `<feature>/validators/` o en `shared/validators.ts`, no escritos dentro del componente.
- **Getters y setters:** getters para los controles y grupos que se consultan seguido (sobre todo los `FormArray`). Un setter reemplaza una colección que viene del backend: limpia los controles anteriores y crea los nuevos con un método privado, el mismo que usa «agregar», para que tengan las mismas validaciones. Nada de HTTP en getters ni setters.
- **Carga:** `patchValue()` para los campos simples. Los elementos de un `FormArray` se crean antes de asignarles valor, porque `patchValue()` no los crea. Hay que contemplar colecciones vacías y opcionales según el contrato de la API. El modelo del backend (`interfaces/`), la estructura del formulario (tipo `FormGroup<…>`) y el payload quedan separados cuando sus nombres o formatos difieren.
- **Interacción:** métodos específicos para agregar y quitar. Se revisa el índice antes de quitar y se llama a `markAsDirty()` cuando el usuario cambia una colección.
- **Envío:** si el formulario es inválido, `markAllAsTouched()` y se detiene. El payload se arma en `prepareSavePayload()` (o `prepare<X>Payload()`) con los nombres que espera el backend, usando `getRawValue()` si hay controles deshabilitados. No se manda un segundo envío mientras el primero sigue en curso. Los estados de espera se cierran tanto en éxito como en error. Las suscripciones usan `takeUntilDestroyed()`.
- **Componente presentacional** (solo `input()`/`output()`): la «carga» se hace desde un `input()` en `ngOnInit()` y el «envío» emite un `output()` con el payload. La consulta al servicio, el guardado y sus estados de espera son de la página que lo usa.
- **Lo que ve el usuario:** los errores de campo se muestran al enviar, no al tocar el campo. Las reglas en vivo, como «precio menor que el costo», son la excepción explícita.
- No se inventan endpoints, campos ni reglas de negocio. Si falta información del backend, se señala qué hay que adaptar.

### Calidad
- TypeScript estricto. Prohibido `any`; usar `unknown` y validar.
- Nombres descriptivos en inglés para código, y en español solo en textos visibles para el usuario.
  - «Código» son identificadores, archivos, carpetas, selectores, refs de plantilla e `id`/`name` de HTML. Los comentarios y las descripciones de las pruebas (`describe`/`it`) siguen en español, igual que las URLs (`/admin/productos`, `/vendedor/mi-stock`) y los datos del contrato con la base y el backend (el rol `'vendedor'`).
  - Glosario (alineado con `stock_movements.type` y las columnas de `products`):

    | Negocio (español, visible) | Código (inglés) | Referencia en backend |
    | --- | --- | --- |
    | producto / productos | `product` / `products` | `products` |
    | categoría | `category` | `categories` |
    | vendedor | `seller` | rol `'vendedor'` (el valor no cambia) |
    | administrador | `admin` | rol `'admin'` |
    | bodega | `warehouse` | `holderProfileId = null` |
    | piezas | `units` (en `stock`, `qty`) | `products.stock`, `stock_movements.qty` |
    | costo de fábrica | `unitCost` | `products.unit_cost` |
    | precio de venta | `price` | `products.price` |
    | alta (de producto) | `create` | — |
    | edición | `edit` / `update` | — |
    | entrada a bodega | `purchase` | tipo `purchase` |
    | dejar a vendedor | `delivery` | tipo `delivery` |
    | retirar (del vendedor) | `return` | tipo `return` |
    | venta directa | `directSale` | tipo `direct_sale` |
    | merma | `shrinkage` | tipo `shrinkage` |
    | fraccionar / se fracciona | `fraction` / `fractionable` | tipos `fraction_out`/`fraction_in`, `products.fractionable` |
    | porción | `portionSize` | `products.portion_size` |
    | bolsita | `portionProduct` (producto con `parentProductId`) | `products.parent_product_id` |
    | corte | `cashCut` | `cuts` |
    | carrito | `cart` | — |
    | búsqueda | `search` / `searchQuery` | — |
    | foto | `photo` (el archivo) / `image` (la URL guardada) | `products.image`, bucket `product-photos` |
    | cambios sin guardar | `unsavedChanges` | — |

  - Los specs escritos antes de T-05 citan nombres viejos en español; su traducción está en la tabla «viejo → nuevo» de `specs/M1-t05-codigo-en-ingles/spec.md` §4.
- No dejar código comentado ni `console.log` en los cambios finales.
- Antes de terminar una tarea, ejecutar `ng build` y los tests afectados.

### Dinero e inventario
- Cantidades monetarias como enteros en centavos o con tipos decimales, nunca con `number` flotante para cálculos de caja.
- **Convención de dinero (spec `M1-t08`):**
  - **Escalas:** precio hasta 2 decimales (`numeric(10,2)`, máximo `99999999.99`) y costo hasta 4 (`numeric(10,4)`, máximo `999999.9999`). Decimales de más o un monto fuera de rango dan error en el campo y `422` en la API («El precio admite hasta 2 decimales», «El costo es demasiado grande»…): **nunca se redondea en silencio**.
  - **Texto en la API:** las respuestas mandan los montos como texto (`"450.50"`), igual que llegan de Postgres. Las peticiones mandan texto; el backend también acepta número JSON y lo normaliza con `requireMoney(body, field, { scale, label })` (`backend/src/lib/handler.ts`). Notación científica, comas o separadores de miles dan `422`. En el frontend, precio y costo son `string` en interfaces y formularios, y los inputs de dinero son `type="text" inputmode="decimal"`, no `type="number"`.
  - **Calcular en unidades enteras:** toda comparación o aritmética de dinero usa `money.ts` (`src/app/shared/utils/money.ts` y `backend/src/lib/money.ts`, mismo contrato y mismos casos de prueba): `toMinorUnits` (texto → centavos o diezmilésimas, sin pasar por flotante), `fromMinorUnits`, `compareMoney` (lleva ambos a escala 4) y `decimalPlaces`. `Number()` sobre un monto solo para pasarlo al pipe `currency` al mostrarlo.
  - **Para ventas, cortes y precios por vendedor (M2/M3):** cada venta guarda en su fila el precio y el costo del momento como `numeric`; los totales de una venta se calculan como `qty × unidades mínimas` con enteros en el backend; los de cortes y reportes con `sum()` en SQL sobre `numeric`, nunca sumando en JS valores leídos como `number`. Un costo de 4 decimales multiplicado por piezas se redondea a centavos **una sola vez, al final** (mitad hacia arriba), al guardar o mostrar un total en pesos; la primera historia de M3 confirma esta regla con el negocio.
- Toda operación que modifique inventario o caja debe registrar un movimiento; no sobrescribir saldos directamente. En inventario la base lo impone: solo se insertan `stock_movements` con `insertMovements` (ver «Backend»).

## Diseño de interfaces

- Antes de crear una pantalla nueva, usar ui-ux-pro-max para definir estilo, paleta y reglas de UX.
- Después, aplicar frontend-design para el acabado visual.
- No aplicar este flujo a cambios menores ni a lógica sin interfaz.
- Mantener los colores, tipografías y componentes ya definidos en el sistema de diseño del proyecto.
