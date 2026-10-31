# Spec técnico — HU-11 · Dejarle producto a un vendedor con su precio y su costo con envío

> **Estado:** Implementado
> **Depende de:** M2-t10-base-vendedores (`specs/M2-t10-base-vendedores/spec.md`) — `vendor_stock.unit_price` y `unit_cost_with_shipping` con check `> 0`; M2-hu08-alta-vendedor (`specs/M2-hu08-alta-vendedor/spec.md`) — vendedores; M2-hu09-ver-mis-vendedores (`specs/M2-hu09-ver-mis-vendedores/spec.md`) — detalle `/admin/vendedores/:id` y `stockOfHolder`; M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`) — `ViewingService`; M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`) — `insertMovements`; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — escalas y `money.ts`
> **Fecha:** 2026-10-30
> **Objetivo:** que el administrador deje piezas de la bodega a un vendedor, con un precio de venta y un costo con envío propios si hace falta, y vea un resumen de lo que dejó.

Fuentes:
- **Jira:** historia `SCRUM-35 · HU-11`, épica `SCRUM-7 · M2 · Vendedores y entregas`.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantalla 03a Dejar a vendedor, y 04 Mis vendedores; §4, reglas de precios y costos) y «Requerimientos» (RF-07, RF-26, RF-27, RNF-04, RNF-05).
- **Código:** `backend/src/stock/` (`insertMovements`, `holdings.ts`), `backend/src/accounts/sellers.ts`, `backend/src/products/products.ts` (`getProduct`, `listProducts`), `features/sellers/` (detalle y reglas), `features/products/` (tarjeta y lista), `core/viewing/` y `shared/utils/money.ts`.
- **Decisiones del usuario del 2026-10-30** (§9).

## 1. Alcance

**Entra en este spec:**

- **Base:** una migración que agrega `stock_movements.request_id` con un índice único, para que reintentar una entrega no la duplique (§4).
- **Backend:**
  - Módulo nuevo `backend/src/deliveries/` con el caso de uso `createDelivery` (dos movimientos `delivery` y los precios del vendedor, en una sola transacción) y las lecturas de una entrega.
  - Endpoints, solo para administradores: `POST /api/sellers/:id/deliveries`, `GET /api/deliveries/:requestId`, `GET /api/sellers/:id/deliveries` (historial) y `GET /api/sellers/:id/stock/:productId` (lo que ya tiene de ese producto, para prellenar la ventana).
  - `GET /api/sellers/:id` agrega a cada línea de stock el precio y el costo propios y los generales del producto.
- **Frontend:**
  - Feature nueva `features/deliveries/` con la ventana «Dejar a vendedor» en `/admin/entregas/nueva` y el resumen de la entrega en `/admin/entregas/:requestId`.
  - Entradas: botón «Dejar a vendedor» en cada tarjeta de «Productos» y botón «Dejar producto» en el detalle del vendedor.
  - Detalle del vendedor: cada producto muestra su precio de venta y su costo con envío efectivos (marca «propio» si son del vendedor), y una sección «Últimas entregas».
  - Aviso (toast) al confirmar, y después el resumen.
- **Pruebas** de backend y frontend (§8).

**No entra en este spec:**

- Cambiar el precio o el costo de un vendedor sin dejarle al menos 1 pieza. Es otra acción con su propia pantalla (Jira lo deja «por decidir»; la decisión está en §9).
- Recordar el costo con envío por producto como valor por defecto de la siguiente entrega (también «por decidir» en Jira; no se hace: ver §9).
- «Retirar» producto (HU-12) y sus movimientos `return`.
- Ventas a los precios del vendedor y cortes (M3). Cada venta guardará en su fila el precio y el costo del momento; aquí solo se guardan los vigentes del vendedor.
- Guardar el precio y el costo que se aplicaron en cada entrega pasada: el historial muestra fecha, producto y piezas, no precios.
- Dejar varios productos en una sola entrega, o dejar piezas a varios vendedores a la vez.
- Paginación o filtros del historial (solo las últimas 20 entregas).
- Mover o deshacer una entrega (un error se corrige con otro movimiento: HU-12 o un ajuste, RNF-05).
- Ver el costo o la ganancia desde el rol vendedor: todo lo de este spec es solo para administradores (RNF-04).

## 2. Reglas de negocio

- **Solo el administrador.** Todos los endpoints exigen `requireRole(request, 'admin')`: un vendedor recibe `403` y sin sesión es `401`.
- **Una entrega son dos movimientos `delivery`** en la misma transacción (T-07): bodega `−N` (`holder_profile_id` null) y vendedor `+N`, con `insertMovements`. Nunca se escribe `vendor_stock.qty`. El total del negocio no cambia.
- **Quién y qué:**
  - El vendedor debe ser un perfil `role = 'vendedor'` y `active = true`. Si no, `404`, como el detalle de HU-09.
  - El producto debe existir y estar activo (`getProduct`). Si no existe o está archivado, `404`. Las bolsitas (productos con `parentProductId`) se pueden dejar como cualquier otro producto.
