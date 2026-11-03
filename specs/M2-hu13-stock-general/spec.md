# Spec técnico — HU-13 · Ver el stock general: bodega, cada vendedor y total

> **Estado:** Implementado
> **Depende de:** M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`) — `ViewingService` y la selección «Yo · bodega» / vendedor; M2-hu11-dejar-a-vendedor (`specs/M2-hu11-dejar-a-vendedor/spec.md`) y M2-hu12-retirar-a-vendedor (`specs/M2-hu12-retirar-a-vendedor/spec.md`) — los pop-ups «Dejar» y «Retirar» que abren los movimientos rápidos; M2-hu09-ver-mis-vendedores (`specs/M2-hu09-ver-mis-vendedores/spec.md`) — `unitsByHolder`/`stockOfHolder` en el módulo `stock` y `listSellers` en `accounts`; M2-t16-ventanas-dejar-retirar (`specs/M2-t16-ventanas-dejar-retirar/spec.md`) — `modal-links.ts` y `StockChangesService`; M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`) — `products.stock` y `vendor_stock.qty` los mantienen los movimientos
> **Fecha:** 2026-11-03
> **Objetivo:** que el administrador vea en `/admin/stock` el total del negocio repartido entre bodega y vendedores, y por producto cuánto hay en cada lugar, o solo el stock del vendedor elegido en «Viendo».

Fuentes:

- **Jira:** historia `SCRUM-37 · HU-13`, épica `SCRUM-7 · M2 · Vendedores y entregas`. Requerimientos RF-09, RNF-01, RNF-03.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantalla 02 Stock general, v1 parcial: sin merma de la semana, «lo que le deben» ni lista de resurtir).
- **Canvas de mockups:** artboards `AdminInicio` (con «Yo» y con un vendedor), `AdminInicioLuis` y `EstadosStock` (cargando, vacío y error).
- **Código:** `core/layout/routes/admin.routes.ts` (hoy `stock` es «Próximamente»), `core/viewing/viewing.service.ts`, `core/stock-changes/stock-changes.service.ts`, `shared/utils/modal-links.ts`, `backend/src/stock/holdings.ts`, `backend/src/accounts/sellers.ts` y `features/products/pages/products-page` (patrón de lista con `rxResource`, buscador, esqueletos y «Reintentar»).
- **Decisiones del usuario del 2026-11-03** (§9).

## 1. Alcance

**Entra en este spec:**

- **Backend:**
  - Módulo nuevo `src/inventory/` con el caso de uso `getStockOverview`, que junta las piezas de la bodega (`products.stock`) y de cada vendedor (`vendor_stock.qty`) por producto.
  - `GET /api/stock`, solo para administradores.
- **Frontend:**
  - Feature nueva `features/stock/`: `/admin/stock` deja de ser «Próximamente» y pasa a «Stock general».
  - Con «Yo · bodega» en «Viendo»:
    - Total del negocio con la barra dividida (bodega + cada vendedor) y su leyenda.
    - Lista por producto con buscador.
    - Movimientos rápidos «Entrada a bodega», «Dejar a vendedor» y «Nuevo producto».
  - Con un vendedor en «Viendo»:
    - «Stock de {nombre}» con su total.
    - Su lista por producto con buscador.
    - Los movimientos rápidos «Dejar más a {nombre}» y «Retirarle producto».
  - Estados cargando, vacío y error con «Reintentar». La pantalla se recarga sola tras guardar en «Dejar» o «Retirar».
  - Ruta `/admin/entrada` con la página genérica «Próximamente», para el movimiento rápido «Entrada a bodega».
- **Pruebas** de backend y frontend (§7).

**No entra en este spec:**

- La pantalla real de «Entrada a bodega» (pantalla 11, movimiento `purchase`): va en su propia historia.
- El aviso de baja existencia (RF-17). Falta decidir cuántas piezas son «baja».
- Movimientos rápidos de otros milestones:
  - «Vender» (M3).
  - «Fraccionar» (M5).
  - «Registrar su merma» (M6).
  - «Ver su corte» (M4a).
