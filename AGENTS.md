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
npm test                 # vitest run against the REAL Supabase DB
npx vitest run tests/admins.test.ts   # single file
npm run db:check         # sanity query
npm run db:pull          # regenerate src/db/schema.ts
```

- Backend tests hit the live database. Account tests need `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`; without it they are **silently skipped**, so a green run doesn't prove auth logic passed. Test data is prefixed `test-auth-` / `test-tx-` and cleaned up automatically.
- After `npm run db:pull`, fix `src/db/schema.ts` by hand before committing:
  1. `.default(')` → `.default('')`.
  2. Re-add at the top: `const authSchema = pgSchema("auth")`, `export const usersInAuth = authSchema.table("users", { id: uuid().primaryKey() })`, `const users = usersInAuth`.
  3. Delete the generated `src/db/0000_*.sql` and `src/db/meta/` — they aren't used.

## Frontend conventions

**Folder structure (by feature, not by file type):**

- `src/app/pages/<name>-page/` — one folder per routed page. Pages hosting a `<router-outlet>` (`admin-page`, `seller-page`) still live here.
- `src/app/<feature>/` — one functional area with its own `services/`, `guards/`, `interfaces/` (and `components/` if needed). Examples: `auth/`, `products/`.
- `src/app/shared/` — code reused across features (`api-base-url.ts`, `initials.ts`, `normalize-text.ts`, `components/top-nav/`).
- Visual-only subcomponents of a page/component go in its own `ui/` subfolder.
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
tests/           Vitest against the real DB
```

- **No business logic in routes** — routes validate and delegate to `src/`.
- **Auth is re-checked on every request**: `getAuthContext` loads `profiles` fresh so deactivation takes effect immediately. Never trust JWT claims for role/active status.
- **Account creation = Supabase Auth user, then `profiles` row**, with manual compensation (delete the Auth user if the profile insert fails). Follow `createAccount` for any new account flow.
- **Transactions** go through `withTransaction` / `lockRows` (`select … for update`), not raw queries.
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
- Toda operación que modifique inventario o caja debe registrar un movimiento; no sobrescribir saldos directamente.

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
