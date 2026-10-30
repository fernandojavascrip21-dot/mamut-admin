# AGENTS.md

Guidance for AI coding agents (Codex, Cursor, Copilot, Claude Code, etc.) working in this repository. `CLAUDE.md` holds the same rules in more detail; keep both in sync. If they disagree, `CLAUDE.md` wins and this file should be updated.

## Project overview

- **Frontend (repo root):** Angular 22 admin app (`mamut-admin`) for Mammut Supplements, a supplement-inventory business. Standalone components, SSR (`src/server.ts`, `outputMode: "server"`), Tailwind v4 via `@tailwindcss/postcss`.
- **Backend (`backend/`):** Next.js API-only project (own `package.json`, `node_modules`, `.env`), reused from the sibling Vue project `mammutSuplements/mammut-Suplements` and extended here. Supabase (Postgres + Auth) accessed through Drizzle.
- **Migrations:** `supabase/migrations/` (timestamped SQL files).
- **Specs:** `specs/<milestone>-<story>/spec.md` (e.g. `specs/M1-hu05-ver-y-buscar-productos/`). `specs/M0-base/spec.md` is the only milestone-wide spec.
- **Requirements, mockups, user stories:** Jira/Confluence on `fernandojavascrip21.atlassian.net` (Jira project key `SCRUM`), not local files.
- **Design references:** `references/` (local HTML/Vue references and the inventory Excel).

Known legacy mismatches inherited from the old project:

- `backend/README.md` still talks about a Vue frontend and a Vite dev port; it's accurate about backend code, outdated about who consumes it.
- The schema's domain (`clients`, `consignment_items`, `debtors`, …) doesn't map 1:1 onto this project's vocabulary (administrador/vendedor, bodega, dejar/retirar). Settled in spec `M1-t03`: a `vendedor` is **not** a `client`. A seller is a `profiles` row with `role = 'vendedor'`, and `clients` stays unused for now.
- `profiles.role` allows `'admin' | 'client' | 'vendedor'` (check constraint and `AuthContext['role']`); a `vendedor` requires a 10-digit `phone` (spec `M2-t10`). New roles **extend** both, never replace them.

## Commands

### Frontend (repo root)

```bash
npm start                # ng serve — http://localhost:4200
npm run dev              # frontend + backend at once (concurrently): :4200 and :3000
npm run dev:all          # db:start (Docker Supabase; no-op if already up) and then dev
npm run build            # production build
npm run watch            # dev build in watch mode
npm test                 # unit tests (Vitest runner, jsdom) — not Karma/Jasmine
npm run check:architecture # layer boundaries of src/app (core/shared/features), see «Architecture»
ng test --include src/app/core/auth/services/auth.service.spec.ts   # single file
ng test --filter "AuthService"                                  # by name
```

No lint script is configured (no ESLint at root or in `backend/`).

### Backend (`cd backend`)

```bash
npm run dev              # http://localhost:3000/api/health
npm run build / start
npm run type-check       # tsc --noEmit
npm test                 # vitest run against whatever DB backend/.env points to (local Docker by default)
npx vitest run tests/admins.test.ts   # single file
npm run db:check         # sanity query
npm run db:pull          # regenerate src/db/schema.ts (point .env at PRODUCCIÓN first)
```

- Backend tests hit the database `backend/.env` points to — see "Local environment" below. Account tests need `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`; without it they are **silently skipped**, so a green run doesn't prove auth logic passed. Test data is prefixed `test-auth-` / `test-tx-` and cleaned up automatically.
- After `npm run db:pull`, fix `src/db/schema.ts` by hand before committing:
  1. `.default(')` → `.default('')`.
  2. Re-add at the top: `const authSchema = pgSchema("auth")`, `export const usersInAuth = authSchema.table("users", { id: uuid().primaryKey() })`, `const users = usersInAuth`.
  3. Delete the generated `src/db/0000_*.sql` and `src/db/meta/` — they aren't used.

### Local environment (Docker — Supabase local)

```bash
npm run db:start         # (repo root) Postgres + Auth + Storage + Studio in Docker; needs Docker Desktop running
npm run db:reset         # wipe local DB, re-apply supabase/migrations + supabase/seed.sql
npm run db:status        # URLs and local keys
npm run db:stop
```

