# Spec técnico — T-32 · CI en GitHub Actions: build, arquitectura y pruebas

> **Estado:** Aprobado
> **Depende de:** M7-t31-configuracion-por-ambiente (`specs/M7-t31-configuracion-por-ambiente/spec.md`) — `API_BASE_URL` y `config:prepare` en los hooks `pre*`
> **Fecha:** 2026-11-09
> **Objetivo:** que cada PR y cada push a `main` compilen y prueben solos el frontend y el backend, incluida la suite del backend contra Supabase local en el runner, y que una falla bloquee el merge.

Fuentes:

- **Jira:** tarea `SCRUM-74 · T-32`, épica `SCRUM-13 · M7 · Pulido y publicación`. Depende de T-31 (`SCRUM-73`).
- **Código:**
  - `.github/workflows/claude.yml` y `claude-code-review.yml` (los únicos workflows de hoy).
  - `package.json` (`config:prepare`, `pre*`, `check:architecture`) y `angular.json` (`@angular/build:unit-test`).
  - `scripts/prepare-api-url.test.mjs`, `scripts/prepare-primeng-license.test.mjs`.
  - `backend/package.json`, `backend/vitest.config.ts` (lee `.env` si existe; sin él, usa el entorno), `backend/src/db/client.ts` (lanza `Falta DATABASE_URL` al importarse).
  - `backend/tests/helpers/users.ts` (`hasServiceKey`) y los 31 archivos con `describe.skipIf(!hasServiceKey)`.
  - `backend/.env.example` (llaves de demo de Supabase local, públicas e iguales en todas las máquinas).
  - `supabase/config.toml` (Postgres 17, puertos 54321/54322), `supabase/migrations/`, `supabase/seed.sql`; el bucket `product-photos` se crea en una migración.
- **Estado del repo (2026-11-09):** público; `main` sin protección; el único secret es `CLAUDE_CODE_OAUTH_TOKEN` (falta `PRIMENG_LICENSE_KEY`); Supabase CLI `2.122.0` en `package-lock.json`; Node local `v24`.
- **Decisiones del usuario del 2026-11-09:** ver §9.

## 1. Por qué existe este spec

Hoy el build y las pruebas solo corren si alguien se acuerda de correrlos en su máquina. Un PR puede llegar a `main` con el build roto, una frontera de capas rota o una prueba en rojo.

Además, las pruebas del backend se saltan en silencio cuando falta `SUPABASE_SERVICE_ROLE_KEY`: una corrida «verde» no prueba nada de cuentas. En CI eso no debe pasar sin que se note.

La revisión del 2026-11-09 encontró que la suite completa del backend puede correr en el runner sin secrets: Supabase local usa llaves de demo públicas, ya escritas en `backend/.env.example`. Así se prueba contra una base desechable y **nunca contra producción**.

## 2. Alcance

**Entra en este spec:**

- **Workflow nuevo `.github/workflows/ci.yml`** con tres jobs en paralelo (§3):
  - `frontend`: instalar, `config:prepare` (con el secret `PRIMENG_LICENSE_KEY`), pruebas de `scripts/`, `ng build`, `check:architecture` y `ng test`.
  - `backend`: instalar, `type-check`, `build` y `tests/architecture.test.ts`.
  - `backend-db`: Supabase local en el runner y la suite completa del backend (`npm test`), con aviso de pruebas saltadas.
- **`.nvmrc`** en la raíz con `24`. Los tres jobs leen la versión de ahí.
- **Caché de npm** con `actions/setup-node` (`cache: npm`) sobre los dos `package-lock.json`.
- **`concurrency`**: un push nuevo cancela el run anterior de la misma rama o PR.
- **Comando de protección de `main`** (§3.6). Lo corre el usuario después del primer run verde; el spec trae el comando exacto.
- **Documentación:**
  - `README.md` de la raíz: sección «CI» (qué corre, el secret que hay que crear y cómo activar la protección).
  - `CLAUDE.md` y `AGENTS.md`: una línea en «Commands» que nombre `ci.yml`, sus tres jobs y que `backend-db` usa Supabase local. Sincronizados entre sí.
  - `specs/README.md` y sincronizar `SCRUM-74`.

**No entra en este spec:**

