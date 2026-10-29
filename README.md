# Mamut Admin

Panel de administración de inventario de **Mammut Supplements**.

- **Frontend** (raíz): Angular 22 con SSR y Tailwind v4 — http://localhost:4200
- **Backend** (`backend/`): Next.js, solo API — http://localhost:3000/api/health
- **Base de datos:** Supabase (Postgres + Auth + Storage). Hay dos opciones: la real (producción) y una de prueba en Docker.

## Requisitos

- Node.js y npm
- Docker Desktop, solo si vas a usar la base de prueba

## Primera vez (o en una máquina nueva)

```bash
git clone <url-del-repo> mamut-admin
cd mamut-admin
npm install
npm install --prefix backend
cp backend/.env.example backend/.env   # el bloque LOCAL ya viene listo
```

Con eso ya puedes trabajar con la base de prueba. Para conectarte a producción, completa en `backend/.env` el bloque **PRODUCCIÓN** con las llaves de Supabase (Project Settings → Database y Project Settings → API). Esas llaves nunca se suben a git.

## Día a día

Desde la raíz del proyecto, con Docker Desktop abierto:

```bash
npm run dev:all    # levanta la base de prueba en Docker y luego Angular (:4200) y el backend (:3000)
```

Equivale a correr estos dos, uno tras otro (también se pueden usar por separado):

```bash
npm run db:start   # levanta la base de prueba en Docker (si ya está arriba, no hace nada)
npm run dev        # levanta Angular (:4200) y el backend (:3000)
```

Entra a http://localhost:4200. Para terminar, `Ctrl+C` detiene la app. `npm run db:stop` apaga la base, pero es opcional: los datos se conservan.

## Base de prueba (Docker) vs. producción

`backend/.env` tiene dos bloques de conexión, **PRODUCCIÓN** y **LOCAL**. Deja activo uno y comenta el otro con `#` (en VS Code: selecciona las líneas y usa `Cmd+/`).

- **Usar la base de prueba:** bloque LOCAL activo y PRODUCCIÓN comentado, más `npm run db:start`.
- **Usar producción:** descomenta PRODUCCIÓN y comenta LOCAL. No hace falta Docker.

Después de cambiar de bloque, **reinicia** `npm run dev`. La variable `ALLOWED_ORIGINS`, al final del archivo, es común a los dos bloques y no se toca.

Para saber a cuál base estás conectado:

```bash
cd backend && npm run db:check
# categories: 5  → base de prueba (Docker)
# otro número    → producción
```

| Quiero… | Bloque activo |
| --- | --- |
| Desarrollar, probar, correr `npm test` | LOCAL |
| Probar una migración nueva | LOCAL |
| Ver o usar los datos reales | PRODUCCIÓN |
| Regenerar el esquema con `npm run db:pull` | PRODUCCIÓN |

> ⚠️ Con PRODUCCIÓN activa, `npm test` del backend escribe en la base real.

## Base de prueba (Docker)

Es el Supabase local oficial (Postgres, Auth, Storage, Studio y Mailpit), que el Supabase CLI levanta en Docker. No hay `docker-compose.yml`: la configuración de los contenedores está en `supabase/config.toml`.

| Comando (raíz) | Qué hace |
| --- | --- |
| `npm run db:start` | Levanta los contenedores. La primera vez descarga las imágenes, aplica las migraciones y carga el seed |
| `npm run db:stop` | Detiene los contenedores; los datos se conservan |
| `npm run db:reset` | Borra la base local y la recrea con migraciones y seed |
| `npm run db:status` | Muestra URLs y llaves locales |

- Studio (ver y editar datos): http://127.0.0.1:54323
- Correos de Auth (Mailpit): http://127.0.0.1:54324
- Postgres: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`

### Usuarios de prueba

Todos los datos de la base de prueba son inventados (`supabase/seed.sql`).

| Correo | Contraseña | Rol |
| --- | --- | --- |
| `admin@mammut.local` | `Admin-123456!` | admin |
| `vendedor1@mammut.local` | `Vendedor-123456!` | vendedor |
| `vendedor2@mammut.local` | `Vendedor-123456!` | vendedor |
| `inactivo@mammut.local` | `Vendedor-123456!` | vendedor desactivado (el login debe rechazarlo) |

También trae 5 categorías y 14 productos de ejemplo: uno archivado y dos fraccionables con su bolsita.

## Migraciones

Los cambios de esquema van como archivos SQL con fecha en `supabase/migrations/`.

1. Crea el `.sql` en `supabase/migrations/`.
2. Pruébalo en local con `npm run db:reset`.
3. Cuando funcione, aplícalo a producción.

`20261024000000_baseline_schema.sql` es una copia del esquema heredado de producción. Solo sirve para que la base de prueba se pueda construir desde cero. **No se aplica a producción.**

## Otros comandos

| Comando | Dónde | Qué hace |
| --- | --- | --- |
| `npm run dev:all` | raíz | Base de prueba en Docker (`db:start`) y luego frontend + backend (`dev`) |
| `npm start` | raíz | Solo el frontend (`ng serve`) |
| `npm run build` | raíz | Build de producción del frontend |
| `npm test` | raíz | Pruebas del frontend (Vitest) |
| `npm run dev` | `backend/` | Solo el backend |
| `npm test` | `backend/` | Pruebas del backend, contra la base activa en `.env` |
| `npm run type-check` | `backend/` | Revisión de tipos del backend |
| `npm run db:check` | `backend/` | Cuenta las categorías de la base activa |

Para generar un componente: `ng generate component <ruta>`. Las convenciones del proyecto están en `CLAUDE.md` y `AGENTS.md`.
