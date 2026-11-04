# Spec técnico — HU-17 · Vender como administrador desde Productos (carrito y venta confirmada)

> **Estado:** Aprovado
> **Depende de:** M3-t18-base-ventas (`specs/M3-t18-base-ventas/spec.md`) — `POST /api/sales` con `holderId`, `GET /api/sales/:requestId`, `unitCost` y `profit` solo para el administrador; M3-hu16-confirmar-venta (`specs/M3-hu16-confirmar-venta/spec.md`) — `CartService` v2 con `requestId`, `SaleSaveService`, «Confirmar venta» y «Venta confirmada»; M3-hu15-vender-catalogo-carrito (`specs/M3-hu15-vender-catalogo-carrito/spec.md`) — `buildCartRows`, `cartTotal`, `cartNeedsFix`, `cart-line`, `cart-bar`; M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`) — `ViewingService`; M2-hu13-stock-general (`specs/M2-hu13-stock-general/spec.md`) — acciones rápidas de «Stock general»; M1-hu05-ver-y-buscar-productos (`specs/M1-hu05-ver-y-buscar-productos/spec.md`) — «Productos» y `product-card`; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — `money.ts`
> **Fecha:** 2026-11-04
> **Objetivo:** que el administrador agregue productos al carrito desde «Productos», del stock del titular en «Viendo» (bodega o un vendedor), y confirme la venta viendo su total y su ganancia, sin vender del stock equivocado ni registrarla dos veces.

Fuentes:

- **Jira:** historia `SCRUM-51 · HU-17`, épica `SCRUM-8 · M3 · Ventas`. Requerimientos RF-10, RNF-04. Talla M. Depende de T-18 (`SCRUM-47`), HU-05, HU-10 y HU-13.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantallas 03 Productos y venta, 03c Carrito y venta confirmada; acción rápida «Vender» de 02).
- **Canvas:** tableros `Venta` (vistas del administrador), `EstadosVender` y `EstadosCarritoVendedor`.
- **Código:**
  - `backend/src/sales/sales.ts` (`createSale` con `holderId` para el administrador, `unitCost`/`profit` solo a él) y `backend/src/stock/holdings.ts` (`stockOfHolder` con `includeSoldOut`, `HolderStockLine` con `unitPrice` y `unitCostWithShipping`).
  - `backend/src/inventory/own-stock.ts` (`getOwnStock`, el patrón del catálogo por titular).
  - `core/cart/` (`CartService` v2), `core/viewing/viewing.service.ts` (`pick`, `select`, `selectedSellerId`), `core/layout/admin-shell/` (llama a `viewing.pick`), `core/confirm/`.
  - `core/layout/routes/admin.routes.ts` (`carrito` sigue en «Próximamente»).
  - `features/products/components/product-card` y `pages/products-page`; `features/stock/constants/stock-page.constants.ts` (acciones rápidas).
  - `features/sell/` (reglas, `cart-line`, `cart-bar`, `sale-line`, `SaleSaveService`, `cart-page`, `sale-summary-page`).
- **Decisiones del usuario del 2026-11-04** (§9).

## 1. Alcance

**Entra en este spec:**

- **Backend:**
  - `GET /api/sales/catalog?holderId=` (solo administrador): los productos que se pueden vender de un titular, con piezas, precio y costo ya resueltos.
  - `getSaleCatalog(holderId)` en `src/inventory/sale-catalog.ts`.
- **Frontend · `core/cart/`:**
  - El carrito guarda su titular (`holderId`, `null` = bodega) junto a los renglones y el `requestId` (formato versión 3; la 2 se lee con titular bodega).
- **Frontend · `core/sale-catalog/`:**
  - `SaleCatalogService`: cliente de `GET /api/sales/catalog`, compartido por «Productos» y el carrito del administrador.
- **Frontend · `core/layout/admin-shell`:**
  - Cambiar de «Viendo» con un carrito de otro titular pregunta «¿Vaciar el carrito?»; cancelar deja el titular anterior.
- **Frontend · `shared/components/cart-bar`:**
  - La barra «Carrito · N piezas · $total · Ver carrito» pasa de `features/sell` a `shared/`, con el destino del enlace como `input()`, para usarla en «Vender» y en «Productos».
- **Frontend · `features/products/` · «Productos»:**
  - En cada card, «Vender» junto a «Dejar a vendedor»: el primer toque agrega 1 pieza y el botón se vuelve − N + con tope en las piezas del titular.
  - Con un vendedor en «Viendo», una línea «Luis: N» en la card.
  - La barra del carrito abajo cuando hay piezas.
- **Frontend · `features/sell/` · administrador:**
  - `/admin/carrito`: renglones con precio, −/+, subtotal y «Quitar», titular («Vendiendo de: Bodega» / «Vendiendo de: Luis»), total, ganancia, «Confirmar venta» con diálogo, avisos y errores como HU-16.
  - `/admin/venta/:requestId`: «Venta confirmada» con foto, producto, piezas, precio, subtotal, ganancia por renglón, «Bodega: 4 → 2» / «Luis: 6 → 4», total y ganancia de la venta; acciones «Nueva venta» y «Ver stock general».
- **Frontend · `features/stock/`:**
  - Acción rápida «Vender» en «Stock general» hacia `/admin/productos`.
- **Pruebas** de backend y frontend (§7).

**No entra en este spec:**

- Si una venta registrada por el administrador con un vendedor en «Viendo» cuenta para el corte de ese vendedor: se decide en M4a. La venta ya guarda el titular (`holder_profile_id`) y quién la registró (`sold_by`).
- Anular una venta (`direct_sale_void`): historia propia del administrador.
- Precio especial (RF-12), contado o crédito (RF-13): v2.
- Aviso de baja existencia (HU-18) y cortes (M4a/M4b).
- Historial o lista de ventas.
- Un carrito por titular: hay uno solo y guarda a qué titular pertenece.
- Mostrar en «Productos» todo el stock del vendedor en lugar del de bodega (la card sigue diciendo «N en bodega»).
- Cambios en `POST /api/sales`, `GET /api/sales/:requestId`, migraciones o `supabase/seed.sql`.
- Cambios en la experiencia del vendedor (HU-15/HU-16), salvo que `cart-bar` se mueve a `shared/` sin cambiar cómo se ve.

## 2. Reglas de negocio

- **Solo el administrador.** «Productos», `/admin/carrito` y `/admin/venta/:requestId` están detrás de `roleGuard` de `/admin`. `GET /api/sales/catalog` exige `requireRole(request, 'admin')`.
- **Titular de la venta:**
  - Es el de «Viendo» cuando se agrega la primera pieza: `null` = «Yo · bodega», o el id de un vendedor activo.
  - Se guarda con el carrito (`CartService.holderId()`) y no cambia mientras el carrito tenga renglones.
  - Al confirmar se manda como `holderId` (`null` para bodega) en `POST /api/sales`.
- **Cambiar de «Viendo» con carrito** (decisión del usuario):
  - Si el carrito está vacío o es del mismo titular, el cambio pasa sin preguntar.
  - Si tiene renglones de otro titular: `ConfirmService.ask` con «¿Vaciar el carrito?» / «Tu carrito es de {titular}. Si cambias a {nuevo}, se vacía.» / «Vaciar y cambiar» / «Cancelar».
  - Aceptar vacía el carrito (y su `requestId`) y aplica el cambio con `viewing.pick()`.
  - Cancelar, `Escape` o la X no cambian nada: la barra «Viendo» regresa al titular anterior.
  - `viewing.select()` (cuando una página fija la selección, p. ej. el detalle de un vendedor) no pregunta ni vacía: el carrito conserva su propio titular, y la regla siguiente lo cubre.
- **Agregar con otro titular:** si el carrito tiene renglones de un titular distinto al de «Viendo» (p. ej. tras cerrar el navegador, «Viendo» volvió a «Yo» y el carrito era de Luis), el primer «Vender» en «Productos» pregunta lo mismo; aceptar vacía el carrito y agrega con el titular nuevo.
- **Catálogo por titular** (`GET /api/sales/catalog`):
  - **Bodega** (`holderId` ausente o vacío): todos los productos activos, `units` = `products.stock`, `price` = precio general y `unitCost` = costo de fábrica.
  - **Vendedor** (`holderId` = uuid de un vendedor activo; si no, `404`): lo que tiene y lo que tuvo (`stockOfHolder(id, { includeSoldOut: true })`), `units` = sus piezas, `price` = su precio o el general, `unitCost` = su costo con envío o el de fábrica.
  - Ordenado por nombre, como lo entrega el backend.
- **«Vender» en la card de «Productos»:**
  - Se ve cuando el titular de «Viendo» tiene piezas de ese producto o ya está en el carrito.
  - Primer toque: agrega 1 pieza. Después el botón es «−» / «N» / «+»; «+» se deshabilita en el tope (piezas del titular); «−» con 1 pieza quita el producto.
  - El tope y el precio salen del catálogo del titular de «Viendo», nunca de `products.stock` cuando es un vendedor.
  - Con un vendedor en «Viendo», la card agrega «Luis: N» (sus piezas). Sin piezas, «Vender» no sale.
  - El enlace de la card a «Editar» y «Dejar a vendedor» no cambian.
- **Barra del carrito en «Productos»:** «Carrito · N piezas · $total» y «Ver carrito» → `/admin/carrito`, solo con piezas en el carrito, como en «Vender».
- **`/admin/carrito`:**
  - Lee el catálogo del titular del carrito (no el de «Viendo») y resuelve los renglones con `buildCartRows`. Los avisos de carrito viejo («Solo te quedan N de este producto», «Agotado») son los de HU-15.
  - Encabezado «Vendiendo de: Bodega» o «Vendiendo de: {nombre}».
  - Total con `cartTotal` y **ganancia** con `cartProfit`: Σ (precio − costo) × piezas de los renglones `ok`, en diezmilésimas con `money.ts`, redondeada a centavos una sola vez al final (mitad hacia arriba, T-08).
  - «Confirmar venta», diálogo, `saving`, `requestId` del carrito, «Reintentar» sin diálogo, `409` de piezas, `409` de venta ya registrada y `invalid`: igual que HU-16 (§2 de su spec), con `holderId` en la petición y las URLs de `/admin`.
  - Éxito: vaciar el carrito (también su titular) y navegar a `/admin/venta/<requestId>`. Sin toast. Avisar a `StockChangesService` para que «Productos» y «Stock general» recarguen.
- **«Venta confirmada» del administrador (`/admin/venta/:requestId`):**
  - Se lee siempre de `GET /api/sales/:requestId` con `rxResource`.
  - Encabezado «Venta confirmada», hora (`soldAt`) y titular («Bodega» o el nombre de `sale.holder`).
  - Un renglón por producto: foto (o iniciales), nombre, piezas × precio c/u, subtotal, ganancia del renglón (`profit`) y stock «Bodega: 4 → 2» o «Luis: 6 → 4» (`stock.before → stock.after`).
  - Total (`total`) y ganancia de la venta (`profit`). Montos con `currency` (`Number()` solo al mostrar).
  - Acciones: «Nueva venta» → `/admin/productos` (primario) y «Ver stock general» → `/admin/stock` (secundario).
  - Estados: cargando, no encontrada (`404`/`422`) con «Ir a Productos», error de red con «Reintentar»; aviso de venta repetida con `?repetida=1`, como HU-16.
- **Acción rápida «Vender»** en «Stock general»: un botón más junto a «Entrada a bodega», «Dejar a vendedor» y «Nuevo producto», hacia `/admin/productos`.
- **Ganancia y costos solo para el administrador** (RNF-04): el catálogo nuevo exige rol admin y las pantallas viven en `/admin`. Las pantallas del vendedor no cambian.
- **Stock:** baja solo con los `direct_sale` de `createSale` (T-07). Vender de un vendedor no mueve la bodega.
- **Textos:** los de este spec son de partida y se confirman contra el canvas en el paso de diseño (§5 paso 8).
- **Celular (RNF-03):** a 375 px sin scroll horizontal; «Vender», −/+, «Confirmar venta», «Nueva venta» y «Ver stock general» de al menos 44 px de alto (52 px los botones principales, como HU-16).

## 3. Endpoints

**Nuevo:**

```json
// GET /api/sales/catalog            → bodega
// GET /api/sales/catalog?holderId=… → vendedor activo
{
  "holder": { "id": "uuid", "fullName": "Luis Vendedor" },
  "products": [
    {
      "productId": 3,
      "name": "Proteína Demo Whey 2 lb",
      "image": null,
      "units": 6,
      "price": "920.00",
      "unitCost": "610.5000"
    }
  ]
}
```

| Caso | Status |
| --- | --- |
| Bodega o vendedor activo | 200 (`holder` = `null` para bodega) |
| `holderId` que no es UUID | 422 |
| Vendedor inexistente o inactivo | 404 |
| No es administrador | 403 |

**Sin cambios, ahora usados por el administrador:**

- `POST /api/sales` con `{ requestId, holderId, lines }` (`holderId: null` = bodega). Respuesta con `unitCost` y `profit` por renglón y `profit` de la venta.
- `GET /api/sales/:requestId` (el administrador ve cualquier venta, con costos y ganancia).

## 4. Modelo de datos

Sin migración ni cambios en `POST /api/sales` / `GET /api/sales/:requestId`.

**Backend · `src/inventory/`:**

```ts
// sale-catalog.ts
export interface SaleCatalogProduct {
  productId: number; name: string; image: string | null;
  units: number; price: string; unitCost: string;
}
export interface SaleCatalog {
  holder: { id: string; fullName: string } | null;
  products: SaleCatalogProduct[];
}
export async function getSaleCatalog(holderId: string | null): Promise<SaleCatalog>;
```

- Se exporta desde `src/inventory/index.ts`. Usa `@stock` (`stockOfHolder` para un vendedor y `stockOfWarehouse` para la bodega) y `@accounts` (`getActiveSellerName`).
- `stockOfWarehouse(): Promise<{ productId; name; image; units; price; unitCost }[]>` es nueva en `src/stock/holdings.ts` (exportada en `@stock`): productos activos con `units` = `products.stock`, por nombre. `listProducts` de `@products` y `GET /api/products` no cambian y siguen sin costo.
- Ruta: `backend/app/api/sales/catalog/route.ts` (el segmento estático gana a `[requestId]`).

**Frontend · `src/app/core/cart/`:**

```ts
// cart.models.ts (cambia)
export interface StoredCart { version: number; lines: CartLine[]; requestId?: string; holderId?: string | null }