- **Publicar** en Vercel o desplegar desde CI: T-33 (`SCRUM-75`).
- **Pruebas contra producción** desde CI, de ningún tipo.
- **Cambiar pruebas** con commit, `vitest.config.ts`, `hasServiceKey` o los `describe.skipIf`. El aviso de saltadas vive solo en el workflow.
- **Lint o formato** (`prettier --check`): no hay script de lint hoy.
- **Pruebas end-to-end** en navegador.
- **Cambiar los workflows de Claude** (`claude.yml`, `claude-code-review.yml`). No son checks obligatorios.
- **Caché de `.angular/cache`** o de las imágenes Docker de Supabase. Se agrega en otro spec si los tiempos de §3.5 no se cumplen.
- **Revisiones obligatorias** en la protección de `main` (el usuario trabaja solo).
- **Dependabot, CodeQL** u otros análisis de seguridad.
- **Subir Supabase CLI** a la v3: el workflow usa la misma versión que `package-lock.json`.

## 3. Reglas

### 3.1 Disparadores y permisos

```yaml
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

- `name: CI` en el workflow. Los nombres de los jobs (`frontend`, `backend`, `backend-db`) son los checks que pide la protección (§3.6). No se cambian sin actualizar la regla.
- Cada job empieza con `actions/checkout@v4` y `actions/setup-node@v4` con `node-version-file: .nvmrc` y `cache: npm`.

### 3.2 Job `frontend`

`cache-dependency-path: package-lock.json`. Pasos, en este orden:

1. `npm ci`.
2. `npm run config:prepare`, con `env` **solo en este paso**:
   - `PRIMENG_LICENSE_KEY: ${{ secrets.PRIMENG_LICENSE_KEY }}`. GitHub enmascara el valor; el script de T-31/M3-t01 no lo imprime.
   - `API_BASE_URL: http://localhost:3000`. Basta para compilar y probar; las pruebas no llaman a la API.
   - Si falta el secret, el script falla con su propio mensaje y el job queda en rojo.
3. `node --test scripts/*.test.mjs` (en Node 24 la carpeta sola falla, ver T-31 §7).
4. `npx ng build`. Se llama directo porque el paso 2 ya generó los archivos; `npm run build` repetiría `config:prepare` sin el secret.
5. `npm run check:architecture`.
6. `npx ng test --watch=false`.

### 3.3 Job `backend`

`working-directory: backend` y `cache-dependency-path: backend/package-lock.json`. `env` del job:

- `DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`. `next build` importa `src/db/client.ts`, que lanza sin la variable. `postgres` no conecta al importar, así que no hace falta una base viva.

Pasos:

1. `npm ci`.
2. `npm run type-check`.
3. `npm run build`.
4. `npx vitest run tests/architecture.test.ts`.

### 3.4 Job `backend-db`

`working-directory: backend` en los pasos de npm. `env` del job, con los valores de demo de Supabase local que ya están en `backend/.env.example` (no son secretos):

- `DATABASE_URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `SUPABASE_URL: http://127.0.0.1:54321`
- `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`: los JWT de demo de `backend/.env.example`, copiados tal cual.
- `ALLOWED_ORIGINS: http://localhost:4200`

Pasos:

1. `supabase/setup-cli@v1` con `version: 2.122.0` (la de `package-lock.json`). No se instala el `node_modules` de la raíz solo para tener la CLI.
2. **Guardia de producción.** Un paso que falla con `::error::` si `DATABASE_URL` no apunta a `127.0.0.1:54322` o si `SUPABASE_URL` no es `http://127.0.0.1:54321`. Así nadie puede apuntar el CI a producción cambiando una variable.
3. **Guardia de la llave.** Un paso que falla con `::error::Falta SUPABASE_SERVICE_ROLE_KEY: las pruebas con cuentas se saltarían.` si la variable está vacía.
4. `supabase start -x <servicios>` desde la raíz del repo. Levanta Postgres, Auth, REST y Storage, y aplica `supabase/migrations` y `supabase/seed.sql` (lo mismo que `db reset`).
   - Se excluyen los servicios que las pruebas no usan: Studio, imgproxy, el buzón de correo, edge runtime, logflare, vector, realtime, supavisor y postgres-meta.
   - Los nombres exactos para `-x` se confirman con `supabase start --help` de la versión `2.122.0` (el buzón puede llamarse `mailpit` o `inbucket`).
   - Storage se queda: `products-photo.test.ts` sube al bucket `product-photos`.
