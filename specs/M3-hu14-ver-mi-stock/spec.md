# Spec técnico — HU-14 · Ver mi stock como vendedor

> **Estado:** Implementado
> **Depende de:** M0-hu03-rutas-por-rol (`specs/M0-hu03-rutas-por-rol/spec.md`) — el vendedor entra a `/vendedor/mi-stock`; M2-hu11-dejar-a-vendedor (`specs/M2-hu11-dejar-a-vendedor/spec.md`) — `vendor_stock.unit_price` propio; M2-hu12-retirar-a-vendedor (`specs/M2-hu12-retirar-a-vendedor/spec.md`) — un retiro deja `qty` en 0 y conserva el precio propio; M2-hu09-ver-mis-vendedores (`specs/M2-hu09-ver-mis-vendedores/spec.md`) — `stockOfHolder`; M2-hu13-stock-general (`specs/M2-hu13-stock-general/spec.md`) — módulo `inventory` y patrón de pantalla de stock; M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`) — `vendor_stock.qty` lo mantienen los movimientos
> **Fecha:** 2026-11-03
> **Objetivo:** que el vendedor vea en `/vendedor/mi-stock`, desde el celular, una card por producto que tiene, con su foto, su precio y cuántas piezas le quedan, sin ningún costo ni ganancia.

Fuentes:

- **Jira:** historia `SCRUM-48 · HU-14`, épica `SCRUM-8 · M3 · Ventas`. Requerimientos RF-21, RF-02, RNF-03, RNF-04. Talla S.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantalla 09 Mi stock, v1: «Cards con foto y "Me quedan N", aviso de productos por terminarse, botón Vender, círculo de cuenta»).
- **Código:** `core/layout/routes/seller.routes.ts` (hoy `mi-stock` es «Próximamente»), `backend/src/stock/holdings.ts` (`stockOfHolder`), `backend/app/api/me/route.ts`, `features/stock` (patrón de pantalla de stock con `rxResource`, buscador y esqueletos) y `shared/utils/` (`units-label.ts`, `normalize-text.ts`, `initials.ts`).
- **Decisiones del usuario del 2026-11-03** (§9).

## 1. Alcance

**Entra en este spec:**

- **Backend:**
  - Caso de uso `getOwnStock` en el módulo `src/inventory/`, que arma el stock del vendedor con su precio ya resuelto.
  - `GET /api/me/stock`, solo para el rol `vendedor`.
- **Frontend:**
  - Feature nueva `features/my-stock/`: `/vendedor/mi-stock` deja de ser «Próximamente» y pasa a «Mi stock».
  - Total de piezas arriba, buscador por nombre y una card por producto con foto (o iniciales), nombre, precio y «Me quedan N».
  - Botón «Vender» hacia `/vendedor/vender`, que sigue siendo «Próximamente» hasta HU-15.
  - Estados cargando, vacío y error con «Reintentar».
- **Seed:** `supabase/seed.sql` le pone precio propio a uno de los dos productos de Víctor, para ver los dos casos de precio en local.
- **Pruebas** de backend y frontend (§7).

**No entra en este spec:**

- Las ventas del día del vendedor («Vendí hoy»). Van con las pantallas de venta (HU-15 a HU-17) o con «Mi corte» (M4a).
- El aviso de productos por terminarse (HU-18), que necesita decidir cuántas piezas son «baja existencia».
- La pantalla «Vender» y el carrito (HU-15 y HU-16): aquí «Vender» solo navega.
- Productos con 0 piezas (agotados): no se muestran.
- Costos, costo con envío o ganancia, en cualquier forma.
- Actualización en vivo mientras la pantalla está abierta: se actualiza al entrar.
- Cambios en `GET /api/stock`, `GET /api/sellers/:id` o las pantallas del administrador.

## 2. Reglas de negocio

- **Solo el vendedor.** `GET /api/me/stock` exige `requireRole(request, 'vendedor')`: un administrador o un `client` recibe `403` y sin sesión es `401`. El id sale de la sesión (`ctx.userId`), nunca de la URL ni del cuerpo. La ruta `/vendedor/mi-stock` ya está detrás de `roleGuard`.
- **Mis piezas** = `vendor_stock.qty` (solo se lee; cambia con movimientos, T-07). Solo cuentan productos con `qty > 0`, también los archivados y las bolsitas, porque esas piezas siguen en su mano.
- **Mi precio** = `vendor_stock.unit_price` o, si es `null`, `products.price`. El backend manda el precio ya resuelto en un solo campo `price`, sin indicar de dónde salió (criterios 2 y 3).
- **Sin costos (RF-02, RNF-04):** la respuesta no trae `unitCost`, `unitCostWithShipping`, ganancia ni el precio general cuando hay uno propio. `getOwnStock` arma cada producto con llaves explícitas; no reenvía la fila de `stockOfHolder`.
- **Total** = suma de las piezas de los productos que salen. «Tengo N piezas», con «1 pieza» / «N piezas» (`unitsLabel`). El buscador no lo cambia.
- **Card de producto:** foto (o iniciales si no tiene), nombre, `price` en pesos y «Me quedan N». Con una pieza, «Me queda 1».
- **Orden:** por nombre sin mayúsculas ni acentos, como lo entrega el backend (`stockOfHolder` ya ordena).
- **Buscador:** filtra por nombre sin mayúsculas ni acentos con `shared/utils/normalize-text.ts`. Solo filtra la lista; el total no cambia.
- **«Vender»:** un `<a pButton routerLink="/vendedor/vender">` junto al total (criterio 5). Se muestra también sin productos.
- **Actualización (criterio 6):** la pantalla pide `GET /api/me/stock` cada vez que se entra. Después de un «Dejar» o «Retirar» del administrador, o de una venta propia, al volver a «Mi stock» los números ya son los nuevos.
- **Estados (criterio 7):**
  - **Cargando:** esqueletos de card.
  - **Vacío** (sin productos con piezas): mensaje de que aún no tiene producto. El botón «Vender» sigue ahí.
  - **Error:** mensaje de falla y «Reintentar» (`reload()`).
  - **Buscador sin resultados:** los textos de Productos, «No hay productos con ese nombre».
- **Celular (RNF-03):** se usa sin zoom a 375 px y sin scroll horizontal; las cards pasan a una columna.

## 3. Endpoint

`GET /api/me/stock`, solo para vendedores.

```json
// 200
{
  "total": 6,
  "products": [
    {
      "productId": 10,
      "name": "Proteína Demo Whey 2 lb",
      "image": "https://…",
      "units": 4,
      "price": "480.00"
    },
    {
      "productId": 12,
      "name": "Creatina Demo 300 g",
      "image": null,
      "units": 2,
      "price": "350.00"
    }
  ]
}
```

- `products`: solo con `units > 0`, ordenados por `name`. `image` vacía responde `null`, como en HU-09.
- `price`: texto con 2 decimales (convención de T-08), el propio del vendedor o el general.
- Las únicas llaves de un producto son `productId`, `name`, `image`, `units` y `price`. Una prueba lo fija.
- Invariante: `total` = suma de `units`.

| Caso | Status | `error.message` |
| --- | --- | --- |
| Sin sesión / cuenta desactivada | 401 / 403 | Los de `requireRole` |
| Administrador o `client` | 403 | El de `requireRole` |

## 4. Modelo de datos

No hay migración: `vendor_stock` y `products` ya existen.

**Backend:**

```ts
// backend/src/inventory/own-stock.ts (se agrega, exportado en inventory/index.ts)
export interface OwnStockProduct { productId: number; name: string; image: string | null; units: number; price: string }
export interface OwnStock { total: number; products: OwnStockProduct[] }
export function getOwnStock(profileId: string): Promise<OwnStock>
```

- `getOwnStock` llama a `stockOfHolder(profileId)` de `@stock` y mapea cada línea a `OwnStockProduct` con `price = unitPrice ?? price`. No hace falta tocar `stock/holdings.ts` ni importar `@accounts`.
- Va en `inventory` porque ya es el módulo de lecturas de stock para pantallas (HU-13), y solo depende de `@stock`.
- Ruta delgada nueva: `backend/app/api/me/stock/route.ts`, `GET`, con `requireRole(request, 'vendedor')` y `getOwnStock(ctx.userId)`.

**Frontend (`src/app/features/my-stock/`):**

```ts
// interfaces/my-stock.models.ts
export interface MyStockProduct { productId: number; name: string; image: string | null; units: number; price: string }
export interface MyStock { total: number; products: MyStockProduct[] }