// cart.constants.ts (cambia)
export const CART_STORAGE_VERSION = 3;
export const LEGACY_CART_STORAGE_VERSIONS = [1, 2];   // se leen con holderId null

// cart.service.ts (cambia)
readonly holderId: Signal<string | null>;       // titular del carrito; null = bodega (y siempre null para el vendedor)
assignHolder(holderId: string | null): void;    // solo con el carrito vacío; se guarda con los renglones
// clear(), quitar el último renglón y cerrar sesión descartan también el holderId.
```

- `LEGACY_CART_STORAGE_VERSION = 1` (HU-16) pasa a una lista con la 1 y la 2.
- El vendedor nunca llama a `assignHolder`: su carrito queda con `holderId` `null` y su venta sigue sin mandar `holderId`.

**Frontend · `src/app/core/sale-catalog/`:**

```ts
// sale-catalog.models.ts
export interface SaleCatalogProduct { productId: number; name: string; image: string | null; units: number; price: string; unitCost: string }
export interface SaleCatalog { holder: { id: string; fullName: string } | null; products: SaleCatalogProduct[] }

// sale-catalog.service.ts (providedIn: 'root')
load(holderId: string | null): Observable<SaleCatalog>   // GET ${API_BASE_URL}/api/sales/catalog[?holderId=]
```

- `SaleCatalogProduct` es compatible con `SellProduct` de `features/sell` (mismas llaves más `unitCost`), así que `buildCartRows` lo acepta sin cambios.

**Frontend · `src/app/shared/components/cart-bar/`** (se mueve desde `features/sell/components/cart-bar`):

- `input()`: `units`, `total` y `cartUrl` (nuevo). Sus textos pasan a `cart-bar.constants.ts` junto al componente. «Vender» le pasa `/vendedor/carrito`; «Productos», `/admin/carrito`.

**Frontend · `src/app/features/products/`:**

- `components/product-card`: `input()` nuevos `sellUnits` (piezas del titular o `null` si no se puede vender), `unitsInCart`, `holderLabel` (`'Luis'` o `null`); `output()` nuevos `sellAdd`, `sellIncrement`, `sellDecrement`.
- `pages/products-page`: `rxResource` sobre `SaleCatalogService.load(viewing.selectedSellerId())`, el cambio del carrito con tope, la pregunta de otro titular (`ConfirmService`) y `cart-bar`.

**Frontend · `src/app/features/sell/`:**

```ts
// interfaces/sale.models.ts (se amplía)
export interface CreateSaleRequest { requestId: string; holderId?: string | null; lines: { productId: number; qty: number }[] }
export interface AdminSaleLine extends SaleLine { unitCost: string; profit: string }
export interface AdminSale extends Omit<Sale, 'lines'> { lines: AdminSaleLine[]; profit: string }

