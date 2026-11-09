# Spec técnico — HU-26 · Ver la merma reflejada en el stock y el historial

> **Estado:** Aprobado
> **Depende de:** M6-hu25-registrar-merma (`specs/M6-hu25-registrar-merma/spec.md`) — pop-up «Registrar merma», feature `shrinkage`; M6-t25-base-merma-simple (`specs/M6-t25-base-merma-simple/spec.md`) — filas `shrinkage` con `reason` y `request_id`, `SHRINKAGE_REASONS`; M2-hu13-stock-general (`specs/M2-hu13-stock-general/spec.md`) — «Stock general» y sus enlaces de texto; M2-hu12-retirar-a-vendedor (`specs/M2-hu12-retirar-a-vendedor/spec.md`) — «Últimos retiros» del detalle del vendedor; M3-hu18-aviso-baja-existencia (`specs/M3-hu18-aviso-baja-existencia/spec.md`) — `stockLevel`; M3-hu14-ver-mi-stock (`specs/M3-hu14-ver-mi-stock/spec.md`) — «Mi stock»; M5-hu24-bolsitas-en-inventario (`specs/M5-hu24-bolsitas-en-inventario/spec.md`) — patrón del historial `/admin/fraccionados`
> **Fecha:** 2026-11-09
> **Objetivo:** que el administrador vea cada merma (producto, piezas, motivo y fecha) en la sección «Últimas mermas» del detalle del vendedor y en el historial nuevo `/admin/mermas`, y que una prueba de backend fije que la merma ya baja el stock, el total, el `stockLevel` y «Mi stock».
>
> **Nota (2026-11-09):** implementado. `/admin/mermas` carga con `toSignal` + `switchMap` (no `rxResource`): con `rxResource` las pruebas con commit se colgaban al cambiar «Viendo», porque el recurso cuenta como tarea pendiente; «Reintentar» y `StockChangesService` repiten la petición. «Últimas mermas» y `/admin/mermas` usan `p-dataview`; en `seller-detail-page.component.spec.ts` el usuario aprobó cambiar el conteo de `p-dataview` de 3 a 4 y que `load()` responda con sus mermas. Al entrar con un vendedor guardado en «Viendo», la página pide primero todas y luego las suyas (misma selección efectiva de HU-10 que «Stock general»).

Fuentes:

- **Jira:** historia `SCRUM-67 · HU-26`, épica `SCRUM-12 · M6 · Merma simple`. Requerimientos RF-15, RF-09, RF-17. Pantallas 02 Stock general, 04 Mis vendedores, 09 Mi stock. Depende de HU-25, HU-13 y HU-18.
- **Código:** `backend/src/shrinkage/` (`SHRINKAGE_REASONS`, `listShrinkageOptions`), `backend/app/api/shrinkages/route.ts` (solo `POST` hoy), `backend/src/returns/returns.ts` (`listSellerReturns`), `backend/src/stock/holdings.ts` (`listReturns`, `stockOfHolder`, `lastMovementType`), `backend/app/api/sellers/[id]/returns/route.ts`; `src/app/features/sellers/pages/seller-detail-page/` («Últimas entregas», «Últimos retiros»), `src/app/features/sellers/components/return-history-line/`, `src/app/features/fraction/pages/fraction-history-page/` y `rules/fraction-history.rules.ts` (historial con buscador), `src/app/features/stock/pages/stock-page/stock-page.component.html` (enlace «Ver fraccionados»), `src/app/features/stock/constants/stock-page.constants.ts`, `src/app/core/layout/routes/admin.routes.ts`, `src/app/core/viewing/viewing.service.ts`, `src/app/core/stock-changes/stock-changes.service.ts`, `src/app/shared/utils/normalize-text.ts`.
- **Decisiones del usuario del 2026-11-09** (§10). Cierran los dos «Por decidir» de `SCRUM-67`: no existe historial de la bodega y se crea `/admin/mermas`; el vendedor solo ve sus piezas descontadas.

## 1. Por qué existe este spec

La merma ya baja las piezas: es un movimiento `shrinkage` y los triggers mantienen `products.stock` y `vendor_stock.qty`. Por eso «Stock general», el `stockLevel` de HU-18 y «Mi stock» la reflejan sin cambios de código (criterios 1, 2, 4 y 5 de Jira). Lo que falta es **verla**: ninguna pantalla lista las mermas, y la bodega no tiene historial.

## 2. Alcance

**Entra en este spec:**

- **Backend, en `backend/src/shrinkage/`:**
  - Caso de uso de solo lectura `listShrinkages(filter, actor)` (solo administrador) en `history.ts`, con el tipo `ShrinkageHistoryItem` en `types.ts` y los límites en `constants.ts`.
  - `GET /api/shrinkages` (en el `route.ts` que ya tiene el `POST`): todas las mermas o las de un vendedor (`?sellerId=`), las últimas 50.
  - `GET /api/sellers/[id]/shrinkages` (ruta nueva): las últimas 20 de ese vendedor, para su detalle.
  - Pruebas: `backend/tests/shrinkage-history.test.ts` (lista) y `backend/tests/shrinkage-stock.test.ts` (la merma en el stock, `stockLevel` y «Mi stock»).
