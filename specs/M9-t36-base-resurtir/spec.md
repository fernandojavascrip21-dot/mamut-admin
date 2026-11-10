# Spec técnico — T-36 · Base de resurtir: pedidos guardados con fecha (backend)

> **Estado:** Implementado
> **Depende de:** M3-hu18-aviso-baja-existencia (`specs/M3-hu18-aviso-baja-existencia/spec.md`): `LOW_STOCK_THRESHOLD` y `stockLevel` los decide el backend. M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`): `products.stock` es la caché de la bodega que mantiene el trigger. M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`): el costo viaja como texto con 4 decimales. M5-t24-base-fraccionado (`specs/M5-t24-base-fraccionado/spec.md`): las bolsitas tienen `parent_product_id`, y es el patrón de tabla propia con `request_id` único. HU-27 «Entrada a bodega» (`SCRUM-77`, módulo `@purchases`, sin carpeta de spec) registra la mercancía que llega; este spec no la toca.
> **Fecha:** 2026-11-10
> **Objetivo:** que el administrador obtenga del backend los productos de la bodega con baja o nula existencia y guarde, edite, cierre y liste pedidos de resurtir con fecha, sin mover inventario.

Fuentes:

- **Jira:** tarea `SCRUM-87 · T-36`, épica `SCRUM-79 · M9 · Resurtir y exportar (v2)`. Requerimientos RF-19 y RF-20. La consumen HU-31 (`SCRUM-88`, lista editable) y HU-32 (`SCRUM-89`, exportar y pedidos anteriores).
- **Confluence:** «Plan v2» (página 5767169) y «Requerimientos» (RF-19, RF-20).
- **Código:**
  - `backend/src/stock/levels.ts` (`stockLevelOf`) y `backend/src/stock/constants.ts` (`LOW_STOCK_THRESHOLD = 2`).
  - `backend/src/stock/holdings.ts` (`lowStockLines`: el filtro de la bodega a seguir; `holdingsByProduct` no sirve porque omite los productos en 0 en todos lados).
  - `backend/src/purchases/purchases.ts` (`createPurchase`, `findReplay`, candado `pg_advisory_xact_lock`: el modelo a seguir).
  - `backend/src/products/products.ts` (`findProduct`).
  - `supabase/migrations/20261107000000_fractions.sql` (forma de la migración).
  - `supabase/migrations/20261024000000_baseline_schema.sql` (event trigger `rls_auto_enable`).
- **Decisiones del usuario del 2026-11-10** (§9). Cierran el «Por decidir» de `SCRUM-87`.

## 1. Por qué existe este spec

Hoy el administrador sabe qué se acaba por el aviso de baja existencia (HU-18), pero no tiene dónde armar el pedido al proveedor ni guardar los anteriores (RF-19, RF-20). Un pedido de resurtir **no es inventario**: es una lista de lo que se piensa pedir. Las piezas solo cambian cuando la mercancía llega y se registra con «Entrada a bodega» (HU-27). Por eso los pedidos van en tablas propias, sin `stock_movements`.

## 2. Alcance

**Entra en este spec:**

- **Base:** migración `supabase/migrations/20261110000000_restock_orders.sql` con las tablas `restock_orders` y `restock_order_lines` (§4).
- **Backend:**
  - Lectura nueva `restockCandidates()` en `backend/src/stock/holdings.ts`, exportada por `@stock`.
  - Módulo nuevo `backend/src/restock/` (`index.ts`, `constants.ts`, `types.ts`, `suggestions.ts`, `orders.ts`) con alias `@restock` en `backend/tsconfig.json`.
  - Casos de uso, todos **solo administrador**: `getRestockSuggestions`, `createRestockOrder`, `updateRestockOrder`, `closeRestockOrder`, `deleteRestockOrder`, `getRestockOrder`, `listRestockOrders`.
  - Rutas:
    - `backend/app/api/restock/suggestions/route.ts` (`GET`).
    - `backend/app/api/restock/orders/route.ts` (`GET` lista, `POST` crea).
    - `backend/app/api/restock/orders/[id]/route.ts` (`GET`, `PUT`, `DELETE`).
    - `backend/app/api/restock/orders/[id]/close/route.ts` (`POST`).
  - `backend/src/db/schema.ts` regenerado con `db:pull` y los fixups de `CLAUDE.md`.
- **Pruebas** contra la base real: archivo nuevo `backend/tests/restock.test.ts` (§7). No se toca ningún test que ya tenga commit.

