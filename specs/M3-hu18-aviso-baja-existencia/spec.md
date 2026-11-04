# Spec técnico — HU-18 · Recibir el aviso de baja o nula existencia

> **Estado:** Aprovado
> **Depende de:** M2-hu13-stock-general (`specs/M2-hu13-stock-general/spec.md`) — «Stock general» y `GET /api/stock`; M3-hu14-ver-mi-stock (`specs/M3-hu14-ver-mi-stock/spec.md`) — «Mi stock» y `GET /api/me/stock`; M3-hu16-confirmar-venta (`specs/M3-hu16-confirmar-venta/spec.md`) — «Venta confirmada» del vendedor; M3-hu17-vender-como-administrador (`specs/M3-hu17-vender-como-administrador/spec.md`) — `GET /api/sales/catalog`, «Productos» con «Agregar» y «Venta confirmada» del administrador; M1-hu05-ver-y-buscar-productos (`specs/M1-hu05-ver-y-buscar-productos/spec.md`) — `product-card` y su etiqueta «Agotado»; M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`) — `products.stock`, `vendor_stock.qty` y `stock_movements`
> **Fecha:** 2026-11-04
> **Objetivo:** que el administrador y cada vendedor vean dentro de la app qué productos quedaron con 2 piezas o menos, o agotados, en la bodega o con cada vendedor, para resurtir a tiempo.

Fuentes:

- **Jira:** historia `SCRUM-52 · HU-18`, épica `SCRUM-8 · M3 · Ventas`. Requerimientos RF-17, RF-21, RF-02, RNF-04. Talla M. Depende de HU-13, HU-14, HU-16 y HU-17.
- **Confluence:** «Requerimientos» (RF-17: «Avisar cuando un producto tiene baja o nula existencia»); «Mockups y flujo de pantallas · MVP v1» (pantallas 02 Stock general, 03 Productos, 06c Venta confirmada, 09 Mi stock).
- **Canvas:** tableros `AdminInicio` (tarjeta ámbar «3 productos con baja existencia» / «N productos por terminarse» con la lista), `VendedorStock` (aviso «Te quedan pocas Creatinas. Ya se le avisó al administrador.» y etiqueta «Quedan pocas» con 2 piezas o menos) y `Venta` (vista confirmada: «Se avisó al administrador que te quedan pocas piezas de: …»).
- **Código:**
  - `backend/src/inventory/overview.ts` (`getStockOverview`), `own-stock.ts` (`getOwnStock`) y `sale-catalog.ts` (`getSaleCatalog`).
  - `backend/src/stock/holdings.ts` (`stockOfHolder`, `stockOfWarehouse`, `holdingsByProduct`) y `backend/src/sales/sales.ts` (`SaleLine.stock.before/after`).
  - `features/stock/pages/stock-page`, `features/products/components/product-card` (etiqueta «Agotado» con `stock <= 0`), `features/my-stock/pages/my-stock-page`, `features/sell/pages/sale-summary-page` y `admin-sale-summary-page`, `features/sell/components/sale-line` y `admin-sale-line`.
- **Decisiones del usuario del 2026-11-04** (§9).

## 1. Alcance

**Entra en este spec:**

- **Backend · nivel de existencia:**
  - Constante `LOW_STOCK_THRESHOLD = 2` y la regla `stockLevelOf` en `src/stock/` (§2).
  - `stockLevel` (`'ok' | 'low' | 'out'`) en cada línea de `GET /api/stock`, `GET /api/me/stock`, `GET /api/sales/catalog`, `POST /api/sales` y `GET /api/sales/:requestId`.
  - Lista calculada de avisos: `lowStock` en `GET /api/stock` (todos los titulares) y `alerts` en `GET /api/me/stock` (solo los del vendedor en sesión).
- **Frontend · «Stock general»:** tarjeta ámbar con la lista de productos bajos o agotados y de quién son; con un vendedor en «Viendo», solo los suyos.
- **Frontend · «Productos»:** etiqueta «Baja existencia» o «Agotado» en la card, según el stock del titular en «Viendo».
- **Frontend · «Mi stock» del vendedor:** aviso «Te quedan pocas piezas de: … Ya se le avisó al administrador.» y etiqueta «Quedan pocas» / «Agotado» en sus cards.
- **Frontend · «Venta confirmada»:**
  - Vendedor: aviso «Se avisó al administrador que te quedan pocas piezas de: …» cuando algún renglón quedó bajo o agotado.
  - Administrador: etiqueta «Baja existencia» / «Agotado» en el renglón que quedó así.
- **Pruebas** de backend y frontend (§7).

**No entra en este spec:**

- Notificaciones fuera de la app (correo, push, WhatsApp): el aviso se ve al abrir o recargar la pantalla.
- Un límite por producto, por vendedor o configurable desde la app: es un solo número fijo en el código.
- Guardar avisos, marcarlos como leídos o llevar un historial: se calculan en cada lectura.
- Lista de resurtir (RF-19, RF-20): v2.
- Etiquetas en las filas de la lista de «Stock general» (el aviso es la tarjeta).
- Productos archivados: nunca generan aviso.
- Migraciones o cambios en `supabase/seed.sql`.

## 2. Reglas de negocio

- **Límite:** «baja existencia» es tener **1 o 2 piezas** (`LOW_STOCK_THRESHOLD = 2`, igual para la bodega y para todos los vendedores). **0 piezas** es «agotado».
- **Por titular:** se mide en la bodega (`products.stock`) y en cada vendedor activo (`vendor_stock.qty`) por separado, nunca sobre el total del negocio. No se guarda un saldo aparte.
- **Nivel de una línea** (`stockLevel`):
  - `'out'` con 0 piezas, `'low'` con 1 o 2, `'ok'` con 3 o más.
- **Qué productos entran al aviso:**
  - **Bodega:** todo producto **activo** con 2 piezas o menos, incluidas las bolsitas y los productos nuevos que aún están en 0.
  - **Vendedor activo:** los productos que tiene con 1 o 2 piezas, y los que tiene en 0 **solo si se le acabaron vendiendo**: el último movimiento de ese producto para ese vendedor no fue un `return`. Retirarle todo a un vendedor no genera aviso.
  - Vendedores desactivados y productos archivados no generan aviso.
  - En las líneas sueltas (catálogo, «Mi stock», venta), una fila de vendedor en 0 cuyo último movimiento fue un retiro lleva `stockLevel: 'ok'`: ahí no hay nada que resurtir.
- **Se recalcula en cada lectura:** dejarle piezas a un vendedor, una entrada a bodega o un retiro hacen que el aviso desaparezca o aparezca al recargar la pantalla (criterio 7). No hay estado «leído».
- **«Stock general» del administrador:**
  - Con «Yo · bodega»: tarjeta ámbar «N productos con baja existencia» (singular «1 producto con baja existencia») con un renglón por aviso: nombre, titular y piezas («Creatina 300 g · Bodega: 1», «Whey 2 lb · Luis: 0 · Agotado»). Un mismo producto bajo en la bodega y con Luis sale dos veces.
  - Con un vendedor en «Viendo»: «N productos por terminarse» con solo los avisos de ese vendedor.
  - Sin avisos, la tarjeta no sale. Orden: agotados primero, luego por nombre.
- **«Productos»:** la card muestra «Agotado» (`stockLevel 'out'`) o «Baja existencia» (`'low'`) según el catálogo del titular en «Viendo» (`GET /api/sales/catalog`, el mismo que usa «Agregar»).
  - Mientras el catálogo carga (o si falla), con «Yo · bodega» se conserva la regla de HU-05 (`products.stock <= 0` → «Agotado») y no sale «Baja existencia».
  - Con un vendedor en «Viendo», un producto que no está en su catálogo no lleva etiqueta.
  - «Fraccionado» sigue igual.
- **«Mi stock» (vendedor):**
  - Aviso arriba cuando tiene avisos: «Te quedan pocas piezas de: Creatina, Whey (agotado). Ya se le avisó al administrador.».
  - Card con «Quedan pocas» (`'low'`) o «Agotado» (`'out'`). Un producto que se le acabó vendiendo aparece solo en el aviso, porque «Mi stock» lista lo que tiene en mano (HU-14).
  - Nunca muestra costos (RNF-04, RF-02).
- **«Venta confirmada»:**
  - Vendedor: si algún renglón quedó con `stockLevel` `'low'` o `'out'`, aviso «Se avisó al administrador que te quedan pocas piezas de: …» con esos nombres.
  - Administrador: etiqueta «Baja existencia» / «Agotado» junto a «Bodega: 4 → 2» / «Luis: 3 → 0».
  - «Se avisó al administrador» significa que el administrador lo verá en «Stock general» al abrirlo o recargarlo: no se envía nada.
- **Textos:** los de este spec son de partida y se confirman contra el canvas en el paso de diseño (§5 paso 7).
- **Celular (RNF-03):** a 375 px sin scroll horizontal; la tarjeta de avisos con muchos productos hace scroll dentro o se recorta con «y N más», sin empujar las acciones fuera de la pantalla (se decide en diseño).

## 3. Endpoints

Sin endpoints nuevos. Cambian las respuestas:

```json
// GET /api/stock (administrador): agrega `lowStock` y `stockLevel`
{
  "warehouse": 118, "sellers": [ … ], "inactiveSellers": 0, "total": 124,
  "products": [ { "productId": 3, "warehouse": 1, "warehouseLevel": "low", "sellers": [ { "sellerId": "uuid", "units": 0, "stockLevel": "out" } ], … } ],
  "lowStock": [
    { "productId": 3, "name": "Creatina 300 g", "image": null, "holder": null, "units": 1, "stockLevel": "low" },
    { "productId": 5, "name": "Whey 2 lb", "image": null, "holder": { "id": "uuid", "fullName": "Luis Vendedor" }, "units": 0, "stockLevel": "out" }
  ]
}

