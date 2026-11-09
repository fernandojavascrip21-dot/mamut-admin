# Spec técnico — T-31 · Configuración por ambiente: URL de la API, variables y CORS

> **Estado:** Borrador
> **Depende de:** M0-base (`specs/M0-base/spec.md`) — `core/api-base-url.ts`, rutas `RenderMode.Client` y CORS por `ALLOWED_ORIGINS`; M3-t01-primeng-listas-dialogos (`specs/M3-t01-primeng-listas-dialogos/spec.md`) — patrón de `scripts/prepare-primeng-license.mjs` (archivo generado e ignorado por git)
> **Fecha:** 2026-11-09
> **Objetivo:** que el frontend tome la URL de la API de la variable `API_BASE_URL` al compilar, que el build falle si falta o no es válida, y que el backend y su documentación queden listos para un dominio público, sin cambiar el comportamiento en local.

Fuentes:

- **Jira:** tarea `SCRUM-73 · T-31`, épica `SCRUM-13 · M7 · Pulido y publicación`. La necesitan T-32 (CI, `SCRUM-74`) y T-33 (publicar en Vercel, `SCRUM-75`).
- **Código:**
  - `src/app/core/api-base-url.ts` (constante fija `http://localhost:3000`, importada por 21 archivos).
  - `src/app/app.routes.server.ts` (todas las rutas `RenderMode.Client`).
  - `scripts/prepare-primeng-license.mjs` y su prueba `scripts/prepare-primeng-license.test.mjs`.
  - `package.json` (hooks `pre*` → `ui:prepare`), `.gitignore`, `.env.example`.
  - `backend/src/lib/cors.ts`, `backend/proxy.ts`, `backend/tests/errors-cors.test.ts`.
  - `backend/.env.example`, `backend/README.md`, `backend/src/accounts/accounts.ts` (`admin.createUser`).
- **Decisiones del usuario del 2026-11-09:** ver §9.

## 1. Por qué existe este spec

Hoy la app solo funciona en `localhost`: la URL de la API está escrita en el código.

Para publicar (T-33) hace falta que cada ambiente diga a qué API llama, sin editar el código. Además, un build mal configurado no debe salir apuntando a `localhost` sin que nadie lo note.

La revisión del 2026-11-09 encontró tres cosas que achican el alcance:

- **El SSR nunca llama a la API.** Todas las rutas son `RenderMode.Client` (`app.routes.server.ts`), así que el servidor y el navegador no pueden usar URLs distintas.
- **El frontend no habla con Supabase.** El login y todo lo demás pasa por el backend.
- **Supabase Auth no necesita Site URL ni Redirect URLs.** Las cuentas se crean con `admin.createUser`, sin correos ni enlaces de confirmación.

## 2. Alcance

**Entra en este spec:**

- **Frontend:**
  - Script nuevo `scripts/prepare-api-url.mjs`. Lee `API_BASE_URL` del entorno o del `.env` de la raíz, la valida y genera `src/app/core/api-base-url.generated.ts`, que queda ignorado por git.
  - Su prueba `scripts/prepare-api-url.test.mjs`, con `node:test`, igual que la de la licencia.
  - `src/app/core/api-base-url.ts` reexporta `API_BASE_URL` desde el archivo generado. Los 21 archivos que la importan no cambian.
  - En `package.json`: scripts `api:prepare` y `config:prepare`. Los hooks `pre*` pasan a llamar a `config:prepare`; `ui:prepare` sigue existiendo.
  - `.gitignore` agrega el archivo generado. `.env.example` agrega `API_BASE_URL=http://localhost:3000`.
  - Si el `.env` local no tiene `API_BASE_URL`, se agrega esa línea, sin leer ni mostrar las demás variables.
- **Backend:**
  - `backend/.env.example`: `ALLOWED_ORIGINS=http://localhost:4200`, sin el puerto 5173 del Vue viejo.
  - `backend/README.md` se reescribe con el backend actual: quién lo consume, variables, scripts, pruebas y una sección «Despliegue».