- «Vendió hoy» del vendedor (M3).
- La merma de la semana (RF-16), «lo que le deben» y la lista de resurtir (v2).
- El reparto por lugar en las tarjetas de Productos («B · L · A» del mockup 03).
- La fecha del día en la cabecera del mockup.
- Cambios en el seed: el de HU-09 ya deja 6 piezas a Víctor Vendedor.

## 2. Reglas de negocio

- **Solo el administrador.** `GET /api/stock` exige `requireRole(request, 'admin')`: un vendedor recibe `403` y sin sesión es `401`. La ruta `/admin/stock` ya está detrás de `roleGuard`.
- **Bodega** = `products.stock`. **Un vendedor** = `vendor_stock.qty`. Las dos solo cambian con movimientos (T-07): aquí solo se leen. **Total de un producto** = bodega + todos los vendedores. **Total del negocio** = suma de los totales de los productos.
- **Qué productos cuentan:** todo producto con piezas > 0 en algún lugar, activo o archivado. Las bolsitas (productos con `parent_product_id`) cuentan como productos aparte. Un producto con 0 piezas en todas partes no sale en la lista ni suma.
- **Vendedores activos** (`profiles.role = 'vendedor'` y `active = true`):
  - Salen con su nombre en la leyenda de la barra, también con 0 piezas.
  - En la barra solo dibujan segmento si tienen piezas.
  - En el reparto de cada producto solo salen si tienen piezas de ese producto.
- **Vendedores desactivados con piezas:** sus piezas suman al total, y salen agrupados en un solo segmento y una sola entrada «Vendedores inactivos», nunca con su nombre. Si ninguno tiene piezas, esa entrada no aparece.
- **Con «Yo · bodega»:**
  - Título «Stock general».
  - Tarjeta «Total del negocio» con el número de piezas, la barra y la leyenda: «Bodega», cada vendedor activo y, si hace falta, «Vendedores inactivos».
  - Lista de productos. Cada fila lleva foto (o iniciales), nombre y total a la derecha. Debajo, el reparto en una línea que puede saltar: «Bodega 4 · Luis 6», solo con los lugares que tienen piezas.
- **Con un vendedor en «Viendo»:**
  - Título «Resumen de {nombre}».
  - Tarjeta «Stock de {nombre}» con su total.
  - Lista de sus productos con piezas > 0: foto, nombre y sus piezas, sin reparto.
  - Si el vendedor no tiene productos: «Todavía no tiene producto.», el texto de HU-09.
- **Movimientos rápidos con «Yo»:**
  - «Entrada a bodega» lleva a `/admin/entrada` («Próximamente»).
  - «Dejar a vendedor» abre el pop-up «Dejar» sin vendedor fijo, con `deliveryModalLink()`.
  - «Nuevo producto» lleva a `/admin/productos/nuevo`.
- **Movimientos rápidos con un vendedor:**
  - «Dejar más a {nombre}» abre «Dejar» con ese vendedor fijo, con `deliveryModalLink({ sellerId })`.
  - «Retirarle producto» abre «Retirar» con `returnModalLink(sellerId)`.
- **Orden:** productos por nombre y vendedores de la leyenda por nombre, sin distinguir mayúsculas ni acentos, como en `sortSellersByName` (regla pura del frontend). «Bodega» va siempre primero y «Vendedores inactivos» al final.
- **Buscador:** filtra la lista por nombre sin mayúsculas ni acentos con `shared/utils/normalize-text.ts`, como Productos. Solo filtra la lista, no cambia el total ni la barra.
- **Texto de piezas:** «1 pieza» / «N piezas» en totales y filas. El reparto usa solo el número («Bodega 4 · Luis 6»).
- **Actualización (criterio 5):**
  - La pantalla pide `GET /api/stock` cada vez que se entra.
  - Recarga sin ocultar los datos cuando cambia `StockChangesService.version`, como el detalle del vendedor.
  - Cambiar de vendedor en «Viendo» no vuelve a pedir datos: la misma respuesta trae a todos.
