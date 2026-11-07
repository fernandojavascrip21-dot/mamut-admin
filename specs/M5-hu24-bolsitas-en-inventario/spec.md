# Spec técnico — HU-24 · Ver las bolsitas y su costo en el inventario (administrador)

> **Estado:** Aprobado
> **Depende de:** M5-hu23-fraccionar-entero-bolsitas (`specs/M5-hu23-fraccionar-entero-bolsitas/spec.md`) — pop-up «Fraccionar» y bolsita creada; M5-t24-base-fraccionado (`specs/M5-t24-base-fraccionado/spec.md`) — tabla `fractions`, módulo `@fractions`, `parent_product_id`; M1-hu05-ver-y-buscar-productos (`specs/M1-hu05-ver-y-buscar-productos/spec.md`) — card y `GET /api/products`; M2-hu13-stock-general (`specs/M2-hu13-stock-general/spec.md`) — «Stock general»; M2-hu11-dejar-a-vendedor y M3-hu17-vender-como-administrador — flujos que la bolsita usa sin cambios
> **Fecha:** 2026-11-07
> **Objetivo:** que el administrador distinga la bolsita en «Productos» con la etiqueta «Fraccionado», su costo y su precio, y consulte en `/admin/fraccionados` los últimos fraccionados.

Fuentes:

- **Jira:** historia `SCRUM-64 · HU-24`, épica `SCRUM-11 · M5 · Fraccionado`. RF-14, RF-09. Pantallas 02 «Stock general» y 03 «Productos y venta». Depende de HU-23, HU-11, HU-17.
- **Código:** `backend/src/products/products.ts` (`listProducts`), `backend/src/fractions/` (`fractions.ts`, `types.ts`), `backend/app/api/fractions/route.ts`, `src/app/features/products/components/product-card/`, `src/app/features/products/interfaces/product.models.ts`, `src/app/features/fraction/`, `src/app/features/stock/pages/stock-page/`, `src/app/core/layout/routes/admin.routes.ts`.
- **Decisiones del usuario del 2026-11-07** (§9).

## 1. Alcance

**Entra en este spec:**

- **«Productos» (card de HU-05):**
  - La bolsita (`parentProductId ≠ null`) lleva la etiqueta «Fraccionado»; el entero (`fractionable = true`) pasa a «Se fracciona».
  - La card de la bolsita muestra «Costo $X» (costo de fábrica de la bolsita) además del precio, solo con «Yo · bodega».
  - Se quita el botón «Fraccionar» del pie de la card (el cambio ya empezado en `product-card.component.html`), con su código (`canFraction`, `fractionLink`, `fractionText`) y su constante. «Fraccionar» sigue en los movimientos rápidos de «Stock general».
- **Backend:**
  - `listProducts` agrega `parentProductId` y `portionUnitCost` (el `unit_cost` de la bolsita; `null` para los demás productos).
  - Caso de uso `listFractions()` en `backend/src/fractions/` y `GET /api/fractions` (solo administrador): los 50 fraccionados más recientes.
- **Historial `/admin/fraccionados`:** página nueva en `features/fraction/` con buscador por nombre del entero o de la bolsita. Se enlaza desde el pop-up «Fraccionar» (formulario y resultado) y desde «Stock general» con «Yo · bodega».
- **Verificación** de que la bolsita cuenta en «Stock general» y «Viendo», se deja, se retira y se vende sin cambios en esos flujos (prueba nueva de backend).
- **Pruebas** nuevas (§8) y el cambio aprobado de tres tests con commit de `product-card` (§8).
- Actualizar `specs/README.md` y sincronizar `SCRUM-64`.

**No entra en este spec:**

- Cambios en entregas, retiros, ventas, cortes o «Stock general» más allá del enlace al historial.
- Paginación, filtros por fecha o por producto en el backend, y más de 50 fraccionados.
- Detalle de un fraccionado o URL propia (`GET /api/fractions/[requestId]` sigue sin usarse en pantalla).
- Mostrar costo en la card de productos que no son bolsita, o el costo con un vendedor en «Viendo».
- Deshacer un fraccionado; editar la relación entero ↔ bolsita; resincronizar la bolsita con el entero.
- Restringir la edición de una bolsita en HU-06 (p. ej. marcarla «Se fracciona»).
- Migraciones o cambios en `supabase/seed.sql`.

## 2. Reglas de negocio

- **Quién:** solo el administrador. `/admin/fraccionados` cuelga de `/admin` (`roleGuard`); `GET /api/fractions` usa `requireRole(request, 'admin')` → vendedor `403`, sin sesión `401`.
- **Etiquetas de la card:**
  - `parentProductId !== null` → «Fraccionado».
  - `fractionable === true` → «Se fracciona».
  - Se combinan con «Agotado»/«Baja existencia» como hoy (esas van primero).