// GET /api/me/stock (vendedor): cada producto con `stockLevel` y la lista `alerts`
{ "total": 6, "products": [ { "productId": 3, "name": "…", "image": null, "units": 2, "price": "450.00", "stockLevel": "low" } ],
  "alerts": [ { "productId": 3, "name": "…", "units": 2, "stockLevel": "low" } ] }

// GET /api/sales/catalog: cada producto con `stockLevel`
// POST /api/sales y GET /api/sales/:requestId: cada renglón con `stockLevel` (calculado de `stock.after`)
```

| Caso | Resultado |
| --- | --- |
| Producto activo con 2 piezas en bodega | `lowStock` con `holder: null`, `stockLevel: 'low'` |
| Producto activo con 0 en bodega (también nuevo) | `lowStock` con `stockLevel: 'out'` |
| Vendedor con 0 tras vender | `lowStock` y `alerts` con `stockLevel: 'out'` |
| Vendedor con 0 tras un retiro | No sale en avisos; línea con `stockLevel: 'ok'` |
| Producto archivado o vendedor desactivado | No sale en avisos |

Los errores, la autorización y el resto de los campos no cambian.

## 4. Modelo de datos

Sin migración ni tablas nuevas: todo se calcula de `products.stock`, `vendor_stock.qty` y el último `stock_movements` por titular y producto.

**Backend · `src/stock/`:**

```ts
// constants.ts (se agrega)
export const LOW_STOCK_THRESHOLD = 2;

