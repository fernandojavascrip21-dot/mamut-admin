# Spec técnico — HU-12 · Retirarle producto a un vendedor

> **Estado:** Aprovado
> **Depende de:** M2-hu09-ver-mis-vendedores (`specs/M2-hu09-ver-mis-vendedores/spec.md`) — detalle `/admin/vendedores/:id` y `stockOfHolder`; M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`) — `ViewingService`; M2-hu11-dejar-a-vendedor (`specs/M2-hu11-dejar-a-vendedor/spec.md`) — `stock_movements.request_id`, idempotencia y patrón de resumen; M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`) — `insertMovements` y signos de `return`
> **Fecha:** 2026-10-31
> **Objetivo:** que el administrador le retire piezas de un producto a un vendedor desde su detalle, y que esas piezas regresen a la bodega sin registrarse dos veces.

Fuentes:
- **Jira:** historia `SCRUM-36 · HU-12`, épica `SCRUM-7 · M2 · Vendedores y entregas`.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantalla 04 Mis vendedores; §4, reglas de stock) y «Requerimientos» (RF-08, RNF-03, RNF-05).
- **Mockup:** tablero `Entregar` del canvas, modo «Retirar producto» (vista previa «Así queda el stock»). Se traduce a los tokens de la app, sin copiar colores.
- **Código:** `backend/src/deliveries/deliveries.ts`, `backend/src/stock/` (`insertMovements`, `holdings.ts`), `features/sellers/` y `features/deliveries/services/delivery-save.service.ts` (patrón del guardado).
- **Decisiones del usuario del 2026-10-31** (§9).

## 1. Alcance

**Entra en este spec:**

- **Backend:**
  - Módulo nuevo `backend/src/returns/` con el caso de uso `createReturn` y las lecturas de un retiro.
  - Endpoints, solo para administradores: `POST /api/sellers/:id/returns`, `GET /api/sellers/:id/returns` (historial) y `GET /api/sellers/:id/returns/:requestId` (resumen).
  - `GET /api/sellers/:id` agrega `warehouseUnits` a cada línea de stock, para la vista previa.
- **Frontend (dentro de `features/sellers/`):**
  - Pantalla «Retirar producto» en `/admin/vendedores/:id/retirar`.
  - Resumen del retiro en `/admin/vendedores/:id/retiros/:requestId`.
  - Detalle del vendedor: botón «Retirar producto» y sección «Últimos retiros».
  - Toast al confirmar, y después el resumen.
- **Pruebas** de backend y frontend (§8).

**No entra en este spec:**

- Migraciones: `stock_movements.request_id` y su índice único ya existen (HU-11).
- Retirar varios productos en una sola operación (el mockup lo dibuja; Jira pide elegir el producto, ver §9).
- Motivo del retiro: `stock_movements.reason` queda en `null`.
- Acción «Retirar» en cada línea de «Su stock» o en «Stock general» (HU-13).
- Retirarle piezas a un vendedor desactivado.
- Deshacer o editar un retiro: un error se corrige dejándole las piezas de nuevo (HU-11) o con un ajuste (RNF-05).
- Paginar o filtrar «Últimos retiros» (solo los últimos 20), o mezclarlos con «Últimas entregas».
- Mostrar precios, costos o ganancia en la pantalla o en el resumen del retiro: retirar no los usa ni los cambia.
- Acceso desde el rol vendedor.

## 2. Reglas de negocio

- **Solo el administrador.** Los tres endpoints exigen `requireRole(request, 'admin')`: un vendedor recibe `403` y sin sesión es `401`.
- **Un retiro son dos movimientos `return`** en la misma transacción (T-07): vendedor `−N` y bodega `+N` (`holder_profile_id` null), con `insertMovements`. Nunca se escribe `vendor_stock.qty` ni `products.stock`. El total del negocio no cambia.
- **Quién y qué:**
  - El vendedor debe ser un perfil `role = 'vendedor'` y `active = true`. Si no, `404` al registrar, como el detalle de HU-09.
  - El producto debe existir (`findProduct`), y **puede estar archivado**: es la única forma de regresar esas piezas a la bodega. Si no existe, `404`.
  - La lista desplegable solo ofrece lo que el vendedor tiene en mano (`qty > 0`), incluidos los archivados.