- **Costo en la card:**
  - Solo si `portionUnitCost !== null` y «Viendo» es «Yo · bodega» (`holderLabel() === null`).
  - Se pinta con el pipe `currency` tal como llega (escala 4 → pantalla en centavos); el frontend no calcula dinero (`Number()` solo para el pipe).
- **`GET /api/products`:** sigue sin el campo `unitCost` (RNF-04 y `products.test.ts`). `portionUnitCost` existe en todas las filas y vale `null` salvo en bolsitas. El endpoint ya es solo de administrador.
- **`GET /api/fractions`:**
  - Los 50 fraccionados más recientes (`created_at desc`, desempate `id desc`), sin parámetros.
  - Lee `fractions` con el entero, la bolsita (`products`) y quién lo hizo (`profiles.full_name`); incluye productos desactivados (el historial no se borra).
  - No escribe nada.
- **Página `/admin/fraccionados`:**
  - Cada fila: fecha y hora (en `America/Mexico_City`), entero → bolsita, «1 entero → N bolsitas», costo por bolsita (`portionUnitCost`), precio que quedó (`portionPrice`) y quién lo hizo.
  - Buscador en el frontend por nombre del entero o de la bolsita, sin acentos ni mayúsculas (`shared/utils/normalize-text`).
  - Carga con `rxResource`: esqueleto; error → «No pudimos cargar los fraccionados» con «Reintentar» (`reload()`); vacío → «Todavía no hay fraccionados»; búsqueda sin resultados → «Ningún fraccionado coincide».
  - Siempre es la bodega: la página no depende de «Viendo».
- **Enlaces al historial:** «Ver fraccionados» en el pop-up «Fraccionar» (bajo el formulario y en el resultado) y en «Stock general» como enlace de texto junto a los movimientos rápidos, solo con «Yo · bodega». Los cinco movimientos rápidos no cambian.
- **La bolsita en los flujos existentes:** es un producto normal; cuenta en «Stock general» y «Viendo», aparece en «Dejar», «Retirar» y en el catálogo de venta sin código nuevo.

## 3. Endpoints

`GET /api/products` (cambia la fila):

```ts
{ id, name, categoryId, price, stock, fractionable, image,
  parentProductId: number | null,     // nuevo
  portionUnitCost: string | null }    // nuevo: unit_cost escala 4 de la bolsita; null si no es bolsita
```

`GET /api/fractions` (nuevo, en `backend/app/api/fractions/route.ts` junto al `POST`):

- `200 { fractions: FractionHistoryItem[] }`; `401`; `403` vendedor.
- No choca con `options` ni `[requestId]`: es la raíz del segmento.

## 4. Modelo de datos

No hay migración ni tablas nuevas.

Backend (`backend/src/fractions/types.ts`, exportado desde `index.ts`):

```ts
export interface FractionHistoryItem {
  id: number
  requestId: string
  createdAt: string
  portions: number
  wholeUnitCost: string     // escala 4
  portionUnitCost: string   // escala 4
  portionPrice: string      // escala 2
  product: { id: number; name: string }          // el entero
  portionProduct: { id: number; name: string }   // la bolsita
  createdBy: { id: string; name: string }        // profiles.full_name
}
```

Constante nueva en `backend/src/fractions/constants.ts`: `FRACTION_HISTORY_LIMIT = 50`.

Frontend:

- `features/products/interfaces/product.models.ts`: `ProductSummary` suma `parentProductId: number | null` y `portionUnitCost: string | null`.
- `features/fraction/interfaces/fraction.models.ts`: `FractionHistoryItem` (mismo contrato).
- Estructura nueva en `features/fraction/`:

```
pages/fraction-history-page/               contenedor: rxResource, buscador, estados
components/fraction-history-line/          presentacional (input item)
models/fraction-history-page.models.ts     si hace falta
constants/fraction-history-page.constants.ts  textos, FRACTION_HISTORY_URL
rules/fraction-history.rules.ts            filtro por nombre (función pura)
services/fraction.service.ts               + getHistory()
fraction-history.routes.ts                 FRACTION_HISTORY_ROUTES ('' → fraction-history-page)
```