5. `npm ci`.
6. `npx vitest run --reporter=default --reporter=json --outputFile=vitest-results.json`. Corre toda la suite, incluida `architecture.test.ts`.
7. **Aviso de saltadas** (`if: always()`, después del paso 6). Lee `numPendingTests` y `numTodoTests` de `vitest-results.json` con `jq`:
   - Si suman más de 0: `::warning::N pruebas del backend se saltaron` y la misma línea en `$GITHUB_STEP_SUMMARY`.
   - Si el archivo no existe (las pruebas no llegaron a correr): no imprime nada; el paso 6 ya está en rojo.
   - Con la llave definida se esperan 0 saltadas: hoy no hay `it.skip` ni `it.todo` en `backend/tests`.
8. `supabase stop --no-backup` con `if: always()`.

### 3.5 Tiempos y caché

- Cada job lleva `timeout-minutes: 15`.
- Los pasos largos (`ng build`, `ng test`, `npm run build` del backend, `supabase start`, la suite del backend) llevan `timeout-minutes: 10`. Si uno pasa de 10 minutos, el paso falla en vez de colgarse.
- `actions/setup-node` con `cache: npm` guarda `~/.npm` por `package-lock.json`, y `npm ci` instala desde ahí. **No** se guarda `node_modules`: `npm ci` lo borra al empezar.

### 3.6 Protección de `main`

La regla la activa el usuario a mano, **después del primer run verde de `ci.yml` en el PR de este spec**, porque GitHub solo ofrece como obligatorios los checks que ya corrieron.

Comando (lo corre el usuario):

```bash
gh api -X PUT repos/fernandojavascrip21-dot/mamut-admin/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["frontend", "backend", "backend-db"] },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null
}
JSON
```

- `strict: true`: la rama del PR debe estar al día con `main` antes del merge.
- `enforce_admins: true`: el dueño del repo tampoco puede saltarse los checks. Coincide con «no se hace commit directo en `main`».
- Sin revisiones obligatorias.
- Verificación: `gh api repos/fernandojavascrip21-dot/mamut-admin/branches/main/protection --jq '.required_status_checks.contexts'` devuelve los tres nombres.

### 3.7 Secret `PRIMENG_LICENSE_KEY`

El usuario lo crea antes del primer run:

```bash
gh secret set PRIMENG_LICENSE_KEY   # pega el valor cuando lo pida; no queda en el historial de la terminal
```

- Nadie lo escribe en el workflow, en un log ni en un archivo con commit.
- Los PR desde forks no reciben secrets, así que su job `frontend` falla. Se acepta: el repo tiene un solo autor (§10).

## 4. Modelo de datos

No hay datos, tablas ni endpoints nuevos. Cambian archivos de configuración y documentación:

| Archivo | Cambio |
|---|---|
| `.github/workflows/ci.yml` | Nuevo (§3). |
| `.nvmrc` | Nuevo, con `24`. |
| `README.md` | Sección «CI». |
| `CLAUDE.md`, `AGENTS.md` | Línea sobre `ci.yml` en «Commands». |
| `specs/README.md` | Fila, relación con T-31 y área M7. |

Fuera del repo (los hace el usuario): el secret `PRIMENG_LICENSE_KEY` (§3.7) y la protección de `main` (§3.6).

## 5. Plan de implementación

Cada paso deja el repo funcionando.

1. **`.nvmrc`.** Crear el archivo con `24`. `node -v` local sigue en 24.
2. **Job `frontend`.** Escribir `ci.yml` con disparadores, permisos, `concurrency` y el job de §3.2. Revisar el YAML con `npx --yes @action-validator/cli .github/workflows/ci.yml` o, si no está disponible, con `actionlint`. Reproducir sus pasos en local con las mismas variables.
3. **Job `backend`.** Agregar el job de §3.3. Reproducir en local `type-check`, `build` (con el `DATABASE_URL` local) y `tests/architecture.test.ts`.
4. **Job `backend-db`.** Agregar el job de §3.4. Confirmar los nombres de `-x` con `npx supabase start --help`. En local, con Docker: `supabase start -x …`, la suite con las variables del job y el reporte JSON; comprobar que `jq` lee `numPendingTests` en 0.
5. **Documentación.** Sección «CI» en `README.md` y la línea en `CLAUDE.md` y `AGENTS.md`.
6. **Primer run.** El usuario crea el secret (§3.7) y hace push de la rama; se abre el PR. Los tres jobs quedan en verde y cada paso tarda menos de 10 minutos.
7. **Protección.** El usuario corre el comando de §3.6 y la verificación.
8. **Cierre.** `specs/README.md` y comentario en `SCRUM-74` con ✅/❌ por criterio. La tarea se mueve En curso → In review.

## 6. Interfaz