- **Frontend:**
  - Componente presentacional compartido `src/app/shared/components/shrinkage-history-line/` (una fila de merma), que usan las dos pantallas.
  - Sección «Últimas mermas» en `seller-detail-page`, después de «Últimos retiros», con su `rxResource` y `SellerShrinkagesService` en `features/sellers/services/`.
  - Página nueva `features/shrinkage/pages/shrinkage-history-page/` en `/admin/mermas` (rutas en `features/shrinkage/shrinkage-history.routes.ts`), con buscador por producto y filtro por «Viendo».
  - Enlace de texto «Ver mermas» en «Stock general», siempre visible.
  - `ShrinkageService.list()` en la feature `shrinkage`.
- **Pruebas nuevas** (§9) y las de `seller-detail-page` que cambian (requiere desbloqueo, §9). Verificación manual a 375 px.
- Actualizar `specs/README.md` y sincronizar `SCRUM-67`.

**No entra en este spec:**

- Que el vendedor vea sus mermas (lista «Mis mermas» o similar): «Mi stock» solo muestra las piezas ya descontadas, sin cambios.
- Una página de resumen de una merma (`/admin/mermas/:requestId`): las filas no se abren. `GET /api/shrinkages/[requestId]` sigue sin uso en el frontend.
- Juntar entregas, retiros y mermas en una sola línea de tiempo.
- Un enlace «Ver mermas» dentro del pop-up «Registrar merma» de HU-25.
- Cambiar la regla de «Agotado» de HU-18 (`lastMovementType`): una merma que deja al vendedor en 0 se marca «Agotado», como una venta.
- «Merma de la semana» en «Stock general» y la merma en el resumen del vendedor (RF-16, v2). Anular una merma.
- Migraciones, cambios en `POST /api/shrinkages`, en `supabase/seed.sql` o en el pop-up de HU-25.

## 3. Reglas de negocio

- **Quién:** solo el administrador. `/admin/mermas` cuelga de `/admin` (`roleGuard`); los dos endpoints exigen rol administrador en la ruta (`requireRole`) y en el caso de uso (`403`), como `listShrinkageOptions`.
- **Qué es una merma en el historial:** cada fila `stock_movements` con `type = 'shrinkage'`, de la más nueva a la más vieja (`order by id desc`).
  - `qty` va en positivo.
  - `reason` es el código; `reasonLabel` es la etiqueta de `SHRINKAGE_REASONS`. Una fila sin `reason` (anterior a T-25 o de pruebas) trae `reason: null` y `reasonLabel: null`, y la pantalla pinta «Sin motivo».
  - `holder` es `null` para la bodega o `{ id, fullName }` del perfil, también si el vendedor está desactivado (la merma ya hecha no desaparece).
  - Incluye productos desactivados.
- **Filtros:**
  - `GET /api/shrinkages` sin `sellerId` → todas (bodega y vendedores, activos o no), las últimas `SHRINKAGE_HISTORY_LIMIT` = 50.
  - `GET /api/shrinkages?sellerId=<uuid>` → solo las de ese vendedor, últimas 50. `sellerId` que no es de un vendedor activo → `404`; que no es UUID → `422`.
  - `GET /api/sellers/[id]/shrinkages` → solo las de ese vendedor, últimas `SELLER_SHRINKAGE_HISTORY_LIMIT` = 20 (igual que entregas y retiros). Vendedor no activo → `404`, como `listSellerReturns`.
- **Detalle del vendedor, sección «Últimas mermas»** (después de «Últimos retiros»):
  - Cargando «Cargando mermas…»; error «No pudimos cargar las mermas» con «Reintentar» (`reload()` solo de esta sección); vacío «Todavía no tiene mermas.».
  - Fila: foto (o iniciales), producto, «<motivo> · dd/MM/yyyy HH:mm» y «−N». Sin titular (ya se sabe de quién es). No es un enlace.
  - Se recarga con `StockChangesService` junto con las demás secciones.
- **`/admin/mermas`:**
  - Con «Yo · bodega»: título «Mermas», lista todas; cada fila muestra el titular («Bodega» o el nombre).
  - Con un vendedor en «Viendo»: título «Mermas de <nombre>», pide `?sellerId=`; las filas no repiten el titular. Cambiar «Viendo» con la página abierta vuelve a pedir la lista (el `rxResource` tiene el id como parámetro).
  - Buscador por nombre de producto en el frontend, sin mayúsculas ni acentos (`normalize-text`), sobre las 50 que llegaron; regla pura `filterShrinkageHistory` en `features/shrinkage/rules/`.
  - Estados: cargando (esqueleto); error «No pudimos cargar las mermas» con «Reintentar»; vacío «Aún no hay mermas» / «<nombre> no tiene mermas»; sin coincidencias «No hay mermas de ese producto» con «Limpiar búsqueda».
  - Se recarga con `StockChangesService`.
- **«Stock general»:** enlace de texto «Ver mermas» hacia `/admin/mermas`, con «Yo · bodega» y con un vendedor en «Viendo» (la página filtra sola por «Viendo»). Va junto a «Ver fraccionados» (que sigue solo con «Yo · bodega»). Los movimientos rápidos no cambian.
- **El stock (sin cambio de código, lo fija una prueba):**
  - Merma de un vendedor: baja su `vendor_stock.qty` y el total de `GET /api/stock`; la bodega no cambia.
  - Merma de la bodega: baja la bodega y el total.
  - El `stockLevel` sigue la regla de HU-18 (`LOW_STOCK_THRESHOLD`): una merma que deja 2 piezas da `'low'`; una que deja al vendedor en 0 da `'out'` (su último movimiento no es `return`). El frontend no repite el número.
  - `GET /api/me/stock` del vendedor trae las piezas descontadas, sin costos; con 0 piezas el producto sale de la lista (y con `includeSoldOut` sale con `'out'`).