**No entra en este spec:**

- Las pantallas «Lista de resurtir» (HU-31) y «Pedidos anteriores» con exportar (HU-32).
- Exportar a PDF o Excel. La decisión de si el archivo lleva costos es de HU-32.
- «Usar como base» un pedido cerrado para uno nuevo: lo arma el frontend de HU-32 con `POST` y los renglones del cerrado, sin endpoint propio.
- Un mínimo de reorden por producto (`products.reorder_min`), una cantidad sugerida y sugerencias sobre el total del negocio o sobre los vendedores.
- El proveedor como dato o catálogo (pendiente heredado de la v1).
- Recibir un pedido contra entradas a bodega, o que cerrar un pedido cree movimientos `purchase`.
- Reabrir un pedido cerrado.
- Cambios en `@purchases`, `@inventory`, `lowStockLines`, el aviso de baja existencia, el seed o el frontend.

## 3. Reglas de negocio

- **Quién:** solo el **administrador** usa cualquier caso de uso o ruta de este spec. Un vendedor recibe `403`.
- **Sugerencias (`GET /api/restock/suggestions`):**
  - Productos **activos**, que **no son bolsita** (`parent_product_id is null`) y cuya **bodega** (`products.stock`) tiene `LOW_STOCK_THRESHOLD` piezas o menos.
  - Cada sugerencia trae `units` (piezas en bodega), `stockLevel` (`'out'` con 0, `'low'` de 1 al umbral, con `stockLevelOf`) y `unitCost` (costo de fábrica actual, texto con 4 decimales).
  - No trae cantidad a pedir: la pone el administrador.
  - Las piezas de los vendedores no cuentan: un producto agotado en bodega aparece aunque un vendedor tenga piezas.
  - Orden igual que `lowStockLines`: agotados primero, luego por nombre (`localeCompare('es')`).
  - Es solo lectura y no depende de ningún pedido: un producto aparece aunque ya esté en un borrador.
- **Estados del pedido:** `draft` (borrador) y `closed` (cerrado). Se crea siempre en `draft`. Solo un borrador se edita, se cierra o se borra; uno cerrado responde `409` «Este pedido ya está cerrado.». No hay vuelta de `closed` a `draft`.
- **Renglones (`lines: { productId, qty }[]`):**
  - Producto existente (`404` si no), **activo** y que **no es bolsita**. Si no, `422` «Solo se piden productos activos que no son bolsita».
  - Un producto aparece **una sola vez** por pedido. Repetido, `422` «Un producto aparece dos veces en el pedido».
  - `qty` entero de **1 a `MAX_QTY`** (2 147 483 647). Si es decimal, `0`, negativo o mayor, `422`.
  - Máximo **`MAX_LINES` = 200** renglones por pedido. Más, `422`.
  - **Costo del momento:** al guardar un renglón nuevo se copia `products.unit_cost` en `restock_order_lines.unit_cost`. En un `PUT`, el renglón de un producto que ya estaba en el pedido conserva su costo guardado; uno que entra por primera vez toma el actual.
- **Vacíos:** un borrador puede tener 0 renglones; cerrarlo así responde `422` «No se puede cerrar un pedido sin productos».
- **Nota (`note`):** opcional, texto de 0 a 500 caracteres. `''` y solo espacios se guardan como `null`, y con más de 500 responde `422`. Se guarda recortada (`trim`).
- **Fecha:** `createdAt` (al crear), `updatedAt` (al crear y en cada `PUT`) y `closedAt` (al cerrar). La «fecha del pedido» que pintará el frontend es `createdAt`.
- **Idempotencia del alta (`requestId`, UUID en minúsculas, patrón de HU-27):**
  - La primera vez responde `201`.
  - El mismo `requestId` con la misma nota y los mismos renglones (mismos productos y piezas, sin importar el orden) responde `200` con el mismo pedido y `replayed: true`, sin crear otro.
  - El mismo `requestId` con otros datos responde `409` «Este pedido ya se registró con otros datos.».
  - Dos altas a la vez con el mismo `requestId`: `pg_advisory_xact_lock(hashtext(requestId))`, nueva búsqueda dentro de la transacción, y el índice único `restock_orders_request_id_key` como red.
