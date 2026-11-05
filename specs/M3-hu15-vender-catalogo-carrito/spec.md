# Spec técnico — HU-15 · Elegir los productos que voy a vender (catálogo y carrito del vendedor)

> **Estado:** Implementado
> **Depende de:** M3-hu14-ver-mi-stock (`specs/M3-hu14-ver-mi-stock/spec.md`) — `GET /api/me/stock`, `getOwnStock` y el botón «Vender» hacia `/vendedor/vender`; M2-hu09-ver-mis-vendedores (`specs/M2-hu09-ver-mis-vendedores/spec.md`) — `stockOfHolder`; M2-hu12-retirar-a-vendedor (`specs/M2-hu12-retirar-a-vendedor/spec.md`) — un retiro deja la fila de `vendor_stock` con `qty` 0; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — `money.ts`; M0-hu03-rutas-por-rol (`specs/M0-hu03-rutas-por-rol/spec.md`) — rutas de `/vendedor`
> **Fecha:** 2026-11-03
> **Objetivo:** que el vendedor busque en su stock, agregue piezas a un carrito con tope en lo que tiene, y revise en «Carrito» las piezas, los subtotales y el total, sin costos y sin perder el carrito al salir o recargar.

> **Nota (2026-11-04):** el carrito y «Venta confirmada» de los dos roles se pintan con los mismos componentes (`cart-view`, `sale-summary-view` y `sale-line` en `features/sell/components/`), con el diseño del administrador (dos columnas, panel de resumen fijo y «← Seguir vendiendo» arriba). Cada página pasa solo los datos de su rol: la ganancia, el titular y el desglose «antes → después» llegan solo al administrador (el vendedor nunca recibe costos). `admin-sale-line` ya no existe: la línea es `sale-line`.

Fuentes:

- **Jira:** historia `SCRUM-49 · HU-15`, épica `SCRUM-8 · M3 · Ventas`. Requerimientos RF-21, RF-10, RF-02, RNF-03, RNF-06. Talla S. La continúa HU-16 (`SCRUM-50`, confirmar la venta).
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantallas 06 Vender y 06b Carrito; 06b es «v1 (parcial)»: se quita contado o crédito).
- **Canvas:** tableros `Venta` (vistas catálogo y carrito del vendedor), `EstadosVender` y `EstadosCarritoVendedor`.
- **Código:**
  - `backend/src/inventory/own-stock.ts` (`getOwnStock`) y `backend/src/stock/holdings.ts` (`stockOfHolder`, hoy solo `qty > 0`).
  - `core/layout/routes/seller.routes.ts` (hoy `vender` y `carrito` son «Próximamente»).
  - `core/layout/top-nav/` (botón de carrito sin contador).
  - `core/auth/services/auth.service.ts` (`currentUser`).
  - `features/my-stock` (patrón de la pantalla de stock del vendedor) y `shared/utils/` (`money.ts`, `normalize-text.ts`, `initials.ts`, `units-label.ts`).
- **Decisiones del usuario del 2026-11-03** (§9).

## 1. Alcance

**Entra en este spec:**

- **Backend:**
  - `GET /api/me/stock?includeSoldOut=true`: además de lo que tiene, trae los productos que tuvo y se le acabaron (`vendor_stock.qty = 0`). Sin el parámetro responde igual que en HU-14.
  - `stockOfHolder(profileId, { includeSoldOut })` y `getOwnStock(profileId, { includeSoldOut })` aceptan la opción.
- **Frontend · `core/cart/`:**
  - `CartService`: el estado del carrito (productos y piezas), guardado en `localStorage` por usuario y borrado al cerrar sesión.
- **Frontend · `top-nav`:**
  - El botón del carrito muestra el número de piezas cuando hay alguna.
- **Frontend · feature nueva `features/sell/`:**
  - `/vendedor/vender`: catálogo con buscador y una card por producto (foto o iniciales, precio, «Quedan N», «+ Agregar», −/+ y «Agotado»). Abajo, una barra «Carrito · N piezas · $total» con «Ver carrito».
  - `/vendedor/carrito`: un renglón por producto (foto, nombre, precio c/u, −/+ con tope, subtotal, «Quitar»), el total y «Seguir vendiendo».
  - Avisos de carrito viejo: piezas de más («Solo te quedan N de este producto») y producto agotado.
  - Estados cargando, vacío y error con «Reintentar» en las dos pantallas.
