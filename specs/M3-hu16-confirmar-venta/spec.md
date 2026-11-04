# Spec técnico — HU-16 · Confirmar mi venta y ver que mi stock baja

> **Estado:** Aprovado
> **Depende de:** M3-hu15-vender-catalogo-carrito (`specs/M3-hu15-vender-catalogo-carrito/spec.md`) — `CartService`, «Carrito», `buildCartRows`/`cartNeedsFix` y los avisos de carrito viejo; M3-t18-base-ventas (`specs/M3-t18-base-ventas/spec.md`) — `POST /api/sales`, `GET /api/sales/:requestId` e idempotencia por `requestId`; M3-hu14-ver-mi-stock (`specs/M3-hu14-ver-mi-stock/spec.md`) — «Mi stock»; M2-hu11-dejar-a-vendedor (`specs/M2-hu11-dejar-a-vendedor/spec.md`) — patrón de guardado con resultado tipado y «Reintentar» con la misma llave; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — `money.ts`
> **Fecha:** 2026-11-03
> **Objetivo:** que el vendedor confirme la venta de su carrito con `POST /api/sales`, sin duplicarla al reintentar, y vea «Venta confirmada» con el desglose mientras su stock baja.

Fuentes:

- **Jira:** historia `SCRUM-50 · HU-16`, épica `SCRUM-8 · M3 · Ventas`. Requerimientos RF-10, RF-21, RF-02, RNF-04, RNF-06. Talla M. Depende de T-18 (`SCRUM-47`) y HU-15 (`SCRUM-49`).
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantallas 06b Carrito con «Confirmar venta» y 06c Venta confirmada).
- **Canvas:** tableros `Venta` (carrito y venta confirmada del vendedor), `EstadosVender` (error «No hay conexión… Tu venta todavía no se registró») y `EstadosCarritoVendedor`.
- **Código:**
  - `backend/src/sales/sales.ts` (`createSale`, `getSale`, recorte de `unitCost`/`profit` al vendedor) y `backend/src/stock/movements.ts` (el `409` «No hay piezas suficientes» no dice qué producto).
  - `core/cart/` (`CartService`, versión 1 del formato guardado), `core/confirm/` (`ConfirmService`).
  - `features/sell/pages/cart-page` (sin «Confirmar venta»), `features/sell/rules/sell.rules.ts` (`cartNeedsFix`) y `features/deliveries/services/delivery-save.service.ts` (patrón de resultado tipado).
  - `shared/utils/uuid.ts` (`newUuid`) y `shared/utils/http-errors.ts`.
- **Decisiones del usuario del 2026-11-03** (§9).

## 1. Alcance

**Entra en este spec:**

- **Frontend · `core/cart/`:**
  - El carrito guarda también el `requestId` de la venta en curso, en la misma llave `mamut.cart.<userId>` (formato versión 2).
- **Frontend · `features/sell/` · «Carrito»:**
  - Botón «Confirmar venta» con diálogo de confirmación (`ConfirmService`).
  - Envío a `POST /api/sales`, botón deshabilitado mientras guarda y con el carrito por corregir.
  - Errores: sin conexión con «Reintentar» (misma llave), `409` de piezas (recarga el stock y marca el renglón) y `409` de venta ya registrada (abre esa venta).
- **Frontend · `features/sell/` · «Venta confirmada»:**
  - Pantalla nueva `/vendedor/venta/:requestId`, leída de `GET /api/sales/:requestId`: desglose con foto, producto, piezas, mi precio, subtotal y total, sin costo ni ganancia.
  - Acciones «Nueva venta» (`/vendedor/vender`) y «Ver mi stock» (`/vendedor/mi-stock`).
  - Estados cargando, no encontrada y error con «Reintentar».
- **Pruebas** de frontend (§7).

**No entra en este spec:**

- Anular una venta (`direct_sale_void`). Lo hará el administrador en su propia historia; HU-16 no muestra ninguna opción de anular.
- Cambios en el backend, migraciones o `supabase/seed.sql`. `POST /api/sales` y `GET /api/sales/:requestId` ya existen (T-18).
- Que el `409` diga qué producto no alcanza (el producto se marca recargando el stock, §2).
- La venta del administrador desde «Productos» (HU-17, `SCRUM-51`).
- Aviso de productos por terminarse (HU-18) y el corte del vendedor (M4a).
- Historial o lista de ventas del vendedor.
- Forma de pago, crédito y precio especial (v2).