- `core/layout/routes/admin.routes.ts`: `{ path: 'fraccionados', loadChildren: FRACTION_HISTORY_ROUTES }` (tabla de rutas en `features/fraction/`), título «Fraccionados».
- `features/products/components/product-card`: etiquetas, costo y retiro del botón; `product-card.constants.ts` pierde `PRODUCT_CARD_FRACTION_TEXT` y suma los textos «Se fracciona», «Fraccionado», «Costo».
- `features/stock/pages/stock-page`: enlace «Ver fraccionados» (URL en `stock-page.constants.ts`, una feature no importa otra).

## 5. Plan de implementación

1. **Backend: fila de productos.** `listProducts` suma `parentProductId` y `portionUnitCost` (`case when parent_product_id is not null then unit_cost end`). Prueba nueva en `backend/tests/products-portion.test.ts`. `npm run type-check` y `npm test` pasan (incluido `products.test.ts` sin cambios).
2. **Backend: historial.** `FractionHistoryItem`, `FRACTION_HISTORY_LIMIT`, `listFractions()` y `GET` en `app/api/fractions/route.ts`. Prueba nueva `backend/tests/fraction-history.test.ts`.
3. **Backend: la bolsita en los flujos.** Prueba nueva `backend/tests/fraction-inventory.test.ts`: fraccionar → la bolsita está en `GET /api/stock` (bodega) → dejarla a un vendedor → aparece en su stock → retirar una → venderla. Sin cambios de código; si algo falla, se detiene y se informa.
4. **Card de «Productos».** Modelo, etiquetas «Fraccionado»/«Se fracciona», «Costo $X» solo para bolsitas con «Yo · bodega», y retiro del botón «Fraccionar» con su código. Cambio aprobado de los tres tests (§8) y pruebas nuevas en `product-card.component.portion.spec.ts`.
5. **Diseño del historial.** **ui-ux-pro-max** y luego **frontend-design** (regla de `CLAUDE.md`), con tokens de `styles.css`, PrimeNG (`DataView`, `Skeleton`, `pInputText`) y mockups de Jira/Confluence + `references/`.
6. **Página `/admin/fraccionados`.** `ng generate component` para `fraction-history-page` y `fraction-history-line`, ruta lazy, `FractionService.getHistory()`, regla de filtro, estados. Pruebas.
7. **Enlaces.** «Ver fraccionados» en el pop-up (formulario y resultado) y en «Stock general». Pruebas nuevas en archivos nuevos.
8. **Cierre.** `ng build`, `npm test`, `npm run check:architecture`; en `backend/` `npm run type-check` y `npm test` con `SUPABASE_SERVICE_ROLE_KEY`; prueba manual a 375 px y escritorio; `specs/README.md`; `SCRUM-64` En curso → In review.

## 6. Criterios de aceptación

- [ ] Tras fraccionar, la bolsita aparece en «Productos» con la etiqueta «Fraccionado», «Costo $X» y su precio (criterio 1 de `SCRUM-64`); con `450.0000 ÷ 7` se ve «Costo $64.29».
- [ ] El entero fraccionable muestra «Se fracciona» y no «Fraccionado»; un producto normal no muestra ninguna de las dos.
- [ ] Con un vendedor en «Viendo», la card de la bolsita no muestra el costo.
- [ ] La card ya no tiene el botón «Fraccionar»; «Fraccionar» sigue en los movimientos rápidos de «Stock general».
- [ ] `GET /api/products` trae `parentProductId` y `portionUnitCost` (no `null` solo en bolsitas) y sigue sin `unitCost`.
- [ ] «Stock general» refleja el entero que bajó y las bolsitas que subieron (criterio 2).
- [ ] La bolsita se deja a un vendedor, se retira y se vende sin cambios en esos flujos (criterio 3; prueba de backend).
- [ ] `/admin/fraccionados` lista los fraccionados más recientes primero (máx. 50) con fecha, entero → bolsita, N bolsitas, costo por bolsita, precio y quién lo hizo (criterio 4).
- [ ] El buscador filtra por entero o bolsita sin acentos ni mayúsculas; muestra los estados de carga, error con «Reintentar», vacío y sin resultados.
- [ ] `GET /api/fractions` da `403` a un vendedor y `401` sin sesión.
- [ ] «Ver fraccionados» lleva a `/admin/fraccionados` desde el pop-up y desde «Stock general» (solo con «Yo · bodega»); «Stock general» sigue con cinco movimientos rápidos.
- [ ] `ng build`, `npm test`, `npm run check:architecture`, y en `backend/` `npm run type-check` y `npm test` (con `SUPABASE_SERVICE_ROLE_KEY`) pasan.
- [ ] `/admin/fraccionados` se usa sin desplazamiento horizontal a 375 px.