## 4. Endpoints

`GET /api/shrinkages` (nuevo `GET` en `backend/app/api/shrinkages/route.ts`, solo administrador):

- `?sellerId=<uuid>` opcional (ver §3).
- `200 ShrinkageHistoryItem[]`.
- `401` sin sesión; `403` con un vendedor; `404` si `sellerId` no es de un vendedor activo; `422` si no es UUID.

`GET /api/sellers/[id]/shrinkages` (nuevo, `backend/app/api/sellers/[id]/shrinkages/route.ts`, solo administrador):

- `200 ShrinkageHistoryItem[]`; `401`, `403`, `404` (vendedor no activo), `422` (id no UUID, `parseUuid`).

Las dos rutas solo validan y llaman a `listShrinkages`. Solo leen.

## 5. Modelo de datos

No hay migración ni tablas nuevas.

Backend (`backend/src/shrinkage/types.ts`, exportado desde `index.ts`):

```ts
export interface ShrinkageHistoryItem {
  requestId: string | null          // null en una fila creada fuera de POST /api/shrinkages
  createdAt: string
  qty: number                       // en positivo
  reason: ShrinkageReason | null    // null en filas sin motivo
  reasonLabel: string | null
  holder: { id: string; fullName: string } | null   // null = bodega
  product: { id: number; name: string; image: string | null }
}

export type ShrinkageHistoryFilter =
  | { scope: 'all'; limit: number }
  | { scope: 'seller'; sellerId: string; limit: number }
```

`listShrinkages(filter, actor)` en `backend/src/shrinkage/history.ts`: `403` si el actor no es administrador; con `scope: 'seller'` valida con `getActiveSellerName` (`404`); lee `stock_movements` (`type = 'shrinkage'`) con `products` y `left join profiles` (nombre del titular) usando `db` de `@db`, sin escribir. Constantes en `constants.ts`: `SHRINKAGE_HISTORY_LIMIT = 50`, `SELLER_SHRINKAGE_HISTORY_LIMIT = 20`.

Frontend:

```ts
// shared/components/shrinkage-history-line/shrinkage-history-line.models.ts
export interface ShrinkageHistoryLineItem {
  createdAt: string
  qty: number
  reasonLabel: string | null
  holder: { id: string; fullName: string } | null
  product: { id: number; name: string; image: string | null }
}
// Entradas del componente: item (ShrinkageHistoryLineItem) y showHolder (boolean, false por omisión).

// features/shrinkage/interfaces/shrinkage.models.ts (se agrega) y
// features/sellers/interfaces/seller.models.ts (se agrega): mismo contrato que el backend.
export interface ShrinkageHistoryItem { /* §5 backend */ }
```

Constantes nuevas:

- `shared/components/shrinkage-history-line/shrinkage-history-line.constants.ts`: `NO_REASON_LABEL = 'Sin motivo'`, `WAREHOUSE_HOLDER_LABEL = 'Bodega'`.
- `features/shrinkage/constants/shrinkage-history-page.constants.ts`: textos de la página.
- `features/stock/constants/stock-page.constants.ts`: `SHRINKAGE_HISTORY_URL = '/admin/mermas'` y `shrinkageHistoryLink: 'Ver mermas'` en `STOCK_PAGE_TEXTS`.
- Textos de la sección en `features/sellers/constants/sellers.constants.ts` (o donde viven los de «Últimos retiros»).

## 6. Interfaz

- **Fila** (`shrinkage-history-line`): igual de alta que `return-history-line` (foto 48 px o iniciales, `surface-card`, `p-3`), con nombre en negrita, una segunda línea «<motivo> · <fecha>» en `text-muted` y, con `showHolder`, una tercera con el titular. «−N» en `font-mono` a la derecha. No es enlace.
- **`/admin/mermas`:** «‹ Stock general» arriba (`pButton [text]`), título `page-title`, buscador `pInputText`, lista con `DataView`, esqueletos con `Skeleton`. Como `/admin/fraccionados`.
- Tokens y utilidades de `styles.css` (`surface-*`, `alert-*`, `field-*`), controles de PrimeNG. Sin hex ni CSS por componente.
- Antes de maquetar `/admin/mermas`: **ui-ux-pro-max** y después **frontend-design** (pantalla nueva, `CLAUDE.md`). La sección del detalle y el enlace siguen el diseño existente.
- A 375 px se usa sin zoom ni desplazamiento horizontal (RNF-03).

## 7. Plan de implementación