- **Edición (`PUT`):** reemplaza la nota y **toda** la lista de renglones en una transacción, con el pedido bloqueado (`lockRows` / `select … for update`). Mismas validaciones que el alta. No lleva `requestId`: repetir el mismo `PUT` deja el mismo resultado.
- **Cerrar (`POST …/close`):** con el pedido bloqueado, pasa a `closed` con `closedAt = now()`. Cerrar uno ya cerrado responde `409`.
- **Borrar (`DELETE`):** solo un borrador, y se llevan sus renglones (`on delete cascade`). Uno cerrado responde `409` y uno inexistente `404`. Responde `204`.
- **Lista (`GET /api/restock/orders`):** los **50** más recientes por `createdAt` (más nuevo primero), borradores y cerrados, con totales por pedido (`lineCount`, `totalUnits`) y sin renglones. Opcional `?status=draft|closed`; otro valor responde `422`.
- **Detalle (`GET /api/restock/orders/[id]`):** el pedido con sus renglones en el orden en que se guardaron (`id` del renglón). Cada renglón trae `product` (nombre e imagen, aunque el producto se haya desactivado después), `qty` y `unitCost`. Un `id` que no es entero positivo responde `422` y uno inexistente `404`.
- **Inventario:** ningún caso de uso de este spec inserta en `stock_movements` ni toca saldos.

## 4. Modelo de datos

Migración `supabase/migrations/20261110000000_restock_orders.sql`:

```sql
-- T-36: pedidos de resurtir. Una lista de lo que se piensa pedir al proveedor; no mueve inventario
-- (la mercancía que llega se registra con «Entrada a bodega», HU-27). RLS la activa el event trigger
-- rls_auto_enable del baseline; el backend entra con la conexión directa.

create table public.restock_orders (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  status text not null default 'draft',
  note text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint restock_orders_request_id_key unique (request_id),
  constraint restock_orders_status_check check (status in ('draft', 'closed')),
  constraint restock_orders_closed_at_check check ((status = 'closed') = (closed_at is not null)),
  constraint restock_orders_note_check check (note is null or char_length(note) between 1 and 500)
);

create index restock_orders_created_at_idx on public.restock_orders (created_at desc);

create table public.restock_order_lines (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.restock_orders (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete restrict,
  qty integer not null check (qty > 0),
  unit_cost numeric(10,4) not null check (unit_cost >= 0),   -- costo de fábrica al agregar el renglón
  constraint restock_order_lines_product_key unique (order_id, product_id)
);
```

Tipos del backend (`backend/src/restock/types.ts`, exportados desde `index.ts`; los archivos de casos de uso solo declaran funciones):

```ts
export type RestockOrderStatus = 'draft' | 'closed'

export interface RestockActor { userId: string; role: string }

export interface RestockSuggestion {
  productId: number
  name: string
  image: string | null
  units: number                     // piezas en bodega
  stockLevel: 'low' | 'out'
  unitCost: string                  // costo de fábrica actual, «123.4500»
}

export interface RestockLineInput { productId: number; qty: number }

export interface CreateRestockOrderInput {
  requestId: string                 // UUID en minúsculas
  note: string | null
  lines: RestockLineInput[]
}

export interface UpdateRestockOrderInput {
  note: string | null
  lines: RestockLineInput[]
}

export interface RestockOrderLine {
  product: { id: number; name: string; image: string | null }
  qty: number
  unitCost: string
}

export interface RestockOrderSummary {
  id: number
  status: RestockOrderStatus
  note: string | null
  createdAt: string
  updatedAt: string
  closedAt: string | null
  lineCount: number
  totalUnits: number
}

export interface RestockOrder extends RestockOrderSummary {
  requestId: string
  lines: RestockOrderLine[]
}
```

Lectura en `backend/src/stock/holdings.ts`:

```ts
export interface RestockCandidate {
  productId: number
  name: string
  image: string | null
  units: number
  unitCost: string
}

// Productos activos que no son bolsita con LOW_STOCK_THRESHOLD piezas o menos en la bodega.
export async function restockCandidates(): Promise<RestockCandidate[]>
```

Respuestas:

| Ruta | Respuesta |
| --- | --- |
| `GET /api/restock/suggestions` | `200 { suggestions: RestockSuggestion[] }` |
| `GET /api/restock/orders[?status=]` | `200 { orders: RestockOrderSummary[] }` |
| `POST /api/restock/orders` con `{ requestId, note?, lines }` | `201 { order, replayed: false }` o `200 { order, replayed: true }` |
| `GET /api/restock/orders/[id]` | `200 { order }` |
| `PUT /api/restock/orders/[id]` con `{ note?, lines }` | `200 { order }` |
| `POST /api/restock/orders/[id]/close` | `200 { order }` |
| `DELETE /api/restock/orders/[id]` | `204` |