## 7. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un test con commit además de los tres aprobados se rompe | Se detiene y se pide aprobación (`CLAUDE.md` global). Solo los tres de §8 están aprobados. |
| `portionUnitCost` se confunde con un costo visible al vendedor | `GET /api/products` es solo de administrador y la card lo oculta con un vendedor en «Viendo»; el vendedor usa `GET /api/me/stock`, que no cambia. |
| Agregar campos a `ProductSummary` rompe fixtures de pruebas de `products`/`sell` | Los campos son nuevos y obligatorios en el tipo; los fixtures de tests con commit que no compilen se señalan antes de tocarlos (los nuevos usan su propio fixture). |
| El historial crece y 50 no alcanza | Decisión aceptada (§9); la paginación queda fuera. |
| Un flujo existente trata mal a la bolsita (criterio 3) | La prueba del paso 3 lo detecta; corregirlo sería un cambio aparte que se consulta. |

## 8. Plan de pruebas

- **Backend** (contra la base real, saltadas sin `SUPABASE_SERVICE_ROLE_KEY`; datos `test-frac-h-` + `Date.now()`, limpieza como T-24):
  - `products-portion.test.ts`: bolsita con `parentProductId` y `portionUnitCost`; entero y producto normal con `null`; sin `unitCost`.
  - `fraction-history.test.ts`: orden, tope de 50 (`FRACTION_HISTORY_LIMIT`), campos y nombre de quien lo hizo, producto desactivado incluido, `401`/`403`.
  - `fraction-inventory.test.ts`: criterio 3 de punta a punta.
- **Frontend** (Vitest, archivos nuevos): `product-card.component.portion.spec.ts` (etiquetas, costo con y sin «Viendo», sin botón), `fraction-history.rules.spec.ts`, `fraction.service.history.spec.ts`, `fraction-history-line.component.spec.ts`, `fraction-history-page.component.spec.ts` (estados y buscador), y specs nuevos de los enlaces del pop-up y de «Stock general».
- **Tests con commit cuyo cambio aprobó el usuario el 2026-11-07** (no se toca ningún otro):
  - `product-card.component.fraction.spec.ts` y `product-card.component.fraction-modal.spec.ts`: se borran (prueban el botón que se quita).
  - `product-card.component.spec.ts`: el `it` «muestra "Fraccionado" solo cuando fractionable es true» se ajusta a «Se fracciona» para el entero (y el de «Agotado» primero, si depende del texto).
- **Manual:** fraccionar en local (`npm run dev:all`), revisar «Productos», «Stock general», dejar y vender la bolsita, y abrir `/admin/fraccionados`.

## 9. Decisiones

- **Sí:** la bolsita lleva «Fraccionado» y el entero pasa a «Se fracciona» (decisión del usuario). Las dos se distinguen a simple vista.
- **No:** dejar «Fraccionado» en ambos o quitarle la etiqueta al entero.
- **Sí:** costo solo en la card de la bolsita y solo con «Yo · bodega» (decisión del usuario). Con un vendedor la card es de su stock y su precio.
- **No:** costo en todas las cards. Cambia HU-05 para todo producto.
- **Sí:** el costo viaja como `portionUnitCost` (`null` si no es bolsita), no como `unitCost`. Mantiene RNF-04 para el resto y no toca `products.test.ts`.
- **Sí:** página `/admin/fraccionados` con `GET /api/fractions` (decisión del usuario), enlazada desde el pop-up y «Stock general».
- **No:** historial en la edición del producto o dentro del pop-up.
- **Sí:** fila completa: fecha, entero → bolsita, N, costo por bolsita, precio y quién (decisión del usuario). Todo sale de `fractions`.
- **Sí:** últimos 50 y buscador en el frontend, sin paginación (decisión del usuario).
- **Sí:** enlace de texto en «Stock general», no un sexto movimiento rápido. `stock-page.component.spec.ts` exige cinco.
- **Sí:** quitar el botón «Fraccionar» de la card (decisión del usuario; el cambio ya estaba empezado en el árbol de trabajo). Se fracciona desde «Stock general».
- **Sí:** cambiar tres tests con commit de `product-card` (aprobado por el usuario el 2026-11-07, §8).
- **Sí:** los criterios 2 y 3 se cumplen sin código nuevo y se demuestran con una prueba de backend. La bolsita es un producto normal desde T-24.

## Lo que **no** entra en este spec

- Cambios en entregas, retiros, ventas, cortes o en los movimientos rápidos.
- Paginación o filtros del historial en el backend; detalle de un fraccionado.
- Costo en cards que no son bolsita o con un vendedor en «Viendo».
- Deshacer un fraccionado o editar la relación entero ↔ bolsita.
- Migraciones o seed.