## 2. Reglas de negocio

- **Solo el vendedor.** «Carrito» y «Venta confirmada» están detrás de `roleGuard` de `/vendedor`. El vendedor nunca manda `holderId`: el backend vende de su propio stock (`holderId` ausente = su id, T-18 §2). La petición es `{ requestId, lines: [{ productId, qty }] }`.
- **Precio:** el que resuelve el backend al confirmar (`vendor_stock.unit_price` o el general) queda guardado en la venta (T-18). El carrito no manda precios.
- **Stock:** baja solo con los movimientos `direct_sale` que inserta `createSale` (T-07). El frontend no calcula ni guarda saldos.
- **Botón «Confirmar venta»** (en «Carrito», debajo del total):
  - Se ve solo en el estado `ready` del carrito (con renglones y el stock cargado).
  - **Deshabilitado** si `cartNeedsFix(rows)` (algún renglón de más o agotado), con el texto «Corrige los productos marcados para confirmar» debajo.
  - **Deshabilitado** mientras guarda, con el texto «Confirmando…».
- **Diálogo de confirmación** (`ConfirmService.ask`, tono `default`):
  - Título «¿Confirmar venta?», mensaje «N piezas por $total.» (con `unitsLabel` y el total de `cartTotal`), botón «Confirmar venta» y cancelar «Cancelar».
  - Cancelar, `Escape` o la X no envían nada.
- **Una sola petición** (criterio 6): mientras el diálogo está abierto o la petición sigue en curso, otro toque no hace nada (`saving` se pone en `true` antes de abrir el diálogo y se cierra en éxito, error o cancelación).
- **`requestId`** (criterio 5):
  - Lo da `CartService.saleRequestId()`: el que ya está guardado con el carrito o uno nuevo (`newUuid()`) que se guarda en ese momento.
  - Sobrevive a recargar y a cerrar la app, porque vive en `mamut.cart.<userId>` junto a los renglones.
  - Se descarta solo cuando el carrito se vacía (`clear()`, quitar el último renglón o cerrar sesión). Cambiar piezas no lo cambia.
  - «Reintentar» reenvía la misma llave **sin** volver a abrir el diálogo: el vendedor ya confirmó.
- **Éxito (`201`, o `200` con `replayed: true`):**
  - `CartService.clear()` (el carrito y su `requestId` se borran) y navegar a `/vendedor/venta/<requestId>`.
  - Sin toast: la pantalla «Venta confirmada» es el aviso.
  - Al volver a «Vender», el carrito está vacío (criterio 3).
- **Errores al confirmar** (traducidos por `SaleSaveService` a un `SaleResult`; la página no lee `HttpErrorResponse`):
  - **Sin conexión, `5xx` o sin respuesta** (`offline`): alerta «No hay conexión» / «Tu venta todavía no se registró.» con «Reintentar». El carrito y su llave se conservan.
  - **`409` «No hay piezas suficientes»** (`not-enough-units`, criterio 4): alerta «No hay piezas suficientes» y `stockResource.reload()`. Con el stock fresco, los avisos de HU-15 marcan el renglón afectado («Solo te quedan N de este producto» o «Agotado») y el botón queda deshabilitado hasta corregirlo. No se registra nada (la transacción de T-18 se revierte). La llave se conserva: esa venta no existe, así que el siguiente intento con otros renglones se registra normal.
  - **`409` «Esta venta ya se registró con otros datos.»** (`already-registered`): la primera petición sí llegó y después el vendedor cambió el carrito. Se vacía el carrito y se abre `/vendedor/venta/<requestId>` con el aviso «Esta venta ya se había registrado. Esto es lo que se vendió.» (parámetro de consulta `?repetida=1`). Así el vendedor ve lo que de verdad se vendió.
  - **`404` o `422`** (`invalid`: un producto que ya no existe, datos que el backend rechaza): alerta con el mensaje del backend y `stockResource.reload()`, para que el renglón salga «Agotado».
  - Al confirmar, los mensajes de error se distinguen por el texto de `error.message`, como `DeliverySaveService`. Los textos esperados van en `features/sell/constants/sales.constants.ts` y deben ser idénticos a `NOT_ENOUGH_UNITS` (`backend/src/stock/constants.ts`) y `SALE_MISMATCH` (`backend/src/sales/constants.ts`).