- `backend/.env` has two connection blocks, **PRODUCCIÓN** and **LOCAL**: keep one active, comment the other. Next, tests, `db:check` and drizzle all read that file; restart `npm run dev` after switching. `backend/.env.example` has the same layout.
- Studio: http://127.0.0.1:54323 · Mailpit: http://127.0.0.1:54324 · DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- Test users: `usuarios-prueba.md` (seed accounts, sellers created from the app, production test accounts). Keep it updated. It is **local only** (`.gitignore`) because it holds real passwords and emails and the repo is public, so never commit it or copy its contents into tracked files.
- `next dev` may exit right after start-up with a Next.js security-upgrade notice (exit code 1). Re-run `npm run dev`. Upgrading Next is its own deliberate change.
- Seed users (`supabase/seed.sql`, all fake data): `admin@mammut.local` / `Admin-123456!`; `vendedor1@`, `vendedor2@mammut.local` / `Vendedor-123456!`; `inactivo@mammut.local` (deactivated). Every `vendedor` has a 10-digit phone, which the database requires (spec `M2-t10`).
- `supabase/migrations/20261024000000_baseline_schema.sql` is a schema-only snapshot of the inherited production schema so an empty DB can replay every migration. Never apply it to production.
- New migrations: add the `.sql` to `supabase/migrations/`, verify with `npm run db:reset` locally, then apply to production.

## Frontend conventions

**Folder structure — component-based, grouped by feature** (dependencies one way only: `features → core / shared`, `core → shared`, `shared → nothing internal`; a feature never imports another; `npm run check:architecture` enforces it):