- **Documentación:**
  - `README.md` de la raíz: sección «Variables de entorno» con la tabla de variables del frontend y del backend (nombres y para qué sirven, nunca valores), y qué hay que configurar en un ambiente público.
  - `CLAUDE.md` y `AGENTS.md`: `config:prepare` en lugar de `ui:prepare` en los comandos, y que CI debe definir `API_BASE_URL` además de `PRIMENG_LICENSE_KEY`.
  - Actualizar `specs/README.md` y sincronizar `SCRUM-73`.

**No entra en este spec:**

- **Publicar** en Vercel, crear sus proyectos o cargar sus variables: T-33 (`SCRUM-75`).
- **CI en GitHub Actions:** T-32 (`SCRUM-74`). Aquí solo se deja documentado que CI necesita `API_BASE_URL`.
- **Previews de Vercel:**
  - `ALLOWED_ORIGINS` sigue aceptando solo orígenes exactos.
  - `cors.ts` no acepta patrones con `*`.
  - Si los previews se desactivan o se agregan a mano, lo decide T-33.
- **Supabase Auth:** cambiar la Site URL o las Redirect URLs, porque no hay flujos por correo.
- **Cambios de código en el backend** (`cors.ts`, `proxy.ts`, rutas) **y nuevas pruebas de CORS:** el `403` de un origen no permitido ya está probado en `errors-cors.test.ts`.
- **Editar `backend/.env` local** (lleva secretos y bloques PRODUCCIÓN/LOCAL). Quitar el 5173 de ahí lo hace el usuario a mano.
- **Configuración en tiempo de ejecución** (un `config.json` que se descarga al abrir la app).
- **Elegir dominio propio o `*.vercel.app`:** T-33.

## 3. Reglas

### 3.1 Cómo se obtiene `API_BASE_URL`

1. Si la variable de proceso `API_BASE_URL` existe, gana, aunque esté vacía. Así, en CI o en Vercel una configuración incompleta se nota: es la misma regla que `PRIMENG_LICENSE_KEY`.
2. Si no existe, se lee `API_BASE_URL` del `.env` de la raíz con `parseEnv`.
3. Si `.env` no existe, se sigue como si la variable faltara. Si existe pero no se puede leer, falla con un mensaje propio, sin el error original.

### 3.2 Validación

- **Sin valor** (falta o queda vacía después de `trim`): el script falla con `Configura API_BASE_URL en el .env del frontend o en el entorno antes de compilar (por ejemplo http://localhost:3000).` y no genera archivo.
- **Debe ser una URL absoluta** con protocolo `http:` o `https:`. Si no lo es: `API_BASE_URL debe ser una URL absoluta http(s), por ejemplo https://api.ejemplo.com.`
- **`http:` solo se acepta** con host `localhost` o `127.0.0.1`. Con cualquier otro host: `API_BASE_URL debe usar https:// fuera de localhost.`
- **No lleva ruta, query ni fragmento** (solo origen). Si los trae: `API_BASE_URL debe ser solo el origen del backend, sin ruta (por ejemplo https://api.ejemplo.com).` Una `/` final sola se acepta y se quita.
- **Valor generado:** el origen normalizado (`new URL(valor).origin`), por ejemplo `https://mamut-api.vercel.app`.
- **Al fallar:** sale con `process.exitCode = 1` e imprime solo el mensaje propio, como el script de la licencia. Con eso se detienen los hooks `pre*` y, por tanto, `ng build`, `ng serve` y `ng test`.

### 3.3 Archivo generado

`src/app/core/api-base-url.generated.ts`:

```ts
// Archivo generado por npm run api:prepare. No versionar.
export const API_BASE_URL: string = "https://mamut-api.vercel.app";
```