- **Piezas (`qty`):** entero `> 0`. `0`, negativos, decimales o texto dan `422`. Más piezas que las de la bodega dan `409` «No hay piezas suficientes» (lo traduce `insertMovements`); la ventana lo muestra en el campo y no se mueve nada.
- **Precio y costo del vendedor** (RF-26, RF-27; aplican a todas sus piezas de ese producto):
  - `unitPrice` (2 decimales, máximo `99999999.99`) y `unitCostWithShipping` (4 decimales, máximo `999999.9999`), ambos opcionales, `> 0` si se escriben. Texto en la API; nunca se redondea en silencio (T-08).
  - **Vacío = general.** `null` significa «usar el precio general» y «usar el costo de fábrica». Siempre se guardan **los dos** valores tal como llegan: dejar un campo vacío borra el propio anterior. Por eso la ventana llega **prellenada** con lo que el vendedor ya tiene (así lo que se ve es lo que queda guardado).
  - Una entrega nueva con otros valores **reemplaza** a los anteriores (criterio 5). El precio general del producto no cambia.
- **Precio menor que el costo** (decisión del usuario, criterio 7): se compara el precio **efectivo** (el propio o, si no hay, el general) con el costo **efectivo** (el propio o, si no hay, el de fábrica). Si el precio es menor, la ventana lo avisa en vivo («El precio es menor que el costo») y el botón pasa a «Dejar de todos modos»; **no se bloquea**. Es la excepción a HU-06, que bloquea el precio menor que el costo de un producto: aquí el envío puede volver un caso puntual un negocio de pérdida que el administrador sí quiere. El backend no impone esta regla.
- **Ganancia por pieza** = precio efectivo − costo efectivo, calculada con `money.ts` en unidades enteras (precio a escala 4 para restar) y redondeada a centavos una sola vez, al mostrarla (mitad hacia arriba), como manda `CLAUDE.md`.
- **Vista previa:** «Bodega: 10 → 4» y «Luis: 0 → 6», más «El total del negocio no cambia». Se recalcula en vivo con las piezas escritas y solo se muestra si son válidas.
- **Una entrega no se registra dos veces** (criterio 8, §4): cada intento lleva un `requestId` (UUID) que genera el frontend.
  - Mismo `requestId` y mismos datos (vendedor, producto, piezas): no se mueve nada y se responde la entrega ya hecha, con `200`.
  - Mismo `requestId` con otros datos: `409` «Esta entrega ya se registró con otros datos. Revisa el detalle del vendedor.»
  - Sin `requestId` o con uno que no es UUID: `422`.
- **Solo vendedor y bodega:** el resumen y el historial muestran el costo de fábrica, el costo con envío y la ganancia solo al administrador.
- **Sin piezas, sin envío:** el botón «Dejar a vendedor» queda deshabilitado mientras las piezas no sean un entero mayor a 0 (vacío, `0`, negativo, decimal o texto), además de mientras guarda o carga lo que el vendedor ya tiene. Con piezas escritas se habilita, y los demás errores (vendedor sin elegir, piezas de más, montos) se muestran al enviar.
- **Texto de piezas:** «1 pieza», «N piezas» (regla `unitsLabel`, que pasa a `shared/`, §5).

## 3. Endpoints

`POST /api/sellers/:id/deliveries`, solo para administradores.

```json
// Petición
{
  "requestId": "8f14e45f-ceea-467a-9575-0a1d27f7f6a1",
  "productId": 10,
  "qty": 6,
  "unitPrice": "520.00",
  "unitCostWithShipping": null
}
```

`unitPrice` y `unitCostWithShipping` son obligatorios en el cuerpo, pero pueden ser `null` (= general). Aceptan texto o número JSON, normalizados con `requireMoney`, y notación científica, comas o separadores de miles dan `422`.

```json
// 201 (200 si es una repetición del mismo requestId)
{
  "requestId": "8f14e45f-…",
  "createdAt": "2026-10-30T18:21:07.000Z",
  "qty": 6,
  "seller": { "id": "uuid", "fullName": "Luis Pérez" },
  "product": {
    "id": 10, "name": "Proteína Demo Whey 2 lb", "image": null,
    "price": "450.00", "unitCost": "300.00"
  },
  "unitPrice": "520.00",
  "unitCostWithShipping": null,
  "warehouse": { "before": 10, "after": 4 },
  "sellerStock": { "before": 0, "after": 6 }
}
```

`price` y `unitCost` son los generales del producto; `unitPrice` y `unitCostWithShipping` son los propios del vendedor (`null` = usa los generales). `before` y `after` salen de sumar los movimientos hasta la fila de esta entrega, no del saldo actual, así que una repetición o una consulta posterior responde lo mismo que la primera vez.

`GET /api/deliveries/:requestId` responde el mismo cuerpo (para el resumen, que sobrevive a una recarga). `404` si no existe o si el id no es UUID.

`GET /api/sellers/:id/deliveries` responde las últimas 20 entregas del vendedor, de la más nueva a la más vieja:

```json
// 200
[
  { "requestId": "uuid", "createdAt": "…", "productId": 10, "name": "Proteína Demo Whey 2 lb", "image": null, "qty": 6 },
  { "requestId": null, "createdAt": "…", "productId": 12, "name": "Creatina Monohidratada Demo", "image": "https://…", "qty": 2 }
]
```