1. **Prueba del stock (backend).** `backend/tests/shrinkage-stock.test.ts`: merma del vendedor y de la bodega con `createShrinkage` y lectura de `GET /api/stock` (caso de uso de `@inventory`), `stockOfHolder`/`getOwnStock` (`stockLevel` `'low'` y `'out'`, producto que sale de «Mi stock» en 0 y sigue con `includeSoldOut`). Sin cambios de código: si alguna falla, se detiene y se reporta. `npm test` pasa.
2. **Lista (backend).** `ShrinkageHistoryItem`, `ShrinkageHistoryFilter`, constantes, `history.ts` con `listShrinkages`, exportes en `index.ts`; `GET` en `app/api/shrinkages/route.ts` y la ruta `app/api/sellers/[id]/shrinkages/route.ts`. Pruebas en `backend/tests/shrinkage-history.test.ts`. `npm run type-check` y `npm test` pasan.
3. **Fila compartida.** `ng generate component shared/components/shrinkage-history-line` con sus modelos, constantes y prueba.
4. **Detalle del vendedor.** `SellerShrinkagesService` (`list(sellerId)`) con prueba. **Antes de tocar `seller-detail-page`, el usuario corre `./desbloquear seller-detail-page`**; se actualiza primero su prueba (§9) y luego la sección «Últimas mermas» con su `rxResource` y la recarga por `StockChangesService`.
5. **Diseño de `/admin/mermas`.** ui-ux-pro-max y frontend-design con los tokens de la app.
6. **Página `/admin/mermas`.** `ShrinkageService.list(sellerId?)`, `filterShrinkageHistory`, `shrinkage-history.routes.ts`, la ruta `mermas` en `admin.routes.ts` (`loadChildren`, `data.title` «Mermas») y la página con `ng generate component`, con estados, buscador, filtro por «Viendo» y recarga.
7. **Enlace en «Stock general».** Constantes y el enlace «Ver mermas» en `stock-page.component.html`, visible con y sin vendedor en «Viendo». No debe cambiar ninguna aserción con commit de `stock-page`; si alguna falla, se detiene y se pide el desbloqueo.
8. **Verificación.** `ng build`, `npm run check:architecture`, `ng test` de lo afectado, `npm test` del backend con `SUPABASE_SERVICE_ROLE_KEY`, y a mano a 375 px con el backend local: merma de Luis y de la bodega, verlas en su detalle, en `/admin/mermas` con y sin Luis en «Viendo», y en «Mi stock» de Luis.
9. **Índice y Jira.** Actualizar `specs/README.md` (fila, relaciones, área M6) y comentar el avance en `SCRUM-67` (paso del plan y ✅/❌/⏳ por criterio), moviéndola En curso → In review.

## 8. Criterios de aceptación

- [ ] Una merma de 2 piezas de Luis deja su stock y el total de `GET /api/stock` con 2 menos y la bodega igual; «Stock general» con Luis en «Viendo» lo muestra (criterio 1 de `SCRUM-67`).
- [ ] Una merma de la bodega baja la bodega y el total en `GET /api/stock` (criterio 2).
- [ ] El detalle de Luis en «Mis vendedores» muestra «Últimas mermas» con producto, «−N», motivo y fecha, después de «Últimas entregas» y «Últimos retiros»; con error, su «Reintentar» solo recarga esa sección; sin mermas se ve «Todavía no tiene mermas.» (criterio 3).
- [ ] Una merma que deja 2 piezas da `stockLevel: 'low'` y una que deja al vendedor en 0 da `'out'`; la pantalla pinta el `stockLevel` del backend sin repetir el umbral (criterio 4).
- [ ] «Mi stock» de Luis trae las piezas descontadas, sin costos; con 0 piezas el producto ya no aparece (criterio 5).
- [ ] «Stock general» muestra «Ver mermas» con «Yo · bodega» y con un vendedor en «Viendo»; lleva a `/admin/mermas`. «Ver fraccionados» y los movimientos rápidos no cambian.
- [ ] `/admin/mermas` con «Yo · bodega» lista las mermas de la bodega y de los vendedores (también desactivados) con su titular; con Luis en «Viendo» lista solo las suyas con el título «Mermas de Luis», y cambiar «Viendo» recarga la lista.
- [ ] El buscador filtra por producto sin mayúsculas ni acentos; sin coincidencias se ve «No hay mermas de ese producto» con «Limpiar búsqueda»; cargando, error con «Reintentar» y vacío muestran su estado; a 375 px se usa sin zoom.
- [ ] Una fila sin motivo se pinta «Sin motivo»; las filas no son enlaces.
- [ ] `GET /api/shrinkages` y `GET /api/sellers/[id]/shrinkages` devuelven las mermas de la más nueva a la más vieja, con `reasonLabel`, `holder` y producto (también desactivado), con tope 50 y 20; `403` con un vendedor, `404` con un vendedor desactivado o inexistente, `422` con un id que no es UUID.
- [ ] `ng build`, `npm run check:architecture`, `ng test` y `npm test` del backend pasan; solo cambian las pruebas de `seller-detail-page` listadas en §9.

## 9. Plan de pruebas

- **Backend (nuevas, contra la base real, saltadas sin `SUPABASE_SERVICE_ROLE_KEY`):**
  - `backend/tests/shrinkage-stock.test.ts`: criterios 1, 2, 4 y 5 (§8) con datos `test-shrs-` y `test-auth-`.
  - `backend/tests/shrinkage-history.test.ts`: orden, `qty` en positivo, `reasonLabel`, fila sin motivo (`insertMovements` directo) con `null`, titular bodega y vendedor desactivado en `scope: 'all'`, producto desactivado, filtro por vendedor, límites (con una constante de prueba local, sin crear 50 filas si se puede evitar pasando el límite), `403`, `404`. Datos `test-shrh-`, limpieza como en `shrinkage.test.ts` (movimientos del más nuevo al más viejo).