- Se escribe con `JSON.stringify` y modo `0o600`, como la licencia.
- `core/api-base-url.ts` queda como un reexport con comentario:

  ```ts
  export { API_BASE_URL } from './api-base-url.generated';
  ```

- Sigue siendo la única puerta de entrada: ningún archivo importa el `.generated` directamente.

### 3.4 Scripts de `package.json`

```json
"ui:prepare": "node scripts/prepare-primeng-license.mjs",
"api:prepare": "node scripts/prepare-api-url.mjs",
"config:prepare": "npm run ui:prepare && npm run api:prepare",
"prestart": "npm run config:prepare",
"predev": "npm run config:prepare",
"prebuild": "npm run config:prepare",
"prewatch": "npm run config:prepare",
"pretest": "npm run config:prepare"
```

### 3.5 Backend y CORS

- `ALLOWED_ORIGINS` sigue siendo una lista exacta separada por comas. En producción tendrá el origen público del frontend; ese valor lo carga T-33 en Vercel, no va en el repo.
- `backend/.env.example` queda con `ALLOWED_ORIGINS=http://localhost:4200` y el comentario sin la referencia al Vue.

## 4. Modelo de datos

No hay datos, tablas ni endpoints nuevos. Cambian archivos de configuración:

| Archivo | Cambio |
|---|---|
| `scripts/prepare-api-url.mjs` | Nuevo (§3.1–§3.3). |
| `scripts/prepare-api-url.test.mjs` | Nuevo (§8). |
| `src/app/core/api-base-url.ts` | Reexport del generado. |
| `src/app/core/api-base-url.generated.ts` | Generado, ignorado por git. |
| `package.json` | `api:prepare`, `config:prepare` y hooks `pre*` (§3.4). |
| `.gitignore` | `/src/app/core/api-base-url.generated.ts`. |
| `.env.example` | `API_BASE_URL=http://localhost:3000` con comentario. |
| `.env` (local, no versionado) | Se agrega `API_BASE_URL=http://localhost:3000` si falta. |
| `backend/.env.example` | `ALLOWED_ORIGINS=http://localhost:4200`. |
| `backend/README.md` | Reescrito. |
| `README.md` | Sección «Variables de entorno». |
| `CLAUDE.md`, `AGENTS.md` | Comandos con `config:prepare` y la variable en CI. |

### Variables por proyecto (para la documentación)

| Proyecto | Variable | Uso | ¿Secreta? |
|---|---|---|---|
| Frontend | `PRIMENG_LICENSE_KEY` | Licencia de PrimeNG, se genera al compilar | No se versiona |
| Frontend | `API_BASE_URL` | Origen del backend, se genera al compilar | No |
| Backend | `DATABASE_URL` | Conexión a Postgres (Session pooler, 5432) | Sí |
| Backend | `SUPABASE_URL` | URL del proyecto Supabase | No |
| Backend | `SUPABASE_ANON_KEY` | Llave pública: valida tokens y hace login | No se versiona |
| Backend | `SUPABASE_SERVICE_ROLE_KEY` | Llave secreta: crea y edita cuentas | Sí |
| Backend | `ALLOWED_ORIGINS` | Orígenes exactos del frontend para CORS | No |

## 5. Plan de implementación

Cada paso deja la app compilando y con las pruebas en verde.

1. **Prueba del script.** Escribir `scripts/prepare-api-url.test.mjs` con los casos de §8. Fallan porque el script no existe.
2. **Script.** Escribir `scripts/prepare-api-url.mjs` (§3.1–§3.3), agregar el generado a `.gitignore` y la línea a `.env.example`. Agregar `API_BASE_URL=http://localhost:3000` al `.env` local si falta. `node --test scripts/` en verde.
3. **Conexión al build.** Agregar los scripts de §3.4 y cambiar `core/api-base-url.ts` al reexport. `npm run config:prepare`, `ng build`, `npm test` y `npm run check:architecture` en verde.
4. **Backend.** Ajustar `backend/.env.example` (§3.5) y reescribir `backend/README.md`.
5. **Documentación.** Sección «Variables de entorno» en `README.md` y comandos en `CLAUDE.md` y `AGENTS.md`, sincronizados entre sí.
6. **Verificación manual** (§8, último bloque).
7. **Cierre.** `specs/README.md` y comentario en `SCRUM-73` con ✅/❌ por criterio. La tarea se mueve En curso → In review.