`requestId` es `null` en las entregas anteriores a este spec (las del seed de HU-09); esas filas no enlazan a un resumen.

`GET /api/sellers/:id/stock/:productId` responde lo que el vendedor ya tiene de ese producto, aunque tenga 0 piezas:

```json
// 200 (un vendedor sin fila en vendor_stock responde units 0 y los dos precios en null)
{ "units": 2, "unitPrice": "500.00", "unitCostWithShipping": "310.5000" }
```

`GET /api/sellers/:id` (HU-09) agrega a cada línea de `stock`: `price` y `unitCost` generales del producto, y `unitPrice` y `unitCostWithShipping` propios (o `null`).

| Caso | Status | `error.message` |
| --- | --- | --- |
| Vendedor inexistente, desactivado o que no es vendedor; id que no es UUID | 404 | El de `notFound()` |
| Producto inexistente o archivado | 404 | El de `notFound()` |
| `qty` que no es entero `> 0`; precio o costo con decimales de más, fuera de rango o `<= 0`; `requestId` ausente o inválido | 422 | El de `validation()` (p. ej. «El precio admite hasta 2 decimales») |
| Más piezas que la bodega | 409 | No hay piezas suficientes |
| Mismo `requestId` con otros datos | 409 | Esta entrega ya se registró con otros datos. Revisa el detalle del vendedor. |
| Sin sesión / no es administrador | 401 / 403 | Los de `requireRole` |

## 4. Modelo de datos

**Migración** `supabase/migrations/20261030000000_stock_movements_request_id.sql` (forma, no texto final):

```sql
alter table public.stock_movements add column request_id uuid;

-- Una entrega escribe dos filas con el mismo request_id: bodega (holder null) y vendedor.
-- `nulls not distinct` hace que la fila de la bodega también cuente para la unicidad.
create unique index stock_movements_request_holder_key
  on public.stock_movements (request_id, holder_profile_id) nulls not distinct
  where request_id is not null;
```

- La columna es nula y las filas anteriores no cambian: no hay precondición.
- `nulls not distinct` pide PostgreSQL 15 o más. Antes de aplicarla a producción se confirma su versión con `select version()` (paso 1).
- Después, `npm run db:pull` y los dos fixups de `CLAUDE.md` para que `backend/src/db/schema.ts` refleje la columna y el índice.
- `supabase/seed.sql` no cambia: sus entregas quedan con `request_id` nulo.

**Backend:**

```ts
// backend/src/stock/holdings.ts (se agregan; exportados en stock/index.ts)
export interface HolderStockLine {            // se amplía
  productId: number; name: string; image: string | null; units: number
  price: string; unitCost: string                          // generales del producto
  unitPrice: string | null; unitCostWithShipping: string | null  // propios del vendedor
}
export interface HolderHolding { units: number; unitPrice: string | null; unitCostWithShipping: string | null }
export function holdingOf(profileId: string, productId: number): Promise<HolderHolding>
export function setHolderPrices(tx: Tx, profileId: string, productId: number,
  prices: { unitPrice: string | null; unitCostWithShipping: string | null }): Promise<void>  // update de vendor_stock; no toca qty
export interface DeliveryRow { requestId: string | null; createdAt: string; productId: number; name: string; image: string | null; qty: number }
export function listDeliveries(profileId: string, limit: number): Promise<DeliveryRow[]>      // movimientos delivery del vendedor, qty > 0
export function movementsOfRequest(requestId: string): Promise<RequestMovements | null>        // las dos filas + saldos antes/después

// backend/src/accounts/sellers.ts (se agrega)
export function getActiveSellerName(id: string): Promise<{ id: string; fullName: string }>      // 404 si no es un vendedor activo; sin llamar a Supabase Auth

// backend/src/deliveries/index.ts (módulo nuevo; alias @deliveries)
export interface CreateDeliveryInput {
  requestId: string; sellerId: string; productId: number; qty: number
  unitPrice: string | null; unitCostWithShipping: string | null
}
export interface Delivery { /* el cuerpo de §3 */ }
export function createDelivery(input: CreateDeliveryInput, createdBy: string): Promise<{ delivery: Delivery; replayed: boolean }>
export function getDelivery(requestId: string): Promise<Delivery>      // 404 si no existe
```

- `deliveries` usa `accounts`, `products` y `stock` solo por sus `index.ts` (`@accounts`, `@products`, `@stock`), como manda `tests/architecture.test.ts`. La lectura y la escritura de `vendor_stock` y de `stock_movements` viven en `stock`, su módulo dueño.
- `createDelivery` hace, en este orden:
  1. Valida vendedor y producto (`getActiveSellerName`, `getProduct`).
  2. Busca el `requestId`: si ya existe con los mismos datos, devuelve esa entrega con `replayed: true`; con otros datos, `409`.
  3. Abre `withTransaction`: `insertMovements` con las dos filas (cada una con el `request_id`), y luego `setHolderPrices` (el trigger ya creó la fila de `vendor_stock`).
  4. Si el índice único falla (`isUniqueViolation`, dos peticiones iguales a la vez), repite el paso 2.
  5. Lee y arma la entrega con `movementsOfRequest`.
