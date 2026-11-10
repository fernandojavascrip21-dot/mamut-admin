# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, Copilot, Claude Code, etc.) working in this repository. `CLAUDE.md` holds the same rules; keep both in sync. If they disagree, `CLAUDE.md` wins and this file should be updated. The rules govern the work; what each folder or service contains is in the code (`ls`, the specs in `specs/`).

## What this repo is

A new **Angular 22** admin app (`mamut-admin`) for a supplement-inventory business (Mammut Supplements), paired with a **Next.js API-only backend** in `backend/`. The backend was copied from a sibling project (`mammutSuplements/mammut-Suplements`, a Vue catalog app for the same business/Supabase project) and is **reused and extended**, not rebuilt:

- `backend/README.md` describes this backend and the Angular app that consumes it (rewritten in spec `M7-t31`); `ALLOWED_ORIGINS` in `backend/.env.example` lists only the Angular origin (`http://localhost:4200`).
- The schema (`clients`, `consignment_items`, `debtors`, …) reflects the old domain. Settled in `specs/M1-t03-tablas-productos-stock`: **a `vendedor` is not a `client`**; a seller is a `profiles` row with `role = 'vendedor'` and no `clients` row (`clients`/`consignment_items` stay reserved for a wholesale distributor the app doesn't use yet).
- `profiles.role` allows `'admin' | 'client' | 'vendedor'` (`profiles_role_check` and `AuthContext['role']`); a `vendedor` needs a 10-digit `profiles.phone` (spec `M2-t10`). A new role **extends** both, never replaces them.
- Schema changes for this repo are timestamped SQL files in `supabase/migrations/`.
- Requirements, mockups and user stories are **not local**: they live in Jira (`SCRUM`) and Confluence on `fernandojavascrip21.atlassian.net`; the `/spec` skill fetches them. Local design references (Vue/HTML exports, the inventory Excel) are in `references/`.

## Commands

### Frontend (repo root — Angular 22, SSR, Tailwind v4)

```bash
npm start / npm run dev / npm run dev:all   # :4200 / + backend :3000 / + db:start (Docker Supabase)
npm run build | watch                       # production build / dev watch
npm test                                    # ng test: Vitest runner, jsdom (not Karma/Jasmine)
ng test --include src/app/core/auth/services/auth.service.spec.ts   # one file
ng test --filter "AuthService"                                      # by name
npm run check:architecture                  # layer boundaries of src/app — run it with the build
npm run config:prepare                      # PrimeNG license + API URL files (the pre* hooks run it); ui:prepare / api:prepare run each alone
```

Direct `ng serve|build|test` need `npm run config:prepare` first on a fresh checkout; CI must define `PRIMENG_LICENSE_KEY` and `API_BASE_URL`. `API_BASE_URL` (spec `M7-t31`) is the backend origin read at build time from the env or the root `.env`: absolute URL, `http:` only for localhost/127.0.0.1, no path; if missing or invalid the build fails. `scripts/prepare-api-url.mjs` writes the git-ignored `core/api-base-url.generated.ts`, which only `core/api-base-url.ts` re-exports. There is no lint script.

### Backend (`cd backend` — own `package.json`, `node_modules`, `.env`)

```bash
npm run dev | build | start | type-check   # :3000/api/health
npm test                                   # vitest against the REAL database in DATABASE_URL (never a mock)
npx vitest run tests/admins.test.ts        # one file
npm run db:check | db:pull                 # sanity query / regenerate src/db/schema.ts (point .env at PRODUCCIÓN first)
```

- Tests that touch accounts need `SUPABASE_SERVICE_ROLE_KEY`; without it they are **silently skipped**, so a green run doesn't prove auth passed. They create `test-auth-` / `test-tx-` data and clean it up.
- After `db:pull`, fix `src/db/schema.ts` by hand: `.default(')` → `.default('')`; re-add at the top `const authSchema = pgSchema("auth")`, `export const usersInAuth = authSchema.table("users", { id: uuid().primaryKey() })`, `const users = usersInAuth`; delete the generated `src/db/0000_*.sql` and `src/db/meta/`.

### Local environment (Docker — Supabase local)

`npm run db:start | db:reset | db:status | db:stop` (repo root, needs Docker Desktop). `db:reset` re-applies `supabase/migrations` + `supabase/seed.sql`.

- `backend/.env` has **PRODUCCIÓN** and **LOCAL** connection blocks; keep one active. Next, Vitest, `db:check` and drizzle all read it; restart `npm run dev` after switching.
- Studio http://127.0.0.1:54323 · Mailpit :54324 · DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- **`usuarios-prueba.md`** (repo root) lists test accounts. It is **local only** (`.gitignore`: real passwords, public repo) — never commit it or copy its contents into a tracked file; update it when accounts change.
- `next dev` may exit right after start-up with a security-upgrade notice (exit 1): run `npm run dev` again. Upgrading Next is a separate, deliberate change.
- Seed (fake): `admin@mammut.local` / `Admin-123456!`; `vendedor1@`, `vendedor2@mammut.local` / `Vendedor-123456!`; `inactivo@mammut.local` (deactivated, login must fail); sellers have 10-digit phones.
- `supabase/migrations/20261024000000_baseline_schema.sql` only lets an empty DB replay every migration — never apply it to production. New migration: write the `.sql`, check it with `npm run db:reset`, then apply to production.
- **Applying a migration to production is done by hand in the Supabase SQL Editor**, never with `supabase db push`. First run a read-only check (the column or table doesn't exist yet, the migrations it depends on are already there), then paste the migration inside `begin; … commit;`, then run the spec's verification queries. Production is the same Supabase project as the sibling repo, and its migration history holds that repo's versions (`20261007120001`…`010`), so `db push` stops with `DbPushMissingLocalError`. **Never run the `supabase migration repair` or `supabase db pull` it suggests**: they would rewrite the sibling repo's history in the shared database and overwrite `supabase/migrations/`.

## Architecture

### Frontend

Standalone-component Angular app with SSR (`src/server.ts`, `outputMode: "server"`). Three layers, dependencies one way only: **`features → core / shared`, `core → shared`, `shared → nothing internal`**; a feature never imports another feature. `npm run check:architecture` fails on any break.

- `src/app/core/`: app-wide singletons (auth, layout shells and menus, toast, confirm, cart, viewing, sale-catalog, stock-changes, low-stock-notice, ui theme). Never imports `features/`, except `core/layout/routes/`, which mounts the feature route tables with `loadChildren` after `roleGuard`, so a seller never downloads the admin branch. Rules worth knowing: notices go through `ToastService`; confirmations only through `ConfirmService.ask()`; services that must see a sign-out from any screen (`ViewingService`, `CartService`, `LowStockNoticeService`) are created at start with `provideEnvironmentInitializer` in `app.config.ts`.
- `src/app/shared/`: reusable stateless code (`utils/`, `validators/`, `pipes/`, `components/`, `constants/`). `http-errors.ts` is the only place that reads `HttpErrorResponse`; the `phone` pipe is the only way to display a stored phone; money goes through `money.ts` (see «Dinero e inventario»). The pop-ups «Dejar»/«Retirar» live in the `ventana` outlet of `admin-shell` and use `shared/components/modal-panel` (a modal `p-dialog`).
- `src/app/features/<feature>/` (one functional area each): `pages/<name>-page/` (routed containers; a page folder holds only its component `.ts/.html/.spec.ts` and an optional `ui/`), `components/` (presentational: only `input()`/`output()`, never data services or `Router`), `<feature>.routes.ts` (pages lazy-loaded with `loadComponent`), and when needed `services/`, `guards/`, `interfaces/` (backend models shared across the feature), `validators/`, `rules/` (pure business-rule functions), `models/`, `constants/`. Visual-only subcomponents of one page go in its `ui/`; once reused, in `components/`.
- No global `src/app/components/`, `services/` or `pages/` catch-alls. Create a new feature's whole folder skeleton before adding files.
- **Imports between areas use the `tsconfig.json` aliases** `@core/*`, `@shared/*`, `@features/*`; inside one area they stay relative. A new feature needs no alias.
- **Types and interfaces live apart from classes:** a class file (component, page, service, guard, interceptor) never declares a `type`/`interface`. Shared in a feature → `<feature>/interfaces/*.models.ts`; one page → `models/<page>.models.ts`; one non-page component → `<name>.models.ts` beside it. Import with `import type`.
- **Constants live apart too** (frontend **and** backend): a class file never declares module-level constants (message maps, minimum lengths…). One page → `constants/<page>.constants.ts`; one non-page component → `<name>.constants.ts` beside it; services/guards/rules → the feature's or area's `constants/`. Backend: one `constants.ts` per module. Not constants in this sense: functions in a `const`, runtime instances (`db`, `sql`), framework config objects (`nextConfig`, `proxy.ts` `config`), route arrays, `core/api-base-url.ts`, and values local to a test.
- **Components:** always `ng generate component` (never hand-written); selectors with the `app-` prefix; kebab-case names describing function and context, **without** the word «component» (`angular.json` keeps the `.component` suffix and `style: "none"`, so files are `name.component.ts/.html/.spec.ts`, no `.css`).
- **Comments:** every non-trivial function (auth flows, guards, interceptors, non-obvious rules) gets a short comment saying what it does and *why*, not a restatement of the code.
- **Styling:** Tailwind utility classes in the template only (no per-component `.css`, no `styleUrl`). Brand colors and fonts are `@theme` tokens in `src/styles.css` (`bg-page`, `text-ink`, `border-danger`, `font-display`, `warning-*`…): never hard-code hex or font stacks. Use the shared utilities there (`field-*`, `surface-*`, `page-title`, `alert-*`) before repeating utilities; one-off sizes may be arbitrary (`h-[50px]`); test-hook classes alongside are fine. New UI combines the Jira/Confluence mockups with `references/`, translated to the app's tokens — never copy mockup colors or Vue code verbatim.
- **PrimeNG** is used for all buttons and button-looking links (`pButton`: primary without `severity`, `secondary`, `[text]="true"` for ghost, `danger` + `[outlined]`), forms, lists (`DataView`), `Select`, toast, confirm dialog, the `top-nav` menu, cards/`Tag`/`Skeleton` and the pop-ups (`Dialog` inside `modal-panel`). Import each control from `primeng/*` — no aggregate module, PrimeFlex, `primeicons` or `tailwindcss-primeui`; register `MessageService`/`ConfirmationService` once in `app.config.ts`. Config in `core/ui/constants/primeng.constants.ts` and the `MAMMUT_THEME` preset (`mammut-theme.constants.ts`: only the used Aura subpresets, CSS variables from `styles.css`, no hex in TS); `styles.css` declares `theme, base, primeng, components, utilities` first. `PRIMENG_LICENSE_KEY` lives in `.env`/env (`scripts/prepare-primeng-license.mjs` generates a git-ignored file; the key is never printed or committed). Text fields are `pInputText`, selectors `p-select` (values are text; `''` = «Sin categoría»); money fields stay `string` with `type="text" inputmode="decimal"` — never `InputNumber`, never format or round while typing.
- **Low stock (spec `M3-hu18`):** the backend decides the level (`LOW_STOCK_THRESHOLD`, `stockLevel` `'ok'|'low'|'out'`); the frontend never repeats the number, it only paints `stockLevel` (`shared/constants/stock-level.constants.ts`).
- **Cash cut (spec `M4a-hu19`):** `features/cash-cut/` is shared by the admin page (`/admin/corte`, HU-19) and the seller's «Mi corte» (`/vendedor/mi-corte`, spec `M4a-hu20`), so its models mark cost and profit as optional. Since HU-20 the seller also receives cost and profit from `GET /api/cuts` (no role trimming; the seller can only ask for their own cut, `403` otherwise): the rule «a seller never sees costs» no longer applies to the cut, but still applies to «Mi stock», «Vender» and «Venta confirmada». The shared components take `perspective: 'admin' | 'seller'` for the wording; the seller's page shows only the line's total cost («costo»), never the word «envío». The frontend never adds up cut money: it paints the `totals` and lines of `GET /api/cuts`. The pure period rule (`rules/cash-cut-period.rules.ts`: Monday-to-Sunday weeks, calendar months, «today» via `Intl` in `America/Mexico_City`, never the device clock) only feeds the period text and the `date` sent; once a cut is generated, the backend's `period` wins. Changing period, arrows or the «Viendo» holder discards the generated cut. HU-21 (spec `M4b-hu21`): the admin page has two cut types, «Corte del vendedor» (`GET /api/cuts`, profit with the seller's cost with shipping) and «Corte de casa» (`GET /api/cuts?type=home` via `CashCutService.getHome()`, profit with the factory cost); the type always starts as «Corte del vendedor» and changing it discards the generated cut. The shared components take `cutType: 'seller' | 'home'` and `layout: 'classic' | 'overview'` (`classic` by default, so «Mi corte» is unchanged); only the admin page passes `layout="overview"`, which shows just «Vendido» and «Ganancia» (no costs, never «Para cubrir envíos»; the backend still sends `shippingCover` and `factoryCost`, the screen does not paint them) with «Generado…» and «Generar de nuevo» projected into the summary footer. HU-22 (spec `M4b-hu22`): with «Yo · bodega» and «Corte de casa» the admin page shows the switch «Incluir a mis vendedores» (`p-toggleswitch`, off by default, never remembered, absent with a seller in «Viendo» or with «Corte del vendedor»): off is the warehouse's own home cut (`getHome()`, no `scope`), on is the business summary (`GET /api/cuts?type=home&scope=business` via `CashCutService.getBusiness()`) with a «Por titular» breakdown (`cut-holder-line`: warehouse first, then sellers by amount sold, deactivated sellers included). `scope` is part of `CutRequest`, so flipping the switch discards the generated cut. The screen paints only «Vendido» and «Ganancia» (the backend computes and sums every holder in SQL; the frontend never adds holders), and the business summary has no product breakdown or sales list. «Mis ventas» means the warehouse only.

### Backend (`backend/`)

Next.js App Router, API routes only, as a **modular monolith** (one app, one database; not microservices: stock is kept by Postgres triggers, operations cross modules inside one `withTransaction`, auth is re-read per request). Routes in `app/api/**/route.ts` only validate and call a use case in `src/` — no business logic in routes.

```
proxy.ts      CORS for /api/**              src/db/   Drizzle client, schema.ts, withTransaction + lockRows
app/api/      thin routes                   src/lib/  errors (AppError), cors, supabase, handler (readJson, requireMoney…), money
src/<module>/ auth · accounts · products · categories · stock · deliveries · returns · inventory · sales (each: index.ts + constants.ts)
tests/        Vitest against the real DB; architecture.test.ts checks module boundaries
```

- **Boundaries:** a module exposes its API only in `src/<module>/index.ts`. Between areas use the `backend/tsconfig.json` aliases (`@db/*`, `@lib/*`, `@auth`, `@accounts`, `@products`, `@categories`, `@stock`, `@deliveries`, `@returns`, `@inventory`, `@sales`, `@api/*`); a module alias points only at its `index.ts`. Inside an area, imports stay relative. Infrastructure never depends on a module; `src/` never imports `app/`. A new area = new `src/<module>/` with `index.ts`, `constants.ts` and its alias. A use case writing to several modules lives in the owning module and passes its `tx` to the others' public functions.
- **Auth is re-checked on every request** (`getAuthContext` loads `profiles` fresh); never trust JWT claims for role/active status.
- **Account creation** = Supabase Auth user, then `profiles` row, with manual compensation (delete the Auth user if the insert fails); follow `createAccount`.
- **Transactions** go through `withTransaction`/`lockRows` (`select … for update`), not raw queries.
- **Inventory only changes by inserting `stock_movements` via `insertMovements`** (`src/stock/movements.ts`). Never write `products.stock` or `vendor_stock.qty`: Postgres triggers maintain them and reject direct writes from any client. Products are inserted with `stock = 0`; a negative balance → `409` «No hay piezas suficientes». Movements are never updated (correct with `*_void` or `adjustment`); deleting one (tests only) reverts it — delete newest first.
- **Movement signs** (`stock_movements_qty_sign_check`): one row per holder (`holder_profile_id` null = warehouse), signed `qty`; a transfer is two rows in one transaction. `initial`/`purchase`: warehouse `> 0`; `delivery`: warehouse `< 0`, seller `> 0`; `return`: warehouse `> 0`, seller `< 0`; `direct_sale`/`shrinkage`/`fraction_out`: `< 0`; `*_void`/`fraction_in`: `> 0`; `adjustment`: `≠ 0`.
- Rows with history are **deactivated, never deleted** (`DELETE` relies on FK `restrict` → 409).
- **Errors** are always `{ error: { code, message } }` via `AppError`/`toResponse` with a fixed status per code (401/403/404/409/422/500); login/refresh give one generic message for wrong password, unknown and deactivated accounts.
- **CORS** origins come from `ALLOWED_ORIGINS` in `backend/.env`; add any new frontend origin there.
- `src/db/schema.ts` is generated: never hand-edit beyond the `db:pull` fixups, never add Drizzle-generated migrations.

### Specs workflow

Specs are written with `/spec` and implemented with `/spec-impl` (Claude Code skills); `specs/.spec-config.yml` (`AutoCreateBranch`) controls whether the spec branch is created automatically — `/spec` creates it when it writes the spec, `/spec-impl` continues on it; its name follows «Convenciones Git» (`<tipo>/<descripcion-corta>`, type chosen from the spec's content). `specs/README.md` is the spec index (type, Jira key, status, dependencies, objective, cross-spec relationships): update it in the same change whenever a spec is created, changes status or affects another one. Older specs cite pre-reorganization paths; the old → new table is the last bullet of its «Relaciones» section.

**Jira sync** (when a spec maps to a user story `HU-NN`): while implementing, comment progress on the issue (current step of the plan and ✅/❌/⏳ per acceptance criterion; pattern of `SCRUM-17`) and move it En curso → In review → Finalizada as the work advances; Finalizada only when every criterion is checked, tests pass and the user reviewed.

## Convenciones Git

- **Tipos permitidos:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- **Ramas:** `<tipo>/<descripcion-corta>`, en minúsculas, con guiones y de 5 palabras como máximo (`feat/corte-para-casa`). Se sale de `main`; no se hace commit directo en `main`.
- **Commits:** `<tipo>(<área>): <descripción>`. Descripción en español, en infinitivo, sin punto final y de 72 caracteres como máximo (`feat(cuts): calcular el corte para casa`). El área va en minúsculas y con guiones.
- **Hook:** `.githooks/commit-msg` rechaza los mensajes que no cumplen el formato; solo deja pasar los merge y revert automáticos de git. En un clon nuevo se activa con `git config core.hooksPath .githooks`.
- **PRs:** título con el mismo formato que un commit; el cuerpo sigue `.github/pull_request_template.md`.
- **Ramas de specs:** al crear la rama de un spec (la crea `/spec` al escribirlo; `/spec-impl` la reutiliza), el tipo se elige por el contenido del spec, no siempre `feat`: una funcionalidad nueva es `feat`, una corrección `fix`, una reorganización sin cambio de comportamiento `refactor`, solo pruebas `test`, solo documentación `docs`, y configuración o mantenimiento `chore`. Este formato reemplaza el `spec-NN-slug` por omisión de la skill.
- No hacer commit ni push si no se pide. Para crear un PR usa `gh pr create` con la plantilla. Solo cuando te lo pida, igual que push.

## Buenas prácticas de código

### Principios
- SOLID: una responsabilidad por clase o componente, dependencias por inyección, interfaces pequeñas. La lógica de negocio va en servicios; los componentes solo presentan datos y emiten eventos.

### Angular
- Componentes standalone (sin NgModules nuevos); `inject()`; `input()`, `output()` y `computed()`; plantillas con `@if`, `@for` (con `track`) y `@switch`; lazy loading en todas las rutas de funcionalidades.
- OnPush ya es el valor por defecto en Angular 22: no declarar `changeDetection`, nunca `Eager` ni `Default`.
- No anidar `subscribe`. Lo que se carga al entrar a una pantalla va con `rxResource` (`status()`/`error()` dan cargando/error; «Reintentar» es `reload()`) o `toSignal()`. Las acciones del usuario usan un solo `subscribe` con `takeUntilDestroyed()`; si una llamada depende de otra, `switchMap` en el mismo `pipe`.

### Formularios
Todo formulario reactivo sigue este patrón (ejemplos: `features/products/components/product-form`, `features/auth/pages/login-page`):
- **Orden del componente**, cada sección con un comentario breve: dependencias (`inject()`) → formulario y estados → getters/setters → ciclo de vida → carga de datos → métodos que agregan/quitan/modifican controles → validación, payload y envío.
- Tipados con `FormBuilder` (`.nonNullable`), `FormGroup` para objetos y `FormArray` para colecciones; estructura y validaciones en `createEmptyForm()` (en `ngOnInit()`: primero eso, luego `loadInitialValue()`/`loadX()`); validadores en `<feature>/validators/` o `shared/validators/validators.ts`, no dentro del componente.
- Getters para controles que se consultan seguido; un setter reemplaza una colección del backend (limpia y crea con el mismo método privado que «agregar»); nada de HTTP en getters ni setters. `patchValue()` para campos simples; los elementos de un `FormArray` se crean antes de asignarles valor. Modelo del backend, forma del formulario y payload quedan separados si difieren.
- Envío: inválido → `markAllAsTouched()` y parar; payload en `prepareSavePayload()` (con `getRawValue()` si hay controles deshabilitados); sin segundo envío mientras el primero está en curso; cerrar los estados de espera en éxito y error; `markAsDirty()` al cambiar una colección.
- Un componente presentacional carga desde un `input()` y emite un `output()` con el payload; la consulta y el guardado son de la página. Los errores de campo se muestran al enviar, no al tocar (excepción: reglas en vivo como «precio menor que el costo»).
- No se inventan endpoints, campos ni reglas de negocio: si falta información del backend, se señala qué hay que adaptar.

### Calidad
- TypeScript estricto; prohibido `any` (usar `unknown` y validar). No dejar código comentado ni `console.log`. Antes de terminar una tarea, `ng build` y los tests afectados.
- Nombres en inglés para código (identificadores, archivos, carpetas, selectores, refs de plantilla, `id`/`name` de HTML) y español solo en textos visibles. Comentarios, descripciones de pruebas (`describe`/`it`), URLs (`/admin/productos`) y datos del contrato con la base (el rol `'vendedor'`) siguen en español. Los specs anteriores a T-05 citan nombres viejos: ver la tabla «viejo → nuevo» de `specs/M1-t05-codigo-en-ingles/spec.md` §4.

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

### Dinero e inventario
- Nunca `number` flotante para cálculos de caja. **Convención (spec `M1-t08`):** precio hasta 2 decimales (máx. `99999999.99`), costo hasta 4 (máx. `999999.9999`); decimales de más o fuera de rango → error de campo y `422`, **nunca redondeo silencioso**. Los montos viajan como texto (`"450.50"`); el backend también acepta número y normaliza con `requireMoney(body, field, { scale, label })`. En el frontend son `string`.
- Calcular o comparar siempre con `money.ts` (`src/app/shared/utils/` y `backend/src/lib/`, mismo contrato): `toMinorUnits`, `fromMinorUnits`, `compareMoney`, `decimalPlaces`; `Number()` solo para el pipe `currency` al mostrar.
- Ventas, cortes y precios por vendedor: cada venta guarda precio y costo del momento como `numeric`; totales de venta con enteros en el backend; cortes y reportes con `sum()` en SQL; un costo de 4 decimales se redondea a centavos **una sola vez, al final** (mitad hacia arriba).
- Toda operación que modifique inventario o caja registra un movimiento; no se sobrescriben saldos (en inventario la base lo impone).

## Diseño de interfaces

- Antes de crear una pantalla nueva, usar definir estilo, paleta y reglas de UX (en Claude Code, la skill ui-ux-pro-max); después trabajar el acabado visual (la skill frontend-design). No aplicar este flujo a cambios menores ni a lógica sin interfaz.
- Mantener los colores, tipografías y componentes ya definidos en el sistema de diseño del proyecto.