// services/my-stock.service.ts
load(): Observable<MyStock>   // GET ${API_BASE_URL}/api/me/stock

// rules/my-stock.rules.ts (puras)
filterMyStockByName<T extends { name: string }>(items: T[], query: string): T[]
unitsLeftLabel(units: number): string   // «Me queda 1» / «Me quedan N»
```

- **Constantes** (`constants/my-stock-page.constants.ts`): los textos de la pantalla y de los estados, y el enlace de «Vender».
- **Componentes presentacionales** (`features/my-stock/components/`, solo `input()`/`output()`):
  - `my-stock-card`: `Card` de PrimeNG con foto o iniciales (`shared/utils/initials.ts`), nombre, precio con el pipe `currency` (único uso de `Number()` sobre un monto, al mostrarlo) y «Me quedan N».
  - `my-stock-card-skeleton`: esqueleto de una card con `Skeleton`.
- **Página** `pages/my-stock-page`: `rxResource` sobre `load()`, `computed()` para la lista filtrada, el buscador como `signal`, «Reintentar» con `reload()` y el botón «Vender».
- **Rutas:** `features/my-stock/my-stock.routes.ts` exporta `MY_STOCK_ROUTES`: `''` → `my-stock-page`, lazy, con `data: { title: 'Mi stock' }`. En `core/layout/routes/seller.routes.ts`, `mi-stock` pasa a `loadChildren` de `@features/my-stock/my-stock.routes`. El menú (`MENU`) no cambia.
- **Sin importar otras features:** `features/my-stock` no importa `features/stock` ni `features/products`. El filtro se reescribe en `my-stock.rules.ts` con `shared/utils/normalize-text.ts`; `unitsLabel` viene de `shared/utils/units-label.ts`.

## 5. Plan de implementación

1. **Backend · caso de uso y ruta.** Crear `backend/src/inventory/own-stock.ts` con `getOwnStock`, exportarlo en `inventory/index.ts` y crear `app/api/me/stock/route.ts`. `npm run type-check` pasa y `architecture.test.ts` sigue verde.
2. **Backend · pruebas.** Crear `backend/tests/own-stock.test.ts` (§7). `npm test` pasa con `SUPABASE_SERVICE_ROLE_KEY` puesta.
3. **Seed.** Agregar a `supabase/seed.sql`, después de las entregas de Víctor, un `update public.vendor_stock set unit_price = …` para uno de sus dos productos; el otro queda en `null`. `npm run db:reset` pasa y `npm test` sigue verde (ver riesgos).
4. **Frontend · datos y reglas.** Crear la carpeta completa `features/my-stock/` (`pages/`, `components/`, `services/`, `interfaces/`, `rules/`, `constants/`). Modelos, `MyStockService.load()` y las reglas de `my-stock.rules.ts`, con sus specs. `ng test` pasa.
5. **Frontend · diseño.** El flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design, sobre la pantalla 09 y `EstadosStock` del canvas, traducido a los tokens de `styles.css`.
   - Se confirman ahí los textos exactos de cargando, vacío y error contra el canvas (criterio 7); los de §2 son los de partida.
   - Se reusan `surface-*`, `page-title`, `alert-*`, `Card`, `Skeleton`, `Tag` y `pButton`.
   - No se copian el menú inferior del mockup, sus colores ni sus fuentes: el vendedor ya tiene `top-nav`.
6. **Frontend · componentes.** `ng generate component` para `my-stock-card` y `my-stock-card-skeleton`, con sus specs.
7. **Frontend · página y rutas.** `ng generate component` para `my-stock-page`. Crear `my-stock.routes.ts`, montar `mi-stock` en `seller.routes.ts` y armar la pantalla con sus estados. Cierre del paso: `ng build`, `ng test` y `npm run check:architecture` pasan.
8. **Verificación manual** contra la base local con el seed, entrando como `vendedor1@mammut.local`, en escritorio y a 375 px:
   - Se ven los dos productos de Víctor con «Me quedan N», uno con precio propio y otro con el general.
   - En la pestaña de red de la respuesta no aparece ningún costo ni ganancia.
   - «Vender» abre «Próximamente».
   - Un «Dejar» o «Retirar» hecho desde el administrador se ve al volver a «Mi stock». Retirar todo un producto lo quita de la lista.
   - Con el backend apagado se ve el error, y «Reintentar» con el backend encendido carga el stock.
9. **Cierre.**
   - Actualizar `specs/README.md`.
   - Actualizar `CLAUDE.md`/`AGENTS.md` con `GET /api/me/stock`, `getOwnStock` en `inventory` y la feature `my-stock`.
   - Comentar el avance en `SCRUM-48` en cada paso y moverla de estado según el flujo de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-48`:

- [x] **1.** Un vendedor que entra a «Mi stock» ve una card por cada producto con piezas, con foto (o iniciales), nombre, su precio y «Me quedan N».
- [x] **2.** Con 6 piezas dejadas y un precio propio, la card dice «Me quedan 6» y muestra el precio propio, no el general (prueba de backend y de la card).
- [x] **3.** Sin precio propio (`vendor_stock.unit_price` en `null`), la card muestra el precio general.
- [x] **4.** Ni la pantalla ni la respuesta de `GET /api/me/stock` contienen costo, costo con envío ni ganancia: cada producto trae solo `productId`, `name`, `image`, `units` y `price`.
- [x] **5.** «Vender» lleva a `/vendedor/vender`.
- [x] **6.** Tras un «Dejar», un «Retirar» o una venta, al regresar a «Mi stock» los números son los nuevos.
- [x] **7.** Cargando, vacío y error se ven con los textos confirmados contra el canvas, y «Reintentar» vuelve a pedir el stock.

Además:

- [x] `GET /api/me/stock` responde `403` a un administrador y a un `client`, y `401` sin sesión.
- [x] Un producto con `qty` 0 no sale en la lista ni suma al total. Uno archivado con piezas sí.
- [x] El vendedor solo ve su stock: el id sale de la sesión y no hay parámetro que lo cambie.
- [x] El `total` es la suma de las piezas de la lista y el buscador no lo cambia.
- [x] El buscador filtra sin mayúsculas ni acentos.
- [x] A 375 px no hay scroll horizontal ni zoom.
- [x] `features/my-stock` no importa otras features, e `inventory` sigue usando solo `@stock` y `@accounts`.
- [x] Backend: `npm run type-check` y `npm test` pasan, con `SUPABASE_SERVICE_ROLE_KEY` puesta. Frontend: `ng build`, `ng test` y `npm run check:architecture` pasan.