- **«Venta confirmada» (`/vendedor/venta/:requestId`):**
  - Siempre se lee de `GET /api/sales/:requestId` con `rxResource`, también justo después de confirmar. Recargar o volver atrás muestra la misma venta.
  - Encabezado «Venta confirmada» con la hora de `soldAt` (`date: 'shortTime'`).
  - Un renglón por producto: foto (o iniciales), nombre, piezas, «mi precio» c/u (`unitPrice`), subtotal y «Te quedan N» (`stock.after`).
  - Total de la venta (`total`). Montos con el pipe `currency` (`Number()` solo para mostrarlos).
  - Nunca hay costo ni ganancia (criterio 7): la respuesta al vendedor no trae `unitCost` ni `profit` (T-18), y los modelos del frontend no tienen esas llaves.
  - Acciones: «Nueva venta» (primario) y «Ver mi stock» (secundario).
  - **Estados:** cargando (esqueletos de renglón); no encontrada (`404` o `422`): «No encontramos esta venta» con «Ir a vender»; error de red: mensaje y «Reintentar» (`reload()`).
- **Stock después de vender** (criterio 2): «Mi stock» y «Stock general» ya leen el stock al entrar (`rxResource`), así que muestran las piezas nuevas sin cambios de código. La bodega no cambia porque la venta del vendedor solo mueve su `vendor_stock`.
- **Textos:** los de este spec son los de partida y se confirman contra el canvas en el paso de diseño (§5 paso 5).
- **Celular (RNF-03):** a 375 px sin zoom ni scroll horizontal. «Confirmar venta», «Nueva venta» y «Ver mi stock» miden al menos 52 px de alto, como los botones de HU-15.

## 3. Endpoints

No hay endpoints nuevos. Se consumen los de T-18 como vendedor:

```json
// POST /api/sales — petición
{ "requestId": "6f1c…-uuid", "lines": [{ "productId": 3, "qty": 2 }] }
```

```json
// 201 (nueva) o 200 (repetida) — y el mismo objeto `sale` en GET /api/sales/:requestId
{
  "sale": {
    "id": 31,
    "requestId": "6f1c…-uuid",
    "soldAt": "2026-11-03T18:20:11.512Z",
    "soldById": "uuid",
    "holder": { "id": "uuid", "fullName": "Víctor Demo" },
    "lines": [
      {
        "productId": 3,
        "name": "Proteína Demo Whey 2 lb",
        "image": null,
        "qty": 2,
        "unitPrice": "920.00",
        "subtotal": "1840.00",
        "stock": { "before": 6, "after": 4 }
      }
    ],
    "total": "1840.00"
  },
  "replayed": false
}
```

| Caso | Status | `SaleResult` |
| --- | --- | --- |
| Venta nueva o repetida igual | 201 / 200 | `{ ok: true, sale, replayed }` |
| Alguna pieza no alcanza | 409 «No hay piezas suficientes» | `not-enough-units` |
| Llave usada con otros renglones | 409 «Esta venta ya se registró con otros datos.» | `already-registered` |
| Producto inexistente o datos inválidos | 404 / 422 | `invalid` (con el mensaje) |
| Sin respuesta, `0` o `5xx` | — | `offline` |

`401`/`403` siguen el flujo de sesión de siempre (`auth.interceptor`).

## 4. Modelo de datos

Sin migración ni cambios en el backend.

**Frontend · `src/app/core/cart/`:**

```ts
// cart.models.ts (cambia)
export interface StoredCart { version: number; lines: CartLine[]; requestId?: string }

// cart.constants.ts (cambia)
export const CART_STORAGE_VERSION = 2;
export const LEGACY_CART_STORAGE_VERSION = 1;   // se lee como v2 sin requestId

// cart.service.ts (cambia)
saleRequestId(): string;   // el guardado, o uno nuevo con newUuid() que se guarda
// clear(), remove() del último renglón y cerrar sesión descartan también el requestId.
```

- Un carrito guardado en versión 1 se lee igual (sin `requestId`) y se reescribe en versión 2 en el siguiente cambio. Cualquier otra versión, un `requestId` que no sea UUID o JSON inválido se descartan como hoy.
- `CartService` importa `newUuid` de `@shared/utils/uuid` (core → shared).