- **Selección no confirmada:** mientras `ViewingService.selectedSeller()` es `null`, se muestra la vista de «Yo». Es lo mismo que pasa mientras carga la lista de «Viendo» o si el id guardado ya no es de un vendedor activo.
- **Celular (RNF-03):** se usa sin zoom a 375 px, sin scroll horizontal. La leyenda y el reparto saltan de línea en vez de cortarse.

## 3. Endpoint

`GET /api/stock`, solo para administradores.

```json
// 200
{
  "warehouse": 412,
  "sellers": [
    { "id": "uuid", "fullName": "Luis", "units": 168 },
    { "id": "uuid", "fullName": "Valeria Vendedora", "units": 0 }
  ],
  "inactiveSellers": 0,
  "total": 580,
  "products": [
    {
      "productId": 10,
      "name": "Proteína Demo Whey 2 lb",
      "image": "https://…",
      "warehouse": 4,
      "sellers": [{ "sellerId": "uuid", "units": 6 }],
      "inactiveSellers": 0,
      "total": 10
    }
  ]
}
```

- `sellers` (arriba): todos los vendedores activos, también con `units: 0`, ordenados por `full_name`.
- `products[].sellers`: solo vendedores activos con `units > 0` de ese producto.
- `inactiveSellers`: suma de las piezas de los vendedores desactivados, en total y por producto.
- `products`: solo los que tienen `total > 0`, ordenados por `name`. `image` vacía responde `null`, como en HU-09.
- Invariantes que prueban los tests:
  - `total = warehouse + Σ sellers.units + inactiveSellers`, arriba y en cada producto.
  - El `total` de arriba es la suma de los `total` de los productos.

| Caso | Status | `error.message` |
| --- | --- | --- |
| Sin sesión / no es administrador | 401 / 403 | Los de `requireRole` |

## 4. Modelo de datos

No hay migración: `products.stock`, `vendor_stock` y `profiles` ya existen.

**Backend:**

```ts
// backend/src/stock/holdings.ts (se agrega, exportado en stock/index.ts)
export interface ProductHoldings {
  productId: number; name: string; image: string | null;
  warehouse: number;
  holders: { profileId: string; units: number }[];   // vendor_stock con qty > 0
}
export function holdingsByProduct(): Promise<ProductHoldings[]>   // productos con alguna pieza, por nombre

// backend/src/inventory/overview.ts (módulo nuevo; index.ts y constants.ts)
export interface StockOverview { /* la forma de §3 */ }
export function getStockOverview(): Promise<StockOverview>
```

- **`inventory` es un módulo nuevo** porque junta dos módulos: `stock` (piezas) y `accounts` (`listSellers`, para saber quién está activo y su nombre). `accounts` ya importa `@stock`, así que poner esto en cualquiera de los dos crearía un ciclo.
- Se agrega el alias `@inventory` en `backend/tsconfig.json`. `inventory` importa solo `@stock` y `@accounts`, y `tests/architecture.test.ts` lo cubre.
- Un `profileId` de `holders` que no está en `listSellers()` es un vendedor desactivado y suma a `inactiveSellers`.
- Ruta delgada nueva: `backend/app/api/stock/route.ts`, `GET`, con `requireRole(request, 'admin')` y `getStockOverview()`.

**Frontend (`src/app/features/stock/`):**