- `insertMovements` recibe un campo nuevo opcional, `requestId`, que escribe en `stock_movements.request_id`.
- `app/api/**/route.ts` queda delgado: valida el cuerpo con `readJson`, `requireString`, `requireMoney`, `parseUuid` y `parseId`, y llama a `@deliveries`.
- `backend/tsconfig.json` agrega `"@deliveries": ["./src/deliveries"]`.

**Frontend (`src/app/features/deliveries/`):**

```ts
// interfaces/delivery.models.ts
export interface DeliveryProduct { id: number; name: string; image: string; stock: number; price: string; unitCost: string }
export interface SellerHolding { units: number; unitPrice: string | null; unitCostWithShipping: string | null }
export interface NewDeliveryInput { requestId: string; productId: number; qty: number; unitPrice: string | null; unitCostWithShipping: string | null }
export interface Delivery { /* el cuerpo de §3 */ }

// models/create-delivery-page.models.ts · constants/create-delivery-page.constants.ts
export type DeliveryFailure = 'not-enough-units' | 'mismatch' | 'not-found' | 'invalid' | 'offline'
export type DeliveryResult = { ok: true; delivery: Delivery } | { ok: false; reason: DeliveryFailure; message?: string }

// rules/delivery.rules.ts (puras)
effectivePrice(general: string, own: string | null): string
effectiveCost(factory: string, own: string | null): string
profitPerUnit(price: string, cost: string): string            // a centavos, mitad hacia arriba, solo al final
isBelowCost(price: string, cost: string): boolean
previewBalances(warehouse: number, seller: number, qty: number): { warehouse: number; seller: number }
filterDeliverableProducts(products: DeliveryProduct[], query: string): DeliveryProduct[]   // stock > 0, sin acentos

// services/ · deliveries.service.ts (create, get, holding), delivery-products.service.ts (GET /api/products y /api/products/:id),
//            delivery-save.service.ts (por página: genera el requestId, evita el segundo envío y traduce HttpErrorResponse a DeliveryResult)
// validators/delivery-form.validators.ts · constants/deliveries.constants.ts
```

- `delivery-products.service.ts` repite una lectura de `ProductsService` porque una feature no importa a otra; sus tipos son los de la entrega, no los de `features/products`.
- **Formulario** (tipado, con `createEmptyForm()` y el orden de «Formularios» de `CLAUDE.md`):

```ts
FormGroup<{
  sellerId: FormControl<string>;          // select, o fijo si viene en la URL
  productId: FormControl<number | null>;  // buscador, o fijo si viene en la URL
  qty: FormControl<string>;               // texto, se convierte a entero al enviar
  unitCostWithShipping: FormControl<string>;  // '' = costo de fábrica
  unitPrice: FormControl<string>;             // '' = precio general
}>
```

- **Parámetros de la URL** de `/admin/entregas/nueva`:
  - `producto` (id) y `vendedor` (id), ambos opcionales: si vienen, ese campo queda fijo.
  - `volver` (`productos` o `vendedor`): a dónde regresa «Cancelar» y «Listo». Solo se aceptan esos dos valores; cualquier otro cae en `productos`. Nunca se navega a una URL que venga en el parámetro.
- **Componentes** (con `ng generate component`, prefijo `app-`):
  - Presentacionales en `features/deliveries/components/`: `delivery-form` (campos, vista previa, ganancia y avisos; recibe el producto, lo que ya tiene el vendedor y los vendedores; emite el payload), `delivery-product-picker` (buscador con la lista filtrada) y `delivery-summary` (el resumen de una entrega).
  - Páginas en `features/deliveries/pages/`: `create-delivery-page` (carga producto, vendedor y lo que ya tiene; guarda con `DeliverySaveService`) y `delivery-summary-page` (`rxResource` sobre `get(requestId)`).
- **Rutas** (`features/deliveries/deliveries.routes.ts`, `DELIVERY_ROUTES`), montadas en `core/layout/routes/admin.routes.ts` como `entregas`: `nueva` (título «Dejar a vendedor») antes de `:requestId` (título «Entrega»), ambas lazy. No son del menú.
- **Sin alias nuevo en el frontend:** `deliveries` entra en `@features/*`.
- **Cambios en otras features** (solo plantillas, reglas y modelos propios; ninguna importa a `deliveries`, solo enlazan a su URL):
  - `features/products/components/product-card`: la tarjeta entera deja de ser un enlace único y pasa a tener dos acciones hermanas: «Editar» (el enlace de hoy) y «Dejar a vendedor» (`/admin/entregas/nueva?producto=ID&volver=productos`, con `&vendedor=ID` si hay uno en «Viendo»). La acción se muestra solo con `stock > 0`. Un enlace dentro de otro no es HTML válido, por eso se rehace la estructura.
  - `features/sellers/pages/seller-detail-page`: botón «Dejar producto» (`/admin/entregas/nueva?vendedor=ID&volver=vendedor`), líneas de stock con precio y costo efectivos, y la sección «Últimas entregas».
  - `features/sellers/components/seller-stock-line`: muestra el precio y el costo con envío efectivos, con la marca «propio» cuando son del vendedor.
  - `features/sellers/components/delivery-history-line` (nuevo): fecha, foto o iniciales, producto y piezas; con `requestId`, enlaza a `/admin/entregas/:requestId`.
  - `unitsLabel` se mueve de `features/sellers/rules/seller.rules.ts` a `shared/utils/units-label.ts`, con su prueba, y `sellers` lo importa de ahí.