- **Piezas (`qty`):** entero `> 0`, hasta el máximo de un `integer`. `0`, negativos, decimales o texto dan `422`. Más piezas que las del vendedor, o un producto que nunca tuvo, dan `409` «No hay piezas suficientes» (lo traduce `insertMovements`) y no se mueve nada ni queda una fila nueva en `vendor_stock`.
- **Errores en la pantalla** (criterio 3): se muestran en el campo **al confirmar**, no al escribir.
  - Sin producto: «Elige un producto».
  - Piezas vacías, `0`, negativas, decimales o con texto: «Escribe un número entero mayor a 0».
  - Más piezas que las del vendedor: «No hay piezas suficientes».
  - El botón «Retirar» solo se deshabilita mientras guarda, para que esos errores se puedan ver.
- **Saldo desactualizado:** si el backend responde `409` «No hay piezas suficientes» (el saldo cambió en otra sesión), el error sale en el campo de piezas y la pantalla vuelve a pedir el stock del vendedor.
- **Precio y costo propios:** un retiro no los toca. Si al vendedor le quedan 0 piezas, la fila de `vendor_stock` se conserva con `qty = 0` y sus dos valores, y la próxima entrega llega prellenada con ellos (resuelve el «por decidir» de Jira).
- **Vista previa** (criterio 2): «Luis: 6 → 4», «Bodega: 4 → 6» y «El total del negocio no cambia». Se recalcula en vivo y solo se muestra con un producto elegido y piezas válidas que no pasen de las del vendedor.
- **Un retiro no se registra dos veces** (criterio 4): cada pantalla usa un `requestId` (UUID) generado por el frontend, y «Reintentar» reenvía el mismo.
  - Mismo `requestId` y mismos datos (vendedor, producto, piezas): no se mueve nada y se responde el retiro ya hecho, con `200`.
  - Mismo `requestId` con otros datos, o uno que ya usó una entrega: `409` «Este retiro ya se registró con otros datos. Revisa el detalle del vendedor.»
  - Sin `requestId` o con uno que no es UUID: `422`.
- **Barra «Viendo»:** la pantalla y el resumen la siguen como el detalle. Al cargar eligen a ese vendedor, y elegir a otro en la barra abre su detalle (o la lista, con «Yo · bodega»).
- **Entrada:** el botón «Retirar producto» va junto a «Dejar producto» y no aparece si el vendedor tiene 0 piezas. Quien abra la URL a mano con un vendedor sin piezas ve «Este vendedor no tiene piezas para retirar» con un enlace a su detalle.
- **Texto de piezas:** «1 pieza», «N piezas» (`unitsLabel`).

## 3. Endpoints

`POST /api/sellers/:id/returns`, solo para administradores.

```json
// Petición
{ "requestId": "8f14e45f-ceea-467a-9575-0a1d27f7f6a1", "productId": 10, "qty": 2 }
```

```json
// 201 (200 si es una repetición del mismo requestId)
{
  "requestId": "8f14e45f-…",
  "createdAt": "2026-10-31T18:21:07.000Z",
  "qty": 2,
  "seller": { "id": "uuid", "fullName": "Luis Pérez" },
  "product": { "id": 10, "name": "Proteína Demo Whey 2 lb", "image": null },
  "sellerStock": { "before": 6, "after": 4 },
  "warehouse": { "before": 4, "after": 6 }
}
```

`qty` siempre es positivo en la respuesta. `before` y `after` salen de sumar los movimientos hasta la fila de este retiro, no del saldo actual, así que una repetición o una consulta posterior responde lo mismo que la primera vez.