**Frontend · `src/app/features/sell/`:**

```ts
// interfaces/sale.models.ts
export interface SaleLine {
  productId: number; name: string; image: string | null; qty: number;
  unitPrice: string; subtotal: string; stock: { before: number; after: number };
}
export interface Sale {
  id: number; requestId: string; soldAt: string; soldById: string;
  holder: { id: string; fullName: string } | null;
  lines: SaleLine[]; total: string;
}
export interface CreateSaleRequest { requestId: string; lines: { productId: number; qty: number }[] }
export interface SaleResponse { sale: Sale; replayed: boolean }
export type SaleResult =
  | { ok: true; sale: Sale; replayed: boolean }
  | { ok: false; reason: 'not-enough-units' | 'already-registered' | 'offline' }
  | { ok: false; reason: 'invalid'; message: string };

// services/sales.service.ts (providedIn: 'root')
create(body: CreateSaleRequest): Observable<SaleResponse>   // POST ${API_BASE_URL}/api/sales
get(requestId: string): Observable<SaleResponse>            // GET  ${API_BASE_URL}/api/sales/:requestId

// services/sale-save.service.ts (sin providedIn; lo provee cart-page)
confirm(body: CreateSaleRequest): Observable<SaleResult>     // traduce los errores HTTP

// rules/sell.rules.ts (se agrega)
buildSaleRequest(requestId: string, rows: CartRow[]): CreateSaleRequest   // solo renglones 'ok'

// models/cart-page.models.ts (se agrega)
export type CartConfirmError = 'offline' | 'not-enough-units' | 'invalid';

// models/sale-summary-page.models.ts
export type SaleSummaryState = 'loading' | 'ready' | 'not-found' | 'error';
```

- `SaleLine` y `Sale` no tienen `unitCost` ni `profit`.
- **Constantes:**
  - `constants/sales.constants.ts`: `NOT_ENOUGH_UNITS_MESSAGE`, `SALE_MISMATCH_MESSAGE`, `SALE_SUMMARY_URL = '/vendedor/venta'`, `REPLAYED_QUERY_PARAM = 'repetida'`.
  - `constants/cart-page.constants.ts` (se amplía): «Confirmar venta», «Confirmando…», el motivo del botón deshabilitado, los textos del diálogo y de las tres alertas.
  - `constants/sale-summary-page.constants.ts`: textos de «Venta confirmada», del aviso de venta repetida, de los estados y los enlaces `/vendedor/vender` y `/vendedor/mi-stock`.
- **Componente presentacional nuevo** (`features/sell/components/sale-line`, solo `input()`): un renglón de la venta (foto o iniciales, nombre, piezas, precio c/u, subtotal y «Te quedan N»).
- **Página nueva:** `pages/sale-summary-page` (`/vendedor/venta/:requestId`), con `rxResource` sobre `SalesService.get()` y el parámetro `repetida` leído de la URL.
- **Rutas:**
  - `features/sell/sell.routes.ts` exporta además `SALE_ROUTES` (`':requestId'` → `sale-summary-page`, `data: { title: 'Venta confirmada' }`, con `loadComponent`).
  - `core/layout/routes/seller.routes.ts` agrega `venta` → `loadChildren` de `SALE_ROUTES`.
- `features/sell` sigue sin importar otras features.

## 5. Plan de implementación

1. **Frontend · `core/cart/`.**
   - `requestId` en `StoredCart`, versión 2 con lectura de la 1, `saleRequestId()` y el descarte al vaciar.
   - Ampliar `cart.service.spec.ts` (§7). `ng test` pasa.
2. **Frontend · datos de la venta.**
   - `interfaces/sale.models.ts`, `constants/sales.constants.ts`, `SalesService`, `SaleSaveService` y `buildSaleRequest`, con sus specs. `ng test` pasa.
3. **Frontend · «Confirmar venta» en «Carrito».**
   - Botón, diálogo, `saving`, envío con `saleRequestId()`, éxito (vaciar y navegar) y las tres alertas con su recarga del stock.
   - `SaleSaveService` en los `providers` de `cart-page`.
   - Ampliar `cart-page.component.spec.ts`. `ng test` pasa.
4. **Frontend · ruta de «Venta confirmada».**
   - `ng generate component` para `pages/sale-summary-page` y `components/sale-line`.
   - `SALE_ROUTES` en `sell.routes.ts` y `venta` en `seller.routes.ts`, con la pantalla mínima (datos y estados sin acabado visual).
   - `ng build` pasa.