## 5. Plan de implementación

1. **Base.** Escribir `20261030000000_stock_movements_request_id.sql` (§4), correr `npm run db:reset` y, con `backend/.env` en LOCAL, `npm run db:pull` con los dos fixups de `CLAUDE.md` (y borrar los archivos de Drizzle). Confirmar con `select version()` en producción que el servidor es PostgreSQL 15 o más, **sin aplicar la migración todavía**. `npm run type-check` pasa.
2. **Backend · stock.** Agregar a `stock/holdings.ts` las funciones nuevas de §4 y ampliar `HolderStockLine` y `stockOfHolder`; agregar `requestId` a `insertMovements`. Ampliar las pruebas de HU-09 que comparan la forma de `stock`. `npm run type-check` y `npm test` pasan.
3. **Backend · módulo `deliveries`.** Crear `src/deliveries/` (`index.ts`, `constants.ts`, `deliveries.ts`), `getActiveSellerName` en `accounts`, el alias `@deliveries`, las rutas de §3 y `backend/tests/deliveries.test.ts` (§8). `npm run type-check` y `npm test` pasan, incluido `architecture.test.ts`.
4. **Frontend · datos y reglas.** Mover `unitsLabel` a `shared/utils/`. Crear la carpeta `features/deliveries/` completa (`interfaces/`, `models/`, `constants/`, `rules/`, `services/`, `validators/`, `components/`, `pages/`) y escribir modelos, servicios, reglas y validadores con sus specs. `ng test` pasa.
5. **Frontend · diseño.** Antes de las pantallas, el flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design, sobre el mockup 03a del canvas, traducido a los tokens de `styles.css` y a las clases `btn-*`, `field-*`, `surface-*` y `alert-*`. Decidir ahí cómo se ve la «ventana» (hoja centrada en escritorio y a pantalla completa en celular de 375 px) y el resumen. No se copian colores ni Vue del mockup.
6. **Frontend · ventana y resumen.** `ng generate component` para `delivery-product-picker`, `delivery-form`, `delivery-summary`, `create-delivery-page` y `delivery-summary-page`, y `deliveries.routes.ts` montado en `admin.routes.ts`. Flujo:
   - Cargando: «Cargando…» con esqueleto. Error de carga: «No pudimos cargar la entrega» con «Reintentar».
   - Al confirmar con éxito: toast «Le dejaste 6 piezas a Luis» y navegación al resumen.
   - Resumen: producto con foto, piezas, «Bodega: 10 → 4», «Luis: 0 → 6», «El total del negocio no cambia», precio y costo aplicados («Precio general» / «Costo de fábrica» si son los generales), ganancia por pieza y los botones «Listo» (vuelve al origen) y «Dejar otro producto».
   - Sin conexión: aviso «No pudimos registrar la entrega» con «Reintentar», que reenvía el mismo `requestId`.
