# Backend de Mamut Admin

API en Next.js (App Router, solo `app/api/**`) que usa el frontend Angular de `mamut-admin` (http://localhost:4200) para hablar con Supabase (PostgreSQL + Auth). Es un monolito modular dentro de este repo: una sola app y una sola base. Tiene su propio `package.json`, `node_modules` y `.env`.

## Arrancar

```bash
cd backend
npm install
cp .env.example .env   # el bloque LOCAL ya viene listo (ver abajo)
npm run dev            # http://localhost:3000/api/health
```

Para la base de prueba en Docker, `npm run db:start` desde la raíz. Los bloques PRODUCCIÓN y LOCAL de `.env` se explican en el `README.md` de la raíz.

### Variables de entorno (`.env`, solo servidor)

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL. Usa **Session pooler** (puerto 5432) o la conexión directa, nunca el pooler en modo transacción (6543): rompe `select … for update`. La contraseña con caracteres especiales va codificada en la URL. |
| `SUPABASE_URL` | URL del proyecto. |
| `SUPABASE_ANON_KEY` | Llave pública: valida tokens y hace login. |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave secreta: crea y edita cuentas de Auth. Nunca se expone al navegador. |
| `ALLOWED_ORIGINS` | Orígenes del frontend permitidos por CORS, separados por coma. Deben ser exactos: no se aceptan patrones con `*`. |

`.env` está ignorado por git; `.env.example` no lleva valores reales.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` / `npm start` | Build y servidor de producción. |
| `npm run type-check` | `tsc --noEmit`. |
| `npm test` | Pruebas con Vitest (ver «Pruebas»). |
| `npm run db:check` | Comprueba la conexión (`select count(*) from categories`). |
| `npm run db:pull` | Regenera `src/db/schema.ts` desde la base (ver «Esquema»). |

## Estructura

```
proxy.ts            CORS para /api/** (en Next 16 «middleware» se llama proxy)
app/api/            rutas delgadas: validan el cuerpo y llaman a un caso de uso
src/<módulo>/       auth · accounts · products · categories · stock · deliveries ·
                    returns · inventory · sales · cuts · fractions · shrinkage
                    (cada uno expone su API solo en index.ts)
src/db/             conexión Drizzle, esquema, withTransaction y lockRows
src/lib/            AppError, CORS, clientes de Supabase, helpers de rutas, dinero
tests/              Vitest contra la base real; architecture.test.ts revisa las fronteras
```

## Endpoints

Todos devuelven errores como `{ error: { code, message } }` (401, 403, 404, 409, 422, 500). La sesión viaja en `Authorization: Bearer <accessToken>`. La lista completa está en `app/api/**/route.ts`; por áreas:

| Área | Rutas |
|---|---|
| Sesión | `GET /api/health`, `POST /api/auth/{login,refresh,logout}`, `GET /api/me` |
| Catálogo | `/api/products`, `/api/products/:id`, `/api/products/photo`, `/api/categories` |
| Inventario | `/api/stock`, `/api/me/stock`, `/api/sellers/:id/{deliveries,returns,shrinkages,stock/:productId}` |
| Vendedores y cuentas | `/api/sellers`, `/api/sellers/:id`, `/api/admins`, `/api/clients`, `/api/logins` |
| Ventas y cortes | `/api/sales`, `/api/sales/catalog`, `/api/cuts` |
| Fraccionado y merma | `/api/fractions`, `/api/shrinkages` |

## Reglas que conviene recordar

- **Una transacción por caso de uso**: `withTransaction(fn)` hace rollback si `fn` lanza; `lockRows` hace `select … for update`.
- **El perfil se consulta en cada petición** (rol y `active`): desactivar una cuenta surte efecto de inmediato. Un perfil inexistente o inactivo es 401.
- **Crear una cuenta son dos pasos** (Auth y `profiles`) sin transacción común: si falla el segundo se borra la cuenta de Auth (`createAccount`).
- **El inventario solo cambia insertando `stock_movements`**; los triggers de Postgres mantienen `products.stock` y `vendor_stock.qty`.
- **Con historial no se borra**: los `DELETE` devuelven 409 por la llave foránea `restrict`; solo se desactiva.

## Esquema (Drizzle)

La base se migra con las SQL de `../supabase/migrations/`. Drizzle **no** genera ni aplica migraciones: `src/db/schema.ts` es un reflejo de la base obtenido con `npm run db:pull` (con `.env` apuntando a PRODUCCIÓN).

Después de cada `db:pull` hay que reaplicar a mano estos ajustes:

1. Los valores por defecto vacíos salen como `.default(')`; deben ser `.default('')`.
2. Falta `auth.users` (el filtro solo trae `public`): reponer al inicio `const authSchema = pgSchema("auth")`, `export const usersInAuth = authSchema.table("users", { id: uuid().primaryKey() })` y `const users = usersInAuth`.
3. Borrar `src/db/0000_*.sql` y `src/db/meta/` (migraciones de Drizzle que no se usan).

## Pruebas

`npm test` corre Vitest contra la **base real** de `DATABASE_URL` (nunca un mock). Deja el bloque LOCAL activo. Las pruebas con cuentas necesitan `SUPABASE_SERVICE_ROLE_KEY`; sin ella se omiten en silencio, así que un `npm test` en verde sin esa llave no prueba autenticación ni cuentas.

`tests/routes-auth.test.ts` recorre todos los `app/api/**/route.ts` y exige 401 sin token; una ruta pública nueva debe agregarse a su conjunto `PUBLIC`.

Lo que crean las pruebas lleva el prefijo `test-auth-` / `test-tx-` y se borra antes y después de cada suite (`tests/helpers/users.ts`).

## Despliegue

El backend se publica como un proyecto aparte del frontend (la publicación en Vercel es la tarea T-33). Lo que cada ambiente público debe configurar:

1. **Variables del servidor:** las cinco de la tabla de arriba, cargadas en el panel del proveedor, nunca en el repo. `DATABASE_URL` debe usar el Session pooler (5432).
2. **`ALLOWED_ORIGINS`:** el origen público exacto del frontend (por ejemplo `https://mamut-admin.vercel.app`), sin ruta ni `/` final. Un origen que no esté en la lista recibe `403`. Los previews de Vercel no se aceptan por patrón: si se necesitan, se agregan a mano.
3. **Migraciones:** se aplican a mano en el SQL Editor de Supabase, nunca con `supabase db push` (ver `CLAUDE.md`).
4. **Frontend:** el frontend toma la URL de este backend de `API_BASE_URL` al compilar. Debe ser `https://` y solo el origen, y el comando de build en el proveedor debe ser `npm run build`, no `ng build`, para que se genere el archivo de configuración.
5. **Supabase Auth:** no hace falta configurar Site URL ni Redirect URLs; las cuentas se crean con `admin.createUser`, sin correos ni enlaces de confirmación.