```ts
// interfaces/stock-overview.models.ts
export interface StockSellerTotal { id: string; fullName: string; units: number }
export interface StockProductSellerUnits { sellerId: string; units: number }
export interface StockProduct {
  productId: number; name: string; image: string | null;
  warehouse: number; sellers: StockProductSellerUnits[]; inactiveSellers: number; total: number;
}
export interface StockOverview {
  warehouse: number; sellers: StockSellerTotal[]; inactiveSellers: number; total: number;
  products: StockProduct[];
}
// Segmento de la barra y entrada de la leyenda, ya resuelto (nombre y color).
export interface StockSplitPart { key: string; label: string; units: number; colorIndex: number | null }

// services/stock.service.ts
overview(): Observable<StockOverview>   // GET ${API_BASE_URL}/api/stock

// rules/stock.rules.ts (puras)
splitParts(overview: StockOverview): StockSplitPart[]                                  // Bodega, activos por nombre, «Vendedores inactivos»
productBreakdown(product: StockProduct, sellers: StockSellerTotal[]): string           // «Bodega 4 · Luis 6»
sellerProducts(overview: StockOverview, sellerId: string): { product: StockProduct; units: number }[]
sellerTotal(overview: StockOverview, sellerId: string): number
filterStockByName<T extends { name: string }>(items: T[], query: string): T[]
unitsLabel(units: number): string                                                      // «1 pieza» / «N piezas»
```

- **Constantes** (`constants/stock-page.constants.ts`):
  - Los textos de la pantalla y de los estados (§5).
  - Las etiquetas «Bodega» y «Vendedores inactivos».
  - Las listas de movimientos rápidos.
  - La cantidad de colores de la paleta.
- **Colores:** se agregan en `styles.css` los tokens `--color-split-warehouse` (tinta) y `--color-split-1`…`--color-split-5`. Los valores los fija el paso de diseño y tienen que cumplir contraste con la tarjeta. Cada vendedor activo usa `--color-split-{(índice % 5) + 1}` en orden alfabético; «Vendedores inactivos» usa `--color-faint`.
- **Componentes presentacionales** (`features/stock/components/`, solo `input()`/`output()`):
  - `stock-split-bar`: barra dividida y leyenda. La barra es decorativa (`aria-hidden`) y la leyenda lleva los números en texto.
  - `stock-product-row`: foto o iniciales, nombre, total y, opcional, la línea de reparto.
  - `stock-product-row-skeleton`: esqueleto de una fila.
  - `stock-quick-actions`: rejilla de enlaces. Recibe `{ label, link, icon }[]`; los enlaces ya vienen armados desde la página.
- **Página** `pages/stock-page`:
  - `rxResource` sobre `overview()`.
  - `computed()` sobre `ViewingService.selectedSeller()`, el buscador y la respuesta.
  - Un `effect` sobre `StockChangesService.version` que llama a `reload()` sin pasar a «cargando» si ya hay datos.
- **Rutas:**
  - `features/stock/stock.routes.ts` exporta `STOCK_ROUTES`: `''` → `stock-page`, lazy, con `data: { title: 'Stock general' }`.
  - En `core/layout/routes/admin.routes.ts`, `stock` pasa a `loadChildren` de `@features/stock/stock.routes`.
  - Se agrega `{ path: 'entrada', loadComponent: comingSoon, data: { title: 'Entrada a bodega' } }`.
  - El menú (`MENU`) no cambia: sigue diciendo «Stock».
- **Sin importar otras features:** `features/stock` no importa `features/products` ni `features/sellers`.
  - Su buscador usa `shared/utils/normalize-text.ts`.
  - Las iniciales usan `shared/utils/initials.ts`.
  - Los enlaces de pop-up usan `shared/utils/modal-links.ts`.
  - El orden por nombre se reescribe en `stock.rules.ts` con `localeCompare(…, 'es', { sensitivity: 'base' })`.

## 5. Plan de implementación