- **Frontend (nuevas):**
  - `shrinkage-history-line.component.spec.ts`: producto, «−N», motivo, fecha, «Sin motivo», titular solo con `showHolder` («Bodega» o nombre), no es enlace.
  - `seller-shrinkages.service.spec.ts`: URL `GET /api/sellers/:id/shrinkages`.
  - `shrinkage.service.history.spec.ts`: `list()` con y sin `sellerId`.
  - `shrinkage-history.rules.spec.ts`: `filterShrinkageHistory` (vacío, acentos, mayúsculas).
  - `shrinkage-history-page.component.spec.ts`: estados, buscador, título y petición con y sin vendedor en «Viendo», recarga al cambiar «Viendo» y con `notify()`.
  - `stock-page.component.shrinkage-link.spec.ts`: «Ver mermas» con y sin vendedor en «Viendo», hacia `/admin/mermas`.
- **Con commit, requieren `./desbloquear seller-detail-page`** (cambio de comportamiento pedido por esta historia):
  - `seller-detail-page.component.spec.ts`: cada `it` que carga el detalle con `expectOne(HISTORY_URL)` y `expectOne(RETURNS_URL)` (líneas ~104, ~116, ~174, ~209, ~307 y las que repitan el patrón) suma `expectOne(SHRINKAGES_URL).flush([])`, porque `httpMock.verify()` rechaza la petición nueva. No cambia ninguna otra aserción.
  - Se agregan `it` nuevos para «Últimas mermas» (lista, vacío, error con «Reintentar» propio).
- `stock-page` no debe necesitar desbloqueo: sus pruebas filtran enlaces por texto y cuentan solo `a.quick-action`.

## 10. Decisiones

- **Sí:** sección propia «Últimas mermas» en el detalle del vendedor, con su endpoint `GET /api/sellers/[id]/shrinkages` (decisión del usuario), igual que entregas y retiros.
- **No:** una sola línea de tiempo con entregas, retiros y mermas. Reescribe el detalle y sus pruebas.
- **Sí:** desbloquear `seller-detail-page` para sumar la petición nueva a sus pruebas (decisión del usuario).
- **No:** meter las mermas en `GET /api/sellers/:id` para evitar el desbloqueo. Mezcla el historial con los datos del vendedor y deja la sección sin «Reintentar» propio.
- **Sí:** historial nuevo `/admin/mermas` con todas las mermas (bodega y vendedores) y su titular (decisión del usuario). Cierra el «Por decidir» de Jira: no había historial de la bodega.
- **No:** página solo de la bodega, ni dejar el historial de la bodega para otro spec.
- **Sí:** «Ver mermas» siempre visible en «Stock general» y la página filtra por «Viendo» (decisión del usuario).
- **No:** enlace solo con «Yo · bodega», como «Ver fraccionados».
- **Sí:** buscador por producto en el frontend sobre las últimas 50 (decisión del usuario), como `/admin/fraccionados`.
- **Sí:** filas fijas, sin resumen de merma (decisión del usuario): la fila ya muestra todo.
- **Sí:** el vendedor solo ve sus piezas descontadas en «Mi stock» (decisión del usuario). Cierra el otro «Por decidir» de Jira.
- **Sí:** una merma que deja al vendedor en 0 se marca «Agotado», como una venta (decisión del usuario). La regla de HU-18 no cambia; una prueba la fija.
- **No:** tratarla como un retiro.
- **Sí:** la fila vive en `shared/components/` porque la usan `sellers` y `shrinkage`, y una feature no importa otra.
- **Sí:** la lista vive en el módulo `@shrinkage` (`history.ts`) y lee `stock_movements` directo con `@db`: es el dueño de la merma y no hace falta tocar `@stock`.
- **Sí:** un solo caso de uso `listShrinkages` para los dos endpoints, con el límite en el filtro.

## 11. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| HU-26 se despliega sin HU-25 | Esta rama sale de `feat/registrar-merma`; HU-25 se fusiona primero. |
| La petición nueva rompe las pruebas con commit de `seller-detail-page` | El usuario corre `./desbloquear seller-detail-page` antes del paso 4; solo se suma el `expectOne` de mermas. |
| El enlace nuevo rompe alguna prueba con commit de `stock-page` | Las pruebas revisadas filtran por texto o por `a.quick-action`. Si alguna falla, se detiene y se pide el desbloqueo. |
| Filas `shrinkage` sin motivo (pruebas viejas, Studio) | `reason`/`reasonLabel` `null` y la pantalla pinta «Sin motivo». |
| Un vendedor desactivado desaparece del historial | `left join profiles` sin filtrar `active`: su nombre sigue en `/admin/mermas`. Su detalle da `404`, como hoy con retiros. |
| Con muchas mermas, el buscador solo ve las últimas 50 | Aceptado, igual que `/admin/fraccionados`. |

## 12. Ampliación del 2026-11-09: mermas y fraccionados dentro de «Stock general»