`GET /api/sellers/:id/returns/:requestId` responde el mismo cuerpo. `404` si no existe, si es de otro vendedor, si el `requestId` es de una entrega o si un id no es UUID. No exige que el vendedor siga activo: el resumen de un retiro ya hecho se puede volver a ver.

`GET /api/sellers/:id/returns` responde los últimos 20 retiros de un vendedor activo, del más nuevo al más viejo:

```json
// 200
[
  { "requestId": "uuid", "createdAt": "…", "productId": 10, "name": "Proteína Demo Whey 2 lb", "image": null, "qty": 2 }
]
```

`requestId` es `null` en un movimiento `return` creado fuera de este flujo (p. ej. desde Studio); esa fila no enlaza a un resumen.

`GET /api/sellers/:id` (HU-09) agrega a cada línea de `stock`: `warehouseUnits` (`products.stock`, las piezas de la bodega).

| Caso | Status | `error.message` |
| --- | --- | --- |
| Vendedor inexistente, desactivado o que no es vendedor; id que no es UUID | 404 | El de `notFound()` |
| Producto inexistente | 404 | El de `notFound()` |
| `qty` que no es entero `> 0` o demasiado grande; `requestId` ausente o inválido | 422 | El de `validation()` |
| Más piezas que las del vendedor, o producto que nunca tuvo | 409 | No hay piezas suficientes |
| Mismo `requestId` con otros datos, o ya usado por una entrega | 409 | Este retiro ya se registró con otros datos. Revisa el detalle del vendedor. |
| Sin sesión / no es administrador | 401 / 403 | Los de `requireRole` |

## 4. Modelo de datos

**Base:** este spec no agrega tablas, columnas ni migraciones. Usa `stock_movements.type = 'return'` (T-07) y `request_id` (HU-11).

**Backend:**

```ts
// backend/src/stock/holdings.ts
export interface HolderStockLine { /* lo de hoy */ warehouseUnits: number }   // products.stock
export function movementsOfRequest(requestId: string, type: 'delivery' | 'return'): Promise<RequestMovements | null>
// Se le agrega `type` y `RequestMovements.qty` pasa a ser Math.abs de la fila del vendedor.
// Así, un requestId de otro tipo responde null y `getDelivery` sigue dando 404 con un retiro.
export interface ReturnRow { requestId: string | null; createdAt: string; productId: number; name: string; image: string | null; qty: number }
export function listReturns(profileId: string, limit: number): Promise<ReturnRow[]>  // movimientos return del vendedor; qty en positivo

// backend/src/returns/index.ts (módulo nuevo; alias @returns)
export interface CreateReturnInput { requestId: string; sellerId: string; productId: number; qty: number }
export interface SellerReturn { /* el cuerpo de §3 */ }
export function createReturn(input: CreateReturnInput, createdBy: string): Promise<{ sellerReturn: SellerReturn; replayed: boolean }>
export function getReturn(sellerId: string, requestId: string): Promise<SellerReturn>       // 404 si no existe o es de otro vendedor
export function listSellerReturns(sellerId: string): Promise<ReturnRow[]>                    // 404 si no es un vendedor activo

// backend/src/returns/constants.ts
RETURN_MISMATCH · HISTORY_LIMIT = 20 · MAX_QTY = 2_147_483_647
```

- `returns` usa `accounts`, `products` y `stock` solo por sus `index.ts`. La lectura de `stock_movements` vive en `stock`, su módulo dueño.
- `createReturn` hace, en este orden:
  1. Valida `qty`.
  2. Busca el `requestId` entre los retiros: con los mismos datos devuelve ese retiro con `replayed: true`; con otros datos, `409`.
  3. Valida vendedor y producto (`getActiveSellerName`, `findProduct`).
  4. Abre `withTransaction` e inserta con `insertMovements` las dos filas `return`: vendedor `−N` y bodega `+N`, con el mismo `requestId`.
  5. Si el índice único falla (`isUniqueViolation`), repite el paso 2. Si tampoco es un retiro, el `requestId` era de una entrega: `409` `RETURN_MISMATCH`.
  6. Lee y arma el retiro con `movementsOfRequest(requestId, 'return')`.