1. **Backend · lectura por producto.** Agregar `holdingsByProduct()` a `backend/src/stock/holdings.ts`: lee `products` con `stock > 0` o con filas de `vendor_stock` con `qty > 0`, archivados incluidos. Exportarlo en `stock/index.ts`. `npm run type-check` pasa.
2. **Backend · módulo `inventory` y ruta.** Crear `src/inventory/` (`index.ts`, `constants.ts`, `overview.ts` con `getStockOverview`), el alias `@inventory` y `app/api/stock/route.ts`. Crear `backend/tests/stock-overview.test.ts` (§7). `npm run type-check` y `npm test` pasan, incluido `architecture.test.ts`.
3. **Frontend · datos y reglas.** `ng generate`, más la estructura de carpetas, de `features/stock/` (`pages/`, `components/`, `services/`, `interfaces/`, `rules/`, `constants/`). Modelos, `StockService.overview()` y las reglas de `stock.rules.ts`, con sus specs. `ng test` pasa.
4. **Frontend · diseño.** El flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design, sobre `AdminInicio`/`EstadosStock`, traducido a los tokens de `styles.css`.
   - Ahí se fijan los valores de `--color-split-*` y su contraste.
   - Se reusan `surface-*`, `page-title`, `alert-*`, `Card`, `Skeleton` y `pButton`.
   - No se copian el menú inferior del mockup, la barra «Viendo» propia del mockup, sus colores ni sus fuentes: la app ya tiene `top-nav` y la barra de HU-10.
5. **Frontend · componentes.** `ng generate component` para `stock-split-bar`, `stock-product-row`, `stock-product-row-skeleton` y `stock-quick-actions`, con sus specs.
6. **Frontend · página y rutas.** `ng generate component` para `stock-page`. Crear `stock.routes.ts`, montar `stock` y `entrada` en `admin.routes.ts` y armar la pantalla con sus estados:
   - **Cargando:** «Cargando el stock…» y «Bodega y vendedores.», con esqueletos.
   - **Vacío** (`products` vacío): «Aún no hay productos», «Agrega tu primer producto para ver aquí el stock.» y el botón «Nuevo producto».
   - **Error:** «No pudimos cargar el stock», «Revisa tu conexión e inténtalo de nuevo.» y «Reintentar» (`reload()`).
   - **Buscador sin resultados:** «No hay productos con ese nombre» y «Revisa cómo lo escribiste.», los textos de Productos.
   - **Vendedor sin productos:** «Todavía no tiene producto.».
   - **Cierre del paso:** `ng build`, `ng test` y `npm run check:architecture` pasan.
7. **Verificación manual** contra la base local con el seed (admin y Víctor con 6 piezas), en escritorio y a 375 px:
   - Con «Yo», el total cuadra con bodega + Víctor. La leyenda muestra a Valeria con 0 y no muestra a Iván.
   - La fila de la proteína dice «Bodega 8 · Víctor Vendedor 4».
   - Elegir a Víctor en «Viendo» muestra «Stock de Víctor Vendedor · 6 piezas» con sus dos productos y sus dos acciones.
   - «Dejar más» y «Retirarle producto» abren su pop-up con Víctor fijo. Al guardar, los números cambian sin recargar la página.
   - «Entrada a bodega» abre «Próximamente».
   - Con el backend apagado se ve el error, y «Reintentar» con el backend encendido carga el stock.