## 7. Plan de pruebas

- **`backend/tests/own-stock.test.ts`** (contra la base local; cuentas `test-auth-`, productos y movimientos de prueba borrados al terminar, los movimientos del más nuevo al más viejo):
  - **Criterio 2:** un producto con `initial` 10 y un `delivery` de 6 al vendedor de prueba, con `unit_price` propio, sale con `units: 6` y ese precio.
  - **Criterio 3:** otro producto con `unit_price` en `null` sale con el `price` general.
  - **Criterio 4:** las llaves de cada producto son exactamente `productId`, `name`, `image`, `units` y `price`, y la respuesta serializada no contiene `unitCost` ni `unitCostWithShipping`, aunque el vendedor tenga costo con envío.
  - **Agotados:** tras retirar todo con un `return`, el producto sale de la lista y no suma, y la fila conserva su precio propio.
  - **Archivados y bolsitas:** un producto archivado con piezas sale.
  - **Aislamiento:** con dos vendedores de prueba, cada uno ve solo lo suyo.
  - **Total:** `total` es la suma de `units`; un vendedor sin piezas responde `{ total: 0, products: [] }`.
  - **Permisos:** `403` para administrador y `client`, `401` sin token.
- **`features/my-stock/rules/my-stock.rules.spec.ts`:** `filterMyStockByName` («proteina» encuentra «Proteína») y `unitsLeftLabel` con 1, 2 y 6.
- **`features/my-stock/services/my-stock.service.spec.ts`:** `load()` llama a `/api/me/stock`.
- **Componentes:**
  - `my-stock-card`: foto o iniciales, precio en pesos y «Me quedan N» / «Me queda 1».
  - `my-stock-card-skeleton`: se renderiza.
- **`features/my-stock/pages/my-stock-page/…spec.ts`:**
  - Los tres estados (cargando, vacío, error), y «Reintentar» llama de nuevo.
  - Lista con total y una card por producto, y el enlace «Vender» a `/vendedor/vender`.
  - El buscador filtra la lista y deja igual el total, y muestra «No hay productos con ese nombre» sin resultados.