- **Pruebas** de backend y frontend (§7).

**No entra en este spec:**

- Confirmar la venta, el botón «Confirmar venta», «Venta confirmada» y descontar el stock: HU-16 (`SCRUM-50`).
- El carrito y la venta del administrador desde «Productos» (HU-17). `/admin/carrito` sigue en «Próximamente».
- Filtros por categoría (RF-04, v2), forma de pago, contado o crédito (RF-13, v2) y precio especial (RF-12, v2).
- Guardar el carrito en el servidor o compartirlo entre dispositivos.
- El aviso de productos por terminarse y la etiqueta «Quedan pocas» (HU-18).
- Cambios en «Mi stock» (HU-14): sigue sin mostrar agotados.
- Cambios en `supabase/seed.sql` o migraciones.

## 2. Reglas de negocio

- **Solo el vendedor.** Las dos pantallas están detrás de `roleGuard` de `/vendedor`. `GET /api/me/stock` sigue exigiendo `requireRole(request, 'vendedor')` y el id sale de la sesión.
- **Catálogo:**
  - Sale de `GET /api/me/stock?includeSoldOut=true`, ordenado por nombre como lo entrega el backend.
  - Muestra lo que el vendedor tiene (`units > 0`) y lo que tuvo y se le acabó (`units = 0`, fila de `vendor_stock` con `qty` 0). Un producto que nunca le dejaron no sale.
  - Un producto archivado o una bolsita con piezas sale, como en HU-14.
- **Precio:** el que ya resuelve el backend en `price` (el propio del vendedor o el general). Nunca viajan ni se muestran costo, costo con envío ni ganancia (RF-02, RNF-04).
- **Buscador:** filtra por nombre sin mayúsculas ni acentos con `shared/utils/normalize-text.ts`. Solo filtra la lista: no cambia el carrito ni la barra del carrito.
- **Card del catálogo:**
  - Foto (o iniciales), nombre, precio y «Quedan N», donde N = piezas que tiene − piezas que ya están en el carrito.
  - Sin ese producto en el carrito: botón «+ Agregar», que pone 1 pieza.
  - Con el producto en el carrito: − / piezas / +. El + se deshabilita al llegar a lo que tiene (criterio 3). El − con 1 pieza lo quita del carrito.
  - Con `units = 0`: etiqueta y botón «Agotado», deshabilitado. No se puede agregar (criterio 6).
- **Tope:** las piezas de un producto en el carrito nunca pasan de lo que el vendedor tiene. Lo imponen los −/+; no hay campo para escribir la cantidad.
- **Carrito (`/vendedor/carrito`):**
  - Un renglón por producto con: foto (o iniciales), nombre, precio «c/u», − / piezas «de N» / +, subtotal y «Quitar».
  - Total de la venta abajo. «Quitar» lo quita sin confirmar (pocos toques, RNF-06).
  - Las piezas y el precio se leen frescos de `GET /api/me/stock?includeSoldOut=true` al entrar; el carrito guardado solo tiene `productId` y piezas.
- **Dinero:** subtotal = piezas × precio y total = Σ subtotales, en centavos con `shared/utils/money.ts` (`toMinorUnits`/`fromMinorUnits`), nunca con `number` flotante. `Number()` sobre un monto solo para el pipe `currency` al mostrarlo.
- **Carrito viejo** (al cargar, el stock cambió desde que se armó):
  - Más piezas en el carrito que las que tiene: el renglón sale con «Solo te quedan N de este producto» y el + deshabilitado. El vendedor baja las piezas con el −. No se ajusta solo.
  - El producto ya no tiene piezas, o ya no viene en la respuesta: el renglón sale «Agotado», sin −/+ y con «Quitar».
  - El total suma solo los renglones válidos. El carrito queda marcado como «hay que corregir» mientras tenga renglones así, para que HU-16 no deje confirmarlo.
  - En el catálogo, un producto con piezas de más en el carrito muestra «Quedan 0» y el aviso.