- El trigger de T-07 crea la fila de `vendor_stock` antes de restar. Con un producto que el vendedor nunca tuvo, el check `vendor_stock_qty_check` hace fallar la transacción y esa fila se revierte: responde `409` sin dejar residuos.
- `app/api/sellers/[id]/returns/route.ts` y `app/api/sellers/[id]/returns/[requestId]/route.ts` quedan delgados.
- `backend/tsconfig.json` agrega `"@returns": ["./src/returns"]` y `tests/architecture.test.ts` lo agrega a su lista de módulos.

**Frontend (`src/app/features/sellers/`):**

```ts
// interfaces/seller.models.ts
export interface SellerStockLine { /* lo de hoy */ warehouseUnits: number }
export interface NewReturnInput { requestId: string; productId: number; qty: number }
export interface SellerReturn { /* el cuerpo de §3 */ }
export interface ReturnHistoryItem { requestId: string | null; createdAt: string; productId: number; name: string; image: string | null; qty: number }
export type ReturnFailure = 'not-enough-units' | 'mismatch' | 'not-found' | 'invalid' | 'offline'
export type ReturnResult = { ok: true; sellerReturn: SellerReturn } | { ok: false; reason: ReturnFailure; message?: string }

// components/return-form/return-form.models.ts
export interface ReturnFormValue { productId: number; qty: number }

// models/return-units-page.models.ts · models/return-summary-page.models.ts
export type ReturnUnitsPageState = 'loading' | 'error' | 'not-found' | 'empty' | 'ready'
export type ReturnSummaryPageState = 'loading' | 'error' | 'not-found' | 'ready'

// models/seller-detail-page.models.ts (se agrega)
export type ReturnHistoryState = 'loading' | 'error' | 'ready'

// rules/return.rules.ts (puras)
previewReturnBalances(seller: number, warehouse: number, qty: number): { seller: number; warehouse: number }

// validators/return-form.validators.ts
wholePositiveUnits   // «Escribe un número entero mayor a 0»
maxUnits(getMax)     // «No hay piezas suficientes»; lee las piezas del producto elegido
```

- **Formulario** (tipado, con `createEmptyForm()` y el orden de «Formularios» de `CLAUDE.md`):

```ts
FormGroup<{
  productId: FormControl<number | null>;  // select: «Proteína Demo Whey 2 lb · 6 piezas»
  qty: FormControl<string>;               // texto con inputmode="numeric"; se convierte a entero al enviar
}>
```

- **Servicios:**
  - `services/seller-returns.service.ts`: `create(sellerId, input)`, `get(sellerId, requestId)` y `list(sellerId)`.
  - `services/return-save.service.ts`: se provee por página, como `DeliverySaveService`. Tiene un `requestId` por pantalla, y traduce `HttpErrorResponse` a `ReturnResult`.
  - La página no manda un segundo envío mientras el primero sigue en curso.
- **Componentes** (con `ng generate component`, prefijo `app-`):
  - `components/return-form`: presentacional. Recibe las líneas de stock y el nombre del vendedor; tiene los campos, los errores y la vista previa; emite `ReturnFormValue`.
  - `components/return-history-line`: fecha, foto o iniciales, producto y `−N piezas`. Con `requestId`, enlaza al resumen.
  - `pages/return-units-page`: carga al vendedor con `rxResource` sobre `SellersService.get` y guarda con `ReturnSaveService`.
  - `pages/return-summary-page`: `rxResource` sobre `SellerReturnsService.get`.
- **Rutas** (`sellers.routes.ts`), lazy y antes de `:id`: `:id/retirar` (título «Retirar producto») y `:id/retiros/:requestId` (título «Retiro»). No son del menú.
- **Constantes:** `constants/sellers.constants.ts` agrega `NOT_ENOUGH_UNITS_MESSAGE`. Una feature no importa a otra, así que no se reusa la de `deliveries`.
- **Detalle del vendedor** (`seller-detail-page`):
  - Botón «Retirar producto» junto a «Dejar producto», solo con piezas.
  - Sección «Últimos retiros» debajo de «Últimas entregas», con carga, error con «Reintentar» y «Todavía no le has retirado producto.».
  - Se actualiza su comentario, que hoy dice que «Retirar» se agrega en HU-12.