Pedido del usuario después de implementar §1–§11. **Reemplaza** en este spec la página `/admin/mermas` (§2, §3 «/admin/mermas» y «Stock general», §6, §7 pasos 5–7, criterios 6–8 de §8) y **revierte** la página `/admin/fraccionados` de HU-24 y la posición del botón «Baja existencia» de HU-18. «Últimas mermas» del detalle del vendedor (§3) y el backend (§4, §5) no cambian.

### 12.1 Alcance

**Entra:**

- Selector `p-selectbutton` «Productos | Mermas | Fraccionados» en «Stock general», encima del buscador. Cambia la lista de abajo sin salir de la página.
- «Baja existencia» pasa al final de la fila de movimientos rápidos (sigue abriendo su pop-up).
- Se quitan los enlaces «Ver fraccionados» y «Ver mermas» de «Stock general».
- Se borran las páginas `/admin/mermas` (`features/shrinkage/pages/shrinkage-history-page/`, `shrinkage-history.routes.ts`, `constants/shrinkage-history-page.constants.ts`) y `/admin/fraccionados` (`features/fraction/pages/fraction-history-page/`, `fraction-history.routes.ts`, la parte de historial de `constants/fraction-history-page.constants.ts`); sus rutas redirigen a «Stock general» con la vista elegida.
- Datos y reglas pasan a `features/stock` (una feature no importa otra):
  - `features/stock/services/stock-history.service.ts` (nuevo): `shrinkages(sellerId?)` (`GET /api/shrinkages`, sale de `ShrinkageService.list`) y `fractions()` (`GET /api/fractions`, sale de `FractionService.getHistory`).
  - `features/stock/rules/stock-history.rules.ts`: `filterShrinkageHistory` y `filterFractionHistory` (salen de `features/shrinkage/rules/` y `features/fraction/rules/`).
  - Tipos en `features/stock/interfaces/stock-history.models.ts`.
  - `features/fraction/components/fraction-history-line` se mueve a `shared/components/fraction-history-line` (con su modelo `.models.ts` y sus constantes al lado).
- El enlace «Ver fraccionados» del pop-up «Fraccionar» abre `/admin/stock?vista=fraccionados`.

**No entra:** cambios de backend, en «Últimas mermas» del detalle del vendedor, en el pop-up de «Baja existencia» (solo se mueve el botón) ni en los movimientos rápidos existentes.

### 12.2 Reglas

- **Vista:** `'products' | 'shrinkages' | 'fractions'`, sincronizada con el query param `vista` (`productos` / `mermas` / `fraccionados`) con `replaceUrl`. Sin `vista` o con un valor desconocido → «Productos».
- **«Fraccionados»** solo aparece con «Yo · bodega» (los fraccionados son de la bodega). Con un vendedor en «Viendo» la opción no está y, si estaba elegida, la vista cae a «Productos».
- **Mermas:** con «Yo · bodega», todas (bodega y vendedores) con su titular; con un vendedor en «Viendo», solo las suyas (`?sellerId=`), sin titular en la fila. Cambiar «Viendo» vuelve a pedir la lista.
- **Carga perezosa:** las mermas y los fraccionados se piden solo cuando su vista está activa; se recargan con `StockChangesService`.
- **Buscador:** uno solo, por nombre de producto, sin mayúsculas ni acentos, aplicado a la vista activa (`filterShrinkageHistory`, `filterFractionHistory`).
- **Estados por vista:** cargando (esqueleto), error con «Reintentar», vacío («Aún no hay mermas» / «<nombre> no tiene mermas» / «Aún no hay fraccionados») y sin coincidencias con «Limpiar búsqueda». Textos tomados de las constantes de las páginas que se borran.
- **«Baja existencia»:** botón `button.low-filter` proyectado al final de `stock-quick-actions` (`<ng-content />`), con su globo, su `aria-label`, `aria-haspopup="dialog"`, su pop-up y el foco que le devuelve cerrar la tarjeta de avisos. Aparece con «Yo · bodega» y con un vendedor. Los `a.quick-action` siguen siendo 6 con «Yo · bodega» y 3 con un vendedor.
- **Redirecciones:** `/admin/mermas` → `/admin/stock?vista=mermas`; `/admin/fraccionados` → `/admin/stock?vista=fraccionados` (`redirectTo` con `UrlTree`).

### 12.3 Interfaz

- Orden: resumen → tarjeta de avisos → fila de movimientos rápidos (con «Baja existencia» al final) → selector de vista → buscador → lista.
- Filas: `app-shrinkage-history-line` (`showHolder` solo con «Yo · bodega») y `app-fraction-history-line`; lista con `p-dataview`.
- «Baja existencia» con el estilo de las acciones (`severity="secondary"`, `h-11`) y el ícono de alerta.
- A 375 px sin desplazamiento horizontal.

### 12.4 Plan

1. Pruebas en rojo (`test-writer`), después de los desbloqueos de §12.6.
2. **Datos y reglas:** `StockHistoryService`, `stock-history.rules.ts`, tipos, mover `fraction-history-line` a `shared/components/`; quitar `ShrinkageService.list`, `FractionService.getHistory` y las reglas viejas.
3. **Interfaz:** selector y vistas en `stock-page`, «Baja existencia» en la fila, quitar los enlaces y sus constantes, borrar las dos páginas y sus rutas, redirecciones en `admin.routes.ts`, enlace del pop-up «Fraccionar».
4. Verificación: `ng test`, `ng build`, `npm run check:architecture`, y a mano a 375 px.
5. README y Jira (`SCRUM-67` vuelve a «En curso»; nota en `SCRUM-64` de HU-24).