- **Persistencia (criterio 7):**
  - El carrito vive en `CartService` (`core/cart/`) y se guarda en `localStorage` con la llave `mamut.cart.<userId>` y un número de versión.
  - Sobrevive a cambiar de pantalla, recargar y cerrar la pestaña.
  - Al cerrar sesión se borra la llave del usuario que salió. Otro usuario en el mismo navegador nunca ve ese carrito.
  - Una llave con otra versión, JSON inválido o renglones mal formados se descarta y el carrito arranca vacío.
  - Sin `localStorage` disponible (SSR, modo privado que lo bloquea), el carrito funciona en memoria; todo acceso va en `try/catch`.
- **Contador en `top-nav`:** el botón del carrito muestra el total de piezas del carrito cuando es mayor que 0, con `aria-label` «Carrito, N piezas». Con 0 se ve como hoy. En `admin-shell` el carrito del administrador está vacío hasta HU-17, así que no muestra número.
- **Barra del catálogo:** fija abajo, solo con piezas en el carrito: «Carrito · N piezas · $total» y «Ver carrito» hacia `/vendedor/carrito`.
- **Estados:**
  - **Cargando:** esqueletos de card o de renglón.
  - **Vacío del catálogo** (el vendedor no tiene ni tuvo productos): «Aún no te han dejado producto».
  - **Carrito vacío:** «Tu carrito está vacío» con «Ir a vender».
  - **Error al cargar el stock:** mensaje de falla y «Reintentar» (`reload()`).
  - **Buscador sin resultados:** «No hay productos con ese nombre».
  - Los textos exactos se confirman contra el canvas en el paso de diseño; los de este spec son los de partida. El error del tablero `EstadosVender` («No hay conexión… Tu venta todavía no se registró») es de confirmar la venta y lo usa HU-16.
- **Celular (RNF-03):** se usa sin zoom a 375 px y sin scroll horizontal. Los −/+ y «+ Agregar» miden al menos 44 px.

## 3. Endpoint

`GET /api/me/stock?includeSoldOut=true`, solo para vendedores. Misma respuesta que HU-14, con los agotados incluidos:

```json
// 200
{
  "total": 4,
  "products": [
    { "productId": 5, "name": "Creatina Monohidratada Demo", "image": null, "units": 0, "price": "499.00" },
    { "productId": 3, "name": "Proteína Demo Whey 2 lb", "image": null, "units": 4, "price": "920.00" }
  ]
}
```

- Sin `includeSoldOut`, o con cualquier valor distinto de `true`, la respuesta es la de HU-14: solo `units > 0`.
- Con `includeSoldOut=true` entran también las filas de `vendor_stock` del vendedor con `qty = 0`. `units` es `0` y `price` sigue resuelto (propio o general).
- Las únicas llaves de un producto siguen siendo `productId`, `name`, `image`, `units` y `price`.
- `total` = suma de `units` (los agotados suman 0).
- Errores sin cambios: `401` sin sesión, `403` cuenta desactivada, administrador o `client`.

## 4. Modelo de datos

No hay migración: se usan `vendor_stock` y `products`.

**Backend:**

```ts
// backend/src/stock/holdings.ts (cambia)
export function stockOfHolder(profileId: string, options?: { includeSoldOut?: boolean }): Promise<HolderStockLine[]>
// includeSoldOut: qty >= 0 en vez de qty > 0. Por defecto false: HU-09, HU-12 y HU-14 no cambian.

// backend/src/inventory/own-stock.ts (cambia)
export function getOwnStock(profileId: string, options?: { includeSoldOut?: boolean }): Promise<OwnStock>
```

- `backend/app/api/me/stock/route.ts` lee `new URL(request.url).searchParams.get('includeSoldOut') === 'true'` y lo pasa a `getOwnStock`.

**Frontend · `src/app/core/cart/`:**

```ts
// cart.models.ts
export interface CartLine { productId: number; units: number }
export interface StoredCart { version: number; lines: CartLine[] }

// cart.constants.ts
export const CART_STORAGE_PREFIX = 'mamut.cart.';
export const CART_STORAGE_VERSION = 1;

// cart.service.ts (providedIn: 'root')
readonly lines: Signal<CartLine[]>;
readonly totalUnits: Signal<number>;
unitsOf(productId: number): number;
setUnits(productId: number, units: number): void;  // 0 o menos lo quita; solo enteros
remove(productId: number): void;
clear(): void;
```