Constantes en `backend/src/restock/constants.ts`:

- `MAX_QTY`, `MAX_LINES` (200), `MAX_NOTE_LENGTH` (500), `LIST_LIMIT` (50).
- Mensajes: `ORDER_CLOSED` («Este pedido ya está cerrado.»), `ORDER_MISMATCH` («Este pedido ya se registró con otros datos.»), `EMPTY_ORDER` («No se puede cerrar un pedido sin productos»), `PRODUCT_NOT_ORDERABLE` («Solo se piden productos activos que no son bolsita»), `DUPLICATE_PRODUCT` («Un producto aparece dos veces en el pedido»).

## 5. Plan de implementación

1. **Migración.**
   - Escribir `supabase/migrations/20261110000000_restock_orders.sql` (§4) y comprobarla con `npm run db:reset`.
   - Aplicarla a producción a mano en el SQL Editor:
     - Revisión de solo lectura: `select to_regclass('public.restock_orders'), to_regclass('public.restock_order_lines')` da `null, null`, y `select 1 from public.products limit 1` responde.
     - La migración dentro de `begin; … commit;`.
     - Verificación: `select relname, relrowsecurity from pg_class where relname in ('restock_orders', 'restock_order_lines')` da dos filas con `true`.
   - Correr `npm run db:pull` en `backend/` (con `.env` en PRODUCCIÓN) y aplicar los fixups de `CLAUDE.md`.
   - Al terminar el paso, `npm run type-check` y `npm test` pasan sin cambios.
2. **Lectura en `@stock`.** Agregar `RestockCandidate` y `restockCandidates()` a `backend/src/stock/holdings.ts`: el mismo filtro de bodega de `lowStockLines`, más `parent_product_id is null` y `unit_cost`. `npm run type-check` pasa.
3. **Módulo `restock`.** Crear `backend/src/restock/` (`index.ts`, `constants.ts`, `types.ts`) y el alias `@restock` en `backend/tsconfig.json`. `npm run type-check` pasa.
4. **Sugerencias.** `getRestockSuggestions(actor)` en `suggestions.ts`: `403` si no es administrador (el chequeo vive en `restock/access.ts`, `requireAdmin`, compartido con `orders.ts`); mapear `restockCandidates()` con `stockLevelOf`; ordenar.
5. **Pedidos.** En `orders.ts`:
   - Una validación compartida de `note` y `lines`: tamaño, repetidos, `qty`, y producto activo y no bolsita con `findProduct`.
   - `createRestockOrder` con `findReplay` (comparación sin importar el orden), candado e `isUniqueViolation`, igual que `createPurchase`.
   - `updateRestockOrder`, `closeRestockOrder` y `deleteRestockOrder` con `withTransaction` y el pedido bloqueado (`lockRows`), y `409` si está cerrado.
   - `getRestockOrder` y `listRestockOrders` con `lineCount` y `totalUnits` calculados con `count()`/`sum()` en SQL.
6. **Rutas.** Las cuatro rutas de §2. Cada una con `requireRole(request, 'admin')`, `parseRouteId` para `[id]` (responde `422`, como pide §3; `parseId` respondería `404`), `requestId` con `UUID`, `optionalText` para `note` y validación de que `lines` sea un arreglo de objetos con `productId` y `qty` enteros. Sin lógica de negocio en las rutas.
7. **Pruebas.** Escribir `backend/tests/restock.test.ts` (§7) y correr `npm run type-check` y `npm test` con `SUPABASE_SERVICE_ROLE_KEY`.
8. **Índice y Jira.** Actualizar `specs/README.md` (estado y relaciones) y comentar el avance en `SCRUM-87` (paso del plan y ✅/❌/⏳ por criterio). Moverla En curso → In review.

## 6. Criterios de aceptación