// rules/sell.rules.ts (se agrega)
cartProfit(rows: CartRow[], costOf: (productId: number) => string): string   // solo renglones 'ok', T-08

// models/admin-cart-page.models.ts, models/admin-sale-summary-page.models.ts
// constants/admin-cart-page.constants.ts, constants/admin-sale-summary-page.constants.ts
```

- **Páginas nuevas:** `pages/admin-cart-page` (`/admin/carrito`) y `pages/admin-sale-summary-page` (`/admin/venta/:requestId`).
- **Componente presentacional nuevo:** `components/admin-sale-line` (renglón con ganancia y «Bodega: 4 → 2»). `cart-line` se reutiliza en el carrito del administrador.
- `SaleSaveService.confirm()` reenvía `holderId` cuando viene en la petición; sus resultados no cambian.
- **Rutas:** `sell.routes.ts` exporta además `ADMIN_CART_ROUTES` y `ADMIN_SALE_ROUTES`. `core/layout/routes/admin.routes.ts` cambia `carrito` («Próximamente») por `loadChildren` de `ADMIN_CART_ROUTES` y agrega `venta` → `ADMIN_SALE_ROUTES`.

**Frontend · `src/app/features/stock/`:**

- `constants/stock-page.constants.ts`: acción rápida `{ label: 'Vender', link: '/admin/productos', icon: … }` (el ícono se elige en el paso de diseño).

**Frontend · `src/app/core/layout/admin-shell/`:**

- `(selectionChange)` llama a un método del shell que pregunta si hace falta (`CartService`, `ConfirmService`, `ViewingService`: core → core) antes de `viewing.pick()`. Si cancela, la barra vuelve a mostrar el titular anterior.

- `features/products` no importa `features/sell` ni al revés: lo común está en `core/` (`CartService`, `SaleCatalogService`) y `shared/` (`cart-bar`).

## 5. Plan de implementación

1. **Backend · catálogo por titular.**
   - `getSaleCatalog` en `src/inventory/sale-catalog.ts`, exportado en `index.ts`, y `app/api/sales/catalog/route.ts`.
   - `tests/sale-catalog.test.ts` (§7). `npm test` y `npm run type-check` de `backend/` pasan.
2. **Frontend · `core/cart/` con titular.**
   - Formato v3 con `holderId`, lectura de la 1 y la 2, `holderId()` y `assignHolder()`, y el descarte al vaciar.
   - Ampliar `cart.service.spec.ts`. `ng test` pasa.
3. **Frontend · `core/sale-catalog/` y pregunta al cambiar de «Viendo».**
   - `SaleCatalogService` con su spec.
   - `admin-shell`: pregunta antes de `viewing.pick()` con carrito de otro titular; spec del shell.
   - `ng test` pasa.
4. **Frontend · `cart-bar` a `shared/`.**
   - Mover el componente y sus textos, agregar `cartUrl` y actualizar «Vender» (`sell-page`). Sin cambio visible para el vendedor.
   - `ng test` y `npm run check:architecture` pasan.
5. **Frontend · «Vender» en «Productos».**
   - `product-card` con «Vender», −/+, «Luis: N» y sus `output()`; `products-page` con el catálogo del titular, el tope, la pregunta de otro titular y `cart-bar`.
   - Ampliar los specs de `product-card` y `products-page`. `ng test` pasa.
6. **Frontend · carrito del administrador.**
   - `cartProfit`, `CreateSaleRequest.holderId`, `admin-cart-page` y `ADMIN_CART_ROUTES`; `carrito` en `admin.routes.ts`.
   - Specs de reglas, `SaleSaveService` (con `holderId`) y `admin-cart-page`. `ng test` y `ng build` pasan.
7. **Frontend · «Venta confirmada» del administrador y acción rápida.**
   - `admin-sale-line`, `admin-sale-summary-page`, `ADMIN_SALE_ROUTES` y `venta` en `admin.routes.ts`.
   - «Vender» en las acciones rápidas de «Stock general».
   - Specs de los componentes nuevos, de `admin.routes.spec.ts` y de `stock-page`. `ng test` y `ng build` pasan.
8. **Frontend · diseño.** El flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design, sobre los tableros `Venta` (03, 03c) del canvas, traducidos a los tokens de `styles.css`.
   - Se confirman los textos de §2 (botón «Vender», «Luis: N», «Vendiendo de», ganancia, diálogo de vaciar, «Venta confirmada»).
   - Se reusan `surface-*`, `page-title`, `alert-*`, `pButton`, `cart-line`, el sello y el bloque de total de HU-16.
   - No se copian del mockup los colores, la forma de pago ni el precio especial.
   - Cierre del paso: `ng build`, `ng test` y `npm run check:architecture` pasan.
9. **Verificación manual** contra la base local con el seed, como `admin@mammut.local`, en escritorio y a 375 px:
   - Con «Yo · bodega», «Vender» en un producto con N piezas en bodega llega al tope N; el carrito dice «Vendiendo de: Bodega», muestra total y ganancia.
   - Confirmar 2 piezas: «Venta confirmada» con «Bodega: N → N−2», ganancia por renglón y total; «Stock general» muestra la bodega 2 menos.
   - Con Víctor en «Viendo»: tope = sus piezas, su precio, «Víctor: N» en la card; al confirmar baja su stock y la bodega no cambia; la ganancia usa su costo con envío (o el de fábrica).
   - Con carrito de bodega, cambiar «Viendo» a Víctor: pregunta «¿Vaciar el carrito?»; «Cancelar» deja «Yo · bodega» y el carrito; «Vaciar y cambiar» lo vacía.
   - Retirarle piezas a Víctor con el carrito armado: «No hay piezas suficientes», el renglón se marca y no se registra venta.
   - Sin conexión: «Reintentar» registra una sola venta con el mismo `requestId`.
   - La acción rápida «Vender» de «Stock general» abre «Productos».
   - Como vendedor, «Vender» y «Carrito» siguen igual (barra del carrito incluida) y nada muestra costo ni ganancia.
   - Al terminar, `npm run db:reset` deja la base como el seed.
10. **Cierre.**
    - Actualizar `specs/README.md` (fila y relaciones).
    - Actualizar `CLAUDE.md` y `AGENTS.md`: `holderId` y versión 3 en `core/cart/`, `core/sale-catalog/`, `shared/components/cart-bar`, el carrito y la venta del administrador en `features/sell`, `GET /api/sales/catalog` y `src/inventory/sale-catalog.ts`.
    - Recordar que la migración de T-18 debe estar en producción antes de desplegar.
    - Comentar el avance en `SCRUM-51` en cada paso y moverla de estado según el flujo de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-51`:

- [ ] **1.** Con «Yo · bodega» y 4 piezas en bodega de un producto, «Vender» en su card lo agrega al carrito con tope de 4 piezas, al precio general.
- [ ] **2.** Con un vendedor en «Viendo», el tope es lo que tiene ese vendedor y el precio es el suyo (o el general si no tiene uno propio).
- [ ] **3.** «Carrito» muestra las piezas por producto, deja cambiarlas o quitarlas, y muestra el total y la ganancia de la venta.
- [ ] **4.** Confirmar con «Yo» 2 piezas de un producto con 4 en bodega abre «Venta confirmada» con foto, precio, «Bodega: 4 → 2» y ganancia, y «Stock general» muestra 2.
- [ ] **5.** Confirmar con un vendedor en «Viendo» baja su stock, la bodega no cambia y la ganancia usa su costo con envío (o el de fábrica si no tiene).
- [ ] **6.** Si las piezas ya no alcanzan sale «No hay piezas suficientes»; sin conexión sale un aviso con «Reintentar»; en ningún caso la venta se registra dos veces.
- [ ] **7.** Cambiar de «Viendo» con productos de otro titular en el carrito pregunta «¿Vaciar el carrito?»; cancelar no cambia nada y aceptar vacía el carrito. Nunca se vende del stock de un titular distinto al del carrito.