- `CartService` no conoce el stock: el tope lo aplican las reglas de la feature antes de llamar a `setUnits`.
- Carga y guarda según `AuthService.currentUser()`. Cuando el usuario cambia, carga el carrito del nuevo. Cuando pasa a `null`, borra la llave del usuario anterior y vacía el estado.
- `top-nav` inyecta `CartService` (core → core) y muestra `totalUnits()`.

**Frontend · `src/app/features/sell/`:**

```ts
// interfaces/sell-stock.models.ts
export interface SellProduct { productId: number; name: string; image: string | null; units: number; price: string }
export interface SellStock { total: number; products: SellProduct[] }

// models/cart-page.models.ts
export type CartRowStatus = 'ok' | 'over' | 'soldOut';
export interface CartRow { product: SellProduct; units: number; available: number; subtotal: string; status: CartRowStatus }

// services/sell-stock.service.ts
load(): Observable<SellStock>   // GET ${API_BASE_URL}/api/me/stock?includeSoldOut=true

// rules/sell.rules.ts (puras)
filterSellProductsByName<T extends { name: string }>(items: T[], query: string): T[]
unitsLeft(product: SellProduct, unitsInCart: number): number        // max(0, units − en carrito)
canIncrement(product: SellProduct, unitsInCart: number): boolean
buildCartRows(products: SellProduct[], lines: CartLine[]): CartRow[] // producto ausente → 'soldOut' con units 0
cartTotal(rows: CartRow[]): string                                   // suma de subtotales 'ok', escala 2
cartNeedsFix(rows: CartRow[]): boolean                               // algún 'over' o 'soldOut'
```

- `CartLine` se importa de `@core/cart/cart.models`.
- **Constantes:** `constants/sell-page.constants.ts` y `constants/cart-page.constants.ts` (textos de pantalla y estados, y los enlaces `/vendedor/vender` y `/vendedor/carrito`).
- **Componentes presentacionales** (`features/sell/components/`, solo `input()`/`output()`):
  - `sell-product-card`: `Card` de PrimeNG con foto o iniciales, nombre, precio, «Quedan N», y «+ Agregar», −/+ o «Agotado». Emite `add`, `increment` y `decrement`.
  - `sell-product-card-skeleton`.
  - `cart-line`: un renglón del carrito con su estado. Emite `increment`, `decrement` y `remove`.
  - `cart-bar`: la barra del catálogo («Carrito · N piezas · $total», «Ver carrito»).
- **Páginas:** `pages/sell-page` (`/vendedor/vender`) y `pages/cart-page` (`/vendedor/carrito`). Cada una usa `rxResource` sobre `SellStockService.load()` y `computed()` para la vista, y llama a `CartService`.
- **Rutas:**
  - `features/sell/sell.routes.ts` exporta `SELL_ROUTES` (`''` → `sell-page`, `data: { title: 'Vender' }`) y `CART_ROUTES` (`''` → `cart-page`, `data: { title: 'Carrito' }`), las dos con `loadComponent`.
  - En `core/layout/routes/seller.routes.ts`, `vender` y `carrito` pasan a `loadChildren` de `@features/sell/sell.routes`.
- **Sin importar otras features:** `features/sell` no importa `features/my-stock`. El servicio, el modelo y el filtro se escriben en la feature, como hicieron HU-13 y HU-14.

## 5. Plan de implementación

1. **Backend · agotados en `GET /api/me/stock`.**
   - Agregar `includeSoldOut` a `stockOfHolder` y `getOwnStock`, y leer el parámetro en `app/api/me/stock/route.ts`.
   - Extender `backend/tests/own-stock.test.ts` (§7).
   - `npm run type-check` y `npm test` pasan, con `SUPABASE_SERVICE_ROLE_KEY` puesta.
2. **Frontend · `core/cart/`.** `CartService`, modelos y constantes, con su spec. `ng test` pasa.
3. **Frontend · contador en `top-nav`.** El botón del carrito muestra las piezas y su `aria-label`; spec de `top-nav` actualizado.
4. **Frontend · datos y reglas de `features/sell/`.**
   - Crear la carpeta completa (`pages/`, `components/`, `services/`, `interfaces/`, `models/`, `rules/`, `constants/`).
   - Modelos, `SellStockService.load()` y `sell.rules.ts`, con sus specs. `ng test` pasa.