// levels.ts (nuevo; exportado en index.ts)
export type StockLevel = 'ok' | 'low' | 'out';
export function stockLevelOf(units: number, options?: { withdrawn?: boolean }): StockLevel;
// 0 → 'out' (o 'ok' si `withdrawn`: se le retiró todo); 1–2 → 'low'; 3+ → 'ok'

// holdings.ts (se agrega)
export interface LowStockLine { productId: number; name: string; image: string | null; holderProfileId: string | null; units: number; stockLevel: 'low' | 'out' }
export async function lowStockLines(holderProfileId?: string): Promise<LowStockLine[]>;
// Sin argumento: bodega + vendedores activos; con un id: solo ese vendedor. Excluye archivados.
export async function withdrawnProductIds(holderProfileId: string): Promise<Set<number>>;
// Productos en 0 de ese vendedor cuyo último movimiento fue un `return`.
```

- `HolderStockLine` (de `stockOfHolder`) y `WarehouseStockLine` (de `stockOfWarehouse`) agregan `stockLevel`.
- `src/inventory/overview.ts`: `StockOverview.lowStock` (con `holder: { id; fullName } | null` resuelto con `@accounts`), `StockProduct.warehouseLevel` y `stockLevel` en cada `sellers[]`.
- `src/inventory/own-stock.ts`: `OwnStockProduct.stockLevel` y `OwnStock.alerts`.
- `src/inventory/sale-catalog.ts`: `SaleCatalogProduct.stockLevel`.
- `src/sales/sales.ts`: `SaleLine.stockLevel` (de `stock.after`; un renglón de venta nunca es un retiro).

**Frontend:**

- `shared/constants/stock-level.constants.ts`: `StockLevel` como tipo en `shared/` (`'ok' | 'low' | 'out'`) y los textos de las etiquetas («Baja existencia», «Agotado», «Quedan pocas»). El frontend nunca repite el número 2: solo pinta lo que manda el backend.
- `features/stock/interfaces/stock.models.ts`: `StockOverview.lowStock`, `warehouseLevel` y `stockLevel` por vendedor.
- `features/stock/components/low-stock-alert/` (nuevo, presentacional): tarjeta ámbar con título y lista; `input()` `items`, `title`.
- `features/products/components/product-card`: `input()` nuevo `stockLevel` (`StockLevel | null`); `products-page` lo saca del catálogo del titular en «Viendo».
- `core/sale-catalog/sale-catalog.models.ts`: `SaleCatalogProduct.stockLevel`.
- `features/my-stock/`: `OwnStock.alerts`, `stockLevel` por producto, aviso en la página y etiqueta en su card.
- `features/sell/interfaces/sale.models.ts`: `SaleLine.stockLevel`; aviso en `sale-summary-page` y etiqueta en `admin-sale-line`.
- `features/products` y `features/stock` no se importan entre sí: lo común (tipo y textos) vive en `shared/`.

## 5. Plan de implementación

1. **Backend · nivel de existencia.**
   - `LOW_STOCK_THRESHOLD`, `levels.ts`, `withdrawnProductIds` y `lowStockLines` en `src/stock/`; `stockLevel` en `stockOfHolder` y `stockOfWarehouse`.
   - `tests/stock-levels.test.ts` (§7). `npm test` y `npm run type-check` de `backend/` pasan.
2. **Backend · respuestas.**
   - `lowStock` y `stockLevel` en `getStockOverview`; `alerts` y `stockLevel` en `getOwnStock`; `stockLevel` en `getSaleCatalog` y en los renglones de `createSale`/`getSale`.
   - Ampliar `stock-overview.test.ts`, `own-stock.test.ts`, `sale-catalog.test.ts` y `sales.test.ts`. `npm test` pasa.
3. **Frontend · modelos y «Stock general».**
   - `shared/constants/stock-level.constants.ts`, modelos de `features/stock`, componente `low-stock-alert` y su uso en `stock-page` (bodega y vendedor en «Viendo»).
   - Specs del componente y de `stock-page`. `ng test` y `npm run check:architecture` pasan.
4. **Frontend · «Productos».**
   - `stockLevel` en `SaleCatalogProduct`, `product-card` con «Baja existencia»/«Agotado» y `products-page` pasándolo desde el catálogo (con el respaldo de HU-05 mientras carga).
   - Ampliar los specs de `product-card` y `products-page`. `ng test` pasa.
5. **Frontend · «Mi stock».**
   - Modelos, aviso en `my-stock-page` y etiqueta en su card.
   - Ampliar sus specs. `ng test` pasa.
6. **Frontend · «Venta confirmada».**
   - `SaleLine.stockLevel`, aviso en `sale-summary-page` (vendedor) y etiqueta en `admin-sale-line`.
   - Ampliar sus specs. `ng test` y `ng build` pasan.
7. **Frontend · diseño.** El flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design sobre los tableros `AdminInicio`, `VendedorStock` y `Venta`, traducidos a los tokens de `styles.css` (sin copiar el ámbar del canvas: se usan o se agregan tokens `warning-*` en `@theme`).
   - Se confirman los textos de §2 y cómo se recorta la tarjeta con muchos avisos.
   - Cierre del paso: `ng build`, `ng test` y `npm run check:architecture` pasan.
8. **Verificación manual** contra la base local con el seed, en escritorio y a 375 px:
   - Como administrador, con «Yo · bodega»: la tarjeta lista los productos de bodega con 0–2 piezas y los de cada vendedor; con Víctor en «Viendo», solo los suyos.
   - En «Productos», la etiqueta cambia al cambiar «Viendo» (bodega vs. Víctor).
   - Vender hasta dejar 2 piezas: «Venta confirmada» del vendedor muestra el aviso y la del administrador la etiqueta; «Stock general» lo lista al recargar.
   - Dejarle piezas al vendedor (o entrada a bodega) hasta 3 o más: el aviso desaparece al recargar.
   - Retirarle todo a un vendedor: no aparece como «Agotado».
   - Como vendedor, «Mi stock» muestra el aviso y las etiquetas sin costos.
   - Al terminar, `npm run db:reset` deja la base como el seed.
9. **Cierre.**
   - Actualizar `specs/README.md` (fila y relaciones).
   - Actualizar `CLAUDE.md` y `AGENTS.md`: `LOW_STOCK_THRESHOLD` y `stockLevel` en `@stock`, `lowStock`/`alerts` en las respuestas, `shared/constants/stock-level.constants.ts` y `low-stock-alert`.
   - Comentar el avance en `SCRUM-52` en cada paso y moverla de estado según el flujo de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-52`:

- [ ] **1.** Un producto con 1 o 2 piezas en un titular se marca «Baja existencia»; con 0, «Agotado».
- [ ] **2.** Con «Yo · bodega», «Stock general» muestra la tarjeta con los productos bajos o agotados y de quién son (bodega o qué vendedor).
- [ ] **3.** Con un vendedor en «Viendo», «Stock general» muestra solo sus productos por terminarse.
- [ ] **4.** En «Productos», la card de un producto bajo o agotado (para el titular en «Viendo») muestra «Baja existencia» o «Agotado».
- [ ] **5.** Cuando un vendedor confirma una venta y un producto le queda con 2 o menos, «Venta confirmada» dice que se avisó al administrador, y el administrador lo ve en «Stock general» al abrirlo o recargarlo.
- [ ] **6.** El vendedor ve en «Mi stock» el aviso de sus productos por terminarse, sin costos.
- [ ] **7.** Al dejarle o entrar producto hasta superar 2 piezas, el aviso desaparece al recargar.

Además:

- [ ] Retirarle todo a un vendedor no genera un aviso de «Agotado».
- [ ] Los productos archivados y los vendedores desactivados no generan avisos.
- [ ] «Venta confirmada» del administrador marca el renglón que quedó bajo o agotado.
- [ ] El número 2 solo existe en el backend (`LOW_STOCK_THRESHOLD`); el frontend pinta el `stockLevel` que recibe.
- [ ] Ninguna respuesta del vendedor (`GET /api/me/stock`, ventas) agrega costos ni datos de otros vendedores.
- [ ] A 375 px no hay scroll horizontal y la tarjeta de avisos no empuja las acciones fuera de la pantalla.
- [ ] `features/products` y `features/stock` no se importan entre sí; `npm run check:architecture` y `backend/tests/architecture.test.ts` pasan.
- [ ] `ng build`, `ng test` y `npm test` de `backend/` pasan.

