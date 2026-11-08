# Spec técnico — T-25 · Base de la merma simple: bajar piezas de un vendedor o de la bodega con un motivo (backend)

> **Estado:** Aprobado
> **Depende de:** M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`) — saldos por trigger, `insertMovements` y signos (`shrinkage < 0`); M2-t10-base-vendedores (`specs/M2-t10-base-vendedores/spec.md`) — el vendedor es un `profiles` con `role = 'vendedor'`; M2-hu11-dejar-a-vendedor (`specs/M2-hu11-dejar-a-vendedor/spec.md`) — `stock_movements.request_id` y su índice único por titular; M2-hu12-retirar-a-vendedor (`specs/M2-hu12-retirar-a-vendedor/spec.md`) — patrón de idempotencia sobre los movimientos y saldos antes → después leídos de los movimientos
> **Fecha:** 2026-11-07
> **Objetivo:** que `POST /api/shrinkages` dé de baja en una sola fila de movimiento N piezas de un producto del stock de un vendedor activo o de la bodega, con uno de cuatro motivos, y que reintentar la misma petición no registre la merma dos veces.
>
> **Nota (2026-11-08):** código y pruebas listos en la rama `feat/base-merma-simple`. La migración pasa con `npm run db:reset`; `npm run type-check` y `npm test` pasan contra la base local (385 pruebas, con `SUPABASE_SERVICE_ROLE_KEY`). **Falta:** aplicar la migración a producción a mano en el SQL Editor y correr `db:pull` contra producción (paso 1). Las rutas `app/api/shrinkages/**` solo se revisaron con `type-check`; el `403` y los `422` se prueban en el caso de uso.

Fuentes:

- **Jira:** tarea `SCRUM-65 · T-25`, épica `SCRUM-12 · M6 · Merma simple`. Requerimientos RF-15, RNF-05. La consumen HU-25 (`SCRUM-66`, pantalla «Registrar merma») y HU-26 (`SCRUM-67`, la merma en el stock y el historial).
- **Confluence:** «Mockups y flujo de pantallas · MVP v1», pantalla 07 (simplificada: producto, piezas y motivo; sin nota, sin reporte semanal RF-16 ni confirmación del vendedor) y la tabla de movimientos (merma: baja el titular y el total).
- **Código:** `backend/src/stock/movements.ts` (`insertMovements`, `reason`, `requestId`), `backend/src/stock/holdings.ts` (`movementsOfRequest`, `balanceUpTo`), `backend/src/returns/returns.ts` (`createReturn`, `findReplay`, `getReturn`: el modelo a seguir), `backend/src/accounts/sellers.ts` (`getActiveSellerName`, `getSellerName`), `backend/src/products` (`findProduct`), `backend/app/api/fractions/route.ts` (forma de la ruta), `supabase/migrations/20261030000000_stock_movements_request_id.sql` (índice `stock_movements_request_holder_key`).
- **Decisiones del usuario del 2026-11-07** (§9). Cierran los «Por decidir» de `SCRUM-65`.

## 1. Por qué existe este spec

El tipo `shrinkage` existe en `stock_movements` desde T-07, pero nada lo usa fuera de las pruebas. La épica decidió el 2026-11-07 que la merma simple aplica al vendedor **y** a la bodega.

La tabla vieja `shrinkage` del baseline no sirve: está atada a `clients`/`consignment_items` (dominio del repo hermano) y vive en la base de producción compartida con ese repo, así que cambiarla podría romperlo. En cambio, una merma es **una sola fila** de un solo titular, así que la columna `stock_movements.reason` y el `request_id` de HU-11 (con su índice único por `(request_id, holder_profile_id)`) bastan para guardar el motivo y hacerla idempotente, sin tabla nueva.

## 2. Alcance

**Entra en este spec:**

- **Base:** migración `supabase/migrations/20261107000001_stock_movements_shrinkage_reason.sql` con el check `stock_movements_shrinkage_reason_check` (§4).
- **Backend:**
  - Módulo nuevo `backend/src/shrinkage/` (`index.ts`, `constants.ts`, `types.ts`, `shrinkage.ts`) con alias `@shrinkage` en `backend/tsconfig.json`.
  - Caso de uso `createShrinkage(input, actor)`: exige rol administrador (`403` si no), valida, inserta un movimiento `shrinkage` con `insertMovements` y responde la merma con el stock del titular antes → después.
  - Caso de uso `getShrinkage(requestId, actor)`, de solo lectura y solo administrador, para releer una merma si se perdió la respuesta.
  - Función nueva `movementOfShrinkage(requestId)` en `backend/src/stock/holdings.ts` (exportada por `@stock`), hermana de `movementsOfRequest`, que lee la fila y su saldo con `balanceUpTo`.
  - Rutas `backend/app/api/shrinkages/route.ts` (`POST`) y `backend/app/api/shrinkages/[requestId]/route.ts` (`GET`), solo administrador.
  - `backend/src/db/schema.ts` regenerado con `db:pull` y sus fixups de `CLAUDE.md` (solo cambia el check).
- **Pruebas** contra la base real: archivo nuevo `backend/tests/shrinkage.test.ts` (§7). Los tests que ya tienen commit no se tocan.

**No entra en este spec:**

- La pantalla «Registrar merma» y sus entradas desde «Stock general» (HU-25).
- La merma en el stock, en el historial del vendedor o de la bodega, y una lista `GET /api/shrinkages` (HU-26).
- Anular una merma (`shrinkage_void`): el tipo existe, pero no hay caso de uso ni ruta en este spec.
- Varios productos en una sola merma.
- Nota o texto libre (también para «Otro»).
- Guardar el costo del momento de la merma; el reporte «merma de la semana» (RF-16) y el reporte del vendedor con confirmación (v2).
- Cambios en la tabla vieja `shrinkage`, en `supabase/seed.sql`, en el frontend o en otros módulos (entregas, retiros, ventas, cortes, fraccionado).

## 3. Reglas de negocio

- **Quién:** solo el **administrador** registra y relee mermas. Un vendedor recibe `403`.
- **De quién (`holderProfileId`):**
  - `null` → la **bodega**. Siempre se permite.
  - UUID de un **vendedor activo** (`getActiveSellerName`). Un vendedor desactivado, un perfil que no es vendedor (p. ej. un administrador) o un UUID inexistente → `404`. Igual que «Retirar» (HU-12).
  - Un valor que no es `null` ni UUID → `422`.
- **Qué producto (`productId`):** cualquier producto existente, **también desactivado** (`findProduct`, como en «Retirar»): sus piezas siguen existiendo y hay que poder darlas de baja. Inexistente → `404`.
- **Piezas (`qty`):** entero de **1 a `MAX_QTY`** (2 147 483 647, el máximo de un `integer`). Decimal, `0`, negativo o mayor → `422`.
- **Piezas suficientes:** si el titular tiene menos piezas que `qty` (o nunca tuvo el producto) → `409` «No hay piezas suficientes». Lo lanza `insertMovements` al rechazar el trigger el saldo negativo; no queda nada escrito.
- **Motivo (`reason`), uno de cuatro códigos fijos:**

  | Código | Etiqueta (la manda el backend) |
  | --- | --- |
  | `lost` | Se perdió |
  | `damaged` | Dañado |
  | `expired` | Caducó |
  | `other` | Otro |

  Falta o es otro valor → `422`. Es obligatorio en el caso de uso; la base solo rechaza un código inválido (§4).
- **Movimiento:** una sola fila `shrinkage`, `qty = -N`, `holder_profile_id` = el titular, `reason` = el código, `request_id` = el de la petición. Baja el stock del titular y el total; con un vendedor, la bodega no cambia.
- **Idempotencia (`requestId`, UUID en minúsculas, patrón de HU-12):**
  - Primera vez → `201`.
  - Mismo `requestId` con el mismo titular, producto, piezas y motivo → `200` con la misma merma y `replayed: true`; no se mueve nada.
  - Mismo `requestId` con otro titular, producto, piezas o motivo → `409` «Esta merma ya se registró con otros datos.».
  - Un `requestId` que ya usó una entrega o un retiro → `409` con el mismo mensaje (choca con el índice único o no es una fila `shrinkage`).
  - Dos peticiones a la vez con el mismo `requestId`: dentro de la transacción se toma `pg_advisory_xact_lock(hashtext(requestId))` y se vuelve a buscar la repetición antes de insertar. Así se cubre también el caso que el índice no ve (mismo `requestId` con **otro** titular, que no choca en `(request_id, holder_profile_id)`).
- **Saldos de la respuesta:** `stock.before`/`stock.after` del titular se leen de los movimientos (`balanceUpTo` hasta esa fila), no de la caché actual, para que un `GET` posterior o una repetición den lo mismo que el primer `POST`.

## 4. Modelo de datos

Migración `supabase/migrations/20261107000001_stock_movements_shrinkage_reason.sql`:

```sql
-- T-25: el motivo de una merma es uno de cuatro códigos. Solo valida si viene: los movimientos
-- `shrinkage` sin motivo (anteriores o de pruebas) siguen siendo válidos; el caso de uso lo exige.
alter table public.stock_movements
  add constraint stock_movements_shrinkage_reason_check
  check (
    type <> 'shrinkage'
    or reason is null
    or reason in ('lost', 'damaged', 'expired', 'other')
  );
```

Sin tablas ni columnas nuevas: se usan `stock_movements.reason` (texto, ya existe) y `stock_movements.request_id` (HU-11).

Tipos del backend (`backend/src/shrinkage/types.ts`, exportados desde `index.ts`; `shrinkage.ts` solo declara funciones):

```ts
export type ShrinkageReason = 'lost' | 'damaged' | 'expired' | 'other'

export interface CreateShrinkageInput {
  requestId: string                 // UUID en minúsculas
  holderProfileId: string | null    // null = bodega
  productId: number
  qty: number                       // 1..MAX_QTY, en positivo
  reason: ShrinkageReason
}

export interface Shrinkage {
  requestId: string
  createdAt: string
  qty: number                       // en positivo: piezas que se dieron de baja
  reason: ShrinkageReason
  reasonLabel: string               // «Dañado»
  holder: { id: string; fullName: string } | null   // null = bodega
  product: { id: number; name: string; image: string | null }
  stock: { before: number; after: number }          // del titular
}
```

Lectura en `backend/src/stock/holdings.ts`:

```ts
export interface ShrinkageMovement {
  requestId: string
  createdAt: string
  productId: number
  holderProfileId: string | null
  qty: number                       // en positivo
  reason: string | null
  stock: { before: number; after: number }
}

// La fila `shrinkage` de un requestId, con el saldo del titular hasta esa fila. null si no existe.
export async function movementOfShrinkage(requestId: string): Promise<ShrinkageMovement | null>
```

Respuestas:

- `POST /api/shrinkages` con `{ requestId, holderProfileId, productId, qty, reason }` → `201 { shrinkage, replayed: false }` o `200 { shrinkage, replayed: true }`.
- `GET /api/shrinkages/[requestId]` → `200 { shrinkage }`; `404` si no existe; `422` si no es UUID. El nombre del vendedor se lee con `getSellerName` (también desactivado: la merma ya hecha no desaparece).

Constantes en `backend/src/shrinkage/constants.ts`: `SHRINKAGE_REASONS` (código → etiqueta, en el orden de la tabla de §3), `MAX_QTY` y `SHRINKAGE_MISMATCH` («Esta merma ya se registró con otros datos.»).

## 5. Plan de implementación

1. **Migración.** Escribir `supabase/migrations/20261107000001_stock_movements_shrinkage_reason.sql` (§4) y comprobarla con `npm run db:reset`. Aplicarla a producción a mano en el SQL Editor: primero la revisión de solo lectura (el check no existe; `select count(*) from stock_movements where type = 'shrinkage' and reason is not null and reason not in ('lost','damaged','expired','other')` da `0`), luego la migración dentro de `begin; … commit;`, y la verificación (`select conname from pg_constraint where conname = 'stock_movements_shrinkage_reason_check'`). Correr `npm run db:pull` en `backend/` (con `.env` en PRODUCCIÓN) y aplicar los fixups de `CLAUDE.md`. `npm run type-check` y `npm test` pasan sin cambios.
2. **Lectura en `@stock`.** Agregar `ShrinkageMovement` y `movementOfShrinkage` a `backend/src/stock/holdings.ts` (reusa `balanceUpTo`). `npm run type-check` pasa.
3. **Módulo `shrinkage`.** Crear `backend/src/shrinkage/` (`index.ts`, `constants.ts`, `types.ts`, `shrinkage.ts`) y el alias `@shrinkage` en `backend/tsconfig.json`. `npm run type-check` pasa.
4. **`createShrinkage`.** Rechazar con `403` un actor que no es administrador (como `createFraction`); validar `qty` y `reason`; buscar la repetición (`movementOfShrinkage` + comparación) antes de nada; validar titular (`getActiveSellerName` si no es `null`) y producto (`findProduct`); en `withTransaction`: `pg_advisory_xact_lock(hashtext(requestId))`, volver a buscar la repetición e `insertMovements` con la fila `shrinkage`. Capturar `isUniqueViolation` como en `createReturn` (repetición o `409`). Armar la respuesta desde `movementOfShrinkage`.
5. **`getShrinkage` y rutas.** `app/api/shrinkages/route.ts` (`POST`: `requireRole(request, 'admin')`, `requestId` con `UUID`, `holderProfileId` `null` o UUID, `productId` y `qty` con `requireNumber`, `reason` con `requireString`) y `app/api/shrinkages/[requestId]/route.ts` (`GET` con `parseUuid`). Sin lógica de negocio en las rutas.
6. **Pruebas.** Escribir `backend/tests/shrinkage.test.ts` (§7) y correr `npm run type-check` y `npm test` con `SUPABASE_SERVICE_ROLE_KEY`.
7. **Índice y Jira.** Actualizar `specs/README.md` (estado y relaciones) y comentar el avance en `SCRUM-65` (paso del plan y ✅/❌/⏳ por criterio), moviéndola En curso → In review.

## 6. Criterios de aceptación

- [ ] La migración pasa con `npm run db:reset` y en producción deja `stock_movements_shrinkage_reason_check`.
- [x] Con Luis (vendedor activo) con 6 piezas de un producto, una merma de 2 con motivo `damaged` inserta una fila `shrinkage` con `qty = -2`, `holder_profile_id` = Luis, `reason = 'damaged'` y el `request_id` de la petición; Luis queda en 4, la bodega no cambia y el total baja 2 (criterio 1 de `SCRUM-65`).
- [x] Con 10 piezas en bodega, una merma de 3 con `holderProfileId = null` deja la bodega en 7 y el total baja 3 (criterio 2).
- [x] La respuesta del `POST` trae `qty`, `reason`, `reasonLabel` («Dañado»), `holder` (`null` para la bodega), `product` y `stock: { before, after }` correctos (6 → 4; 10 → 7).
- [x] Pedir más piezas de las que tiene el titular (o un producto que nunca tuvo) → `409` «No hay piezas suficientes» y ninguna fila nueva en `stock_movements` (criterio 3).
- [x] `qty` de `0`, `-1`, `2.5` o mayor que `MAX_QTY`, `reason` ausente o fuera de los cuatro códigos, `holderProfileId` que no es `null` ni UUID o `requestId` que no es UUID → `422`; producto inexistente → `404` (criterio 4).
- [x] Vendedor desactivado, perfil de administrador o UUID inexistente como `holderProfileId` → `404`; un producto desactivado sí se puede mermar.
- [x] Un vendedor que llama al `POST` o al `GET` → `403` (criterio 5).
- [x] Repetir el mismo `requestId` con los mismos datos responde `200`, `replayed: true`, los mismos saldos y no mueve piezas; con otro titular, producto, piezas o motivo responde `409` «Esta merma ya se registró con otros datos.»; con el `requestId` de un retiro responde `409` (criterio 6).
- [x] Dos `createShrinkage` iguales a la vez (`Promise.all`) dejan una sola fila `shrinkage`; dos con el mismo `requestId` y distinto titular a la vez dejan una sola fila y el otro recibe `409`.
- [x] `GET /api/shrinkages/[requestId]` devuelve la merma con los mismos saldos que el `POST`; uno inexistente da `404`.
- [x] Una fila `shrinkage` con `reason = 'robo'` insertada directo en la base falla por `stock_movements_shrinkage_reason_check`; una sin `reason` sigue pasando.
- [x] `npm run type-check`, `npm test` (con `SUPABASE_SERVICE_ROLE_KEY`) y `tests/architecture.test.ts` pasan, sin cambios en tests con commit (criterio 7).

## 7. Plan de pruebas

Contra la base real, saltadas sin `SUPABASE_SERVICE_ROLE_KEY` como el resto:

- **`backend/tests/shrinkage.test.ts`** (nuevo):
  - **Datos:** productos de prueba con prefijo `test-shr-` + `Date.now()` creados con `createProduct` (piezas iniciales en bodega), un vendedor activo y uno desactivado `test-auth-` (`createTestUser`), y piezas al vendedor con `createDelivery`.
  - **Casos:** uno por criterio de §6, llamando al caso de uso (`createShrinkage`, `getShrinkage`); el check de la base con un `insertMovements` directo. El `403` se prueba pasando un actor `{ userId, role: 'vendedor' }` al caso de uso, como en `fractions.test.ts`.
  - **Limpieza:** borra los movimientos de los productos de prueba del más nuevo al más viejo (revierte saldos), luego los productos, y `cleanupTestData()` de `tests/helpers/users.ts` para los vendedores.
- **Tests con commit:** `stock-movements.test.ts`, `fractions.test.ts` y `fraction-options.test.ts` insertan `shrinkage` sin `reason`; el check los deja pasar y no se tocan.
- **Arquitectura:** `tests/architecture.test.ts` sigue pasando sin cambios. Su mapa `ALIASES` no lista `@shrinkage` (tampoco `@fractions`), así que no revisa ese alias; agregarlo es tocar un test con commit y requiere aprobación del usuario.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La migración no está en producción cuando se despliega el backend | El caso de uso funciona igual sin el check (solo pierde la red de la base). Se aplica en el paso 1, antes del código, y queda anotado en `SCRUM-65` y en el índice. |
| `db push` no sirve en este proyecto (historia compartida con el repo hermano) | Se aplica a mano en el SQL Editor, como dice `CLAUDE.md`. Nunca `migration repair` ni `db pull` de Supabase. |
| Alguna fila `shrinkage` de producción ya trae un `reason` fuera de los cuatro códigos | La revisión de solo lectura del paso 1 lo detecta; si da más de `0`, se detiene y se consulta al usuario antes de aplicar. |
| El índice `(request_id, holder_profile_id)` no detecta el mismo `requestId` con otro titular | `pg_advisory_xact_lock(hashtext(requestId))` y la segunda búsqueda dentro de la transacción. Lo cubre una prueba. |
| La base no exige el motivo (el check solo valida si viene) | Solo `createShrinkage` crea mermas reales y lo exige; los tests con commit sin motivo siguen pasando (decisión del usuario, §9). |
| Sin costo del momento, el reporte de merma de v2 (RF-16) no tendrá el costo histórico | Aceptado (§9). Si RF-16 lo necesita, su spec agrega el dato. |
| `@shrinkage` sin revisión en `architecture.test.ts` | Los imports se escriben con el alias igual; se pide aprobación para agregarlo al mapa. |

## 9. Decisiones

- **Sí:** guardar la merma solo como movimiento: una fila `shrinkage` con `reason` y `request_id` (decisión del usuario). No hace falta tabla: una merma es una sola fila de un titular.
- **No:** tabla nueva `shrinkages` con el costo del momento y `stock_movements.shrinkage_id` (patrón de `fractions`). Más migración para un dato que la v1 no muestra.
- **No:** adaptar la tabla vieja `shrinkage`. Es del dominio del repo hermano, atada a `clients`, y la base de producción es compartida.
- **Sí:** cuatro motivos fijos `lost` / `damaged` / `expired` / `other` con etiquetas «Se perdió», «Dañado», «Caducó», «Otro» que manda el backend (decisión del usuario). Son los códigos del esquema viejo.
- **No:** texto libre para «Otro». El mockup simplificado quitó la nota.
- **Sí:** un producto por merma (decisión del usuario), como «Retirar».
- **Sí:** vendedor solo activo, bodega siempre, producto también desactivado (decisión del usuario), como «Retirar».
- **Sí:** `POST /api/shrinkages` y `GET /api/shrinkages/[requestId]` con el titular en el cuerpo (`holderProfileId`, `null` = bodega) (decisión del usuario). La lista del historial es de HU-26.
- **No:** rutas bajo `/api/sellers/[id]/…`. La bodega necesitaría otra ruta para lo mismo.
- **Sí:** respuesta con el stock del titular antes → después leído de los movimientos (decisión del usuario), como «Retirar».
- **Sí:** check `stock_movements_shrinkage_reason_check` que valida el motivo solo si viene (decisión del usuario, 2026-11-07). Un check estricto rompía seis inserciones `shrinkage` sin motivo en tres tests con commit.
- **No:** check estricto con desbloqueo de esos tests, ni quedarse sin check.
- **Sí:** módulo propio `src/shrinkage/` con alias `@shrinkage`. Es un flujo de inventario propio, como `returns` y `fractions`.
- **Sí:** `pg_advisory_xact_lock` por `requestId` para la concurrencia. El índice de HU-11 es por titular y no cubre el mismo `requestId` con otro titular.

## Lo que **no** entra en este spec

- Pantalla «Registrar merma» (HU-25).
- La merma en el stock y el historial, y la lista `GET /api/shrinkages` (HU-26).
- Anular una merma, varios productos a la vez, nota libre, costo del momento.
- Reporte de merma de la semana (RF-16) y reporte del vendedor con confirmación (v2).
- Cambios en la tabla vieja `shrinkage`, el seed, el frontend u otros módulos.