## 5. Plan de implementación

1. **Backend · stock.** Agregar `type` a `movementsOfRequest` y ajustar `deliveries.ts`. Agregar `listReturns` y `warehouseUnits` a `stockOfHolder`, y ampliar las pruebas de HU-09 y HU-11 que comparan la forma de `stock`. `npm run type-check` y `npm test` pasan.
2. **Backend · módulo `returns`.** Crear `src/returns/` (`index.ts`, `constants.ts`, `returns.ts`), el alias `@returns`, las rutas de §3 y `backend/tests/returns.test.ts` (§8). `npm run type-check` y `npm test` pasan, incluido `architecture.test.ts`.
3. **Frontend · datos y reglas.** Escribir modelos, `seller-returns.service.ts`, `return-save.service.ts`, `return.rules.ts` y `return-form.validators.ts`, con sus specs. `ng test` pasa.
4. **Frontend · diseño.** Antes de las pantallas, el flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design, sobre el tablero `Entregar` del canvas y `references/`, traducido a los tokens de `styles.css` y a las clases `btn-*`, `field-*`, `surface-*` y `alert-*`. El resultado debe verse como la ventana y el resumen de HU-11.
5. **Frontend · pantalla y resumen.** `ng generate component` para `return-form`, `return-units-page` y `return-summary-page`, y agregar las rutas. Flujo:
   - Cargando: «Cargando…». Error de carga: «No pudimos cargar al vendedor» con «Reintentar». Vendedor inexistente: «No encontramos a este vendedor».
   - Vista previa en vivo y botón «Retirar», con «Cancelar» de regreso al detalle.
   - Al confirmar con éxito: toast «Le retiraste 2 piezas a Luis» y navegación al resumen con `replaceUrl`, para que «Atrás» no regrese a un formulario ya enviado.
   - Resumen: producto con foto, piezas, «Luis: 6 → 4», «Bodega: 4 → 6» y «El total del negocio no cambia», con los botones «Listo» (detalle) y «Retirar otro producto».
   - Sin conexión o `5xx`: aviso «No pudimos registrar el retiro» con «Reintentar», que reenvía el mismo `requestId`.
   - `mismatch`: el mensaje del backend. `not-found`: «Este vendedor o producto ya no está disponible».
6. **Frontend · detalle.** `ng generate component` para `return-history-line`. Agregar el botón y «Últimos retiros» a `seller-detail-page`. `ng build`, `ng test` y `npm run check:architecture` pasan.
7. **Verificación manual** contra la base local (§7).
8. **Cierre.** Actualizar `specs/README.md`, `CLAUDE.md` y `AGENTS.md` (el módulo `src/returns/` y el alias `@returns`). Comentar el avance en `SCRUM-36` en cada paso y moverla de estado según `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-36`:

- [ ] **1.** En el detalle de un vendedor con piezas, «Retirar producto» abre una pantalla con una lista desplegable que solo ofrece los productos que tiene, el campo de piezas y la vista previa vendedor → bodega.
- [ ] **2.** Con 6 piezas en el vendedor y 4 en la bodega, retirar 2 muestra «Luis: 6 → 4» y «Bodega: 4 → 6» (en la vista previa y en el resumen), con «El total del negocio no cambia», y la suma de ambos sigue en 10.
- [ ] **3.** Confirmar con más piezas de las que tiene, `0`, un negativo, un decimal o texto muestra el error en el campo, y no se crean movimientos ni cambian `products.stock` y `vendor_stock.qty`.
- [ ] **4.** Sin conexión al confirmar se ve el aviso con «Reintentar». «Reintentar» reenvía el mismo `requestId` y el retiro queda registrado una sola vez, incluso si la primera petición sí llegó (prueba de backend con dos peticiones iguales).