7. **Frontend · entradas y detalle.** Rehacer `product-card` con sus dos acciones, y agregar a `seller-detail-page` el botón «Dejar producto», los precios en las líneas y «Últimas entregas» (`delivery-history-line`, `SellersService.deliveries()`). `ng build`, `ng test` y `npm run check:architecture` pasan.
8. **Verificación manual** contra la base local (§7). Después, con el permiso del usuario, aplicar la migración a producción (paso 1 confirmó la versión).
9. **Cierre.** Actualizar `specs/README.md`, `CLAUDE.md` y `AGENTS.md` (el módulo `src/deliveries/` y el alias `@deliveries` en la estructura del backend) y comentar el avance en `SCRUM-35` en cada paso, con el patrón de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-35`:

- [x] **1.** Desde «Productos» (tarjeta con piezas) y desde el detalle de un vendedor se abre la ventana «Dejar a vendedor» con: el vendedor (fijo si viene uno en «Viendo» o del detalle), las piezas, el costo de fábrica y el precio general, «Otro costo para el vendedor (con envío)», «Otro precio de venta para el vendedor», la ganancia por pieza y la vista previa bodega → vendedor.
- [x] **2.** Con 10 piezas en la bodega y 0 en Luis, dejar 6 muestra «Bodega: 10 → 4» y «Luis: 0 → 6» (en la vista previa y en el resumen), con «El total del negocio no cambia», y la suma de bodega y vendedor sigue en 10.
- [x] **3.** Con el precio y el costo vacíos, a Luis se le aplican el precio general y el costo de fábrica: `vendor_stock.unit_price` y `unit_cost_with_shipping` quedan en `null` y el detalle los muestra como los generales, sin marca «propio».
- [x] **4.** Con un precio o un costo escritos, quedan guardados en `vendor_stock` y el detalle los muestra con la marca «propio»; el `price` y el `unit_cost` del producto no cambian.
- [x] **5.** Dejarle más del mismo producto con otro precio reemplaza al anterior, y la ventana llega prellenada con los valores vigentes. Dejar el campo vacío vuelve al general.
- [x] **6.** Pedir más piezas que las de la bodega, 0, un negativo o un decimal muestra el error en el campo («No hay piezas suficientes» u otro) y no se mueve nada: no se crean movimientos ni cambian `products.stock` y `vendor_stock.qty`.
- [x] **7.** Con un precio efectivo menor que el costo efectivo se ve «El precio es menor que el costo», el botón dice «Dejar de todos modos» y la entrega se puede confirmar; al corregirlo, el aviso desaparece.
- [x] **8.** Sin conexión al confirmar se ve el aviso con «Reintentar». «Reintentar» reenvía el mismo `requestId` y la entrega queda registrada una sola vez, incluso si la primera petición sí llegó (prueba de backend con dos peticiones iguales).

Además:

- [x] Al confirmar con éxito se ve el toast «Le dejaste N piezas a Luis» y después el resumen, que sobrevive a una recarga porque sale de `GET /api/deliveries/:requestId`.
- [x] El detalle del vendedor muestra «Últimas entregas» (hasta 20, de la más nueva a la más vieja), con las del seed de HU-09 sin enlace y las nuevas con enlace a su resumen.
- [x] Una entrega con un vendedor desactivado, un id inventado, o un producto archivado o inexistente responde `404`.
- [x] Reusar un `requestId` con otro producto, vendedor o cantidad responde `409` y no mueve nada; uno ausente o que no es UUID responde `422`.
- [x] Con las piezas vacías, en `0`, negativas, decimales o con texto, «Dejar a vendedor» está deshabilitado y no envía; con un entero mayor a 0 se habilita.
- [x] Los cinco endpoints responden `403` a un vendedor y `401` sin sesión.
- [x] El parámetro `volver` solo acepta `productos` y `vendedor`; con otro valor, «Cancelar» vuelve a «Productos».
- [x] La tarjeta de «Productos» no anida enlaces, y «Dejar a vendedor» no aparece con 0 piezas.
- [x] La ganancia por pieza sale de `money.ts`, sin flotantes, y un precio o costo con decimales de más da error en el campo en vez de redondearse.
- [x] Backend: `npm run type-check` y `npm test` pasan, con `SUPABASE_SERVICE_ROLE_KEY` puesta. Frontend: `ng build`, `ng test` y `npm run check:architecture` pasan.

## 7. Verificación manual

Contra la base local tras `npm run db:reset` (avisar antes: borra las cuentas creadas a mano):

- Como admin, en «Productos», «Dejar a vendedor» en la proteína abre la ventana sin vendedor fijo; elegir a Víctor muestra lo que ya tiene (4 piezas, sin precios propios).
- Dejar 2 piezas con precio `520` y costo vacío: toast, resumen «Bodega: 8 → 6» y «Víctor: 4 → 6»; el detalle de Víctor muestra 6 piezas, `520.00` con «propio» y el costo de fábrica sin marca.
- Con Víctor en «Viendo», la ventana abre con él fijo. Escribir 99 piezas muestra «No hay piezas suficientes» al confirmar. Un precio de `10` con un costo mayor muestra el aviso y «Dejar de todos modos».
- Con el backend apagado, confirmar muestra el aviso con «Reintentar»; encender el backend y reintentar registra una sola entrega (un solo par de movimientos en Studio).
- Recargar el resumen lo vuelve a mostrar igual. «Últimas entregas» del detalle lista la nueva arriba.
- A 375 px de ancho no hay scroll horizontal ni zoom necesario (RNF-03). No hay errores en la consola.

**Verificación manual (2026-10-30, base local con el seed):**
- «Productos» ofrece «Dejar a vendedor» en cada tarjeta con piezas y no en la agotada. La ventana pide el vendedor y, con uno fijo (desde su detalle), lo muestra sin selector.
- Al confirmar sin datos se ven los errores en cada campo. Con Víctor, 2 piezas y precio propio `950`: vista previa «Bodega: 8 → 6» y «Víctor Vendedor: 4 → 6», ganancia `$430.00`, toast «Le dejaste 2 piezas a Víctor Vendedor» y resumen que se vuelve a ver igual al recargar.
- El detalle de Víctor pasa a 8 piezas, muestra `$950.00 propio` con el costo de fábrica sin marca, y «Últimas entregas» lista la nueva arriba y las del seed sin enlace.
- Desde su detalle, el buscador de producto filtra sin acentos; al elegir la proteína la ventana llega prellenada con `950.00`, y pedir 99 piezas muestra «No hay piezas suficientes» sin mover nada.
- No hay errores en la consola.
- **No verificado a mano:** el aviso sin conexión con «Reintentar» (cubierto por las pruebas unitarias y la de dos peticiones iguales del backend) y el ancho de 375 px.
- **Pendiente:** confirmar con `select version()` que producción es PostgreSQL 15 o más y aplicarle la migración `20261030000000`. La consulta a producción quedó sin hacer en esta sesión, y no se aplicó nada a producción.

## 8. Plan de pruebas

- **`backend/tests/deliveries.test.ts`** (contra la base local; cuentas `test-auth-`, productos y movimientos de prueba borrados al terminar, los movimientos del más nuevo al más viejo):
  - Entrega correcta: dos movimientos `delivery` con el mismo `request_id` (bodega `−6`, vendedor `+6`), `products.stock` y `vendor_stock.qty` en sus valores esperados, y `before`/`after` correctos.
  - Precios: vacíos guardan `null`; valores guardan lo escrito; una segunda entrega reemplaza; una tercera con campos vacíos los vuelve a `null`; el precio general del producto no cambia.
  - Errores: más piezas que la bodega (`409`, sin movimientos), `qty` 0, negativa, decimal o texto (`422`), precio con 3 decimales, costo con 5, precio o costo `0` o fuera de rango (`422`), vendedor desactivado, administrador como vendedor, id que no es UUID y producto archivado o inexistente (`404`).
  - Idempotencia: dos peticiones iguales dejan un solo par de movimientos (la segunda responde `200`); mismo `requestId` con otra cantidad es `409`; dos peticiones simultáneas con el mismo `requestId` dejan un solo par; `requestId` ausente o inválido es `422`.
  - Lecturas: `GET /api/deliveries/:requestId` (y `404`), historial (orden, límite y entregas del seed con `requestId` nulo) y `GET /api/sellers/:id/stock/:productId` (con y sin fila).
  - `GET /api/sellers/:id` incluye los precios generales y propios en cada línea.
  - `403` a un vendedor y `401` sin token en los cinco endpoints.
- **`backend/tests/architecture.test.ts`** sigue pasando con el módulo `deliveries` y su alias (`@deliveries` solo apunta a su `index.ts`).
- **`features/deliveries/rules/delivery.rules.spec.ts`:** precio y costo efectivos, ganancia (`520.00 − 310.5000 = 209.50`, redondeo a centavos), `isBelowCost` en el límite, vista previa y filtro de productos sin acentos.
- **`features/deliveries/validators/delivery-form.validators.spec.ts`:** piezas, escalas y rangos de precio y costo, y `> 0`.
- **`features/deliveries/services/…spec.ts`:** URLs y cuerpos de los servicios; `DeliverySaveService` genera un `requestId`, no manda un segundo envío en curso, reusa el `requestId` al reintentar y traduce `409`, `404`, `422` y sin conexión.
- **`features/deliveries/components/…spec.ts`:** `delivery-form` (campos fijos, prellenado, vista previa, ganancia, aviso de precio menor que el costo y botón «Dejar de todos modos», errores al enviar y no al tocar), `delivery-product-picker` y `delivery-summary`.
- **`features/deliveries/pages/…spec.ts`:** `create-delivery-page` (carga, error con «Reintentar», éxito con toast y navegación, `volver` con un valor inválido) y `delivery-summary-page` (resumen, no encontrada, error).
- **`features/products/components/product-card/…spec.ts`:** dos acciones hermanas, sin enlaces anidados; «Dejar a vendedor» oculto con 0 piezas y con el `vendedor` de «Viendo» en la URL.
- **`features/sellers/…`:** `seller-detail-page` (botón «Dejar producto», precios con y sin «propio», «Últimas entregas» vacía y con datos), `seller-stock-line`, `delivery-history-line` y `shared/utils/units-label.spec.ts`.

## 9. Decisiones

- **Sí:** la ventana es una ruta propia, `/admin/entregas/nueva`, en una feature nueva `deliveries` (decisión del usuario). Productos y el detalle solo enlazan a su URL, así que ninguna feature importa a otra y la ventana sobrevive a una recarga.
- **No:** un modal compartido en `shared/` con un servicio en `core/`. Cada página tendría que cargar vendedores, costo y productos por su cuenta.
- **Sí:** vacío = general, y la ventana llega prellenada con lo que el vendedor ya tiene (decisión del usuario). Lo que se ve es lo que queda guardado, y no se pierde un precio propio por dejar un campo en blanco sin darse cuenta.
- **No:** «vacío conserva el anterior» ni «vacío borra siempre» sin prellenar. El primero obliga a otra acción para volver al general; el segundo pierde precios en silencio.
- **Sí:** precio menor que el costo se avisa y se permite (decisión del usuario, criterio 7 de Jira). **Revierte para este caso la regla de HU-06**, que lo bloquea en el alta y la edición de productos: el costo con envío puede volver negocio de pérdida un caso puntual que el administrador sí quiere. Se compara con los valores efectivos.
- **Sí:** idempotencia con `request_id` en `stock_movements` e índice único por `(request_id, holder_profile_id)` (decisión del usuario). Cubre el caso en que la petición llegó pero se perdió la respuesta, que un botón deshabilitado no cubre.
- **No:** un candado en la interfaz como única defensa. «Reintentar» duplicaría la entrega si la respuesta se pierde.
- **Sí:** repetir un `requestId` con los mismos datos responde la entrega ya hecha (`200`), y con otros datos `409`. Si la primera petición no llegó, reintentar con datos nuevos y el mismo `requestId` simplemente funciona; no hace falta lógica extra en la pantalla.
- **Sí:** el vendedor se elige en la ventana, o va fijo si hay uno en «Viendo» o viene del detalle; el producto se busca en la ventana, o va fijo si viene de «Productos» (decisión del usuario). El buscador lista solo los activos con piezas en la bodega, sin acentos.
- **No:** limitar «Dejar» a «Productos». Dejaría el criterio 1 a medias.
- **Sí:** solo se cambia el precio o el costo de un vendedor al dejarle piezas (decisión del usuario, resuelve el primer «por decidir» de Jira). Cambiarlos solos es otra pantalla y otro spec. Por eso `qty > 0`.
- **No:** guardar el costo con envío como valor por defecto por producto (segundo «por decidir» de Jira), igual que decidió T-10. El prellenado ya recuerda lo último que se le puso a ese vendedor.
- **Sí:** al confirmar, toast y resumen de la entrega, y además «Últimas entregas» en el detalle (decisión del usuario). El resumen sale de `GET /api/deliveries/:requestId`, no de un estado de navegación, para sobrevivir a una recarga.
- **Sí:** `before` y `after` salen de sumar los movimientos hasta la fila de la entrega, no del saldo actual, para que consultar el resumen más tarde dé lo mismo que la primera vez.
- **No:** guardar el precio y el costo aplicados en cada entrega para mostrarlos en el historial. Aumenta el esquema y las ventas (M3) guardan su propio precio. El resumen muestra los vigentes, y el historial solo fecha, producto y piezas.
- **Sí:** una sola entrega = un producto y un vendedor. Es lo que dicen la pantalla 03a y los criterios de Jira; «Dejar otro producto» del resumen reabre la ventana con el mismo vendedor.
- **Sí:** módulo nuevo `backend/src/deliveries/` y no dentro de `stock` o `accounts`. Es una operación que cruza `accounts`, `products` y `stock` en una transacción, y `CLAUDE.md` pide que viva en el módulo que la dueña. La escritura de `vendor_stock` queda en `stock`.
- **Sí:** `getActiveSellerName` en `accounts`, sin pasar por Supabase Auth. `getSeller` llama a Auth solo para el correo, que aquí no hace falta.
- **Sí:** `delivery-products.service.ts` propio. Una feature no importa a otra, y esa lectura es pequeña. Si se repite más, se sube a `shared/`.
- **Sí:** los validadores de precio y costo se escriben en `features/deliveries/validators/` con los mensajes de T-08, sin tocar el código de HU-04 y HU-06. Si más adelante hay una tercera pantalla con el mismo patrón, se consolidan en `shared/validators/`.
- **Sí:** `unitsLabel` pasa a `shared/utils/units-label.ts`, porque ahora lo usan `sellers` y `deliveries`.
- **No:** guarda de cambios sin guardar en la ventana. Es un formulario corto y «Cancelar» está a la vista.
- **Sí:** el parámetro `volver` solo acepta dos valores fijos. Una URL libre sería un redirect abierto.
- **No:** mostrar el costo ni la ganancia al rol vendedor (RNF-04). Todo lo de este spec es de administrador.

## 10. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `nulls not distinct` no existe en el PostgreSQL de producción (pide la versión 15) | El paso 1 confirma `select version()` en producción antes de aplicar la migración. Si fuera menor, el índice se hace sobre `(request_id, coalesce(holder_profile_id, '00000000-0000-0000-0000-000000000000'))` |
| Dos peticiones iguales a la vez pasan la búsqueda previa y chocan en el índice | El caso de uso atrapa `isUniqueViolation`, repite la búsqueda y responde la entrega ya hecha; una prueba lo cubre |
| `db:reset` borra las cuentas creadas a mano en local (p. ej. `luis.prueba@mammut.local`) | Avisarlo antes del paso 8; las del seed se recrean solas |
| Los precios del resumen cambian si se vuelve a ver después de otra entrega | Se acepta: el resumen muestra los vigentes y la decisión queda en §9. Las ventas (M3) guardarán su propio precio |
| Rehacer `product-card` rompe el enlace de «Editar» o la prueba de HU-05 | El paso 7 mantiene el mismo enlace y `aria-label`, y actualiza el spec de la tarjeta; la prueba de dos acciones hermanas lo cubre |
| Ampliar `HolderStockLine` rompe las pruebas de HU-09 que comparan el cuerpo completo | El paso 2 las actualiza en el mismo cambio; solo se agregan campos |
| `next dev` con rutas o `schema.ts` viejos tras cambiar de rama | Reiniciar `npm run dev` después de traer cambios del backend |

## Lo que **no** entra en este spec

- Cambiar el precio o el costo de un vendedor sin dejarle piezas.
- Costo con envío como valor por defecto por producto.
- «Retirar» producto (HU-12).
- Ventas y cortes con los precios del vendedor (M3).
- Guardar los precios aplicados en cada entrega, o paginar y filtrar el historial.
- Dejar varios productos o a varios vendedores en una sola entrega.
- Deshacer o editar una entrega.

Cada uno, si llega, va en su propio spec o en su historia.
