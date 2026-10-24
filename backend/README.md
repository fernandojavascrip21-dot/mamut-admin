# Backend de Mammoth Suplements

API en Next.js (App Router, solo `app/api/**`) que conecta el frontend Vue con Supabase (PostgreSQL + Auth). Es un proyecto independiente dentro de este repo: tiene su propio `package.json`, `node_modules` y `.env`. Lo define el [SPEC 05](../specs/05-backend-base-y-cuentas.md).

## Arrancar

```bash
cd backend
npm install
cp .env.example .env   # y completa los valores (ver abajo)
npm run dev            # http://localhost:3000/api/health
```

### Variables de entorno (`.env`, solo servidor)

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL. Usa **Session pooler** (puerto 5432) o la conexión directa, nunca el pooler en modo transacción (6543): rompe `select … for update`. La contraseña con caracteres especiales va codificada en la URL. |
| `SUPABASE_URL` | URL del proyecto. |
| `SUPABASE_ANON_KEY` | Llave pública (`sb_publishable_…`): valida tokens y hace login. |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave secreta (`sb_secret_…`): crea, edita y borra cuentas de Auth. Nunca se expone al navegador. |
| `ALLOWED_ORIGINS` | Orígenes del frontend permitidos por CORS, separados por coma. |

`.env` está ignorado por git; `.env.example` no lleva valores reales.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo. |
| `npm run build` / `npm start` | Build y servidor de producción. |
| `npm run type-check` | `tsc --noEmit`. |
| `npm test` | Pruebas con Vitest (ver "Pruebas"). |
| `npm run db:check` | Comprueba la conexión (`select count(*) from categories`). |
| `npm run db:pull` | Regenera `src/db/schema.ts` desde la base (ver "Esquema"). |

## Estructura

```
proxy.ts            CORS para /api/** (en Next 16 "middleware" se llama proxy)
app/api/            rutas delgadas: validan el cuerpo y llaman a un caso de uso
src/db/             conexión Drizzle, esquema, withTransaction y lockRows
src/auth/           getAuthContext, guards (requireAuth, requireRole, requireOwnClient), login/refresh/logout
src/accounts/       casos de uso de clientes, logins y administradores
src/lib/            AppError y formato de error, CORS, clientes de Supabase, helpers de rutas
tests/              Vitest
```

## Endpoints

Todos devuelven errores como `{ error: { code, message } }` (401, 403, 404, 409, 422). La sesión viaja en `Authorization: Bearer <accessToken>`.

| Ruta | Quién |
|---|---|
| `GET /api/health` | público |
| `POST /api/auth/login`, `POST /api/auth/refresh` | público |
| `POST /api/auth/logout`, `GET /api/me` | cualquier usuario con sesión |
| `GET/POST /api/clients`, `GET/PATCH/DELETE /api/clients/:id`, `POST /api/clients/:id/{deactivate,reactivate}` | admin |
| `GET/POST /api/clients/:id/logins`, `PATCH/DELETE /api/logins/:id`, `POST /api/logins/:id/{deactivate,reactivate,password}` | admin |
| `GET/POST /api/admins`, `POST /api/admins/:id/{deactivate,reactivate}` | admin |

## Reglas que conviene recordar

- **Una transacción por caso de uso**: `withTransaction(fn)` hace rollback si `fn` lanza; `lockRows` hace `select … for update`.
- **El perfil se consulta en cada petición** (rol, `client_id`, `active`): desactivar o borrar un acceso surte efecto de inmediato. Un perfil inexistente o inactivo es 401.
- **Crear una cuenta son dos pasos** (Auth y `profiles`) sin transacción común: si falla el segundo se borra la cuenta de Auth (`createAccount`).
- **Reactivar un cliente no reactiva sus logins**, y un login nuevo de un cliente desactivado nace desactivado.
- **Con historial no se borra**: los `DELETE` devuelven 409 por la llave foránea `restrict`; solo se desactiva.
- El cliente no puede cambiar su contraseña: solo el admin le asigna una (`POST /api/logins/:id/password`).

## Esquema (Drizzle)

La base se migra con las SQL de `../supabase/migrations/`. Drizzle **no** genera ni aplica migraciones: `src/db/schema.ts` es un reflejo de la base obtenido con `npm run db:pull`.

Después de cada `db:pull` hay que reaplicar a mano dos ajustes en `schema.ts` y borrar lo que el comando genera de más:

1. Los valores por defecto vacíos salen como `.default(')`; deben ser `.default('')`.
2. Falta `auth.users` (el filtro solo trae `public`): reponer al inicio `const authSchema = pgSchema("auth")`, `export const usersInAuth = authSchema.table("users", { id: uuid().primaryKey() })` y `const users = usersInAuth`.
3. Borrar `src/db/0000_*.sql` y `src/db/meta/` (migraciones de Drizzle que no se usan).

## Pruebas

`npm test` corre Vitest contra la **base real** de `DATABASE_URL` (no hay base de pruebas separada todavía). Las pruebas con cuentas necesitan `SUPABASE_SERVICE_ROLE_KEY`; sin ella se omiten en silencio, así que `npm test` en verde sin esa llave no prueba autenticación ni cuentas.

`tests/routes-auth.test.ts` recorre todos los `app/api/**/route.ts` y exige 401 sin token; una ruta pública nueva debe agregarse a su conjunto `PUBLIC`.

Todo lo que crean lleva el prefijo `test-auth-` / `test-tx-` y se borra antes y después de cada suite (`tests/helpers/users.ts`). Si una corrida se interrumpe, la siguiente limpia los restos.