## 7. Plan de pruebas

- **`backend/tests/stock-levels.test.ts`** (nuevo):
  - `stockLevelOf`: 0 → `'out'`, 1 y 2 → `'low'`, 3 → `'ok'`, 0 con `withdrawn` → `'ok'`.
  - `lowStockLines()`: bodega con 0, 1, 2 y 3 piezas; archivado excluido; vendedor con 1; vendedor en 0 tras venta (sale) y tras retiro (no sale); vendedor desactivado excluido.
  - `lowStockLines(id)`: solo ese vendedor.
- **`stock-overview.test.ts`** (se amplía): `lowStock` con `holder` null y con el vendedor; `stockLevel` por línea.
- **`own-stock.test.ts`** (se amplía): `stockLevel` por producto, `alerts` con lo que se le acabó vendiendo y sin lo retirado; sigue sin costos.
- **`sale-catalog.test.ts`** (se amplía): `stockLevel` en bodega y en vendedor.
- **`sales.test.ts`** (se amplía): renglón que queda en 2 → `'low'`, en 0 → `'out'`.
- **`features/stock/components/low-stock-alert/low-stock-alert.component.spec.ts`:** título en singular y plural, renglones con titular y piezas, «Agotado».
- **`features/stock/pages/stock-page/stock-page.component.spec.ts`** (se amplía): tarjeta con «Yo · bodega», solo los del vendedor en «Viendo», sin tarjeta sin avisos.
- **`features/products/components/product-card/product-card.component.spec.ts`** (se amplía): «Baja existencia» con `'low'`, «Agotado» con `'out'`, respaldo de HU-05 sin `stockLevel`.
- **`features/products/pages/products-page/products-page.component.spec.ts`** (se amplía): la etiqueta sale del catálogo del titular en «Viendo».
- **`features/my-stock/pages/my-stock-page/my-stock-page.component.spec.ts`** (se amplía): aviso con nombres, etiquetas, sin aviso cuando `alerts` está vacío.
- **`features/sell/pages/sale-summary-page/sale-summary-page.component.spec.ts`** (se amplía): aviso «Se avisó al administrador…» solo con renglones bajos o agotados.
- **`features/sell/components/admin-sale-line/admin-sale-line.component.spec.ts`** (se amplía): etiqueta por `stockLevel`.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un vendedor al que se le retiró todo aparece «Agotado» para siempre | Regla del último movimiento: un `return` como último movimiento no genera aviso (§2) |
| La bodega lista como «Agotado» productos recién dados de alta que nunca tuvieron stock | Es lo pedido (todo activo en 0); si molesta, el límite y las reglas viven en un solo lugar del backend |
| Con muchos productos bajos la tarjeta llena la pantalla | Se recorta o hace scroll dentro; se define en el paso de diseño |
| El frontend y el backend discrepan en qué es «bajo» | El número solo vive en el backend; el frontend pinta `stockLevel` |
| La consulta del último movimiento por titular y producto se vuelve lenta | Se usa el índice `stock_movements_product_created_idx`; con el volumen del MVP es una lectura pequeña. Si crece, se agrega un índice en una migración aparte |
| El vendedor cree que el administrador recibió una notificación | El texto dice «Se avisó al administrador», y el administrador lo ve en «Stock general» al abrirlo: es la decisión de solo-app (§9) |