- `src/app/core/` — app-wide singletons: `auth/` (service, interceptor, `role`/`guest` guards, `interfaces/auth.models.ts`, `constants/`), `layout/` (`admin-shell/` and `seller-shell/` hosting the `<router-outlet>`, `top-nav/`, `constants/` with the menus, `routes/admin.routes.ts`/`seller.routes.ts`, still loaded with `loadChildren` after `roleGuard` so a seller never downloads the admin branch; `admin.routes.ts` only mounts each feature's routes), `toast/` (service, `components/toast/`, `constants/`), `api-base-url.ts`. Core never imports features except `core/layout/routes/`.
- `src/app/shared/` — reusable, stateless code: `utils/` (`initials.ts`, `normalize-text.ts`, `phone.ts`, `money.ts`, `http-errors.ts` — `isOffline`/`httpStatus`/`isNotFound`, the only place that reads `HttpErrorResponse`), `validators/validators.ts`, `pipes/phone.pipe.ts` (`phone`, the only way to display a stored phone (`55 2468 1357`), display only), `constants/`, `components/confirm-dialog/` (the single confirmation dialog with focus, trapped `Tab` and `Escape`), `pages/coming-soon-page/`.
- `src/app/features/<feature>/` (`auth` = login screen, `account`, `products`, `sellers`) — `pages/<name>-page/` (routed container components; a page folder only holds its component `.ts`/`.html`/`.spec.ts` and its `ui/` if any), `components/` (presentational: only `input()`/`output()`, e.g. `product-form`, `product-card`), `<feature>.routes.ts` (e.g. `PRODUCT_ROUTES`), and when needed `services/`, `guards/`, `interfaces/`, `validators/` (Reactive Forms validators), `rules/` (pure business-rule functions testable without Angular), `models/` (page types, `<page>.models.ts`), `constants/` (page constants, `<page>.constants.ts`, and the feature's own).
- Visual-only subcomponents of a page/component go in its own `ui/` subfolder; once reused, they move to the feature's `components/`.
- **Types and interfaces live apart from classes:** a class file (component, page, service, guard, interceptor) never declares a `type` or `interface`. Types shared across a feature go in `<feature>/interfaces/*.models.ts` (e.g. `features/products/interfaces/product.models.ts`); types used by a single page go in the feature's `models/<page>.models.ts` (e.g. `features/auth/models/login-page.models.ts`), and types used by a single non-page component go in a `<name>.models.ts` file next to it (e.g. `core/layout/top-nav/top-nav.models.ts`, `features/products/components/product-form/product-form.models.ts`). `type` and `interface` may coexist in the same models file. Import them with `import type`. **Constants live apart too** (user preference): a class file never declares module-level constants such as a messages map, a field→message lookup or a minimum length. This applies to **all** code, frontend and backend. Frontend: page constants go in the feature's `constants/<page>.constants.ts` (e.g. `features/sellers/constants/create-seller-page.constants.ts`); constants of a single non-page component go in a `<name>.constants.ts` file next to it; constants of a feature's or core area's services, guards or rules go in its `constants/` (e.g. `core/auth/constants/auth.constants.ts`, `shared/constants/money.constants.ts`). Backend: one `constants.ts` per module (`backend/src/accounts/constants.ts`, `backend/src/lib/constants.ts`, …). Not constants in this sense: functions stored in a `const` (guards, interceptors, error helpers), runtime instances (`db`, `sql`, the Express `app`), config objects a framework requires (`proxy.ts` `config`, `nextConfig`), route arrays (`*.routes.ts`), `core/api-base-url.ts` (already a constants-only file), and values local to a test file.
- No root-level `src/app/components/`, `src/app/services/` or `src/app/pages/` catch-alls.
- Create a new feature's whole folder skeleton before adding files to it.
- Imports between areas use the `tsconfig.json` aliases `@core/*`, `@shared/*`, `@features/*`; imports inside the same area (one feature, one `core/<area>`, or `shared`) stay relative. A new feature needs no new alias.

**Components:**

- Always generate with `ng generate component`, never hand-write the files. `angular.json` already sets `type: "component"` (keeps the `.component` suffix that Angular 22 otherwise drops) and `style: "none"`, so files come out as `name.component.ts`/`.html`/`.spec.ts`, with no `.css`.
- Selector prefix `app-`; kebab-case names describing function and context (`inventory-list`, `grid-client`); don't include the word "component" in the name.

**Styling:**

- Tailwind utility classes in templates only — no per-component `.css` files, no `styleUrl`.
- Brand colors and fonts are Tailwind v4 theme tokens in `src/styles.css` (`@theme`: `--color-*`, `--font-*`); use them as utilities (`bg-page`, `text-ink`, `border-danger`, `font-display`). Never hard-code hex values or font stacks.
- One-off sizes can use arbitrary values (`h-[50px]`).
- Non-styling test-hook classes (e.g. `field-error`) are fine.
- New UI combines the Jira/Confluence mockups with the local `references/`, translated into the app's tokens — don't copy mockup colors or Vue code verbatim.

**Comments:** every non-trivial function (auth flows, guards, interceptors, non-obvious rules) gets a short comment explaining what it does and *why*, not a restatement of the code.

## Backend conventions

Next.js App Router, API routes only, as a **modular monolith** (one app, one database, business modules with explicit public APIs; deliberately not microservices: stock lives in Postgres triggers, operations cross modules in one transaction, auth is re-read per request):

```
proxy.ts         CORS for /api/** (Next 16's renamed "middleware")
app/api/         thin routes: validate input, call a use case in src/
src/db/          (infra) Drizzle client, introspected schema.ts, withTransaction + lockRows
src/lib/         (infra) errors.ts (AppError), cors.ts, supabase.ts, handler.ts (request helpers, requireMoney), money.ts
src/auth/        module: getAuthContext, guards (requireAuth/requireRole/requireOwnClient), session
src/accounts/    module: account use cases built on the internal accounts.ts (createAccount/toView)
src/products/    module: products, photos
src/categories/  module: categories
src/stock/       module: movements.ts (insertMovements: the only way inventory changes)
tests/           Vitest against the real DB; architecture.test.ts checks module boundaries
```

- **Module boundaries and aliases:** each business module exposes its API in `src/<module>/index.ts`. Between areas, imports use the `backend/tsconfig.json` aliases, like the frontend: `@db/*`, `@lib/*`, `@auth`, `@accounts`, `@products`, `@categories`, `@stock` (a module alias points only at its index, so its internals stay private) and `@api/*`. Inside an area, imports stay relative. `src/db`/`src/lib` never depend on a module, and `src/` never imports `app/` (`tests/architecture.test.ts`). Vitest reads the same aliases (`resolve.tsconfigPaths`). A new area is a new module with `index.ts` + `constants.ts` + its alias. A use case spanning modules in one transaction lives in the owning module and passes its `tx` to the others' public functions.

- **No business logic in routes** — routes validate and delegate to `src/`.
- **Auth is re-checked on every request**: `getAuthContext` loads `profiles` fresh so deactivation takes effect immediately. Never trust JWT claims for role/active status.
- **Account creation = Supabase Auth user, then `profiles` row**, with manual compensation (delete the Auth user if the profile insert fails). Follow `createAccount` for any new account flow.
- **Transactions** go through `withTransaction` / `lockRows` (`select … for update`), not raw queries.
- **Inventory only changes by inserting `stock_movements` via `insertMovements`** (`src/stock/movements.ts`). Never write `products.stock` / `vendor_stock.qty`: Postgres triggers maintain them and reject direct writes from any client. Products are inserted with `stock = 0`. A balance going negative → `409` «No hay piezas suficientes». Movements are never updated; deleting one (tests only) reverts it, so delete newest first.
- **Movement sign convention** (`stock_movements_qty_sign_check`, spec `M1-t07` §3): one row per holder (`holder_profile_id` null = warehouse), signed `qty` (in `> 0`, out `< 0`); a transfer is two rows in one transaction. `initial`/`purchase`: warehouse `> 0`; `delivery`: warehouse `< 0`, seller `> 0`; `return`: warehouse `> 0`, seller `< 0`; `direct_sale`/`shrinkage`/`fraction_out`: `< 0`; `*_void`/`fraction_in`: `> 0`; `adjustment`: `≠ 0`.
- **Rows with history are deactivated, never deleted.** `DELETE` endpoints rely on FK `restrict` to surface a 409.
- **Errors** are always `{ error: { code, message } }` via `AppError` / `toResponse`, with a fixed HTTP status per code (401/403/404/409/422/500). Login/refresh return one generic message for wrong password, unknown account and deactivated account.
- **CORS** origins come from `ALLOWED_ORIGINS` in `backend/.env`. It lists `http://localhost:4200` (Angular) plus the legacy Vue port `5173`. Add any new frontend origin there.
- `src/db/schema.ts` is generated — never hand-edit beyond the `db:pull` fixups, never add Drizzle-generated migrations. Schema changes go in `supabase/migrations/`.

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
- **Construcción:** formularios tipados con `FormBuilder` (`.nonNullable` cuando tenga sentido), `FormGroup` para objetos anidados y `FormArray` para colecciones. La estructura y las validaciones van en un método dedicado, `createEmptyForm()`. En `ngOnInit()` se ven las dos etapas: primero `createEmptyForm()` y después la carga de datos (`loadInitialValue()`/`loadX()`). Los validadores van en `<feature>/validators/` o en `shared/validators/validators.ts`, no escritos dentro del componente.
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
- **Convención de dinero (spec `M1-t08`):** precio hasta 2 decimales (máx. `99999999.99`), costo hasta 4 (máx. `999999.9999`); decimales de más o fuera de rango → error de campo y `422`, nunca redondeo silencioso. Los montos viajan como texto (`"450.50"`); el backend también acepta número y normaliza con `requireMoney`. En el frontend son `string` e inputs `type="text" inputmode="decimal"`. Comparar o calcular siempre con `money.ts` (`src/app/shared/` y `backend/src/lib/`, mismo contrato): `toMinorUnits`, `fromMinorUnits`, `compareMoney`, `decimalPlaces`; `Number()` solo para el pipe `currency`. M2/M3: cada venta guarda precio y costo del momento como `numeric`; totales de venta con enteros en el backend; cortes y reportes con `sum()` en SQL; redondeo a centavos una sola vez al final (mitad hacia arriba).
- Toda operación que modifique inventario o caja debe registrar un movimiento; no sobrescribir saldos directamente. En inventario la base lo impone: solo se insertan `stock_movements` con `insertMovements`.

## Diseño de interfaces

- Antes de crear una pantalla nueva, definir estilo, paleta y reglas de UX (en Claude Code, con la skill ui-ux-pro-max).
- Después, trabajar el acabado visual (en Claude Code, con la skill frontend-design).
- No aplicar este flujo a cambios menores ni a lógica sin interfaz.
- Mantener los colores, tipografías y componentes ya definidos en el sistema de diseño del proyecto.

## Workflow

- Specs are written with `/spec` and implemented with `/spec-impl`; `specs/.spec-config.yml` (`AutoCreateBranch`) controls whether a `spec-<slug>` branch is created automatically.
- `specs/README.md` is the spec index (type, Jira key, status, dependencies, objective, and cross-spec relationships). Update it in the same change whenever a spec is created, changes status, or affects another spec. Older specs cite pre-reorganization paths (`pages/…`, `@pages/*`…); the old → new table is the last bullet of its «Relaciones» section.
- When a spec maps to a Jira user story (`HU-NN`):
  - **During implementation**, comment progress on the Jira issue: current step of the spec's plan and the status (✅ done / ❌ pending / ⏳ deferred) of each acceptance criterion — follow the pattern on `SCRUM-17`.
  - **At 100%** (all acceptance criteria checked, tests passing), transition the story to `Finalizada`.
- Don't commit or push unless asked; branch off `main` rather than committing to it.