5. **Frontend · diseño.** El flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design, sobre el tablero `Venta` (06c) y `EstadosVender`, traducidos a los tokens de `styles.css`.
   - Se confirman los textos de §2 (botón, diálogo, alertas, «Venta confirmada» y sus estados).
   - Se reusan `surface-*`, `page-title`, `alert-*`, `Skeleton`, `pButton` y el aspecto de `cart-line`.
   - No se copian del mockup los colores, forma de pago, contado/crédito, «Anular» ni el menú inferior.
6. **Frontend · acabado y pruebas de «Venta confirmada».**
   - Aplicar el diseño a `sale-summary-page` y `sale-line`, y escribir sus specs (§7).
   - Cierre del paso: `ng build`, `ng test` y `npm run check:architecture` pasan.
7. **Verificación manual** contra la base local con el seed, como `vendedor1@mammut.local`, en escritorio y a 375 px:
   - Con 2 piezas de la proteína en el carrito (Víctor tiene 6), «Confirmar venta» abre el diálogo; «Cancelar» no envía nada.
   - Confirmar abre «Venta confirmada» con foto o iniciales, producto, 2 piezas, su precio, subtotal, total y «Te quedan 4». En la respuesta de red no hay `unitCost` ni `profit`.
   - Recargar «Venta confirmada» muestra la misma venta. «Nueva venta» lleva a «Vender» con el carrito vacío. «Ver mi stock» muestra 4.
   - Como `admin@mammut.local`, «Stock general» muestra 4 para Víctor, el total del negocio 2 menos y la bodega igual.
   - Con un carrito armado, retirarle piezas a Víctor desde el administrador sin recargar el carrito; confirmar: «No hay piezas suficientes», el renglón se marca, el botón se deshabilita y no se registra venta.
   - Con la red cortada (DevTools «Offline»): confirmar muestra «No hay conexión… Tu venta todavía no se registró.». Al reconectar, «Reintentar» registra una sola venta (mismo `requestId` en las dos peticiones).
   - Bloquear la respuesta de `POST /api/sales` con la petición ya enviada (el backend la registra), cambiar una pieza del carrito y reintentar: se abre esa venta con el aviso de venta repetida y el carrito queda vacío.
   - Dos toques rápidos en «Confirmar venta» abren un solo diálogo y sale una sola petición.
   - Al terminar, `npm run db:reset` deja la base como el seed.