## 9. Decisiones

- **Sí:** un solo límite fijo de 2 piezas para todo (`LOW_STOCK_THRESHOLD`), como el canvas (decisión del usuario).
- **No:** un límite por producto (migración y campo en el formulario) ni configurable desde la app (tabla de ajustes y pantalla nueva).
- **Sí:** se mide por titular: la bodega y cada vendedor por separado (decisión del usuario).
- **No:** sobre el total del negocio (un vendedor sin piezas no avisaría si la bodega tiene).
- **Sí:** el aviso es solo dentro de la app y se calcula en cada lectura (decisión del usuario).
- **No:** correo, push o WhatsApp; guardar avisos o marcarlos como leídos.
- **Sí:** las etiquetas de «Productos» siguen al titular en «Viendo» (decisión del usuario), con el catálogo que ya usa «Agregar».
- **No:** siempre de la bodega.
- **Sí:** a un vendedor en 0 solo se le marca «Agotado» si se le acabó vendiendo (último movimiento distinto de `return`); en la bodega, todo activo en 0 es «Agotado» (decisión del usuario).
- **No:** marcar todo 0 (deja avisos que no piden resurtir) ni avisar a vendedores solo con 1–2.
- **Sí:** en «Stock general», tarjeta ámbar con la lista de productos, titular y piezas (decisión del usuario), como el canvas.
- **No:** tarjeta resumen con etiquetas en las filas.
- **Sí:** el backend decide el nivel y lo manda como `stockLevel` en las respuestas que ya existen (decisión del usuario).
- **No:** endpoints nuevos de avisos con el límite copiado en el frontend.
- **Sí:** «Venta confirmada» avisa al vendedor y marca el renglón al administrador (decisión del usuario).
- **No:** solo al vendedor.

