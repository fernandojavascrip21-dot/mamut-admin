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
- The schema's domain (`clients`, `consignment_items`, `debtors`, …) doesn't map 1:1 onto this project's vocabulary (administrador/vendedor, bodega, dejar/retirar).
- `profiles.role` only allows `'admin' | 'client'`. Adding `'vendedor'` means **extending** the check constraint and `AuthContext['role']`, not replacing them.

## Commands

### Frontend (repo root)

```bash
npm start                # ng serve — http://localhost:4200
npm run dev              # frontend + backend at once (concurrently): :4200 and :3000
npm run dev:all          # db:start (Docker Supabase; no-op if already up) and then dev
npm run build            # production build
npm run watch            # dev build in watch mode
npm test                 # unit tests (Vitest runner, jsdom) — not Karma/Jasmine
ng test --include src/app/auth/services/auth.service.spec.ts   # single file
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
- Seed users (`supabase/seed.sql`, all fake data): `admin@mammut.local` / `Admin-123456!`; `vendedor1@`, `vendedor2@mammut.local` / `Vendedor-123456!`; `inactivo@mammut.local` (deactivated).
- `supabase/migrations/20261024000000_baseline_schema.sql` is a schema-only snapshot of the inherited production schema so an empty DB can replay every migration. Never apply it to production.
- New migrations: add the `.sql` to `supabase/migrations/`, verify with `npm run db:reset` locally, then apply to production.

## Frontend conventions

**Folder structure (by feature, not by file type):**

- `src/app/pages/<name>-page/` — one folder per routed page. Pages hosting a `<router-outlet>` (`admin-page`, `seller-page`) still live here.
- `src/app/<feature>/` — one functional area with its own `services/`, `guards/`, `interfaces/`, and when needed `components/` (presentational, non-page components that only take `input()` and emit `output()`, e.g. `products/components/product-form`), `validators/` (Reactive Forms validators, e.g. `products/validators/product-form.validators.ts`) and `rules/` (pure business-rule functions testable without Angular, e.g. `products/rules/product.rules.ts`). Examples: `auth/`, `products/`.
- `src/app/shared/` — code reused across features (`api-base-url.ts`, `initials.ts`, `normalize-text.ts`, `http-errors.ts` — `isOffline`/`httpStatus`/`isNotFound`, the only place that reads `HttpErrorResponse` —, `validators.ts`, `components/top-nav/`, `components/confirm-dialog/` — the single confirmation dialog with focus, trapped `Tab` and `Escape`).
- Visual-only subcomponents of a page/component go in its own `ui/` subfolder.
- **Types and interfaces live apart from classes:** a class file (component, page, service, guard, interceptor) never declares a `type` or `interface`. Types shared across a feature go in `<feature>/interfaces/*.models.ts` (e.g. `products/interfaces/product.models.ts`, `products/interfaces/unsaved-changes.models.ts`); types used by a single page or component go in a `<name>.models.ts` file next to it (e.g. `shared/components/top-nav/top-nav.models.ts`, `products/components/product-form/product-form.models.ts`, `pages/login-page/login-page.models.ts`). `type` and `interface` may coexist in the same models file. Import them with `import type`. Constants (e.g. a messages map) are values, not types, and may stay in the class file.
- No root-level `src/app/components/` or `src/app/services/` catch-alls.
- Create a new feature's whole folder skeleton before adding files to it.

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

Next.js App Router, API routes only:

```
proxy.ts         CORS for /api/** (Next 16's renamed "middleware")
app/api/         thin routes: validate input, call a use case in src/
src/db/          Drizzle client, introspected schema.ts, withTransaction + lockRows
src/auth/        getAuthContext, guards (requireAuth/requireRole/requireOwnClient), session
src/accounts/    account use cases built on accounts.ts (createAccount/toView)
src/lib/         errors.ts (AppError), cors.ts, supabase.ts, handler.ts (request helpers)
src/stock/       movements.ts (insertMovements: the only way inventory changes)
tests/           Vitest against the real DB
```

- **No business logic in routes** — routes validate and delegate to `src/`.
- **Auth is re-checked on every request**: `getAuthContext` loads `profiles` fresh so deactivation takes effect immediately. Never trust JWT claims for role/active status.
- **Account creation = Supabase Auth user, then `profiles` row**, with manual compensation (delete the Auth user if the profile insert fails). Follow `createAccount` for any new account flow.
- **Transactions** go through `withTransaction` / `lockRows` (`select … for update`), not raw queries.
- **Inventory only changes by inserting `stock_movements` via `insertMovements`** (`src/stock/movements.ts`). Never write `products.stock` / `vendor_stock.qty`: Postgres triggers maintain them and reject direct writes from any client. Products are inserted with `stock = 0`. A balance going negative → `409` «No hay piezas suficientes». Movements are never updated; deleting one (tests only) reverts it, so delete newest first.
- **Movement sign convention** (`stock_movements_qty_sign_check`, spec `M1-t07` §3): one row per holder (`holder_profile_id` null = warehouse), signed `qty` (in `> 0`, out `< 0`); a transfer is two rows in one transaction. `initial`/`purchase`: warehouse `> 0`; `delivery`: warehouse `< 0`, seller `> 0`; `return`: warehouse `> 0`, seller `< 0`; `direct_sale`/`shrinkage`/`fraction_out`: `< 0`; `*_void`/`fraction_in`: `> 0`; `adjustment`: `≠ 0`.
- **Rows with history are deactivated, never deleted.** `DELETE` endpoints rely on FK `restrict` to surface a 409.
- **Errors** are always `{ error: { code, message } }` via `AppError` / `toResponse`, with a fixed HTTP status per code (401/403/404/409/422/500). Login/refresh return one generic message for wrong password, unknown account and deactivated account.
- **CORS** origins come from `ALLOWED_ORIGINS` in `backend/.env`; the Angular dev origin (`http://localhost:4200`) must be listed.
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

Todo formulario reactivo (nuevo o existente) sigue este patrón. Ejemplos: `products/components/product-form` (presentacional) y `pages/login-page` (llama al servicio).

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
- Toda operación que modifique inventario o caja debe registrar un movimiento; no sobrescribir saldos directamente. En inventario la base lo impone: solo se insertan `stock_movements` con `insertMovements`.

## Diseño de interfaces

- Antes de crear una pantalla nueva, definir estilo, paleta y reglas de UX (en Claude Code, con la skill ui-ux-pro-max).
- Después, trabajar el acabado visual (en Claude Code, con la skill frontend-design).
- No aplicar este flujo a cambios menores ni a lógica sin interfaz.
- Mantener los colores, tipografías y componentes ya definidos en el sistema de diseño del proyecto.

## Workflow

- Specs are written with `/spec` and implemented with `/spec-impl`; `specs/.spec-config.yml` (`AutoCreateBranch`) controls whether a `spec-<slug>` branch is created automatically.
- `specs/README.md` is the spec index (type, Jira key, status, dependencies, objective, and cross-spec relationships). Update it in the same change whenever a spec is created, changes status, or affects another spec.
- When a spec maps to a Jira user story (`HU-NN`):
  - **During implementation**, comment progress on the Jira issue: current step of the spec's plan and the status (✅ done / ❌ pending / ⏳ deferred) of each acceptance criterion — follow the pattern on `SCRUM-17`.
  - **At 100%** (all acceptance criteria checked, tests passing), transition the story to `Finalizada`.
- Don't commit or push unless asked; branch off `main` rather than committing to it.