Además:

- [ ] `GET /api/sales/catalog` responde 403 a un vendedor, 404 con un vendedor inactivo o inexistente y 422 con un `holderId` que no es UUID.
- [ ] Un carrito guardado en versión 1 o 2 se conserva al actualizar (titular bodega); vaciarlo o cerrar sesión descarta su titular y su `requestId`.
- [ ] Tras cerrar el navegador con un carrito de un vendedor, el primer «Vender» con «Yo · bodega» pregunta si vaciarlo.
- [ ] La ganancia del carrito coincide con la de «Venta confirmada» para los mismos renglones (redondeo a centavos una sola vez).
- [ ] «Nueva venta» lleva a `/admin/productos` y «Ver stock general» a `/admin/stock`; un `requestId` que no existe muestra «No encontramos esta venta».
- [ ] La acción rápida «Vender» de «Stock general» abre `/admin/productos`.
- [ ] El vendedor no ve cambios en «Vender», «Carrito» ni «Venta confirmada», y nada de su lado muestra costo ni ganancia.
- [ ] A 375 px no hay scroll horizontal; los botones nuevos miden al menos 44 px (52 px los principales).
- [ ] `features/products` y `features/sell` no se importan entre sí; `npm run check:architecture` y `backend/tests/architecture.test.ts` pasan.
- [ ] `ng build`, `ng test` y `npm test` de `backend/` pasan.