- [ ] La migración pasa con `npm run db:reset` y, en producción, deja `restock_orders` y `restock_order_lines` con RLS activo.
- [ ] Con un producto A en 0, uno B con 2 y uno C con 3 piezas en bodega, las sugerencias traen A (`out`) y B (`low`), en ese orden, con `units` y `unitCost`, y no traen C.
- [ ] Un producto desactivado con 0 piezas y una bolsita con 1 pieza en bodega no aparecen en las sugerencias.
- [ ] Un producto con 0 en bodega y 5 piezas con un vendedor aparece en las sugerencias.
- [ ] `POST` con nota y dos renglones crea un pedido `draft` con `createdAt`, `updatedAt` y `closedAt: null`. Los renglones guardan el `unit_cost` que tenía el producto en ese momento, y cambiar después el costo del producto no cambia el del pedido.
- [ ] Ningún caso de uso de este spec agrega filas a `stock_movements`, ni cambia `products.stock` o `vendor_stock`.
- [ ] Repetir el `POST` con el mismo `requestId` y los mismos datos (renglones en otro orden) responde `200` y `replayed: true`, sin otro pedido. Con otros datos responde `409` «Este pedido ya se registró con otros datos.». Dos `POST` iguales a la vez (`Promise.all`) dejan un solo pedido.
- [ ] Responden `422`:
  - `qty` de `0`, `-1`, `2.5` o mayor que `MAX_QTY`.
  - Un producto repetido.
  - Más de 200 renglones.
  - Una nota de más de 500 caracteres.
  - Un producto desactivado o una bolsita.
  - Un `requestId` que no es UUID.
  
  Un producto inexistente responde `404`.
- [ ] `PUT` de un borrador reemplaza nota y renglones y actualiza `updatedAt`. Un renglón que ya estaba conserva su costo guardado aunque el producto haya cambiado de costo; uno nuevo toma el actual.
- [ ] `POST …/close` deja el pedido en `closed` con `closedAt`. Después, `PUT`, `DELETE` y otro cierre responden `409` «Este pedido ya está cerrado.».
- [ ] Cerrar un borrador sin renglones responde `422` «No se puede cerrar un pedido sin productos».
- [ ] `DELETE` de un borrador responde `204` y borra sus renglones. Uno inexistente responde `404`.
- [ ] `GET /api/restock/orders` trae a lo más 50 pedidos, el más nuevo primero, con `lineCount` y `totalUnits`. `?status=closed` trae solo los cerrados y `?status=otro` responde `422`.
- [ ] `GET /api/restock/orders/[id]` trae los renglones en el orden guardado, también si un producto se desactivó después. Un `id` inexistente responde `404`.
- [ ] Un vendedor que llama a cualquier caso de uso de este spec recibe `403`.
- [ ] `npm run type-check`, `npm test` (con `SUPABASE_SERVICE_ROLE_KEY`) y `tests/architecture.test.ts` pasan, sin cambios en tests con commit.

## 7. Plan de pruebas

Contra la base real. Como el resto, se saltan sin `SUPABASE_SERVICE_ROLE_KEY`.

- **`backend/tests/restock.test.ts`** (nuevo):
  - **Datos:**
    - Productos de prueba con prefijo `test-rst-` + `Date.now()`, creados con `createProduct` (piezas iniciales en bodega).
    - Una bolsita creada con `createFraction`.
    - Un producto desactivado.
    - Un vendedor activo `test-auth-` (`createTestUser`) con piezas por `createDelivery`.
  - **Casos:** uno por criterio de §6, llamando a los casos de uso.
    - Las sugerencias se filtran a los productos `test-rst-`: la base local puede tener otros productos con baja existencia.
    - El `403` se prueba pasando al caso de uso un actor `{ userId, role: 'vendedor' }`, como en `fractions.test.ts`.
  - **Limpieza:**
    - Primero los pedidos de prueba: `restock_order_lines` se va por cascada.
    - Luego los movimientos de los productos de prueba, del más nuevo al más viejo (revierte saldos), las fracciones y los productos.
    - Al final, `cleanupTestData()` para el vendedor.