### 12.5 Criterios de aceptación

- [ ] «Stock general» muestra el selector «Productos | Mermas | Fraccionados»; elegir «Mermas» o «Fraccionados» cambia la lista sin salir de `/admin/stock` y deja `?vista=` en la URL.
- [ ] Con un vendedor en «Viendo», el selector no ofrece «Fraccionados», «Mermas» lista solo las suyas sin titular y, si estaba en «Fraccionados», la vista cae a «Productos».
- [ ] El buscador filtra la vista activa por producto sin mayúsculas ni acentos; cada vista muestra cargando, error con «Reintentar», vacío y sin coincidencias.
- [ ] «Baja existencia» está al final de la fila de movimientos rápidos, con su globo, y abre el mismo pop-up; al cerrar la tarjeta de avisos el foco vuelve a él.
- [ ] Ya no hay enlaces «Ver fraccionados» ni «Ver mermas» en «Stock general»; los movimientos rápidos no cambian.
- [ ] `/admin/mermas` y `/admin/fraccionados` redirigen a «Stock general» con la vista correspondiente; «Ver fraccionados» del pop-up «Fraccionar» abre esa vista.
- [ ] A 375 px se usa sin zoom ni desplazamiento horizontal.
- [ ] `ng build`, `npm run check:architecture` y `ng test` pasan; solo cambian las pruebas con commit de §12.6.

### 12.6 Pruebas

- **Nuevas:** `stock-page.component.history-view.spec.ts` (selector, `?vista=`, «Fraccionados» con vendedor, buscador por vista, estados) y la redirección de las dos rutas.
- **Con commit, requieren desbloqueo del usuario antes del paso 1** (el script de desbloqueo con el nombre indicado):

  | Nombre | Qué cambia |
  | --- | --- |
  | `stock-page` | `.history-link.spec.ts` y `.shrinkage-link.spec.ts` pasan de probar enlaces a probar el selector y `?vista=`; en `stock-page.component.spec.ts` solo lo que dependa de la posición del botón «Baja existencia». |
  | `shrinkage-history` | Se borra la spec de la página; `shrinkage-history.rules.spec.ts` se mueve a `features/stock/rules/`. La spec de la fila no cambia. |
  | `fraction-history` | Se borra la spec de la página; la de las reglas se mueve a `features/stock/rules/` y la de la fila a `shared/components/`, cambiando solo imports. |
  | `shrinkage.service` | `shrinkage.service.history.spec.ts` se mueve a `stock-history.service.spec.ts`. |
  | `fraction.service` | `fraction.service.history.spec.ts` se mueve a `stock-history.service.spec.ts`. |
  | `fraction-page` | `fraction-page.component.history-link.spec.ts`: el destino pasa a `/admin/stock?vista=fraccionados`. |

- Las pruebas que se mueven conservan sus aserciones y solo cambian imports o URL.

### 12.7 Decisiones

- **Sí:** selector «Productos | Mermas | Fraccionados» en la misma pantalla (decisión del usuario).
- **No:** chips alternables ni páginas propias.
- **Sí:** «Baja existencia» sigue abriendo su pop-up y solo cambia de lugar (decisión del usuario).
- **No:** convertirlo en filtro de la lista.
- **Sí:** quitar `/admin/mermas` y `/admin/fraccionados` y redirigir a la vista (decisión del usuario).
- **Sí:** registrar el cambio ampliando este spec (decisión del usuario), no en un spec nuevo.
- **Sí:** el botón entra en la fila por proyección de contenido; `StockQuickAction` sigue siendo solo de enlaces.

## 13. Ampliación del 2026-11-09: bolsitas por titular en «Fraccionados»

Pedido del usuario después de §12: el administrador tiene que ver las bolsitas (productos con `parent_product_id`) que tienen sus vendedores. Fraccionar siempre ocurre en la bodega (T-24), así que un vendedor no tiene «fraccionados» propios: tiene bolsitas que le dejaron. **Cambia** de §12.2 la regla «Fraccionados solo con «Yo · bodega»» y sus criterios.

### 13.1 Alcance

**Entra:**

- **Backend:** `GET /api/stock` marca cada producto con `parentProductId` (`number | null`): `holdingsByProduct` (`backend/src/stock/holdings.ts`) lo selecciona y `StockProduct` (`backend/src/inventory/overview.ts`) lo devuelve. Sin migración ni endpoint nuevo.
- **Frontend:**
  - `StockProduct` del frontend (`features/stock/interfaces/stock-overview.models.ts`) suma `parentProductId?: number | null` (opcional: los fixtures con commit no lo traen).
  - Regla pura `portionRows(rows)` en `features/stock/rules/stock.rules.ts`: deja solo las filas cuyo producto tiene `parentProductId` distinto de `null`.
  - Vista «Fraccionados» de `stock-page` con dos secciones (§13.2) y disponible también con un vendedor en «Viendo».
  - Ajuste de la fila de movimientos rápidos (`stock-quick-actions`): con 7 botones las etiquetas se partían en dos líneas en escritorio; pasa a una cuadrícula de 2 columnas en móvil, 4 desde `sm` y una sola fila desde `xl`.