5. **Frontend · diseño.** El flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design, sobre los tableros `Venta`, `EstadosVender` y `EstadosCarritoVendedor`, traducidos a los tokens de `styles.css`.
   - Se confirman ahí los textos exactos de cada estado y de los avisos de carrito viejo; los de §2 son los de partida.
   - Se reusan `surface-*`, `page-title`, `alert-*`, `Card`, `Skeleton`, `Tag` y `pButton`.
   - No se copian el menú inferior, los chips de categoría, la etiqueta «Quedan pocas», «Precio especial», contado/crédito ni los colores del mockup.
6. **Frontend · componentes.** `ng generate component` para `sell-product-card`, `sell-product-card-skeleton`, `cart-line` y `cart-bar`, con sus specs.
7. **Frontend · páginas y rutas.**
   - `ng generate component` para `sell-page` y `cart-page`.
   - Crear `sell.routes.ts` y montar `vender` y `carrito` en `seller.routes.ts`.
   - Armar las dos pantallas con sus estados.
   - Cierre del paso: `ng build`, `ng test` y `npm run check:architecture` pasan.
8. **Verificación manual** contra la base local con el seed, como `vendedor1@mammut.local`, en escritorio y a 375 px:
   - Desde «Mi stock», «Vender» abre el catálogo con los productos de Víctor y sus precios.
   - Buscar «proteina» deja solo la proteína.
   - Agregar piezas hasta el tope deshabilita el +, y «Quedan N» baja.
   - El contador de `top-nav` y la barra del catálogo muestran las piezas y el total.
   - «Carrito» muestra subtotales y total correctos. Cambiar piezas y «Quitar» funcionan.
   - Salir a «Mi stock», volver y recargar: el carrito sigue. Cerrar sesión y entrar con `vendedor2@mammut.local`: su carrito está vacío.
   - Con el carrito armado, retirarle piezas desde el administrador: al volver se ve el aviso de piezas de más. Retirarle todo un producto: el catálogo lo muestra «Agotado» y el carrito pide quitarlo.
   - Con la petición fallando se ve el error, y «Reintentar» carga el stock.
   - En la respuesta de red no aparece ningún costo ni ganancia.
   - Al terminar, `npm run db:reset` deja la base como el seed.