## 7. Plan de pruebas

- **`backend/tests/sale-catalog.test.ts`:**
  - Bodega: productos activos con `units` = stock, precio general y costo de fábrica.
  - Vendedor: sus productos (también con `qty` 0), su precio o el general, su costo con envío o el de fábrica.
  - `403` a un vendedor, `404` con un vendedor inactivo o inexistente, `422` con un `holderId` inválido.
- **`core/cart/cart.service.spec.ts`** (se amplía): `assignHolder` solo con carrito vacío; el titular se guarda y sobrevive a recargar; `clear()`, quitar el último renglón y cerrar sesión lo descartan; v1 y v2 se leen con titular `null`; un `holderId` que no es UUID ni `null` descarta el carrito.
- **`core/sale-catalog/sale-catalog.service.spec.ts`:** `load(null)` pide `/api/sales/catalog` y `load(id)` agrega `?holderId=`.
- **`core/layout/admin-shell/admin-shell.component.spec.ts`** (se amplía): sin carrito o con el mismo titular cambia sin preguntar; con otro titular pregunta, cancelar no llama a `pick` y deja la selección, aceptar vacía y cambia.
- **`shared/components/cart-bar/cart-bar.component.spec.ts`** (movido): piezas, total y el enlace del `input()` `cartUrl`.
- **`features/products/components/product-card/product-card.component.spec.ts`** (se amplía): «Vender» solo con piezas; −/+ con tope; «Luis: N» con vendedor; los `output()`.
- **`features/products/pages/products-page/products-page.component.spec.ts`** (se amplía): pide el catálogo del titular de «Viendo»; agrega con tope; con otro titular pregunta; barra del carrito hacia `/admin/carrito`.
- **`features/sell/rules/sell.rules.spec.ts`** (se amplía): `cartProfit` con costos de 4 decimales, solo renglones `ok`, redondeo una vez.
- **`features/sell/services/sale-save.service.spec.ts`** (se amplía): manda `holderId` cuando viene.
- **`features/sell/pages/admin-cart-page/admin-cart-page.component.spec.ts`:** lee el catálogo del titular del carrito; «Vendiendo de»; total y ganancia; confirmar con `holderId`; éxito a `/admin/venta/<requestId>` y aviso a `StockChangesService`; `offline`, `not-enough-units`, `already-registered` e `invalid`.
- **`features/sell/components/admin-sale-line/admin-sale-line.component.spec.ts`:** precio, subtotal, ganancia y «Bodega: 4 → 2» / «Luis: 6 → 4».
- **`features/sell/pages/admin-sale-summary-page/admin-sale-summary-page.component.spec.ts`:** `GET /api/sales/<requestId>`, estados, total y ganancia, aviso `?repetida=1`, enlaces.
- **`core/layout/routes/admin.routes.spec.ts`** (se amplía): `carrito` carga `ADMIN_CART_ROUTES` y `venta`, `ADMIN_SALE_ROUTES`.
- **`features/stock/pages/stock-page/stock-page.component.spec.ts`** (se amplía): la acción rápida «Vender» enlaza a `/admin/productos`.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Vender del stock equivocado porque «Viendo» cambió (o se reinició) con el carrito lleno | El carrito guarda su titular, `/admin/carrito` usa ese y no el de «Viendo»; cambiar de «Viendo» o agregar con otro titular pregunta antes de vaciar |
| `viewing.select()` (detalle de un vendedor) cambia «Viendo» sin preguntar | No toca el carrito: su titular sigue siendo el guardado, y el siguiente «Vender» con otro titular pregunta |
| La ganancia del carrito no coincide con la que guarda el backend | `cartProfit` usa la misma regla que `createSale` (diezmilésimas, un solo redondeo); el costo del catálogo es el mismo que resuelve `createSale`. Si el costo cambia entre el carrito y la confirmación, manda el de «Venta confirmada» |
| El catálogo de bodega expone costos | Solo lo responde a `admin`; `GET /api/products` sigue sin `unitCost` |
| Subir `CART_STORAGE_VERSION` borra carritos ya guardados | La 1 y la 2 se siguen leyendo |
| Mover `cart-bar` a `shared/` cambia la pantalla del vendedor | Mismo marcado y textos; su spec se mueve con él y `sell-page.component.spec.ts` sigue pasando |
| La migración de T-18 no está en producción al desplegar | El cierre del paso 10 lo recuerda en `SCRUM-51` y en el índice de specs |