Además:

- [ ] Un retiro crea dos movimientos `return` con el mismo `request_id`: vendedor `−N` y bodega `+N`.
- [ ] Al confirmar se ve el toast «Le retiraste N piezas a Luis» («1 pieza» en singular) y después el resumen, que se ve igual al recargar.
- [ ] «Atrás» desde el resumen no regresa al formulario enviado.
- [ ] Al retirar todas las piezas de un producto, sale de «Su stock» y conserva en `vendor_stock` su precio y su costo con envío; la siguiente entrega llega prellenada con ellos.
- [ ] Un retiro no cambia `unit_price` ni `unit_cost_with_shipping`.
- [ ] Un producto archivado en manos del vendedor aparece en la lista y se puede retirar.
- [ ] Sin piezas, el detalle no muestra «Retirar producto», y abrir `/admin/vendedores/:id/retirar` muestra «Este vendedor no tiene piezas para retirar».
- [ ] «Últimos retiros» muestra hasta 20, del más nuevo al más viejo, y cada uno enlaza a su resumen; «Últimas entregas» no cambia.
- [ ] Registrar un retiro con un vendedor desactivado, un id inventado o un producto inexistente responde `404`.
- [ ] Retirar un producto que el vendedor nunca tuvo responde `409` y no deja una fila en `vendor_stock`.
- [ ] Reusar un `requestId` con otro producto, vendedor o cantidad, o uno de una entrega, responde `409` y no mueve nada; uno ausente o que no es UUID responde `422`.
- [ ] `GET /api/sellers/:id/returns/:requestId` responde `404` con un retiro de otro vendedor o con un `requestId` de entrega, y `GET /api/deliveries/:requestId` responde `404` con uno de retiro.
- [ ] Elegir a otro vendedor en «Viendo» desde la pantalla de retiro abre el detalle de ese vendedor.
- [ ] Los tres endpoints responden `403` a un vendedor y `401` sin sesión.
- [ ] Backend: `npm run type-check` y `npm test` pasan, con `SUPABASE_SERVICE_ROLE_KEY` puesta. Frontend: `ng build`, `ng test` y `npm run check:architecture` pasan.

## 7. Verificación manual

Contra la base local tras `npm run db:reset` (avisar antes: borra las cuentas creadas a mano). En el seed, Víctor tiene 4 piezas de la proteína y 2 de la creatina:

- Como admin, en el detalle de Víctor, «Retirar producto» abre la pantalla y la lista solo ofrece la proteína y la creatina.
- Confirmar sin datos muestra los errores en los campos. Pedir 99 piezas muestra «No hay piezas suficientes» sin mover nada.
- Retirar 2 de la proteína: vista previa y resumen con «Víctor Vendedor: 4 → 2» y «Bodega: 8 → 10», toast, y la recarga del resumen se ve igual. El detalle muestra 2 piezas y el retiro arriba en «Últimos retiros».
- «Dejar producto» de la creatina con un precio propio, retirar todas sus piezas: sale de «Su stock». Al dejarle creatina otra vez, la ventana llega prellenada con ese precio.
- Con el backend apagado, confirmar muestra el aviso con «Reintentar»; encender el backend y reintentar registra un solo par de movimientos (se revisa en Studio).
- Elegir a otro vendedor en «Viendo» desde la pantalla abre su detalle.
- A 375 px de ancho no hay scroll horizontal ni zoom necesario (RNF-03). No hay errores en la consola.

## 8. Plan de pruebas