8. **Cierre.**
   - Actualizar `specs/README.md` (fila y relaciones).
   - Actualizar `CLAUDE.md` y `AGENTS.md`: `requestId` y versión 2 en `core/cart/`, «Confirmar venta» y la ruta `/vendedor/venta/:requestId` en la feature `sell`.
   - Recordar que la migración de T-18 debe estar en producción antes de desplegar.
   - Comentar el avance en `SCRUM-50` en cada paso y moverla de estado según el flujo de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-50`:

- [ ] **1.** Con 2 piezas en el carrito de un producto del que quedan 6, «Confirmar venta» (y aceptar el diálogo) abre «Venta confirmada» con foto o iniciales, producto, piezas, mi precio, subtotal y total, y el stock de ese producto queda en 4.
- [ ] **2.** Después de la venta, «Mi stock» muestra 4 piezas de ese producto, «Stock general» muestra 4 para ese vendedor y el total del negocio 2 menos, y la bodega no cambia.
- [ ] **3.** Tras confirmar, «Vender» y «Carrito» muestran el carrito vacío y el contador de `top-nav` desaparece.
- [ ] **4.** Si el administrador le retiró piezas y ya no alcanzan, confirmar muestra «No hay piezas suficientes», el renglón afectado sale con su aviso de HU-15, no queda ninguna venta nueva y el vendedor puede corregir el carrito y confirmar.
- [ ] **5.** Sin conexión o sin respuesta, «Reintentar» manda el mismo `requestId` y la venta queda registrada una sola vez, también si el vendedor recargó la página entre los dos intentos.
- [ ] **6.** Dos toques seguidos en «Confirmar venta» dan un solo diálogo y una sola petición, y el botón queda deshabilitado mientras guarda.
- [ ] **7.** Ni «Venta confirmada», ni el carrito, ni las respuestas de `POST /api/sales` y `GET /api/sales/:requestId` al vendedor contienen costo ni ganancia.

Además:

- [ ] Con un renglón de más o agotado, «Confirmar venta» está deshabilitado con «Corrige los productos marcados para confirmar».
- [ ] Cancelar el diálogo, `Escape` o la X no envían nada y el botón vuelve a estar disponible.
- [ ] Un `409` «Esta venta ya se registró con otros datos.» vacía el carrito y abre esa venta con el aviso de venta repetida.
- [ ] Recargar `/vendedor/venta/:requestId` muestra la misma venta; un `requestId` que no existe o no es UUID muestra «No encontramos esta venta» con «Ir a vender»; un error de red muestra «Reintentar».
- [ ] «Nueva venta» lleva a `/vendedor/vender` y «Ver mi stock» a `/vendedor/mi-stock`.
- [ ] Un carrito guardado en versión 1 se conserva al actualizar; vaciar el carrito o cerrar sesión descarta su `requestId`.
- [ ] No hay ninguna opción para anular la venta.
- [ ] A 375 px no hay scroll horizontal ni zoom, y los botones de las dos pantallas miden al menos 52 px de alto.
- [ ] `features/sell` no importa otras features; `core/cart` no importa `features/`.
- [ ] `ng build`, `ng test` y `npm run check:architecture` pasan. El backend no cambia: `npm test` de `backend/` sigue pasando.

## 7. Plan de pruebas

- **`core/cart/cart.service.spec.ts`** (se amplía):
  - `saleRequestId()` crea un UUID, lo guarda en `mamut.cart.<userId>` y devuelve el mismo en llamadas siguientes y tras crear el servicio de nuevo.
  - Cambiar piezas no cambia la llave; `clear()`, quitar el último renglón y cerrar sesión la descartan.
  - Un carrito en versión 1 se lee con sus renglones; un `requestId` que no es UUID descarta el carrito.
- **`features/sell/services/sales.service.spec.ts`:** `create()` hace `POST /api/sales` con el cuerpo y `get()` hace `GET /api/sales/<requestId>`.
- **`features/sell/services/sale-save.service.spec.ts`:** `201`/`200` → `ok` con `replayed`; `409` con cada mensaje → `not-enough-units` / `already-registered`; `404` y `422` → `invalid` con el mensaje; `500` y sin respuesta → `offline`.
- **`features/sell/rules/sell.rules.spec.ts`** (se amplía): `buildSaleRequest` arma `{ requestId, lines }` solo con los renglones `ok` y con `qty` = piezas.
- **`features/sell/pages/cart-page/cart-page.component.spec.ts`** (se amplía):
  - «Confirmar venta» abre el diálogo con piezas y total; cancelar no envía.
  - Aceptar envía con `saleRequestId()`; en éxito vacía el carrito y navega a `/vendedor/venta/<requestId>`.
  - Dos clics seguidos: un diálogo y una petición; el botón deshabilitado con «Confirmando…».
  - Deshabilitado con `cartNeedsFix`.
  - `offline`: alerta y «Reintentar» reenvía la misma llave sin diálogo.
  - `not-enough-units` e `invalid`: alerta y recarga del stock.
  - `already-registered`: vacía el carrito y navega con `?repetida=1`.
- **`features/sell/components/sale-line/sale-line.component.spec.ts`:** foto o iniciales, piezas, precio c/u, subtotal y «Te quedan N»; sin costo ni ganancia.
- **`features/sell/pages/sale-summary-page/sale-summary-page.component.spec.ts`:** pide `GET /api/sales/<requestId>`; los estados cargando, lista, no encontrada (`404` y `422`) y error con «Reintentar»; el total; el aviso con `?repetida=1`; los enlaces «Nueva venta» y «Ver mi stock».
- **`core/layout/routes/seller.routes.spec.ts`:** `venta` carga `SALE_ROUTES`.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La primera petición llega pero se pierde la respuesta, y un reintento la duplica | El `requestId` vive con el carrito en `localStorage`, sobrevive a recargar y solo se descarta al vaciar el carrito; el backend responde la venta ya hecha (T-18) |
| El vendedor cambia el carrito después de una petición que sí llegó | El backend responde `409` de venta ya registrada y la app abre esa venta y vacía el carrito: se ve lo que de verdad se vendió |
| El vendedor vacía el carrito después de una petición sin respuesta que sí llegó | La llave se descarta y la app no lo sabe, pero la venta está registrada y su stock ya bajó en «Mi stock». Se acepta: quitar todo es una acción explícita del vendedor |
| El `409` de piezas no dice qué producto falló | Se recarga el stock y los avisos de HU-15 marcan el renglón; si el stock cambia otra vez, el backend vuelve a validar al confirmar |
| Los mensajes del backend cambian y el frontend deja de distinguir los dos `409` | Los textos esperados están en `sales.constants.ts` con un comentario que apunta a `backend/src/stock/constants.ts` y `backend/src/sales/constants.ts`; `sale-save.service.spec.ts` los fija |
| Subir `CART_STORAGE_VERSION` borra los carritos ya guardados | La versión 1 se sigue leyendo como versión 2 sin `requestId` |
| La migración de T-18 no está en producción al desplegar | El cierre del paso 8 lo recuerda en `SCRUM-50` y en el índice de specs |

## 9. Decisiones

- **Sí:** anular una venta es solo del administrador y va en su propia historia (decisión del usuario). HU-16 no muestra «Anular» ni toca `direct_sale_void`.
- **No:** que el vendedor anule su venta. Pide endpoint, reglas y pruebas nuevas, y abre la puerta a cuadrar mal el corte.
- **Sí:** «Venta confirmada» ofrece «Nueva venta» y «Ver mi stock» (decisión del usuario). El vendedor lee el desglose a su ritmo.
- **No:** regresar sola a «Vender» tras unos segundos.
- **Sí:** «Venta confirmada» tiene su URL `/vendedor/venta/:requestId` y se lee de `GET /api/sales/:requestId` (decisión del usuario). Sobrevive a recargar, como los resúmenes de entrega y retiro.
- **No:** mostrar el desglose como un estado dentro de «Carrito», que se pierde al recargar.
- **Sí:** ante el `409` de piezas, el frontend recarga el stock y los avisos de HU-15 marcan el renglón (decisión del usuario). No cambia el backend ni el formato `{ error: { code, message } }`.
- **No:** que el `409` traiga los `productId` que no alcanzan.
- **Sí:** el `requestId` se guarda con el carrito en `localStorage` y solo se renueva al vaciarlo (decisión del usuario). Un reintento tras recargar no duplica la venta.
- **No:** un `requestId` por pantalla como en «Dejar», que se pierde al recargar.
- **Sí:** un `409` de venta ya registrada abre esa venta y vacía el carrito (decisión del usuario).
- **No:** solo mostrar el error, que deja al vendedor sin saber qué se vendió.
- **Sí:** «Confirmar venta» pide confirmación con `ConfirmService` (decisión del usuario). Un toque más por venta a cambio de no registrar una venta por error.
- **Sí:** «Reintentar» reenvía sin volver a abrir el diálogo. El vendedor ya confirmó esa venta.
- **Sí:** el botón se deshabilita con el carrito por corregir y dice por qué (decisión del usuario). Es lo que dejó preparado `cartNeedsFix` en HU-15.
- **No:** enviar igual y dejar que el backend lo rechace.
- **Sí:** la versión 1 del carrito guardado se sigue leyendo (recomendación). Subir la versión no borra los carritos armados.
- **Sí:** «Venta confirmada» muestra «Te quedan N» por renglón con `stock.after` (recomendación). El vendedor ve que su stock bajó (criterio 1) sin ir a «Mi stock»; el dato ya viene en la respuesta.
- **Sí:** sin toast al confirmar (recomendación). La pantalla «Venta confirmada» ya es el aviso.
- **Sí:** «Venta confirmada» siempre lee el GET, también recién confirmada (recomendación). Un solo camino de datos para el primer render y la recarga.
- **No:** cambios en el backend, migraciones o el seed. T-18 ya da lo que pide esta historia.

## Lo que **no** entra en este spec

- Anular una venta (historia del administrador).
- Cambios en el backend o un `409` con los productos que no alcanzan.
- La venta del administrador (HU-17).
- Aviso de productos por terminarse (HU-18) y el corte del vendedor (M4a).
- Historial de ventas del vendedor.
- Forma de pago, crédito y precio especial.

Cada uno, si llega, va en su propio spec o en su historia.