8. **Cierre.**
   - Actualizar `specs/README.md`.
   - Actualizar `CLAUDE.md`/`AGENTS.md` con el módulo `inventory`, `GET /api/stock` y la feature `stock`.
   - Comentar el avance en `SCRUM-37` en cada paso, con el patrón de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-37`:

- [ ] **1.** Con «Yo · bodega» en «Viendo», «Stock» abre «Stock general» con el total del negocio y la barra dividida en bodega y cada vendedor, con su leyenda.
- [ ] **2.** Con 4 piezas de un producto en bodega y 6 con un vendedor, su fila muestra «Bodega 4 · {vendedor} 6» y «10 piezas» (prueba de backend con `insertMovements` y prueba de la regla `productBreakdown`).
- [ ] **3.** Con un vendedor en «Viendo», la pantalla muestra solo su stock (total y productos) y las acciones «Dejar más a {nombre}» y «Retirarle producto», que abren sus pop-ups con él fijo.
- [ ] **4.** Con «Yo», los movimientos rápidos son «Entrada a bodega» (lleva a «Próximamente»), «Dejar a vendedor» (abre «Dejar») y «Nuevo producto» (lleva al alta).
- [ ] **5.** Tras guardar en «Dejar» o «Retirar», «Stock general» muestra los números nuevos sin recargar la página. Al volver a entrar a la pantalla también.
- [ ] **6.** Cargando, vacío y error se ven con los textos de §5, y «Reintentar» vuelve a pedir el stock.

Además:

- [ ] `GET /api/stock` responde `403` a un vendedor y `401` sin sesión.
- [ ] El total de arriba y el de cada producto cumplen `total = bodega + vendedores activos + inactivos`. Un producto archivado con piezas cuenta, y uno con 0 en todas partes no aparece.
- [ ] Las piezas de un vendedor desactivado suman al total como «Vendedores inactivos», sin su nombre.
- [ ] El buscador filtra sin mayúsculas ni acentos y no cambia el total ni la barra.
- [ ] A 375 px no hay scroll horizontal ni zoom, y la leyenda y el reparto saltan de línea.
- [ ] `features/stock` no importa otras features, y `inventory` solo usa `@stock` y `@accounts`.
- [ ] Backend: `npm run type-check` y `npm test` pasan, con `SUPABASE_SERVICE_ROLE_KEY` puesta. Frontend: `ng build`, `ng test` y `npm run check:architecture` pasan.

## 7. Plan de pruebas

- **`backend/tests/stock-overview.test.ts`** (contra la base local):
  - **Datos de prueba:** cuentas `test-auth-`, productos y movimientos de prueba. Se borran al terminar, los movimientos del más nuevo al más viejo.
  - **Criterio 2:** un producto con `initial` 10 y un `delivery` de 6 al vendedor de prueba sale con `warehouse: 4`, su vendedor con `6` y `total: 10`.
  - **Vendedor desactivado:** tras desactivar al vendedor de prueba, sus piezas pasan a `inactiveSellers` y él no sale en `sellers`.
  - **Archivados y vacíos:** un producto archivado con piezas sale. Uno con 0 en todas partes no sale.
  - **Invariantes de §3:** se cumplen en toda la respuesta.
  - **Permisos:** `403` para un vendedor y `401` sin token.
- **`features/stock/rules/stock.rules.spec.ts`:**
  - `splitParts`: Bodega primero, activos por nombre sin acentos, «Vendedores inactivos» al final solo si tiene piezas, colores que rotan a partir del sexto vendedor.
  - `productBreakdown`: «Bodega 4 · Luis 6», sin los lugares en 0 y con «Vendedores inactivos».
  - `sellerProducts` y `sellerTotal` para un vendedor con y sin piezas.
  - `filterStockByName` («proteina» encuentra «Proteína»).
  - `unitsLabel` con 0, 1 y 6.
- **`features/stock/services/stock.service.spec.ts`:** `overview()` llama a `/api/stock`.
- **Componentes:**
  - `stock-split-bar`: leyenda con números y barra `aria-hidden`.
  - `stock-product-row`: con y sin reparto, foto o iniciales.
  - `stock-quick-actions`: un enlace por acción.
- **`features/stock/pages/stock-page/…spec.ts`:**
  - Los tres estados (cargando, vacío, error), y «Reintentar» llama de nuevo.
  - Vista «Yo» con total, barra, lista y tres acciones.
  - Con un vendedor en «Viendo» (`ViewingService` simulado): su total, sus productos y sus dos acciones con los enlaces de `modal-links`.
  - Cambiar `StockChangesService.version` recarga sin mostrar «cargando».
  - El buscador filtra la lista y deja igual el total.
- **`core/layout/routes`:** `stock` carga `STOCK_ROUTES` y `entrada` carga la página «Próximamente».

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El total no cuadra con la suma por lugar | El backend calcula todo de una sola lectura, y la prueba revisa las invariantes de §3 en cada producto y arriba |
| Con muchos vendedores, la barra y la leyenda no caben a 375 px | La leyenda salta de línea; los segmentos sin piezas no se dibujan. Hay revisión visual a 375 px con 3 o más vendedores |
| Colores de vendedores difíciles de distinguir | La leyenda siempre lleva nombre y número, y el paso de diseño fija tokens con contraste suficiente; la barra es decorativa |
| Un ciclo entre módulos del backend (`accounts` ↔ `stock`) | El caso de uso vive en el módulo nuevo `inventory`, y `architecture.test.ts` lo comprueba |
| La respuesta crece con muchos productos y vendedores | Solo trae productos con piezas y vendedores con piezas por producto. Para el tamaño del negocio basta; paginar sería otra historia |
| La selección de «Viendo» aún no confirmada muestra «Yo» un instante | Es el comportamiento de HU-10 (selección efectiva). La vista cambia en cuanto la lista confirma al vendedor, sin volver a pedir datos |

## 9. Decisiones

- **Sí:** el desglose por producto vive en «Stock general», como una lista debajo de la barra (decisión del usuario). Cumple el criterio 2 en la misma pantalla, sin tocar Productos.
- **No:** el reparto «B · L · A» en las tarjetas de Productos. Es de la pantalla 03, toca otra feature y puede ir en su propia historia.
- **Sí:** «Entrada a bodega» lleva a `/admin/entrada` con «Próximamente» (decisión del usuario). El criterio 4 se cumple sin adelantar la pantalla 11, que está «por confirmar».
- **No:** implementar `purchase` aquí. Agranda la historia y su mockup no está cerrado.
- **Sí:** cuentan todos los productos con piezas, activos y archivados, y las bolsitas como productos aparte (decisión del usuario). Es el inventario real.
- **Sí:** con un vendedor en «Viendo», su total y su lista por producto, con «Dejar más» y «Retirarle producto» (decisión del usuario). No incluye «Vendió hoy» (M3).
- **No:** redirigir al detalle del vendedor. El criterio 3 pide ver su stock en «Stock general».
- **Sí:** los vendedores desactivados con piezas suman, agrupados como «Vendedores inactivos» (decisión del usuario). El total no miente y no se expone a quien ya no trabaja.
- **Sí:** cada fila muestra nombre, total y el reparto en texto que salta de línea (decisión del usuario). Escala a cualquier número de vendedores a 375 px.
- **No:** una tabla con una columna por vendedor. Necesita scroll horizontal en celular.
- **Sí:** el buscador de Productos, reescrito en la feature con `normalize-text` (decisión del usuario). Una feature no importa otra.
- **Sí:** bodega con el color de tinta y una paleta fija de 5 tokens que rota por vendedor en orden alfabético (decisión del usuario). La leyenda con nombre y número desambigua.
- **Sí:** un solo endpoint, `GET /api/stock`, con bodega, todos los vendedores y el reparto por producto. Cambiar de vendedor en «Viendo» no hace otra petición.
- **No:** reusar `GET /api/sellers/:id` para la vista del vendedor, porque serían dos cargas y dos estados distintos en la misma pantalla.
- **Sí:** módulo nuevo `src/inventory/` para el caso de uso que junta `stock` y `accounts`. Evita un ciclo entre módulos, según el monolito modular de `CLAUDE.md`.
- **Sí:** los vendedores activos con 0 piezas salen en la leyenda («cada vendedor», criterio 1), pero no dibujan segmento.
- **No:** la fecha del día de la cabecera del mockup. No la pide ningún criterio.
- **No:** cambiar el seed. El de HU-09 alcanza para la verificación manual, y el criterio 2 lo cubre la prueba de backend.

## Lo que **no** entra en este spec

- La pantalla de «Entrada a bodega» y el movimiento `purchase`.
- El aviso de baja existencia (RF-17).
- «Vender», «Fraccionar», «Registrar su merma» y «Ver su corte».
- «Vendió hoy», la merma de la semana, «lo que le deben» y la lista de resurtir.
- El reparto por lugar en las tarjetas de Productos.

Cada uno, si llega, va en su propio spec o en su historia.