- **`backend/tests/returns.test.ts`** (contra la base local; cuentas `test-auth-`, productos y movimientos de prueba borrados al terminar, los movimientos del más nuevo al más viejo):
  - Retiro correcto: dos movimientos `return` con el mismo `request_id`, `products.stock` y `vendor_stock.qty` en sus valores esperados, y `before`/`after` correctos.
  - Precios: retirar todas las piezas deja `qty = 0` y conserva `unit_price` y `unit_cost_with_shipping`.
  - Archivado: el retiro de un producto archivado funciona.
  - Errores: más piezas que el vendedor (`409`, sin movimientos), producto que nunca tuvo (`409`, sin fila en `vendor_stock`), `qty` 0, negativa, decimal o texto (`422`), vendedor desactivado, administrador como vendedor, id que no es UUID y producto inexistente (`404`).
  - Idempotencia: dos peticiones iguales dejan un solo par (la segunda responde `200`), dos simultáneas también; otra cantidad o un `requestId` de entrega dan `409`; ausente o inválido da `422`.
  - Lecturas: resumen (y `404` con otro vendedor o con un `requestId` de entrega), historial (orden, límite y solo retiros) y `getDelivery` con un `requestId` de retiro (`404`).
  - `GET /api/sellers/:id` incluye `warehouseUnits` en cada línea.
  - `403` a un vendedor y `401` sin token en los tres endpoints.
- **`backend/tests/deliveries.test.ts`** sigue pasando con el `type` nuevo de `movementsOfRequest`, y **`architecture.test.ts`** con `returns`.
- **`features/sellers/rules/return.rules.spec.ts`:** vista previa, incluido retirar todo.
- **`features/sellers/validators/return-form.validators.spec.ts`:** vacío, `0`, negativo, decimal, texto, igual al máximo y mayor que el máximo.
- **`features/sellers/services/…spec.ts`:** URLs y cuerpos de `SellerReturnsService`; `ReturnSaveService` reusa el `requestId` al reintentar y traduce `409` (los dos casos), `404`, `422` y sin conexión.
- **`features/sellers/components/…spec.ts`:** `return-form` (opciones del select, vista previa en vivo, errores al confirmar y no al tocar, emite el valor) y `return-history-line` (con y sin enlace).
- **`features/sellers/pages/…spec.ts`:**
  - `return-units-page`: carga, error con «Reintentar», vendedor no encontrado, sin piezas, éxito con toast y `replaceUrl`, `409` que recarga el stock, aviso sin conexión, sin segundo envío en curso y barra «Viendo».
  - `return-summary-page`: resumen, no encontrado y error.
  - `seller-detail-page`: botón visible u oculto según las piezas, y «Últimos retiros» cargando, vacía, con datos y con error.

## 9. Decisiones