**No entra:** cambios en `GET /api/fractions`, en «Mi stock» del vendedor, en «Productos» ni en el seed.

### 13.2 Reglas

- **Con «Yo · bodega», «Fraccionados» muestra:**
  1. «Bolsitas en stock»: las bolsitas del negocio con su reparto por titular («Bodega 12 · Víctor 3») y su total, con `app-stock-product-row` (las mismas filas de «Productos», filtradas con `portionRows`).
  2. «Últimos fraccionados»: el historial de §12 (`GET /api/fractions`, carga perezosa, sus estados).
- **Con un vendedor en «Viendo»:** la opción «Fraccionados» aparece; muestra solo «Bolsitas en stock» con las bolsitas de ese vendedor y sus piezas. No pide `GET /api/fractions` ni muestra el historial. `?vista=fraccionados` con un vendedor ya no cae a «Productos».
- **Buscador:** filtra por nombre las dos secciones (bolsitas con la regla de búsqueda de productos; historial con `filterFractionHistory`).
- **Vacíos:** «No hay bolsitas en stock» (con «Yo») / «<nombre> no tiene bolsitas» (con vendedor); sin coincidencias en una sección, su aviso propio. El historial conserva sus estados de §12.
- El `stockLevel` de cada bolsita se pinta como en «Productos» (HU-18); el frontend no repite el umbral.

### 13.3 Plan

1. Pruebas en rojo (`test-writer`), después de que el usuario corra el desbloqueo de `stock-page`.
2. **Un bloque** (`implementer`): backend (`holdingsByProduct`, `StockProduct`, prueba) y frontend (modelo, `portionRows`, vista «Fraccionados», fila de movimientos rápidos).
3. Verificación: `npm test` del backend, `ng test`, `ng build`, `npm run check:architecture`; a mano, dejar 3 bolsitas a Víctor (el seed no le da ninguna) y revisar las dos vistas a 375 px y en escritorio.
4. README y Jira (`SCRUM-67`).

### 13.4 Criterios de aceptación

- [ ] `GET /api/stock` trae `parentProductId` en cada producto: el id del entero en una bolsita y `null` en los demás.
- [ ] Con «Yo · bodega», «Fraccionados» muestra «Bolsitas en stock» con el reparto por titular (también las que tiene un vendedor) y, debajo, «Últimos fraccionados».
- [ ] Con un vendedor en «Viendo», el selector ofrece «Fraccionados» y la vista muestra solo sus bolsitas con sus piezas, sin historial y sin pedir `GET /api/fractions`.
- [ ] El buscador filtra las dos secciones; los vacíos «No hay bolsitas en stock» / «<nombre> no tiene bolsitas» se ven cuando corresponde.
- [ ] En escritorio, las etiquetas de los movimientos rápidos no se parten en dos líneas; a 375 px no hay desplazamiento horizontal.
- [ ] `npm test` del backend, `ng test`, `ng build` y `npm run check:architecture` pasan; solo cambian las pruebas con commit de §13.5.

### 13.5 Pruebas

- **Nuevas:**
  - `backend/tests/stock-overview-portion.test.ts` (datos `test-sop-`): una bolsita dejada a un vendedor sale con `parentProductId` y las piezas del vendedor; un entero sale con `null`.
  - `features/stock/rules/stock.rules.portions.spec.ts`: `portionRows`.
  - `features/stock/pages/stock-page/stock-page.component.portions.spec.ts`: secciones con «Yo», solo bolsitas con vendedor (sin pedir el historial), buscador en las dos secciones, vacíos.
- **Con commit, requieren que el usuario corra el desbloqueo de `stock-page`** (solo se modifican, ninguna se borra ni renombra): en `stock-page.component.history-view.spec.ts`, bloque «con un vendedor en «Viendo»»:
  - «el selector no ofrece «Fraccionados»» → lo ofrece.
  - «con ?vista=fraccionados cae a «Productos» sin pedir fraccionados» → abre las bolsitas del vendedor sin pedir el historial.
  - «si estaba en «Fraccionados» y se elige un vendedor, la vista cae a «Productos»» → se queda en «Fraccionados» con las bolsitas del vendedor.
- Si alguna prueba con commit del backend compara el producto de `GET /api/stock` completo y falla por el campo nuevo, se detiene y se reporta.

### 13.6 Decisiones

- **Sí:** «Fraccionados» = bolsitas en stock por titular + historial de fraccionados (decisión del usuario); con un vendedor, solo sus bolsitas.
- **No:** dejar «Fraccionados» oculto con vendedor, ni quitar el historial.
- **Sí:** marcar la bolsita con `parentProductId` en `GET /api/stock` en lugar de un endpoint nuevo: la respuesta ya trae las bolsitas con su reparto.
- **Sí:** registrar el cambio como §13 de este spec (decisión del usuario).

## Lo que **no** entra en este spec

- «Mis mermas» para el vendedor, resumen de una merma, línea de tiempo mezclada.
- Enlace «Ver mermas» en el pop-up de HU-25.
- Cambiar la regla de «Agotado» de HU-18.
- RF-16 (merma de la semana, merma en el resumen del vendedor), anular una merma.
- Migraciones, cambios en `POST /api/shrinkages`, en el seed o en el pop-up de HU-25.