No hay cambios de interfaz. Lo nuevo se ve en la pestaña «Checks» de cada PR y en «Actions».

## 7. Criterios de aceptación

- [ ] `.github/workflows/ci.yml` corre en cada `pull_request` y en cada push a `main`, con los jobs `frontend`, `backend` y `backend-db`.
- [ ] `frontend` corre `npm ci`, `config:prepare` con `PRIMENG_LICENSE_KEY` desde secrets, `node --test scripts/*.test.mjs`, `ng build`, `check:architecture` y `ng test --watch=false`.
- [ ] El valor de `PRIMENG_LICENSE_KEY` no aparece en ningún log del run ni en un archivo con commit.
- [ ] `backend` corre `npm ci`, `type-check`, `build` y `tests/architecture.test.ts`.
- [ ] `backend-db` levanta Supabase local en el runner y corre toda la suite del backend contra `127.0.0.1:54322`, sin ningún secret.
- [ ] Si `DATABASE_URL` o `SUPABASE_URL` no apuntan a Supabase local, `backend-db` falla antes de correr pruebas.
- [ ] Si `SUPABASE_SERVICE_ROLE_KEY` está vacía, `backend-db` falla con `::error::` antes de correr pruebas.
- [ ] Si alguna prueba del backend se salta, el run muestra `::warning::` con el número y lo repite en el resumen del job.
- [ ] En el run del PR de este spec, `backend-db` reporta 0 pruebas saltadas.
- [ ] Una prueba en rojo, un build roto o una frontera de capas rota dejan su job en rojo. Se comprueba con un commit temporal que rompa una prueba del frontend; ese commit se revierte antes del merge.
- [ ] Cada job tiene `timeout-minutes: 15`, los pasos largos `timeout-minutes: 10`, y en el run verde ningún paso pasa de 10 minutos.
- [ ] Los tres jobs usan `node-version-file: .nvmrc` y `cache: npm`; el segundo run muestra «Cache restored» en `setup-node`.
- [ ] Un segundo push a la misma rama cancela el run anterior.
- [ ] Con la protección activa, `gh api …/branches/main/protection` devuelve los checks `frontend`, `backend` y `backend-db`, y GitHub no deja hacer merge de un PR con uno en rojo.
- [ ] `README.md`, `CLAUDE.md` y `AGENTS.md` describen el CI; `CLAUDE.md` y `AGENTS.md` dicen lo mismo.
- [ ] Ninguna prueba con commit cambió.
- [ ] `specs/README.md` y `SCRUM-74` quedan actualizados.

## 8. Plan de pruebas

Este spec no agrega pruebas automáticas: lo que se prueba es el workflow.

**Antes del push (local):**

1. `npx --yes @action-validator/cli .github/workflows/ci.yml` (o `actionlint`) no marca errores.
2. Pasos de `frontend` con `API_BASE_URL=http://localhost:3000` y la licencia del `.env`: `npm run config:prepare`, `node --test scripts/*.test.mjs`, `npx ng build`, `npm run check:architecture`, `npx ng test --watch=false`.
3. Pasos de `backend` en `backend/`: `npm run type-check`, `DATABASE_URL=… npm run build`, `npx vitest run tests/architecture.test.ts`.
4. Pasos de `backend-db` con Docker y **el bloque LOCAL** de `backend/.env` (revisar antes cuál está activo): `npx supabase start -x …`, la suite con `--reporter=json` y el `jq` del aviso.

**En GitHub:**

1. Primer run del PR: tres jobs en verde, sin `::warning::` de saltadas.
2. Commit temporal que rompe un `expect` de una prueba del frontend: `frontend` en rojo; se revierte con otro commit.
3. Run manual de la guardia: en un commit temporal, vaciar `SUPABASE_SERVICE_ROLE_KEY` en el `env` del job; `backend-db` falla en la guardia. Se revierte.
4. Dos pushes seguidos: el primer run queda «Cancelled».
5. Tras activar la protección (§3.6), el botón de merge queda bloqueado mientras un check está en rojo o pendiente.

## 9. Decisiones

- **Sí:** las pruebas del backend con base corren en CI contra Supabase local en el runner (usuario, 2026-11-09; cierra el «Por decidir» de `SCRUM-74`).
  - Las llaves de demo son públicas e iguales en todas las máquinas, así que no hace falta ningún secret.
  - La base se crea y se borra en cada run; nunca se toca producción.