- **Sí:** al llegar a 0 piezas se conservan el precio y el costo propios (decisión del usuario, resuelve el «por decidir» de Jira). La entrega ya prellena lo vigente y el administrador lo puede cambiar o vaciar, así que no se pierde lo acordado ni hace falta lógica nueva.
- **No:** borrarlos al llegar a 0. Perdería lo acordado cuando un retiro sea temporal.
- **Sí:** al confirmar, toast y resumen en su propia URL, como HU-11 (decisión del usuario). Sale del backend, así que sobrevive a una recarga.
- **No:** solo toast y regreso al detalle. Era más corto, pero no deja revisar el resultado ni enlazarlo desde el historial.
- **Sí:** sección propia «Últimos retiros» (decisión del usuario). No cambia el endpoint ni la pantalla de HU-11.
- **No:** una sola lista de movimientos mezclados, ni dejar los retiros sin historial.
- **Sí:** la pantalla vive en `features/sellers`, en `/admin/vendedores/:id/retirar` (decisión del usuario). Solo se entra desde el detalle y el vendedor siempre viene en la URL, así que reusa `SellersService`.
- **No:** una feature nueva `features/returns`. Duplicaría la lectura del vendedor sin una segunda entrada que lo justifique. Si HU-13 agrega una, puede enlazar a esta misma URL.
- **Sí:** módulo de backend nuevo `src/returns/`, como pide `CLAUDE.md` para un área nueva. Cruza `accounts`, `products` y `stock`.
- **Sí:** se pueden retirar productos archivados (decisión del usuario). Si no, esas piezas quedarían atoradas con el vendedor. Por eso usa `findProduct` y no `getProduct`.
- **Sí:** un solo botón «Retirar producto», y el producto se elige en la pantalla con una lista desplegable (decisión del usuario, como pide el criterio 1). Un vendedor tiene pocos productos y un `select` funciona bien en el celular.
- **No:** una acción en cada línea de «Su stock», ni el buscador de HU-11, que habría que reescribir porque una feature no importa a otra.
- **No:** retirar varios productos a la vez, como dibuja el mockup. Jira pide elegir un producto, y «Retirar otro producto» del resumen cubre el caso.
- **Sí:** sin motivo (decisión del usuario). Los criterios de `SCRUM-36` solo piden producto y piezas.
- **Sí:** «Retirar» solo se deshabilita mientras guarda, y los errores salen al confirmar. **Difiere de HU-11**, que deshabilita su botón con piezas inválidas, porque el criterio 3 de `SCRUM-36` pide ver el error «cuando confirmo» y `CLAUDE.md` pide mostrarlos al enviar.
- **Sí:** reusar la idempotencia de HU-11, con `request_id` y el mismo índice. Cubre el caso en que la petición llegó pero se perdió la respuesta.
- **Sí:** `movementsOfRequest` recibe `type`. Reusa el cálculo de saldos, y evita que el resumen de una entrega muestre un retiro o al revés.
- **Sí:** `warehouseUnits` en `GET /api/sellers/:id`. La vista previa lo necesita y evita un endpoint más y una petición por producto. Ese endpoint ya es solo de administradores.
- **Sí:** `getReturn` no exige un vendedor activo, como `getDelivery`. Crear sí lo exige.
- **Sí:** `replaceUrl` al ir al resumen. «Atrás» no debe reabrir un formulario ya enviado.
- **Sí:** `MAX_QTY` y `HISTORY_LIMIT` propios en `returns/constants.ts`. Son dos usos, y `CLAUDE.md` pide constantes por módulo. Si una tercera operación las necesita, se suben a `stock`.
- **No:** guarda de cambios sin guardar. Son dos campos y «Cancelar» está a la vista, como en HU-11.

## 10. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La migración `20261030000000` de HU-11 sigue sin aplicarse a producción (su spec lo deja pendiente), y este spec usa `request_id` | Este spec no agrega migración, pero HU-12 no funciona en producción sin ella. Antes de desplegar, confirmar con `select version()` que es PostgreSQL 15 o más y aplicarla, con permiso del usuario |
| El saldo cambia entre cargar la pantalla y confirmar | El backend decide con los checks de la base: responde `409`, la pantalla muestra el error y vuelve a pedir el stock |
| Agregar `type` a `movementsOfRequest` rompe las entregas | Solo tiene tres llamadas, todas en `deliveries.ts`; el paso 1 las cambia y `deliveries.test.ts` las cubre |
| Dos peticiones iguales a la vez pasan la búsqueda previa y chocan en el índice | El caso de uso atrapa `isUniqueViolation` y responde el retiro ya hecho; una prueba lo cubre |
| Ampliar `HolderStockLine` rompe las pruebas que comparan el cuerpo completo | El paso 1 las actualiza en el mismo cambio; solo se agrega un campo |
| El detalle crece con otra sección y otra petición | Cada historial carga por su cuenta y su falla no esconde el detalle, como «Últimas entregas» |
| `db:reset` borra las cuentas creadas a mano en local | Avisarlo antes del paso 7; las del seed se recrean solas |

## Lo que **no** entra en este spec

- Retirar varios productos en una sola operación.
- Motivo del retiro.
- Acción «Retirar» en cada línea de stock o en «Stock general» (HU-13).
- Deshacer o editar un retiro.
- Una lista mezclada de entregas y retiros, o paginar y filtrar el historial.
- Precios, costos o ganancia en la pantalla del retiro.
- Retirarle piezas a un vendedor desactivado.
- Migraciones nuevas.

Cada uno, si llega, va en su propio spec o en su historia.