- **`core/layout/routes` / `app.routes.spec.ts`:** `mi-stock` carga `MY_STOCK_ROUTES`.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un costo se filtra al vendedor al reenviar la fila de `stockOfHolder` | `getOwnStock` arma el objeto con llaves explícitas, y la prueba fija las llaves exactas y busca los nombres de costo en el JSON serializado |
| Cambiar el seed rompe pruebas que suponen el precio de Víctor en `null` | El paso 3 corre `db:reset` y `npm test` completos antes de seguir. Si algo depende de ese valor, la prueba crea sus propios datos o el cambio se revierte |
| Los textos de los estados no coinciden con el canvas | El paso 5 los confirma contra `EstadosStock` antes de escribir la página; los de §2 son solo de partida |
| El vendedor ve números viejos si deja la pantalla abierta mientras el administrador le mueve piezas | Está fuera de alcance: se pide al entrar (criterio 6). Una actualización en vivo sería otra historia |
| El enlace «Vender» lleva a «Próximamente» hasta HU-15 | Es lo que pide el criterio 5; HU-15 reemplaza la página sin cambiar la URL |
| Un precio propio menor que el costo se ve igual que cualquier otro | El vendedor no ve el costo (RNF-04). El aviso de HU-11 es del administrador |

## 9. Decisiones

- **Sí:** ocultar los productos con 0 piezas (decisión del usuario). «Me quedan 0» no sirve para vender y es lo que hacen HU-09 y HU-13.
- **No:** mostrarlos como «Agotado». Obligaría a leer las filas con `qty` 0 y no lo pide ningún criterio.
- **Sí:** «Mi stock» no muestra las ventas del día (decisión del usuario). Aún no hay pantallas de venta; «Vendí hoy» llega con HU-15 a HU-17 o con «Mi corte» (M4a), y HU-13 ya dejó fuera algo igual.
- **Sí:** endpoint nuevo `GET /api/me/stock` (decisión del usuario), solo para `vendedor` y con el id de la sesión. No se mezcla con los endpoints de administrador de `/api/sellers`.
- **No:** `GET /api/sellers/me`. Obligaría a recortar más campos de un endpoint pensado para el administrador.
- **Sí:** la pantalla lleva el total de piezas arriba y un buscador por nombre (decisión del usuario).
- **Sí:** el backend manda un solo campo `price` ya resuelto (propio o general). El vendedor no necesita saber de dónde sale, y así no viaja el precio general cuando hay uno propio.
- **Sí:** `getOwnStock` vive en `src/inventory/`, junto a `getStockOverview` (HU-13), usando solo `@stock`. No agranda `stock` con reglas de pantalla ni crea un módulo para una función.
- **Sí:** feature nueva `features/my-stock/` (recomendación; el usuario no eligió). Un vendedor no descarga código de `features/stock`, y una feature no importa otra. El filtro se reescribe en la feature, como hizo HU-13.
- **Sí:** un solo botón «Vender» arriba, junto al total (recomendación; el usuario no eligió). Es lo que describe la pantalla 09, y lo que haga cada card al vender lo decide HU-15.
- **Sí:** los productos archivados y las bolsitas con piezas salen (recomendación; el usuario no eligió). Las piezas existen y T-18 permite venderlas.
- **Sí:** el seed le pone precio propio a uno de los dos productos de Víctor (recomendación; el usuario no eligió). Deja ver los criterios 2 y 3 en local; las pruebas de backend los cubren igual.
- **No:** actualizar la pantalla en vivo o con `StockChangesService`. Ese servicio avisa a las pantallas del administrador; para el vendedor basta pedir los datos al entrar.
- **No:** el aviso de productos por terminarse. Es HU-18 y falta decidir cuántas piezas son «baja».

## Lo que **no** entra en este spec

- «Vendí hoy» y cualquier dato de ventas.
- El aviso de productos por terminarse (HU-18).
- La pantalla «Vender», el carrito y «Venta confirmada» (HU-15 a HU-17).
- «Mi corte» (M4a).
- Productos agotados en la lista.
- Costos, costo con envío o ganancia para el vendedor.

Cada uno, si llega, va en su propio spec o en su historia.