- **Tests con commit:** ninguno cambia. `lowStockLines` y el aviso de baja existencia no se tocan.
- **Arquitectura:** `tests/architecture.test.ts` sigue pasando. Su mapa `ALIASES` no lista los alias de módulo nuevos (`@shrinkage`, `@purchases`), así que tampoco revisará `@restock`. Agregarlo es tocar un test con commit y requiere aprobación del usuario.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La migración no está en producción cuando se despliega el backend | Se aplica en el paso 1, antes del código, y queda anotada en `SCRUM-87` y en el índice. Sin las tablas, las rutas de pedidos responden 500; las sugerencias no dependen de ellas. |
| `db push` no sirve en este proyecto (historia compartida con el repo hermano) | Se aplica a mano en el SQL Editor, como dice `CLAUDE.md`. Nunca `migration repair` ni `db pull` de Supabase. |
| El event trigger `rls_auto_enable` no existe en producción y las tablas quedan expuestas a PostgREST | La verificación del paso 1 revisa `relrowsecurity`. Si da `false`, se agrega `alter table … enable row level security` antes de seguir y se avisa al usuario. |
| Dos `PUT` del mismo borrador a la vez mezclan renglones | `lockRows` sobre el pedido dentro de la transacción: el segundo espera y reemplaza todo. |
| Un producto se desactiva o se vuelve bolsita con un borrador abierto | El renglón guardado no cambia. El siguiente `PUT` que lo incluya responde `422`, y el frontend de HU-31 lo quita. |
| `parent_product_id` en un producto que ya estaba en un pedido | No pasa: `createFraction` crea la bolsita como producto nuevo. Lo cubre la regla de §3. |
| `@restock` sin revisión en `architecture.test.ts` | Los imports se escriben con el alias igual, y se pide aprobación para agregarlo al mapa. |

## 9. Decisiones

- **Sí:** sugerir con el umbral general (`LOW_STOCK_THRESHOLD`, `stockLevel` `low`/`out`), sin columnas nuevas en `products` (decisión del usuario).
- **No:** mínimo de reorden por producto. Más migración y cambios en el formulario de producto. Queda para otro spec si hace falta.
- **Sí:** calcular sobre las piezas de la **bodega** solamente (decisión del usuario, como dice `SCRUM-87`).
- **No:** el total del negocio (bodega más vendedores).
- **Sí:** excluir desactivados y bolsitas, tanto de las sugerencias como de los renglones (decisión del usuario). Las bolsitas salen de fraccionar, no se compran, y los desactivados no reciben entradas (HU-27).
- **Sí:** estados `draft` / `closed`. Solo el borrador se edita, se cierra o se borra; el cerrado queda como historial fiel (decisión del usuario).
- **No:** pedidos siempre editables ni pedidos nunca editables.
- **Sí:** guardar el costo de fábrica del momento en cada renglón (`unit_cost numeric(10,4)`), porque después no se puede recuperar (decisión del usuario). Si se exporta o se muestra lo decide HU-32.
- **Sí:** la sugerencia no trae cantidad a pedir: la escribe el administrador (decisión del usuario). No se inventa una regla de reorden.
- **Sí:** solo una nota opcional de hasta 500 caracteres en el encabezado (decisión del usuario).
- **No:** proveedor como dato o catálogo.
- **Sí:** cerrar no mueve inventario ni se liga a las entradas a bodega (decisión del usuario). La mercancía se registra aparte con HU-27.
- **No:** cerrar igual a recibir con movimientos `purchase`.
- **Sí:** módulo `src/restock/` con alias `@restock`, tablas `restock_orders` / `restock_order_lines` y rutas bajo `/api/restock/…` (decisión del usuario).
- **No:** el nombre `purchase-orders`, que se confunde con `@purchases`.
- **Sí:** `PUT` que reemplaza nota y renglones completos en una transacción (decisión del usuario).
- **No:** rutas por renglón.
- **Sí:** borrar solo borradores (decisión del usuario). No tienen historia porque no mueven inventario.
- **Sí:** reglas estándar (decisión del usuario):
  - Producto sin repetir.
  - Piezas de 1 a `MAX_QTY`.
  - El borrador puede quedar vacío, pero no se cierra vacío.
  - La lista trae los últimos 50, el más nuevo primero.
- **Sí:** idempotencia del alta con `request_id` único y candado por `requestId`, el patrón de HU-27 y de `fractions`. `PUT`, cerrar y borrar ya son idempotentes por naturaleza o responden `409`.
- **Sí:** lectura nueva `restockCandidates()` en `@stock`. `lowStockLines` (HU-18) incluye bolsitas y vendedores, y `holdingsByProduct` omite los productos en 0 en todos lados; no se cambian.

## Lo que **no** entra en este spec

- Pantallas de HU-31 y HU-32, exportar a PDF o Excel y «usar como base».
- Mínimo de reorden por producto, cantidad sugerida, sugerencias sobre vendedores o el total.
- Proveedor, recibir el pedido contra entradas a bodega, reabrir un pedido cerrado.
- Cambios en `@purchases`, `@inventory`, `lowStockLines`, el seed o el frontend.