## 10. Diseño (paso 7)

Tableros leídos: `AdminInicio`, `VendedorStock` y `Venta`. Los textos de §2 coinciden con los del canvas. Los colores del canvas no se copian: se traducen a los tokens `warning-*` de `styles.css`.

| Elemento del canvas | En la app |
| --- | --- |
| Tarjeta `#FDEFD9` con borde `#F3C98B`, icono de triángulo y título en negrita | `alert-warning` (`warning-bg`, `warning-border`, `warning-text`) con el triángulo en `stroke-warning` |
| Lista de nombres separados por comas dentro de la tarjeta | Un renglón por aviso (nombre · titular · piezas), decisión del usuario del 2026-11-04 (§9) |
| «Quedan pocas» sobre la foto, fondo `#FDEFD9` | `p-tag` con severidad `warn` (mismo ámbar), sobre el nombre en «Mi stock» y sobre la foto en «Productos» |
| Piezas en ámbar cuando quedan 2 o menos | `text-warning` (4.7:1 sobre blanco) en «Me quedan N»; `text-warning-text` en la tarjeta |
| Aviso arriba de la lista en «Mi stock» y «Venta confirmada» | `alert-warning` con `role="status"`, sin enlace |

Decisiones:

- **Recorte de la tarjeta (§2 «Celular»):** hace scroll dentro (`max-h-60`) y no se corta con «y N más», para que ningún aviso quede escondido. La lista es enfocable con teclado y lleva el título como nombre accesible.
- **El color nunca es lo único que informa:** «Agotado» lleva texto; «Baja existencia» y «Quedan pocas» son etiquetas con texto.
- **La tarjeta no es un enlace:** el canvas la enlaza a «Productos», pero la spec no lo pide; queda para una historia aparte si se quiere.

## Lo que **no** entra en este spec

- Notificaciones fuera de la app.
- Límite por producto, por vendedor o configurable.
- Historial o estado «leído» de los avisos.
- Lista de resurtir (RF-19, RF-20).

Cada uno, si llega, va en su propio spec o en su historia.