- **No:** correr en CI solo `architecture.test.ts` y dejar las de base para local. Un fallo de triggers, migraciones o cuentas llegaría a `main` sin verse.
- **Sí:** job `backend-db` aparte de `backend`. El build y el type-check dan respuesta en un par de minutos sin esperar a Docker, y cada falla dice dónde está.
- **Sí:** `supabase start` sin un `db reset` aparte. `start` ya aplica migraciones y semilla sobre una base vacía; `reset` repetiría lo mismo y sumaría tiempo. El criterio 4 de Jira se cumple igual.
- **Sí:** guardia que exige `127.0.0.1` en `DATABASE_URL` y `SUPABASE_URL`. Las pruebas escriben en la base; un error en una variable no debe poder llevarlas a producción.
- **Sí:** si falta la llave, `backend-db` **falla**; si alguna prueba se salta por otra razón, solo **avisa** (usuario). En CI la llave siempre existe, así que su falta solo puede ser un error del workflow.
- **No:** cambiar `hasServiceKey` o los `describe.skipIf`. Son pruebas con commit y en local siguen siendo útiles sin la llave.
- **Sí:** el aviso de saltadas se calcula con el reporte JSON de Vitest y `jq`, dentro del workflow. No agrega archivos ni dependencias.
- **Sí:** el usuario activa la protección de `main` con el comando del spec, después del primer run verde (usuario). Es un cambio fuera del repo y GitHub necesita que los checks hayan corrido una vez.
- **Sí:** `enforce_admins: true` y `strict: true`, sin revisiones obligatorias. El dueño tampoco salta los checks, y no hay un segundo revisor.
- **Sí:** `.nvmrc` con Node 24 (usuario). Una sola versión para local y CI.
- **Sí:** `node --test scripts/*.test.mjs` en el job `frontend` (usuario). Cuida los scripts que generan la licencia y la URL, y tarda segundos.
- **Sí:** `concurrency` con `cancel-in-progress` (usuario). No se gastan minutos en runs que ya no importan.
- **Sí:** caché de `~/.npm` con `setup-node`, no de `node_modules`. `npm ci` borra `node_modules` al empezar, así que guardarlo no sirve; el criterio 7 de Jira se cumple con la caché de npm.
- **Sí:** `ng build` y `ng test` directos después de un solo `config:prepare`. El secret queda solo en ese paso y no se repite en los hooks `pre*`.
- **Sí:** `supabase/setup-cli` fijado en `2.122.0`. Es la versión de `package-lock.json` y evita instalar el `node_modules` de la raíz en `backend-db`.
- **No:** imágenes Docker o `.angular/cache` en caché por ahora. Se agregan si los tiempos no se cumplen.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| `supabase start` tarda mucho en bajar las imágenes y pasa de 10 minutos | Se excluyen los servicios que no se usan. Si aun así no alcanza, un spec aparte agrega caché de imágenes. |
| Un nombre de servicio en `-x` no existe en `2.122.0` y `start` falla | El paso 4 del plan lo confirma con `supabase start --help` antes de escribirlo. |
| La suite del backend tarda más en el runner que en local (`fileParallelism: false`) | `timeout-minutes: 10` hace que falle en vez de colgarse. Si pasa, se parte la suite en otro spec. |
| PR desde un fork: no recibe `PRIMENG_LICENSE_KEY` y `frontend` falla | Se acepta: el repo tiene un solo autor. Se anota en la sección «CI» del `README.md`. |
| Se renombra un job y la protección pide un check que ya no existe, así que ningún PR puede entrar | §3.1 lo advierte. La sección «CI» del `README.md` dice que la regla se actualiza en el mismo cambio. |
| `enforce_admins` bloquea un arreglo urgente en `main` | El arreglo va por PR como todo lo demás. El dueño puede quitar la regla con `gh api -X DELETE …/protection` si hace falta. |
| Las llaves de demo dejan de servir en una versión nueva de la CLI | La versión queda fijada en `2.122.0`. Subirla es un cambio aparte. |
| Una prueba deja datos `test-auth-`/`test-tx-` si el job se corta | La base del runner se borra al terminar el job, así que no afecta a ningún otro run. |

## Lo que **no** entra en este spec

- Desplegar o publicar desde CI (T-33).
- Pruebas contra la base de producción.
- Cambios en pruebas con commit, `vitest.config.ts` o `hasServiceKey`.
- Lint, formato, end-to-end, Dependabot o CodeQL.
- Cambios en los workflows de Claude.
- Caché de imágenes Docker o de `.angular/cache`.
- Revisiones obligatorias en `main`.
- Subir Supabase CLI a la v3.