## 6. Interfaz

No hay cambios de interfaz: la app se ve y se comporta igual. Solo cambia de dónde sale la URL de la API.

## 7. Criterios de aceptación

- [ ] Con `API_BASE_URL=http://localhost:3000` en `.env`, `npm start`, `npm test` y `npm run build` funcionan como hoy.
- [ ] Sin `API_BASE_URL` (ni en el entorno ni en `.env`), `npm run build` falla con el mensaje de §3.2 y no genera el archivo.
- [ ] `API_BASE_URL=http://api.ejemplo.com` (http fuera de localhost) hace fallar el build.
- [ ] `API_BASE_URL=https://api.ejemplo.com/v1` (con ruta) hace fallar el build.
- [ ] `API_BASE_URL=https://api.ejemplo.com/ npm run build` genera `https://api.ejemplo.com`, y el bundle del navegador en `dist/` contiene esa URL y no `localhost:3000`.
- [ ] Una variable de proceso vacía (`API_BASE_URL=`) gana sobre el `.env` y hace fallar el build.
- [ ] `src/app/core/api-base-url.generated.ts` está en `.gitignore` y no se versiona.
- [ ] Ningún archivo fuera de `core/api-base-url.ts` importa `api-base-url.generated`.
- [ ] `node --test scripts/`, `ng build`, `npm test` y `npm run check:architecture` pasan, sin modificar pruebas con commit.
- [ ] `backend/.env.example` ya no menciona 5173 ni el Vue.
- [ ] `backend/README.md` describe el backend de mamut-admin (sin Vue ni «SPEC 05»), con sus variables y una sección «Despliegue».
- [ ] `README.md` lista las variables de §4 sin valores reales.
- [ ] `CLAUDE.md` y `AGENTS.md` dicen `config:prepare` y piden `API_BASE_URL` en CI, con el mismo contenido.
- [ ] `specs/README.md` y `SCRUM-73` quedan actualizados.

## 8. Plan de pruebas

**`scripts/prepare-api-url.test.mjs`** (`node:test`, en un directorio temporal, aislado del `.env` real y de la variable del proceso, como la prueba de la licencia):

- Sin variable ni `.env`: sale con código ≠ 0, imprime el mensaje de §3.2 y no crea el archivo.
- Lee `API_BASE_URL` del `.env` cuando no hay variable de proceso.
- La variable de proceso gana sobre el `.env`.
- Una variable de proceso vacía gana y falla, aunque el `.env` tenga un valor.
- `http://localhost:3000` y `http://127.0.0.1:3000` se aceptan.
- `http://api.ejemplo.com` falla con el mensaje de https.
- `ftp://x` y `no-es-url` fallan con el mensaje de URL absoluta.
- `https://api.ejemplo.com/v1` y `https://api.ejemplo.com/?a=1` fallan con el mensaje de origen.
- `https://api.ejemplo.com/` genera `export const API_BASE_URL: string = "https://api.ejemplo.com";`.
- El archivo generado lleva la línea `// Archivo generado por npm run api:prepare. No versionar.`.
- Un error no imprime el valor recibido completo ni otras variables del `.env`.

**Pruebas existentes:** las 1476 del frontend usan `API_BASE_URL` importada. Siguen igual porque `pretest` genera el archivo con el valor de `.env`.

**Verificación manual:**

