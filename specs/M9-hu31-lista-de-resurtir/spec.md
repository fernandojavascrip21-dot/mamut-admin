# Spec técnico — HU-31 · Generar y editar la lista de resurtir (administrador)

> **Estado:** Aprobado
> **Depende de:** M9-t36-base-resurtir (`specs/M9-t36-base-resurtir/spec.md`): sugerencias y pedidos `draft`/`closed` en `/api/restock/…`, solo administrador, sin mover inventario; **este spec lo extiende** (renglones escritos a mano, costo editable por renglón, total estimado y lectura de productos pedibles; §3 y §4). M3-hu18-aviso-baja-existencia (`specs/M3-hu18-aviso-baja-existencia/spec.md`): el nivel `stockLevel` lo decide el backend. M2-hu13-stock-general (`specs/M2-hu13-stock-general/spec.md`): movimientos rápidos de «Stock general». M7-t26-estados-pantallas (`specs/M7-t26-estados-pantallas/spec.md`): estados cargando / vacío / error. M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`): costo con 4 decimales como texto, sin `number` flotante. HU-27 «Entrada a bodega» (`SCRUM-77`, feature `purchases`, sin carpeta de spec): patrón del campo de piezas como texto validado al enviar.
> **Fecha:** 2026-11-10
> **Objetivo:** que el administrador abra desde «Stock general» la página «Lista de resurtir», parta de los productos con baja o nula existencia (o retome su borrador), agregue cualquier producto del catálogo o uno escrito a mano, ajuste cantidades y costos solo para el pedido, vea el total estimado y guarde o cierre el pedido con un solo envío.

Fuentes:

- **Jira:** historia `SCRUM-88 · HU-31`, épica `SCRUM-79 · M9 · Resurtir y exportar (v2)`. Requerimiento RF-19. Depende de T-36 (`SCRUM-87`). La sigue HU-32 (`SCRUM-89`, exportar y pedidos anteriores). Los renglones a mano, el costo editable y el total estimado **no están en los criterios de `SCRUM-88`**: los pidió el usuario el 2026-11-10 y hay que agregarlos a la historia al sincronizar Jira.
- **Confluence:** «Plan v2» (página 5767169) y «Requerimientos» (RF-19). No hay mockup de esta pantalla en Confluence ni en `references/`: se diseña con los patrones de «Entrada a bodega» y «Stock general» y los tokens de la app.
- **Código:**
  - `backend/src/restock/` (`orders.ts`, `lines.ts`, `types.ts`, `constants.ts`, `suggestions.ts`) y `backend/app/api/restock/**` (T-36).
  - `backend/src/stock/holdings.ts` (`restockCandidates`, `lowStockLines`) y `backend/src/stock/levels.ts` (`stockLevelOf`).
  - `backend/src/lib/money.ts` y `backend/src/lib/handler.ts` (`requireMoney`), `src/app/shared/utils/money.ts`.
  - `supabase/migrations/20261110000000_restock_orders.sql` (tablas de T-36).
  - `src/app/core/layout/routes/admin.routes.ts` (montaje de features).
  - `src/app/features/stock/constants/stock-page.constants.ts` (`YO_QUICK_ACTIONS`), `src/app/features/stock/components/stock-quick-actions/` (íconos).
  - `src/app/features/purchases/` (formulario de piezas como texto, patrón de `PurchaseFormComponent`).
  - `src/app/features/products/guards/unsaved-changes.guard.ts` (patrón del aviso de cambios sin guardar; no se importa).
  - `src/app/shared/constants/stock-level.constants.ts`, `src/app/shared/utils/uuid.ts` (`newUuid`), `src/app/shared/utils/normalize-text.ts`, `src/app/shared/utils/http-errors.ts`, `src/app/core/confirm/`, `src/app/core/toast/`.
- **Decisiones del usuario del 2026-11-10** (§10).

## 1. Alcance

**Entra en este spec:**

- **Base de datos y backend** (extiende T-36):
  - Migración `supabase/migrations/20261110000001_restock_custom_lines.sql` (§4) y `backend/src/db/schema.ts` regenerado con `db:pull` y los fixups de `CLAUDE.md`.
  - **Renglones escritos a mano:** texto del pedido con nombre, piezas y costo opcional; no son un producto.
  - **Costo editable por renglón:** el costo guardado en el renglón puede cambiar sin tocar `products.unit_cost`.
  - **Total estimado:** `estimatedTotal` en el pedido y en el resumen de la lista.
  - **Lectura de productos pedibles:** `GET /api/restock/products` (solo administrador), con piezas en bodega, nivel y costo de fábrica actual.
  - Pruebas nuevas contra la base real (§9).
- **Frontend, feature nueva `src/app/features/restock/`:**
  - Pop-up `restock-page` en el outlet `ventana` (`(ventana:resurtir)`, `loadComponent`), montado en `admin.routes.ts` como los demás pop-ups; usa `shared/components/modal-panel`. Cerrarlo vuelve a «Stock general».
  - Formulario reactivo presentacional `restock-form`: renglones (`FormArray`), «Agregar producto», «Escribir un producto», «Agregar sugeridos (N)», nota, total estimado y los botones de la página.
  - Renglón presentacional `restock-line`: de catálogo (foto, nombre, piezas en bodega con su nivel, piezas, costo, «Quitar», «Ya no se puede pedir») o escrito a mano (nombre, piezas, costo, etiqueta «Escrito a mano», «Quitar»).
  - Regla pura del total estimado (`rules/restock-estimate.rules.ts`), `RestockService` (productos pedibles, sugerencias, borrador más reciente, detalle, crear, actualizar, cerrar, descartar), modelos, validadores, reglas y constantes.
  - Guard `unsavedRestockGuard` en `features/restock/guards/` con `ConfirmService.ask()`.
- **Entrada en «Stock general»:** movimiento rápido «Resurtir» con «Yo · bodega», justo después de «Entrada a bodega», con un ícono nuevo `restock` en `stock-quick-actions`.
- **Pruebas nuevas** (§9) y las aserciones con commit de «Stock general» que cambian (§9, requiere `./desbloquear stock-page`). Verificación manual a 375 px.
- Actualizar `specs/README.md` y sincronizar `SCRUM-88`.

**No entra en este spec:**

- Exportar a PDF o Excel, la lista de pedidos anteriores, ver un pedido cerrado y «Usar como base» (HU-32, `SCRUM-89`). HU-32 decide si el archivo lleva costos y total.
- Elegir entre varios borradores: la página trabaja siempre sobre el **más reciente** (§2).
- Crear el producto en el catálogo desde el pedido, vincular un renglón escrito a mano con un producto, o que cerrar el pedido mueva inventario.
- Cambiar `products.unit_cost` o el precio de venta desde esta pantalla, mostrar el precio de venta o la ganancia.
- Una cantidad sugerida, un mínimo de reorden por producto, sugerencias sobre los vendedores.
- Proveedor, recibir el pedido contra «Entrada a bodega», reabrir un pedido cerrado.
- Un enlace desde el aviso de baja existencia (HU-18) o un elemento en el menú superior.
- Mover el guard de cambios sin guardar de `features/products` a `shared`.
- Cambios en `GET /api/products` (omite `unitCost` a propósito y también lo llama el vendedor), en `lowStockLines`, en `@purchases`, en `@inventory` o en `supabase/seed.sql`.

## 2. Reglas de negocio

- **Quién:** solo el administrador. La ruta cuelga de `/admin`, que ya protege `roleGuard`; el backend responde `403` a un vendedor.
- **Al entrar** (carga con `rxResource`, en paralelo):
  - `GET /api/restock/orders?status=draft` → si hay alguno, se toma el primero (el más reciente por `createdAt`) y se pide su detalle (`GET /api/restock/orders/[id]`).
  - `GET /api/restock/suggestions` y `GET /api/restock/products`.
  - **Sin borrador:** la lista nueva (sin guardar) parte de las sugerencias, en el orden del backend (agotados primero, luego por nombre), con piezas **vacías** y el costo registrado actual en «Costo unitario». El encabezado dice «Pedido nuevo».
  - **Con borrador:** se pintan sus renglones (primero los de catálogo en el orden guardado y después los escritos a mano, como los entrega el backend), con sus piezas, costos y nota. El encabezado dice «Borrador del <fecha de `createdAt`>» y «Guardado <fecha de `updatedAt`>». Las fechas se muestran en `America/Mexico_City`.
- **Piezas en bodega de un renglón de catálogo:** de `GET /api/restock/products` (`units` y `stockLevel`). Con `out` o `low` se pinta la etiqueta de `STOCK_LEVEL_LABELS`; con `ok` solo «N piezas en bodega». El frontend nunca compara contra `LOW_STOCK_THRESHOLD`.
- **Campo «Piezas»** de cada renglón (`pInputText`, `type="text" inputmode="numeric"`): obligatorio, entero de 1 a 2 147 483 647 (el `MAX_QTY` de T-36). Vacío → «Escribe cuántas piezas»; decimal, `0`, negativo o texto → «Debe ser un número entero mayor a 0»; mayor al tope → «Es demasiado». Los errores se muestran **al enviar**, no al tocar; escribir en el campo borra su error.
- **Quitar:** cada renglón tiene «Quitar» (botón de texto, sin confirmación). Quitar el último deja la lista vacía (§5, vacío).
- **Agregar producto (del catálogo, esté o no en baja existencia):**
  - `p-select` con filtro por nombre, «Agregar producto», debajo de la lista. Ofrece los productos de `GET /api/restock/products` que **no están ya** en la lista, por nombre, cada opción como «<Nombre> · N piezas en bodega». Ya vienen sin bolsitas ni desactivados.
  - Elegir uno lo agrega al final con piezas vacías y su costo registrado actual en «Costo unitario»; el selector vuelve a quedar sin valor.
- **Escribir un producto (que no está en el catálogo):**
  - Botón «Escribir un producto» que abre un bloque con «Nombre» (obligatorio, 1 a 120 caracteres tras recortar), «Costo» (opcional, mismas reglas que el costo unitario) y «Agregar». Agrega un renglón al final con piezas vacías y la etiqueta «Escrito a mano»; sin nombre no agrega y pinta el error del campo en ese bloque.
  - Un renglón escrito a mano deja editar nombre, piezas y costo; no tiene foto, ni piezas en bodega, ni nivel, ni «Ya no se puede pedir».
  - **Repetidos:** dos renglones escritos con el mismo nombre (sin mayúsculas ni acentos, con `normalizeText`) → error de campo al enviar «Ya escribiste este producto».
  - Si el nombre coincide con un producto del catálogo, el renglón muestra el aviso no bloqueante «Ya existe en el catálogo: elígelo de la lista» (`alert-warning`).
  - **No crea ningún producto** ni mueve inventario: es solo texto del pedido.
- **Agregar sugeridos (N):** botón secundario visible solo cuando hay sugerencias que no están en la lista; N es cuántas. Las agrega al final, en el orden del backend, con piezas vacías y su costo actual. Nada se mezcla solo al retomar un borrador.
- **Renglones que ya no se pueden pedir:** un renglón de catálogo del borrador cuyo producto no está en `GET /api/restock/products` (se desactivó o es bolsita) se marca «Ya no se puede pedir» (`alert-warning` en el renglón), sin campos editables. No cuenta en el total. Guardar o cerrar con uno así da el error general «Quita los productos que ya no se pueden pedir» y no manda nada.
- **Costo unitario** de cada renglón (catálogo o escrito a mano):
  - `pInputText`, `type="text" inputmode="decimal"`: nunca `InputNumber`, nunca se formatea ni se redondea mientras se escribe. Hasta 4 decimales, de `0` a `999999.9999`. Más decimales, negativo, fuera de rango o texto → error de campo al enviar «Escribe un costo válido (hasta 4 decimales)».
  - En un renglón de catálogo es obligatorio y arranca con el costo registrado: el actual del producto en un renglón nuevo, el guardado en el renglón en uno que viene del borrador. Se muestra con la ayuda «Solo para este pedido».
  - **Editarlo no cambia `products.unit_cost`**: el valor solo se guarda en el renglón del pedido (`restock_order_lines.unit_cost`) y solo sirve para el estimado.
  - En un renglón escrito a mano es opcional; vacío se manda como `null` y cuenta como 0 en el total.
- **Total estimado:**
  - Al pie de la lista, con la etiqueta «Total estimado»: suma de `piezas × costo unitario` de cada renglón con piezas válidas. Si hay renglones escritos a mano sin costo, se agrega «N sin costo».
  - Se actualiza al escribir. Se calcula con `money.ts` en enteros menores (`toMinorUnits`, `fromMinorUnits`): cada renglón se multiplica sin redondear y el redondeo a centavos (mitad hacia arriba) se hace **una sola vez, sobre la suma**, nunca con `number` flotante ni renglón por renglón. Los renglones con piezas o costo inválido no suman.
  - Después de guardar se pinta el `estimatedTotal` que devuelve el backend, que sigue la misma regla en SQL. En el diálogo de «Cerrar pedido» se repite el total.
  - La regla de `CLAUDE.md` «el frontend no suma dinero» es del corte de caja; aquí la suma en vivo es necesaria y usa `money.ts`.
  - Se muestra en pesos con el pipe `currency`; `Number()` solo para el pipe, al mostrar.
- **Nota:** `pInputText` / `textarea` opcional, «Nota del pedido», hasta 500 caracteres con contador. Más de 500 → error de campo al enviar. El payload manda `note` recortada, o `null` si queda vacía.
- **Límite de renglones:** más de 200 (de catálogo y escritos juntos) → error general «Un pedido lleva hasta 200 productos» al enviar (`MAX_LINES` de T-36).
- **Lista válida para guardar:** sin errores de campo y sin renglones no pedibles. Un pedido **vacío sí se puede guardar** como borrador (T-36 lo permite), pero **no cerrar**: «Cerrar pedido» con 0 renglones da «Agrega al menos un producto para cerrar el pedido» y no manda nada. Un pedido con solo renglones escritos a mano sí se cierra.
- **Guardar pedido** (botón primario):
  - Inválido → `markAllAsTouched()`, errores, foco en el primer campo con error y no se manda nada.
  - Sin borrador → `POST /api/restock/orders` con `{ requestId, note, lines }`. El `requestId` (`newUuid()`) se crea una vez por pedido nuevo y se conserva si el envío falla por red o `5xx`, para que reintentar no cree dos pedidos; con `201` o `200 replayed: true` la página pasa a trabajar sobre ese borrador.
  - Con borrador → `PUT /api/restock/orders/[id]` con `{ note, lines }`.
  - Cada renglón de catálogo manda `{ productId, qty, unitCost }` y cada uno escrito a mano `{ name, qty, unitCost }` (`unitCost` como texto o `null`).
  - Éxito → toast «Pedido guardado», la lista queda sin cambios pendientes y se actualiza «Guardado <fecha>».
- **Cerrar pedido** (botón secundario):
  - Mismas validaciones que guardar, más la de lista vacía.
  - Confirmación con `ConfirmService.ask()`: «¿Cerrar el pedido con N productos (total estimado $X)? Ya no se podrá editar.», botón «Cerrar pedido» y «Cancelar». Al cancelar no se manda nada.
  - Si hay cambios sin guardar o el pedido es nuevo: `PUT` (o `POST`) y después `POST …/close`, encadenados con `switchMap` en el mismo `pipe`. Sin cambios: solo el `close`.
  - Éxito → toast «Pedido cerrado» y la página vuelve a cargar todo (`reload()`): sin borrador, parte de las sugerencias como pedido nuevo con un `requestId` nuevo.
  - Si el guardado sale bien y el cierre falla, la página ya trabaja sobre el borrador guardado (no se vuelve a crear) y muestra el error del cierre.
- **Descartar borrador** (botón de texto `danger`, solo con borrador guardado):
  - Confirmación: «¿Descartar el borrador? Se borra lo que guardaste.», botón «Descartar» (danger).
  - `DELETE /api/restock/orders/[id]` → toast «Borrador descartado» y `reload()` (parte de las sugerencias). Un `404` se trata igual (ya no existe).
- **Un solo envío:** mientras guarda, cierra o descarta, los tres botones quedan deshabilitados y el que se pulsó muestra estado de espera; un segundo clic no manda otra petición.
- **Errores del backend** (no se pierde lo escrito):
  - `422` → aviso `alert-danger` encima de los botones con el mensaje del backend.
  - `409` «Este pedido ya está cerrado.» (alguien lo cerró en otra pestaña) → aviso con el mensaje y «Volver a cargar», que hace `reload()`.
  - `409` del `requestId` con otros datos o `404` del pedido o un producto → aviso con el mensaje del backend.
  - Sin conexión o `5xx` → aviso «No pudimos guardar el pedido. Inténtalo de nuevo.» con «Reintentar», que reenvía la misma acción (mismo `requestId` en un `POST`).
  - Solo `http-errors.ts` lee `HttpErrorResponse`; el servicio traduce a un motivo y la página decide qué pintar.
- **Cambios sin guardar:** hay cambios cuando el formulario está `dirty` (cambiar piezas, costos o nota, quitar o agregar renglones marca `markAsDirty()`). Una lista nueva recién cargada de las sugerencias **no** cuenta como cambio. Cerrar el pop-up o salir de él con cambios → `ConfirmService.ask()` «¿Salir sin guardar? Se pierden los cambios del pedido.», «Salir» / «Seguir editando». Mientras un envío está en curso no se sale.

## 3. Contrato con el backend (T-36 extendido)

| Llamada | Uso en esta página | ¿Cambia? |
| --- | --- | --- |
| `GET /api/restock/suggestions` → `{ suggestions: RestockSuggestion[] }` | Lista inicial y «Agregar sugeridos» | No |
| `GET /api/restock/products` → `{ products: RestockProduct[] }` | «Agregar producto», piezas y nivel de cada renglón, renglones no pedibles | **Nueva** |
| `GET /api/restock/orders?status=draft` → `{ orders: RestockOrderSummary[] }` | Saber si hay borrador; se toma `orders[0]` | Suma `estimatedTotal` al resumen |
| `GET /api/restock/orders/[id]` → `{ order: RestockOrder }` | Renglones y nota del borrador | Suma `customLines` y `estimatedTotal` |
| `POST /api/restock/orders` con `{ requestId, note, lines }` → `201`/`200 { order, replayed }` | Guardar un pedido nuevo | `lines` acepta renglones escritos y `unitCost` |
| `PUT /api/restock/orders/[id]` con `{ note, lines }` → `200 { order }` | Guardar el borrador | Igual que `POST` |
| `POST /api/restock/orders/[id]/close` → `200 { order }` | Cerrar | No |
| `DELETE /api/restock/orders/[id]` → `204` | Descartar borrador | No |

**`GET /api/restock/products`** (nuevo, solo administrador; `401` sin sesión, `403` con vendedor):

- Productos **activos que no son bolsita** (`parent_product_id is null`) con sus piezas de **bodega** (`products.stock`), **todos**, no solo los de baja existencia.
- Cada uno trae `productId`, `name`, `image`, `units`, `stockLevel` (`'ok' | 'low' | 'out'`, con `stockLevelOf`) y `unitCost` (costo de fábrica actual, texto de 4 decimales). Ordenados por nombre (`localeCompare('es')`).
- Es solo lectura. Lectura nueva `orderableProducts()` en `backend/src/stock/holdings.ts`, exportada por `@stock`, junto a `restockCandidates()`; el caso de uso `listRestockProducts(actor)` vive en `backend/src/restock/`.
- Por qué no `GET /api/products`: no manda `unitCost` a propósito y también lo llama el vendedor.

**Renglones de `lines`** en `POST` y `PUT`. Cada renglón es **uno** de:

- **De catálogo:** `{ productId, qty, unitCost? }`.
  - `unitCost` (texto o número, hasta 4 decimales, de 0 a `999999.9999`, validado con `requireMoney`) es el costo que se guarda **en el renglón**; `products.unit_cost` no se toca nunca.
  - Sin `unitCost` o con `null` se conserva el comportamiento de T-36: un renglón que ya estaba conserva su costo guardado y uno nuevo toma el actual del producto.
- **Escrito a mano:** `{ name, qty, unitCost }`, con `name` de 1 a 120 caracteres tras recortar y `unitCost` texto o `null`.
- Un renglón con `productId` y `name` a la vez, o con ninguno de los dos → `422`. Las demás reglas de T-36 siguen: `qty` de 1 a `MAX_QTY`, producto de catálogo activo y no bolsita, y como máximo `MAX_LINES` (200) renglones de ambos tipos juntos.
- Nombres escritos repetidos (sin mayúsculas, `lower()`) → `422` «Un producto escrito aparece dos veces en el pedido». Un nombre igual al de un producto del catálogo **se permite**.
- Idempotencia del alta: el mismo `requestId` con la misma nota y los mismos renglones (también mismos nombres y costos, sin importar el orden) responde `200 replayed`; con otro costo, otro nombre u otras piezas, `409`.

**Respuesta del pedido:**

- `RestockOrder` y `RestockOrderSummary` suman `estimatedTotal: string` (dos decimales, «1234.50»): `round(sum(qty * unit_cost), 2)` en SQL, con los costos `null` contando 0. `lineCount` y `totalUnits` incluyen ambos tipos de renglón.
- `RestockOrder` suma `customLines: { id: number; name: string; qty: number; unitCost: string | null }[]`.
- `lines` **no cambia de forma**: solo trae los renglones de catálogo (`product`, `qty`, `unitCost`). Es aditivo a propósito para no tocar `backend/tests/restock.test.ts`, que ya tiene commit.

## 4. Modelo de datos

Migración `supabase/migrations/20261110000001_restock_custom_lines.sql`:

```sql
-- HU-31: renglones escritos a mano en un pedido de resurtir. Son texto del pedido: no crean
-- productos ni tocan inventario. unit_cost de un renglón de catálogo es el costo del pedido y puede
-- editarse sin cambiar products.unit_cost.

alter table public.restock_order_lines
  alter column product_id drop not null,
  alter column unit_cost drop not null,
  add column custom_name text,
  add constraint restock_order_lines_custom_name_check
    check (custom_name is null or char_length(custom_name) between 1 and 120),
  add constraint restock_order_lines_kind_check
    check (
      (product_id is not null and custom_name is null and unit_cost is not null)
      or (product_id is null and custom_name is not null)
    );

create unique index restock_order_lines_custom_key
  on public.restock_order_lines (order_id, lower(custom_name))
  where custom_name is not null;
```

- `unique (order_id, product_id)` de T-36 sigue valiendo: los `null` de `product_id` no chocan entre sí.
- El check de `unit_cost >= 0` de T-36 sigue valiendo (con `null` pasa).
- RLS ya está activo en las tablas (event trigger `rls_auto_enable`); no hay tablas nuevas.

Tipos del backend (`backend/src/restock/types.ts`):

```ts
export interface RestockCatalogLineInput { productId: number; qty: number; unitCost?: string | null }
export interface RestockCustomLineInput { name: string; qty: number; unitCost: string | null }
export type RestockLineInput = RestockCatalogLineInput | RestockCustomLineInput

export interface RestockCustomLine { id: number; name: string; qty: number; unitCost: string | null }

export interface RestockProduct {
  productId: number
  name: string
  image: string | null
  units: number                       // piezas en bodega
  stockLevel: 'ok' | 'low' | 'out'
  unitCost: string                    // costo de fábrica actual, «123.4500»
}
// RestockOrderSummary suma `estimatedTotal: string`; RestockOrder suma `customLines: RestockCustomLine[]`.
```

Constantes nuevas en `backend/src/restock/constants.ts`: `MAX_CUSTOM_NAME_LENGTH` (120) y los mensajes `INVALID_CUSTOM_NAME`, `DUPLICATE_CUSTOM` («Un producto escrito aparece dos veces en el pedido»), `INVALID_LINE_KIND` y `INVALID_UNIT_COST`.

Lectura en `backend/src/stock/holdings.ts`:

```ts
export interface OrderableProduct { productId: number; name: string; image: string | null; units: number; unitCost: string }

// Productos activos que no son bolsita, con las piezas de la bodega (todos, también los que tienen 0).
export async function orderableProducts(): Promise<OrderableProduct[]>
```

Frontend (`src/app/features/restock/interfaces/restock.models.ts`, con `import type`; espejo del backend):

```ts
export type RestockOrderStatus = 'draft' | 'closed';
export type RestockStockLevel = 'ok' | 'low' | 'out';

export interface RestockSuggestion {
  productId: number; name: string; image: string | null;
  units: number; stockLevel: 'low' | 'out'; unitCost: string;
}

export interface RestockProduct {
  productId: number; name: string; image: string | null;
  units: number; stockLevel: RestockStockLevel; unitCost: string;
}

export interface RestockOrderSummary {
  id: number; status: RestockOrderStatus; note: string | null;
  createdAt: string; updatedAt: string; closedAt: string | null;
  lineCount: number; totalUnits: number; estimatedTotal: string;
}

export interface RestockOrderLine {
  product: { id: number; name: string; image: string | null };
  qty: number; unitCost: string;
}

export interface RestockCustomLine { id: number; name: string; qty: number; unitCost: string | null }

export interface RestockOrder extends RestockOrderSummary {
  requestId: string;
  lines: RestockOrderLine[];
  customLines: RestockCustomLine[];
}

export interface RestockCatalogLinePayload { productId: number; qty: number; unitCost: string }
export interface RestockCustomLinePayload { name: string; qty: number; unitCost: string | null }
export type RestockLinePayload = RestockCatalogLinePayload | RestockCustomLinePayload;

export interface CreateRestockOrderPayload { requestId: string; note: string | null; lines: RestockLinePayload[] }
export interface UpdateRestockOrderPayload { note: string | null; lines: RestockLinePayload[] }

export type RestockFailureReason = 'invalid' | 'closed' | 'conflict' | 'not-found' | 'offline';

export type RestockResult =
  | { ok: true; order: RestockOrder }
  | { ok: false; reason: RestockFailureReason; message: string | null };
```

Datos de la página (`models/restock-page.models.ts`):

```ts
// Lo que necesita la pantalla al entrar: borrador (o null), sugerencias y productos pedibles.
export interface RestockPageData {
  draft: RestockOrder | null;
  suggestions: RestockSuggestion[];
  products: RestockProduct[];
}
```

Forma del formulario (`components/restock-form/restock-form.models.ts`):

```ts
// Un renglón: `kind` fija si es de catálogo (productId) o escrito a mano (name). Piezas y costo son
// texto mientras se escriben.
interface RestockLineForm {
  kind: 'catalog' | 'custom';
  productId: number | null;
  name: string;
  qty: string;
  unitCost: string;
}
// FormGroup<{ note: FormControl<string>; lines: FormArray<FormGroup<RestockLineForm>> }>
```

Vista de un renglón (`components/restock-line/restock-line.models.ts`): `{ kind, productId, name, image, units: number | null, stockLevel: RestockStockLevel | null, orderable: boolean }`, calculada por una regla pura en `rules/restock-lines.rules.ts` a partir de `RestockPageData`. El total sale de `rules/restock-estimate.rules.ts` (`estimateTotal(lines): { total: string; withoutCost: number }`, con `money.ts`).

Constantes:

- `constants/restock.constants.ts`: URLs, `MAX_QTY` (2147483647), `MAX_LINES` (200), `MAX_NOTE_LENGTH` (500), `MAX_CUSTOM_NAME_LENGTH` (120) — los mismos topes del backend para validar antes de enviar.
- `constants/restock-page.constants.ts` y `components/*/…constants.ts`: los textos de §2 y §5.

`StockQuickActionIcon` agrega `'restock'`. `YO_QUICK_ACTIONS` agrega `{ label: 'Resurtir', link: <enlace de la ventana resurtir>, icon: 'restock' }` después de «Entrada a bodega».

## 5. Interfaz

- **Pop-up** «Lista de resurtir» (`modal-panel`, ancho amplio, alto casi completo: ~`min(1100px, 95vw)` × `90vh`), con subtítulo «Pedido nuevo» o «Borrador del <fecha>» · «Guardado <fecha>». Encabezado y barra inferior fijos; solo el cuerpo de la tabla hace scroll.
- **Lista como tabla con scroll:** encabezados fijos (Producto · En bodega · Piezas · Costo unitario · Quitar) y una fila por producto; solo el cuerpo hace scroll dentro del pop-up (`surface-*`, `overflow-y-auto`):
  - De catálogo: foto, nombre, «N piezas en bodega» con `Tag` del nivel («Agotado» / «Baja existencia», de `stock-level.constants.ts`), «Piezas», «Costo unitario» («Solo para este pedido») y «Quitar».
  - Escrito a mano: etiqueta «Escrito a mano», nombre, «Piezas», «Costo unitario» (opcional) y «Quitar».
  - Desde `lg` cada renglón es una fila de la tabla. Por debajo de `lg`, y a 375 px, las filas se apilan (campos bajo el nombre) y el pop-up ocupa casi toda la pantalla.
- **Arriba de la tabla, fijo:** «Agregar producto» (`p-select` con filtro, opciones «Nombre · N piezas en bodega»), «Escribir un producto» (bloque con «Nombre» y «Costo» y el botón «Agregar») y «Agregar sugeridos (N)» (secundario, solo si N > 0); la «Nota del pedido» con contador va al final del cuerpo con scroll.
- **Total estimado:** va en la barra inferior fija, con «N sin costo» si aplica; es texto, no un control.
- **Barra de acciones fija** (pie del pop-up, siempre visible): «Total estimado», «Guardar pedido» (primario) y «Cerrar pedido» (secundario). A 375 px el total va arriba y los botones en dos columnas de 44 px.
- **Al final de la lista, en el flujo:** aviso de error (si hay) y, con borrador, «Descartar borrador» (texto, `danger`).
- **Estados** (patrón de T-26):
  - Cargando → `Skeleton` de 3 renglones.
  - Error al cargar → «No pudimos cargar la lista de resurtir» con «Reintentar» (`reload()`).
  - Vacío (sin borrador y sin sugerencias, o lista sin renglones) → «Nada que resurtir» con «Todos los productos tienen piezas en bodega.»; «Agregar producto» y «Escribir un producto» siguen visibles para armar un pedido a mano.
- Tokens y utilidades de `styles.css` (`field-*`, `surface-*`, `alert-*`, `page-title`), controles de PrimeNG (`pButton`, `pInputText`, `p-select`, `Tag`, `Skeleton`). Sin hex ni CSS por componente.
- Antes de maquetar: **ui-ux-pro-max** para estilo y reglas de UX, y **frontend-design** para el acabado (pantalla nueva, `CLAUDE.md`).
- A 375 px se usa sin zoom ni desplazamiento horizontal.

## 6. Plan de implementación

1. **Migración y base.**
   - Escribir `supabase/migrations/20261110000001_restock_custom_lines.sql` (§4) y comprobarla con `npm run db:reset`.
   - Aplicarla a producción **a mano** en el SQL Editor, nunca con `supabase db push`:
     - Revisión de solo lectura: `select column_name, is_nullable from information_schema.columns where table_name = 'restock_order_lines'` no trae `custom_name` y `product_id` es `NO`; T-36 ya está aplicada (`to_regclass('public.restock_order_lines')` no es `null`).
     - La migración dentro de `begin; … commit;`.
     - Verificación: `custom_name` existe, `product_id` y `unit_cost` son `YES`, y `select conname from pg_constraint where conrelid = 'public.restock_order_lines'::regclass` lista `restock_order_lines_kind_check` y `restock_order_lines_custom_name_check`.
   - Correr `npm run db:pull` en `backend/` (con `.env` en PRODUCCIÓN) y aplicar los fixups de `CLAUDE.md`.
   - Al terminar el paso, `npm run type-check` y `npm test` pasan sin cambios.
2. **Backend.**
   - `orderableProducts()` en `@stock`, `listRestockProducts` y la ruta `GET /api/restock/products`.
   - `lines.ts` (`requireLines` acepta renglones de catálogo y escritos, con `unitCost`).
   - `orders.ts`: validación de renglones escritos y de `unitCost`, costo del renglón en `create`/`update`, `matchingOrderId` con nombres y costos, `readOrder` con `customLines`, y `estimatedTotal` en el detalle y en la lista con `sum()` en SQL.
   - `types.ts` y `constants.ts`.
   - Pruebas nuevas (§9). `npm run type-check`, `npm test` con `SUPABASE_SERVICE_ROLE_KEY` y `tests/architecture.test.ts` pasan, sin cambios en tests con commit.
3. **Esqueleto de la feature.** Crear `src/app/features/restock/` (`pages/`, `components/`, `services/`, `guards/`, `interfaces/`, `models/`, `constants/`, `validators/`, `rules/`), `interfaces/restock.models.ts`, `constants/restock.constants.ts` y `RestockService` con sus pruebas (`getPageData()` con `forkJoin`: borrador → detalle, sugerencias y productos; `create()`, `update()`, `close()`, `discard()` traducidos a `RestockResult`). `ng build` pasa.
4. **Ruta.** `restock-page` (`ng generate component`), el montaje `resurtir` en el outlet `ventana` de `admin.routes.ts` y `canDeactivate: [unsavedRestockGuard]`. Estados cargando / error / vacío con `rxResource`.
5. **Diseño.** Pasar por ui-ux-pro-max y frontend-design con los tokens de la app.
6. **Reglas y validadores.** `rules/restock-lines.rules.ts` (vista de cada renglón, productos que ofrece «Agregar producto», sugerencias que faltan, aviso de nombre ya existente), `rules/restock-estimate.rules.ts` (total con `money.ts`) y `validators/restock-form.validators.ts` (piezas, costo, nombre, nota, nombres repetidos), con pruebas.
7. **Formulario.** `restock-line` y `restock-form` (`ng generate component`) con el patrón de `product-form`: `createEmptyForm()`, un setter que reemplaza los renglones con el mismo método privado que «agregar», `markAsDirty()` al quitar o agregar, errores al enviar, `output()` con `{ action: 'save' | 'close', note, lines }` y `output()` de «Descartar». Total estimado en un `computed()`.
8. **Guardar, cerrar y descartar.** En la página: `requestId`, `POST`/`PUT`, `switchMap` hacia `close`, `ConfirmService.ask()` con el total, un solo envío, errores de §2, toasts y `reload()`.
9. **Cambios sin guardar.** `unsavedRestockGuard` con `ConfirmService.ask()` y pruebas.
10. **Entrada.** Ícono `restock` en `stock-quick-actions` y «Resurtir» en `YO_QUICK_ACTIONS`. **Antes de este paso el usuario corre `./desbloquear stock-page`**; se actualizan solo las aserciones de §9.
11. **Verificación.** `ng build`, `npm run check:architecture`, `ng test` de las pruebas afectadas, y a mano a 375 px con el backend local: pedido nuevo desde sugerencias, agregar un producto con existencia suficiente, escribir un producto, editar costos y ver el total, retomar el borrador, agregar sugeridos, cerrar y descartar.
12. **Índice y Jira.** Actualizar `specs/README.md`, agregar a `SCRUM-88` los criterios nuevos y comentar el avance (paso del plan y ✅/❌/⏳ por criterio), moviéndola En curso → In review.

## 7. Criterios de aceptación

- [ ] Con «Yo · bodega», «Stock general» muestra «Resurtir» después de «Entrada a bodega», que abre el pop-up «Lista de resurtir» sobre «Stock general».
- [ ] Sin borrador, la lista parte de los productos con baja o nula existencia en la bodega, en el orden del backend, con piezas vacías, el nivel y el costo registrado de cada uno, y no cuenta como cambio sin guardar (criterio 1 de `SCRUM-88`).
- [ ] Se pueden cambiar piezas, quitar renglones y agregar un producto con el selector (criterio 2).
- [ ] El selector «Agregar producto» ofrece productos con existencia suficiente (no solo bajos), con «N piezas en bodega», y no ofrece bolsitas, desactivados ni los ya agregados.
- [ ] «Escribir un producto» agrega un renglón «Escrito a mano» con piezas vacías; sin nombre, con un nombre de más de 120 caracteres, con dos iguales o con costo inválido da su error y no manda nada.
- [ ] Un nombre escrito que coincide con un producto del catálogo muestra el aviso «Ya existe en el catálogo» y no bloquea.
- [ ] Un renglón de catálogo muestra su costo registrado; cambiarlo cambia el total estimado, pero `products.unit_cost` queda igual (comprobado en la base).
- [ ] El total estimado se actualiza al cambiar piezas o costos y al quitar o agregar renglones, y redondea una sola vez sobre la suma: con un renglón de 3 piezas a `10.3333` da `31.00` y con uno de 3 a `10.3350` da `31.01`. Los renglones escritos sin costo cuentan 0 y se avisa «N sin costo».
- [ ] «Guardar pedido» de un pedido nuevo manda un `POST` con `requestId`; los siguientes guardados mandan `PUT` del mismo pedido. Sale el toast «Pedido guardado», se actualiza «Guardado <fecha>» y el total que se ve es el `estimatedTotal` del backend, igual al calculado en pantalla (criterio 3).
- [ ] Al retomar el borrador reaparecen sus renglones de catálogo y escritos a mano con piezas y costos, su nota y sus fechas; «Agregar sugeridos (N)» agrega solo las sugerencias que faltan y no aparece si no falta ninguna.
- [ ] Piezas vacías, `0`, `2.5`, `-1` o texto, y un costo con más de 4 decimales, negativo o texto, dan su error de campo al enviar y no se manda nada; los errores no aparecen al solo tocar los campos (criterio 3).
- [ ] Mientras se guarda, cierra o descarta, los botones están deshabilitados y un segundo clic no manda otra petición (criterio 3).
- [ ] Sin conexión: aviso con «Reintentar»; reintentar un pedido nuevo usa el mismo `requestId` y no crea dos pedidos.
- [ ] «Cerrar pedido» pide confirmación con el total estimado; con cambios sin guardar guarda y cierra en un solo clic; después sale «Pedido cerrado» y la página parte de las sugerencias como pedido nuevo. Cancelar no manda nada; cerrar una lista vacía da su error sin mandar nada; un pedido con solo renglones escritos a mano se cierra.
- [ ] «Descartar borrador» pide confirmación, borra el borrador y la página parte de las sugerencias.
- [ ] Un renglón de catálogo del borrador con un producto desactivado o bolsita se marca «Ya no se puede pedir», no suma al total, y guardar o cerrar sin quitarlo da el error general sin mandar nada.
- [ ] Una nota de más de 500 caracteres da su error al enviar; una nota vacía se manda como `null`.
- [ ] Salir con cambios sin guardar pregunta «¿Salir sin guardar?»; sin cambios sale sin preguntar.
- [ ] Cargando, error al cargar (con «Reintentar») y vacío («Nada que resurtir», con «Agregar producto» y «Escribir un producto» visibles) muestran su estado; a 375 px la página se usa sin zoom (criterio 4).
- [ ] Guardar o cerrar un pedido no agrega filas a `stock_movements`, no crea productos y no cambia `products` (ni `unit_cost` ni `stock`).
- [ ] Backend: la migración pasa con `db:reset` y en producción; `GET /api/restock/products` trae todos los productos activos que no son bolsita (también los de existencia suficiente) y da `403` a un vendedor; `422`/`409` de §3; `restock.test.ts` con commit sigue pasando sin cambios.
- [ ] `ng build`, `npm run check:architecture`, `ng test`, `npm run type-check` y `npm test` del backend pasan; solo cambian las aserciones de «Stock general» de §9.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La migración no está en producción cuando se despliega el backend | Se aplica en el paso 1, antes del código, y queda anotada en `SCRUM-88` y en el índice. Sin la columna `custom_name`, guardar un pedido da 500. |
| `db push` no sirve en este proyecto (historia compartida con el repo hermano) | Se aplica a mano en el SQL Editor, como dice `CLAUDE.md`. Nunca `migration repair` ni `db pull` de Supabase. |
| Cambiar la forma de `lines` rompería `backend/tests/restock.test.ts` (con commit) y a HU-32 | `customLines` es un arreglo aparte y aditivo; `lines` queda igual. Si HU-32 quiere una sola lista ordenada, pedirá `./desbloquear restock`. |
| El total del frontend y el `estimatedTotal` del backend difieren por redondeo | Los dos suman sin redondear por renglón y redondean una vez sobre la suma (mitad hacia arriba); una prueba del backend y una del frontend usan los mismos casos (`31.00`, `31.01`). |
| El administrador edita el costo y cree que cambió el del producto | Ayuda «Solo para este pedido» en el campo y criterio de aceptación que comprueba `products.unit_cost`. |
| Un renglón escrito duplica un producto del catálogo | Aviso no bloqueante «Ya existe en el catálogo: elígelo de la lista». |
| Un producto se desactiva o se vuelve bolsita con un borrador abierto | El renglón se marca «Ya no se puede pedir» y hay que quitarlo; si pasa entre la carga y el envío, el `422` del backend se pinta como aviso. |
| Hay varios borradores (T-36 no lo impide) | La página trabaja sobre el más reciente; los demás se verán en HU-32. |
| El pedido se cerró o borró en otra pestaña | `409`/`404` del backend: aviso con el mensaje y «Volver a cargar». |
| Guardar sale bien y cerrar falla | La página ya trabaja sobre el borrador guardado; reintentar solo manda el `close`. |
| Agregar «Resurtir» rompe aserciones con commit de «Stock general» | El usuario corre `./desbloquear stock-page` antes del paso 10; solo cambian las aserciones de §9. |
| `@restock` sin revisión en `architecture.test.ts` | Igual que T-36: los imports usan el alias y agregarlo al mapa requiere aprobación del usuario. |
| Sin mockup, la pantalla puede no gustar | Patrones de «Entrada a bodega» y «Stock general», ui-ux-pro-max y frontend-design; el usuario revisa a 375 px antes de In review. |

## 9. Plan de pruebas

- **Backend (nuevas, contra la base real, saltadas sin `SUPABASE_SERVICE_ROLE_KEY`; datos `test-rst-` como en T-36, limpieza igual):**
  - `backend/tests/restock-custom-lines.test.ts`: renglón escrito (alta, retomar, `PUT`, cierre solo con renglones escritos), `422` por nombre vacío o largo, nombre repetido, costo inválido y renglón con `productId` y `name`; nombre igual al de un producto del catálogo permitido; idempotencia con otro nombre o costo → `409`; `lineCount`, `totalUnits` y el tope de 200 con ambos tipos; no se crean productos ni movimientos.
  - `backend/tests/restock-estimate.test.ts`: costo editado en un renglón de catálogo sin tocar `products.unit_cost`; un renglón existente conserva su costo en un `PUT` sin `unitCost`; `estimatedTotal` en detalle y lista con redondeo único (`31.00`, `31.01`) y costos `null` como 0.
  - `backend/tests/restock-products.test.ts`: `GET` trae productos con existencia suficiente y con 0, sin bolsitas ni desactivados, con `stockLevel` y `unitCost`; `403` con un vendedor.
- **Frontend (nuevas):**
  - `restock.service.spec.ts`: `getPageData()` con y sin borrador; `create()` traduce `201`/`200 replayed`, `422`, `409` cerrado, `409` conflicto, `404` y sin conexión; `update()`, `close()` y `discard()` (con `404` tratado como descartado).
  - `restock-lines.rules.spec.ts`: vista de renglones (nivel de `GET /api/restock/products`, no pedible si falta o es bolsita), productos para «Agregar producto» (con existencia suficiente, sin los ya agregados), sugerencias que faltan, aviso de nombre ya existente.
  - `restock-estimate.rules.spec.ts`: total con redondeo único (`31.00`, `31.01`), costo vacío, piezas o costo inválidos que no suman, «N sin costo».
  - `restock-form.validators.spec.ts`: piezas, costo, nombre, nota y nombres repetidos.
  - `restock-line.component.spec.ts`: renglón de catálogo (nombre, piezas en bodega, nivel, costo, «Quitar», «Ya no se puede pedir») y escrito a mano (etiqueta, campos editables).
  - `restock-form.component.spec.ts`: errores al enviar (no al tocar), quitar y agregar marcan `dirty`, «Escribir un producto», «Agregar sugeridos (N)», total estimado al escribir, lista vacía no se cierra, renglón no pedible bloquea, `output()` con el payload (`unitCost` en cada renglón).
  - `restock-page.component.spec.ts`: estados, pedido nuevo vs borrador, `POST` y luego `PUT`, `requestId` que se conserva al reintentar, cerrar con y sin cambios (`switchMap`) con el total en la confirmación, confirmaciones aceptar/cancelar, descartar, un solo envío, toasts y `reload()`.
  - `unsaved-restock.guard.spec.ts`: con y sin cambios, «Salir» / «Seguir editando».
  - `admin.routes.restock.spec.ts`: la ventana `resurtir` carga la página con el guard.
  - `stock-quick-actions.restock.spec.ts`: el ícono `restock`.
- **Con commit, requieren `./desbloquear stock-page`** (cambio de comportamiento pedido por esta historia):
  - `stock-page.component.spec.ts:148`: la lista de «Yo» pasa a `['Entrada a bodega', 'Resurtir', 'Dejar a vendedor', 'Vender', 'Registrar merma', 'Fraccionar', 'Nuevo producto']`.
  - `stock-page.component.history-link.spec.ts:73`: el total de movimientos rápidos pasa de 6 a 7 (y la descripción del `it`, «seis» → «siete»).
  - Ninguna otra aserción se toca.
- **Tests con commit del backend:** ninguno cambia (`restock.test.ts` sigue igual; `lines` y los campos actuales no cambian de forma).

## 10. Decisiones

- **Sí:** pop-up `resurtir` en el outlet `ventana` (decisión del usuario del 2026-11-10, al ver la pantalla como página: no aprovechaba el espacio y los botones se perdían), feature nueva `features/restock/`, con entrada «Resurtir» en «Stock general». Reemplaza la decisión original de página propia `/admin/resurtir`.
- **No:** elemento en el menú superior ni enlace en el aviso de baja existencia.
- **Sí:** borrador que se retoma (decisión del usuario): «Guardar pedido» crea (`POST`) y luego actualiza (`PUT`); al entrar se retoma el borrador más reciente; «Cerrar pedido» aparte, con confirmación.
- **No:** guardar = cerrar, ni dejar el cierre para HU-32.
- **Sí:** «Cerrar pedido» con cambios sin guardar guarda y cierra en un clic (decisión del usuario).
- **Sí:** después de cerrar, toast y lista nueva desde las sugerencias (decisión del usuario). Ver el cerrado es de HU-32.
- **Sí:** piezas vacías en renglones sugeridos y agregados (decisión del usuario). El backend no sugiere cantidad y no se inventa una regla.
- **Sí:** agregar cualquier producto del catálogo, también los de existencia suficiente, con un `p-select` con filtro (decisión del usuario). Ya no depende de `GET /api/products`.
- **Sí:** «Agregar sugeridos (N)» al retomar un borrador (decisión del usuario). Nada se mezcla solo.
- **Sí:** producto escrito a mano como **texto del pedido**, sin crear el producto en el catálogo ni tocar inventario (decisión del usuario).
- **No:** crear el producto en el catálogo desde el pedido (mucho más alcance: toca `products` y su formulario) ni vincular el renglón al catálogo.
- **Sí:** el cambio de backend (migración, renglones escritos, costo editable, total estimado, `GET /api/restock/products`) va **dentro de este spec** (decisión del usuario), no en un spec técnico aparte.
- **Sí:** el renglón escrito a mano lleva **costo opcional** (decisión del usuario); vacío cuenta 0 en el total y se avisa.
- **Sí:** «precio registrado» es el **costo de fábrica** (`products.unit_cost`): es lo que se paga al proveedor y lo que T-36 ya guarda en cada renglón. Se editó la decisión de T-36 de no mostrarlo: ahora se muestra para estimar el pedido (decisión del usuario).
- **Sí:** el costo es editable por renglón y vive solo en `restock_order_lines.unit_cost`; nunca cambia `products.unit_cost` (decisión del usuario: «sin afectar el precio original»).
- **Sí:** total estimado en pantalla, calculado en vivo con `money.ts` (enteros, redondeo una sola vez sobre la suma, mitad hacia arriba) y confirmado por el `estimatedTotal` del backend al guardar.
- **No:** mostrar el precio de venta ni la ganancia.
- **Sí:** endpoint nuevo `GET /api/restock/products` solo para administrador, en vez de `GET /api/products`, porque este omite `unitCost` a propósito y también lo llama el vendedor.
- **Sí:** `customLines` es un arreglo aparte en la respuesta y `lines` no cambia, para no tocar `backend/tests/restock.test.ts` (con commit) ni el contrato de T-36 que usará HU-32.
- **Sí:** guard propio `unsavedRestockGuard` en la feature (decisión del usuario). Una feature no importa otra.
- **No:** mover el guard de productos a `shared` (refactor que toca tests con commit).
- **Sí:** «Descartar borrador», nota del pedido y aviso «Ya no se puede pedir» (decisión del usuario).
- **Sí:** los topes de T-36 (`MAX_QTY`, `MAX_LINES`, 500 caracteres) y los nuevos (nombre de 120, costo con 4 decimales) se validan también en el frontend para dar el error de campo antes de enviar; el backend sigue mandando.
- **Sí:** barra de acciones fija abajo con el total, «Guardar pedido» y «Cerrar pedido», y renglones en una fila desde `lg` (decisión del usuario del 2026-11-10, al ver la pantalla con varios productos: los botones se perdían al final de la lista). Reemplaza «en el flujo, no flotantes».
- **Sí:** el nivel de cada renglón de catálogo se toma de `stockLevel` del backend; el frontend no compara contra el umbral (regla de HU-18).

## Lo que **no** entra en este spec

- Exportar, pedidos anteriores, ver un cerrado y «Usar como base» (HU-32).
- Varios borradores a la vez, cantidad sugerida, mínimo de reorden.
- Crear productos del catálogo desde el pedido, vincular renglones escritos, precio de venta o ganancia.
- Proveedor, recibir contra entradas a bodega, reabrir un cerrado.
- Menú superior, enlace en el aviso de baja existencia, guard compartido.
- Cambios en `GET /api/products`, `lowStockLines`, `@purchases`, `@inventory` o el seed.