## 9. Decisiones

- **Sí:** cambiar de «Viendo» con carrito de otro titular pregunta «¿Vaciar el carrito?» (decisión del usuario).
- **No:** vaciar sin preguntar (se pierde el carrito por un toque), bloquear la barra «Viendo» o un carrito por titular (formato y pantallas más complejos).
- **Sí:** la ganancia se ve en el carrito y en «Venta confirmada» (decisión del usuario), como el canvas.
- **No:** solo en «Venta confirmada».
- **Sí:** si una venta del administrador con un vendedor en «Viendo» cuenta para el corte de ese vendedor se decide en M4a (decisión del usuario). La venta ya guarda titular y quién la registró.
- **Sí:** el carrito y la venta del administrador viven en `features/sell` (decisión del usuario): la feature «vender» sirve a los dos roles y reusa reglas y componentes sin importar otra feature.
- **No:** una feature `admin-sell` aparte, que tendría que duplicar o mover a `shared/` lo común.
- **Sí:** endpoint nuevo `GET /api/sales/catalog?holderId=` con piezas, precio y costo ya resueltos por titular (decisión del usuario). Una sola fuente para el tope, el precio y la ganancia, como `/api/me/stock` del vendedor.
- **No:** agregar `unitCost` a `GET /api/products` y leer el stock del vendedor de `GET /api/sellers/:id`: dos caminos y rompe la regla de que la lista nunca trae costo.
- **Sí:** la card de «Productos» sigue diciendo «N en bodega» y agrega «Vender» y, con un vendedor, «Luis: N» (decisión del usuario).
- **No:** cambiar toda la lista al stock del titular (toca HU-05 más a fondo).
- **Sí:** «Vender» agrega 1 pieza y se vuelve − N + con tope (decisión del usuario), como el catálogo del vendedor.
- **No:** solo sumar una pieza por toque.
- **Sí:** el carrito guarda su titular (formato v3) (decisión del usuario). Sobrevive a cerrar el navegador aunque «Viendo» vuelva a «Yo».
- **No:** que el carrito siga a «Viendo» sin guardar titular: tras reabrir el navegador podría vender del stock equivocado.
- **Sí:** «Venta confirmada» ofrece «Nueva venta» (`/admin/productos`) y «Ver stock general» (`/admin/stock`) (decisión del usuario).
- **Sí:** acción rápida «Vender» en «Stock general» hacia «Productos» (decisión del usuario), como pide la historia.
- **Sí:** `cart-bar` se mueve a `shared/components/` con el destino como `input()` (recomendación). «Productos» la necesita y `features/products` no puede importar `features/sell`.
- **Sí:** `SaleCatalogService` vive en `core/sale-catalog/` (recomendación). Lo usan `features/products` y `features/sell`, que no se importan entre sí.
- **Sí:** el carrito del administrador lee el catálogo del titular del carrito, no el de «Viendo» (recomendación). Así lo que se confirma siempre es del stock con el que se armó.
- **No:** cambios en `POST /api/sales`, migraciones o el seed. T-18 ya da titular, costos y ganancia al administrador.

## Lo que **no** entra en este spec

- Si la venta del administrador cuenta para el corte del vendedor (M4a).
- Anular una venta.
- Precio especial y contado/crédito (v2).
- Aviso de baja existencia (HU-18) y cortes.
- Historial de ventas.
- Un carrito por titular.

Cada uno, si llega, va en su propio spec o en su historia.