1. Quitar `API_BASE_URL` del `.env` y correr `npm run build`: falla con el mensaje. Volver a ponerla.
2. Correr `API_BASE_URL=https://api.ejemplo.com npm run build`. Buscar `api.ejemplo.com` en `dist/mamut-admin/browser/*.js`: aparece. `localhost:3000` no aparece.
3. Volver a `npm run config:prepare` con el `.env` normal, entrar con `npm run dev:all` y comprobar que el login y «Stock general» cargan.

## 9. Decisiones

- **Sí:** la URL se toma al compilar de `API_BASE_URL`, con un script que genera un archivo ignorado por git (usuario, 2026-11-09).
  - Sigue el patrón de la licencia de PrimeNG.
  - Cada ambiente de Vercel tiene su valor y la URL no queda en el repo.
- **No:** `environments` de Angular con `fileReplacements`. La URL de producción quedaría en el repo y los previews no podrían usar otra.
- **No:** `define` en `angular.json`. Tan fijo como `environments` y menos explícito.
- **No:** configuración en tiempo de ejecución (`config.json`). Agrega una petición al arrancar y un estado de carga más; no hace falta mientras cada ambiente tenga su propio build.
- **Sí:** si falta la variable, **falla el build** (usuario). Un frontend publicado nunca apunta a `localhost` por error. El costo es una línea en el `.env` local.
- **No:** usar `localhost:3000` por omisión. Ocultaría una configuración incompleta en Vercel o en CI.
- **Sí:** `http://` solo para `localhost` y `127.0.0.1`; fuera de ahí, `https://` (usuario). La sesión viaja en `Authorization: Bearer` y no debe ir sin cifrar.
- **Sí:** solo el origen, sin ruta. Todas las llamadas ya escriben `${API_BASE_URL}/api/...`; una ruta extra duplicaría segmentos.
- **Sí:** script aparte y `config:prepare` que corre los dos (usuario). Cada script tiene una responsabilidad y la prueba de la licencia, que ya tiene commit, no se toca.
- **No:** meter la URL en el script de la licencia. Mezcla dos responsabilidades y obliga a desbloquear su prueba.
- **Sí:** `ALLOWED_ORIGINS` solo con orígenes exactos; los previews los decide T-33 (usuario). Aceptar patrones con `*` abre más superficie de CORS sin una necesidad confirmada.
- **Sí:** quitar el 5173 del ejemplo y reescribir `backend/README.md` (usuario). Este backend solo atiende a mamut-admin.
- **No:** configurar la Site URL ni las Redirect URLs de Supabase. No hay flujos por correo (`admin.createUser`).
- **No:** pruebas nuevas de CORS. `errors-cors.test.ts` ya cubre el origen permitido, el no permitido y el preflight con `403`.

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Quien clone el repo no tiene `API_BASE_URL` y `npm start` falla | El mensaje dice qué poner. `.env.example` y el `README.md` lo documentan. |
| Vercel corre `ng build` directo, sin pasar por `npm run build`, y no se genera el archivo | T-33 configura el comando de build como `npm run build`. Queda anotado en «Despliegue» de `backend/README.md` y en el `README.md` raíz. |
| CI (T-32) no define `API_BASE_URL` y falla | Queda documentado en `CLAUDE.md`, `AGENTS.md` y `README.md`. T-32 la define como variable del workflow (`http://localhost:3000` basta para las pruebas). |
| Un IDE marca error en `api-base-url.ts` antes de la primera generación | Igual que con la licencia: se resuelve con `npm run config:prepare`. Se menciona en el `README.md`. |
| El valor de la variable aparece en un log de error | Los mensajes de §3.2 no repiten el valor y la prueba lo comprueba. |

## Lo que **no** entra en este spec

- Publicar en Vercel y cargar sus variables (T-33).
- El workflow de CI (T-32).
- Soporte de previews en CORS (patrones con `*`).
- Site URL y Redirect URLs de Supabase Auth.
- Cambios de código o pruebas en el backend.
- Editar `backend/.env` local.
- Configuración en tiempo de ejecución.