9. **Cierre.**
   - Actualizar `specs/README.md`.
   - Actualizar `CLAUDE.md` y `AGENTS.md`: `core/cart/`, el contador de `top-nav`, la feature `sell`, `includeSoldOut` en `GET /api/me/stock` y `stockOfHolder`.
   - Comentar el avance en `SCRUM-49` en cada paso y moverla de estado según el flujo de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-49`:

- [x] **1.** En «Vender» se ve un catálogo con una card por producto (foto o iniciales, precio del vendedor y «Quedan N») y un buscador por nombre.
- [x] **2.** El buscador deja solo los productos que coinciden, sin importar mayúsculas ni acentos.
- [x] **3.** Con 3 piezas de un producto, el carrito sube hasta 3 y el + queda deshabilitado; no se puede pasar de 3.
- [x] **4.** «Carrito» muestra cada producto con sus piezas, su precio, su subtotal y el total de la venta, y deja cambiar las piezas o quitarlo.
- [x] **5.** Ni el catálogo, ni el carrito, ni la respuesta de `GET /api/me/stock?includeSoldOut=true` contienen costo, costo con envío ni ganancia.
- [x] **6.** Un producto que el vendedor tuvo y tiene en 0 piezas sale «Agotado» en el catálogo y no se puede agregar.
- [x] **7.** Al salir de «Vender» y regresar, y al recargar la página, el carrito sigue igual.

Además:

- [x] Sin `includeSoldOut=true`, `GET /api/me/stock` responde igual que en HU-14, y «Mi stock» no muestra agotados.
- [x] Un producto que el vendedor nunca tuvo no sale en el catálogo.
- [x] Subtotales y total se calculan en centavos con `money.ts` (p. ej. 3 × «0.10» = «0.30» exacto).
- [x] Con un carrito viejo, un renglón con piezas de más muestra «Solo te quedan N de este producto», un producto agotado sale «Agotado» con «Quitar», y nada se ajusta solo.
- [x] El contador de `top-nav` muestra las piezas del carrito y desaparece con el carrito vacío.
- [x] Cerrar sesión borra el carrito de ese usuario; otro usuario en el mismo navegador empieza con el carrito vacío.
- [x] Un carrito guardado con otra versión o JSON inválido se descarta sin romper la pantalla.
- [x] Cargando, vacío del catálogo, carrito vacío y error se ven con los textos confirmados contra el canvas, y «Reintentar» vuelve a pedir el stock.
- [x] A 375 px no hay scroll horizontal ni zoom, y los −/+ y «+ Agregar» miden al menos 44 px.
- [x] `features/sell` no importa otras features; `core/cart` no importa `features/`.
- [x] Backend: `npm run type-check` y `npm test` pasan, con `SUPABASE_SERVICE_ROLE_KEY` puesta. Frontend: `ng build`, `ng test` y `npm run check:architecture` pasan.

## 7. Plan de pruebas

- **`backend/tests/own-stock.test.ts`** (se extiende; contra la base local, con los datos de prueba de HU-14):
  - Con `includeSoldOut=true`, el producto retirado por completo sale con `units: 0` y su precio propio.
  - Sin el parámetro, o con `includeSoldOut=false`, no sale (comportamiento de HU-14).
  - Con `includeSoldOut=true`, un producto que el vendedor nunca tuvo no sale y el `total` sigue siendo la suma de `units`.
  - Las llaves de cada producto siguen siendo exactamente las cinco, también en los agotados.
- **`core/cart/cart.service.spec.ts`:**
  - `setUnits`, `remove`, `clear`, `unitsOf` y `totalUnits`.
  - Guarda en `mamut.cart.<userId>` y lo recupera al crear el servicio de nuevo.
  - Al cerrar sesión borra la llave; con otro usuario arranca vacío.
  - Versión distinta, JSON inválido o renglones mal formados dan un carrito vacío.
  - Sin `localStorage` (el acceso lanza) sigue funcionando en memoria.
- **`core/layout/top-nav/top-nav.component.spec.ts`:** el contador aparece con piezas, con su `aria-label`, y no aparece con 0.
- **`features/sell/rules/sell.rules.spec.ts`:**
  - `filterSellProductsByName` («proteina» encuentra «Proteína»).
  - `unitsLeft` y `canIncrement` en el tope.
  - `buildCartRows` con `ok`, `over`, `soldOut` y producto ausente.
  - `cartTotal` exacto con montos de centavos y `cartNeedsFix`.
- **`features/sell/services/sell-stock.service.spec.ts`:** `load()` llama a `/api/me/stock?includeSoldOut=true`.
- **Componentes:**
  - `sell-product-card`: «+ Agregar», −/+ con el + deshabilitado en el tope, «Agotado» deshabilitado, «Quedan N» y los eventos que emite.
  - `cart-line`: precio c/u, subtotal, «de N», el aviso de piezas de más, «Agotado» con «Quitar», y los eventos.
  - `cart-bar` y `sell-product-card-skeleton`: se renderizan con sus datos.
- **Páginas:**
  - `sell-page`: los estados, «Reintentar», el buscador, agregar y subir hasta el tope, y la barra del carrito con «Ver carrito».
  - `cart-page`: los estados, el carrito vacío con «Ir a vender», cambiar piezas, «Quitar», el total y los avisos de carrito viejo.
- **`core/layout/routes/seller.routes.spec.ts`:** `vender` carga `SELL_ROUTES` y `carrito` carga `CART_ROUTES`.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `includeSoldOut` cambia por error lo que ven «Mi stock», el detalle del vendedor o el retiro | La opción es `false` por defecto y las pruebas de HU-09, HU-12 y HU-14 siguen pasando; una prueba nueva fija la respuesta sin el parámetro |
| El carrito guardado queda viejo cuando el administrador deja o retira piezas | Se leen piezas y precio frescos al entrar, y los renglones de más o agotados se marcan sin ajustarse solos; HU-16 vuelve a validar en el backend al confirmar |
| Otro vendedor en el mismo celular ve un carrito ajeno | Llave por `userId` y borrado al cerrar sesión |
| `localStorage` no está disponible o trae datos corruptos | Todo acceso en `try/catch`, versión en la llave y descarte de lo que no valida; el carrito sigue en memoria |
| Un precio cambia entre armar el carrito y confirmarlo | El carrito no guarda precios: se muestran los del momento al entrar. El precio que cuenta es el que guarda T-18 al confirmar (HU-16) |
| El contador del carrito en `top-nav` sale también en `admin-shell` | El carrito del administrador está vacío hasta HU-17, así que no muestra número. HU-17 decide su propio carrito |
| La pantalla se ve vacía sin un botón para terminar la venta | Es la decisión de §9: «Confirmar venta» entra con HU-16, la siguiente historia del mismo milestone |

## 9. Decisiones

- **Sí:** los agotados son los productos que el vendedor tuvo y se le acabaron (`vendor_stock.qty = 0`), con `GET /api/me/stock?includeSoldOut=true` (decisión del usuario). Cumple el criterio 6 sin inventar productos que nunca le dejaron, y «Mi stock» no cambia.
- **No:** mostrar todo el catálogo con «Agotado» en lo que no tiene. Llena la pantalla de productos que no puede vender y pide otro endpoint.
- **No:** quitar el criterio 6.
- **Sí:** el carrito se guarda en `localStorage` con la llave `mamut.cart.<userId>` y se borra al cerrar sesión (decisión del usuario). Cumple el criterio 7 también tras recargar o cerrar la pestaña, sin backend nuevo.
- **No:** `sessionStorage` (se pierde al cerrar la app del celular), solo memoria (se pierde al recargar) ni carrito en el servidor (migración y API para una historia S).
- **Sí:** un carrito viejo se marca y el vendedor lo corrige: «Solo te quedan N de este producto» y «Agotado» con «Quitar», como el tablero de error del canvas (decisión del usuario). Nada cambia sin que el vendedor lo vea.
- **No:** ajustar el carrito solo al máximo disponible.
- **Sí:** el estado del carrito vive en `core/cart/` y `top-nav` muestra el número de piezas (decisión del usuario). Una feature no puede alimentar a `core`, y HU-17 podrá reusar el servicio.
- **Sí:** «Confirmar venta» no se muestra en HU-15 (decisión del usuario). Entra con HU-16; no hay controles que no hacen nada.
- **No:** el botón deshabilitado con «Disponible pronto».
- **Sí:** solo buscador, sin chips de categoría (decisión del usuario). Es lo que piden los criterios 1 y 2, y los filtros pasaron a v2.
- **Sí:** sin forma de pago (decisión del usuario). T-18 no la guarda y ninguna historia de M3 la pide; si el corte (M4a) la necesita, va en su spec.
- **Sí:** una sola feature `features/sell/` con las dos páginas, su servicio y su filtro (decisión del usuario). Las dos pantallas comparten modelo y carga, y una feature no importa `features/my-stock`.
- **No:** dos features (`sell` y `cart`), que duplicarían la carga del stock y el modelo.
- **Sí:** el carrito guarda solo `productId` y piezas; precio y piezas disponibles se leen frescos al entrar (recomendación aceptada con la estructura). Nunca se muestra un precio viejo.
- **Sí:** la cantidad cambia solo con −/+ de al menos 44 px, sin campo de texto (recomendación). Pocos toques (RNF-06) y el tope no se puede saltar escribiendo.
- **Sí:** «Quitar» no pide confirmación (recomendación). Es fácil volver a agregar y cada confirmación suma toques.
- **Sí:** la barra «Carrito · N piezas · $total» con «Ver carrito» abajo del catálogo, como el canvas (recomendación). Lleva al carrito en un toque.
- **No:** cambios en el seed. El agotado para la verificación manual se crea retirando todo un producto desde el administrador.

## Lo que **no** entra en este spec

- Confirmar la venta, «Venta confirmada» y descontar el stock (HU-16).
- El carrito y la venta del administrador (HU-17).
- Filtros por categoría, forma de pago, contado o crédito y precio especial.
- Carrito en el servidor o entre dispositivos.
- Aviso de productos por terminarse y etiqueta «Quedan pocas» (HU-18).

Cada uno, si llega, va en su propio spec o en su historia.
