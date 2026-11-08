# Spec técnico — HU-23 · Fraccionar un producto entero en bolsitas (administrador)

> **Estado:** Implementado
> **Depende de:** M5-t24-base-fraccionado (`specs/M5-t24-base-fraccionado/spec.md`) — `POST /api/fractions`, módulo `@fractions`, reglas del fraccionado y respuesta `Fraction`; M2-hu13-stock-general (`specs/M2-hu13-stock-general/spec.md`) — movimientos rápidos de «Stock general»; M1-hu05-ver-y-buscar-productos (`specs/M1-hu05-ver-y-buscar-productos/spec.md`) — card de «Productos»; M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`) — «Yo · bodega»; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — dinero como texto
> **Fecha:** 2026-11-07
> **Objetivo:** que el administrador abra en `/admin/fraccionar` un entero fraccionable de la bodega, escriba cuántas bolsitas salieron y su precio, confirme una sola vez y vea el costo por bolsita y la bodega antes → después que le devuelve el backend.

Fuentes:

- **Jira:** historia `SCRUM-63 · HU-23`, épica `SCRUM-11 · M5 · Fraccionado`. Requerimiento RF-14. Pantalla 05 «Fraccionar». Depende de T-24 (`SCRUM-62`), HU-13 y HU-05.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (pantalla 05: producto a abrir, bolsitas que salieron, costo por bolsita, precio de venta; baja 1 entero y suben N bolsitas en la bodega). El canvas de mockups no se pudo abrir desde esta sesión (no está compartido con la cuenta); la pantalla se arma con la página de Confluence, `references/` y los tokens de la app.
- **Código:** `backend/src/fractions/` (`createFraction`, `types.ts`, `constants.ts`), `backend/app/api/fractions/route.ts`; `src/app/features/stock/constants/stock-page.constants.ts` (`YO_QUICK_ACTIONS`), `src/app/features/stock/components/stock-quick-actions/`, `src/app/features/products/components/product-card/`, `src/app/core/layout/routes/admin.routes.ts`, `src/app/shared/utils/uuid.ts` (`newUuid`).
- **Decisiones del usuario del 2026-11-07** (§10).

## 1. Alcance

**Entra en este spec:**

- **Backend, en `backend/src/fractions/`:**
  - Caso de uso de solo lectura `listFractionOptions()` y su ruta `backend/app/api/fractions/options/route.ts` (`GET`, solo administrador).
  - Tipo nuevo `FractionOption` en `types.ts`, exportado desde `index.ts`.
- **Frontend, feature nueva `src/app/features/fraction/`:**
  - Ruta `/admin/fraccionar` (lazy) con la página `fraction-page`.
  - Formulario reactivo presentacional `fraction-form`: producto a abrir, bolsitas que salieron, precio de venta de la bolsita.
  - Vista previa «Baja 1 entero · Suben N bolsitas» que solo usa números enteros (sin dinero).
  - Resultado `fraction-result` en la misma página: costo por bolsita, precio, bodega antes → después, «Fraccionar otro» y «Ver stock general».
  - `FractionService` (`getOptions()`, `create()`), modelos, validadores y constantes de la feature.
- **Entradas:**
  - Movimiento rápido «Fraccionar» en «Stock general» con «Yo · bodega».
  - Botón «Fraccionar» en el pie de la card de «Productos» para enteros fraccionables con «Yo · bodega».
- **Pruebas nuevas** (§9) y verificación manual a 375 px.
- Actualizar `specs/README.md` y sincronizar `SCRUM-63`.

**No entra en este spec:**

- Calcular el costo por bolsita antes de confirmar (en el frontend o con un endpoint de vista previa).
- Fraccionar piezas de un vendedor o más de 1 entero por operación (T-24 lo cierra).
- La etiqueta de la bolsita en el inventario y el historial de fraccionados en pantalla (HU-24, `SCRUM-64`).
- Deshacer un fraccionado.
- Una URL propia del resultado (`/admin/fraccionar/:requestId`): `GET /api/fractions/[requestId]` existe pero esta historia no lo usa.
- Cambios en `POST /api/fractions`, en la migración `fractions` o en `supabase/seed.sql`.
- Mover los validadores de dinero de `products`/`deliveries` a `shared/`.

## 2. Reglas de negocio

- **Quién:** solo el administrador. La ruta cuelga de `/admin`, que ya protege `roleGuard`; el endpoint nuevo usa `requireRole(request, 'admin')`.
- **Siempre la bodega:**
  - La pantalla fracciona de la bodega aunque «Viendo» tenga un vendedor elegido, y lo dice con el texto «De la bodega».
  - Las entradas («Fraccionar» en movimientos rápidos y en la card) solo aparecen con «Yo · bodega».
- **Qué se lista (`GET /api/fractions/options`):**
  - Todos los productos **activos** con `fractionable = true`, ordenados por nombre sin mayúsculas.
  - Cada uno con sus piezas en bodega, su porción, su costo de fábrica y su bolsita si ya existe (aunque esté desactivada: `createFraction` la reactiva).
  - Las bolsitas no aparecen como entero (tienen `fractionable = false`).
- **Selector «Producto a abrir»:**
  - Los enteros con 0 piezas en bodega se ven **deshabilitados** con «Sin piezas en bodega».
  - Con `?producto=<id>` en la URL, ese entero queda elegido al cargar si existe en la lista. Si tiene 0 piezas, queda elegido y el campo muestra el error «Sin piezas en bodega» al enviar. Si no está en la lista, se ignora el parámetro.
  - Sin ningún entero fraccionable: estado vacío «No hay productos que se fraccionen» con enlace a «Productos».
- **Campo «Bolsitas que salieron»:** entero de 2 a 1000 (`MIN_PORTIONS`/`MAX_PORTIONS` de T-24, repetidos en `constants/` de la feature). Vacío, decimal, menor o mayor → error de campo al enviar.
- **Campo «Precio de venta de la bolsita»:**
  - Siempre obligatorio y siempre se manda en el `POST`.
  - Bolsita nueva: empieza vacío. Bolsita existente: se prellena con su precio actual al elegir el entero; se puede cambiar.
  - Texto con `inputmode="decimal"`, hasta 2 decimales, mayor que 0 y máximo `99999999.99` (T-08); sin redondear ni formatear mientras se escribe.
  - El frontend **no** compara el precio con el costo por bolsita (no lo conoce antes de confirmar). Si el backend responde `422` `PRICE_BELOW_COST`, se muestra como error del campo precio.
- **Datos visibles del entero elegido:** porción, piezas en bodega, costo de fábrica del entero y, si existe, el nombre de la bolsita. Sin bolsita: «Se creará la bolsita «<entero> · bolsita <porción>»».
- **Vista previa** (solo con entero elegido y bolsitas válidas): «Baja 1 entero (N → N−1) · Suben B bolsitas». No muestra dinero.
- **Envío:**
  - Inválido → `markAllAsTouched()` y no se manda nada.
  - Un `requestId` (`newUuid()`) por intento de fraccionado: se conserva si el envío falla por red o error del servidor, para que reintentar no fraccione dos veces; se renueva al empezar uno nuevo con «Fraccionar otro».
  - Sin segundo envío mientras el primero está en curso: el botón «Fraccionar» queda deshabilitado con estado de espera y el formulario no se reenvía.
- **Errores del `POST` (sin guardar nada, el formulario conserva lo escrito):**
  - `409` «No hay piezas suficientes» → error del campo producto «Sin piezas en bodega» y se recargan las opciones.
  - `422` `PRICE_BELOW_COST` → error del campo precio con el mensaje del backend.
  - `422` `PORTION_COST_ZERO` o `PORTIONS_OUT_OF_RANGE` → error del campo bolsitas con el mensaje del backend.
  - `409` nombre de bolsita ocupado, `409` `FRACTION_MISMATCH`, `404` y `422` `NOT_FRACTIONABLE` → aviso `alert-danger` con el mensaje del backend sobre el botón y se recargan las opciones.
  - Sin conexión o `500` → aviso «No pudimos registrar el fraccionado. Inténtalo de nuevo.»; el `requestId` se conserva.
  - Solo `http-errors.ts` lee `HttpErrorResponse`; el servicio traduce a un motivo y la página decide qué pintar.
- **Resultado** (respuesta `201` o `200` con `replayed: true`):
  - Toast «Fraccionado registrado».
  - Costo por bolsita (`portionUnitCost`, pintado con el pipe `currency`) y precio de la bolsita, tal como vienen del backend.
  - Bodega antes → después: entero `product.stock + 1 → product.stock` y bolsita `portionProduct.stock − portions → portionProduct.stock` (fórmula de T-24 §4). Con `replayed: true` el «antes» no es fiable, así que solo se pinta el «después».
  - «Bolsita nueva» cuando `portionProduct.created` es `true`.
  - «Fraccionar otro» limpia el formulario, renueva el `requestId` y recarga las opciones; «Ver stock general» va a `/admin/stock`.
- **Carga de opciones:** `rxResource`. Cargando → esqueleto; error → «No pudimos cargar los productos» con «Reintentar» (`reload()`).

## 3. Endpoint

`GET /api/fractions/options` (nuevo, solo administrador, sin parámetros):

- `200 { products: FractionOption[] }`.
- `401` sin sesión; `403` con un vendedor.
- La ruta estática `options` convive con `app/api/fractions/[requestId]/route.ts`: Next resuelve primero el segmento estático.
- El caso de uso lee `products` (entero y su bolsita por `parent_product_id`) y `products.stock` (bodega, mantenido por el trigger). No escribe nada.

`POST /api/fractions` (T-24) no cambia. El frontend siempre manda `{ requestId, productId, portions, price }`.

## 4. Modelo de datos

No hay migración ni tablas nuevas.

Backend (`backend/src/fractions/types.ts`):

```ts
export interface FractionOption {
  productId: number
  name: string
  image: string | null
  warehouseUnits: number   // products.stock del entero
  unitCost: string         // escala 4, "450.0000"
  portionSize: string      // texto de la porción, "30 g"
  portionProduct: { id: number; name: string; price: string; active: boolean } | null
}
```

Frontend (`src/app/features/fraction/interfaces/fraction.models.ts`, con `import type`):

```ts
export interface FractionOption { /* mismo contrato que el backend */ }

export interface Fraction {      // respuesta de POST /api/fractions (T-24 §4)
  id: number
  requestId: string
  portions: number
  wholeUnitCost: string
  portionUnitCost: string
  createdAt: string
  product: { id: number; name: string; stock: number }
  portionProduct: { id: number; name: string; created: boolean; price: string; stock: number }
}

export interface CreateFractionPayload {
  requestId: string
  productId: number
  portions: number
  price: string                  // escala 2, tal como se escribió y sin espacios
}

export type FractionFailureReason =
  | 'no-units' | 'price-below-cost' | 'portions-invalid' | 'conflict' | 'offline'

export type FractionResult =
  | { ok: true; fraction: Fraction; replayed: boolean }
  | { ok: false; reason: FractionFailureReason; message: string | null }
```

Forma del formulario (`fraction-form.models.ts`, junto al componente):

```ts
{ productId: number | null; portions: string; price: string }   // portions como texto: se valida entero 2..1000
```

Estructura de carpetas:

```
src/app/features/fraction/
  fraction.routes.ts                       FRACTION_ROUTES ('' → fraction-page, title «Fraccionar»)
  pages/fraction-page/                     contenedor: opciones, envío, resultado
  components/fraction-form/                presentacional (input options, initialProductId, saving, serverErrors; output submitted)
  components/fraction-result/              presentacional (input fraction, replayed; output again)
  services/fraction.service.ts             getOptions(), create()
  interfaces/fraction.models.ts
  validators/fraction-form.validators.ts   portionsInRange(), requiredMoney(scale, max)
  constants/fraction-page.constants.ts     textos de la página, MIN_PORTIONS, MAX_PORTIONS, PRICE_MAX
  rules/fraction-preview.rules.ts          vista previa y antes → después (enteros, funciones puras)
```

Cambios fuera de la feature:

- `core/layout/routes/admin.routes.ts`: `{ path: 'fraccionar', loadChildren: FRACTION_ROUTES }`.
- `features/stock`: `StockQuickActionIcon` suma `'fraction'`; `YO_QUICK_ACTIONS` suma `{ label: 'Fraccionar', link: FRACTION_URL, icon: 'fraction' }` antes de «Nuevo producto»; `stock-quick-actions` dibuja el ícono nuevo.
- `features/products/components/product-card`: `canFraction` (con «Yo · bodega» y `fractionable`), enlace `['/admin/fraccionar']` con `queryParams: { producto: id }`, y `showFooter` lo incluye. La URL va en `product-card.constants.ts` (una feature no importa otra).

## 5. Plan de implementación

1. **Endpoint de opciones.** `FractionOption` en `types.ts`, `listFractionOptions()` en `fractions.ts`, exportación en `index.ts` y ruta `backend/app/api/fractions/options/route.ts`. Pruebas nuevas en `backend/tests/fraction-options.test.ts`. `npm run type-check` y `npm test` pasan.
2. **Esqueleto de la feature.** Crear `src/app/features/fraction/` con sus carpetas, `fraction.routes.ts`, modelos y constantes; `ng generate component` para `fraction-page`, `fraction-form` y `fraction-result`; montar `fraccionar` en `admin.routes.ts`. La página muestra solo el título. `ng build` y `npm run check:architecture` pasan.
3. **Servicio.** `FractionService.getOptions()` y `create()` con la traducción de errores a `FractionResult` (vía `http-errors.ts`). Prueba del servicio.
4. **Diseño.** Usar **ui-ux-pro-max** y después **frontend-design** para la pantalla nueva (regla de `CLAUDE.md`), con los tokens de `styles.css` y PrimeNG.
5. **Formulario.** `fraction-form` con el patrón de formularios de `CLAUDE.md` (`createEmptyForm()`, validadores de la feature, `p-select` con opciones deshabilitadas, `pInputText` para bolsitas y precio, prellenado del precio al cambiar de entero, datos del entero y vista previa con `rules/fraction-preview.rules.ts`). Pruebas del componente, de los validadores y de las reglas.
6. **Página.** `fraction-page`: `rxResource` de opciones, lectura de `?producto=`, `requestId`, envío con un solo `subscribe` y `takeUntilDestroyed()`, estados de espera, errores de §2 y recarga de opciones. Prueba de la página.
7. **Resultado.** `fraction-result` con costo, precio, antes → después (o solo después con `replayed`), «Bolsita nueva», «Fraccionar otro» y «Ver stock general»; toast al fraccionar. Pruebas.
8. **Entradas.** Movimiento rápido «Fraccionar» y botón de la card. Pruebas nuevas en archivos nuevos (los `.spec.ts` con commit no se tocan; si alguno se rompe, se detiene y se pide aprobación).
9. **Cierre.** `ng build`, `npm test`, `npm run check:architecture`, prueba manual a 375 px y en escritorio, `specs/README.md` y comentario de avance en `SCRUM-63` (En curso → In review).

## 6. Criterios de aceptación

- [x] `GET /api/fractions/options` devuelve los enteros activos fraccionables con piezas en bodega, porción, costo y bolsita (o `null`), ordenados por nombre; no lista bolsitas ni productos desactivados; un vendedor recibe `403`.
- [x] «Fraccionar» aparece en los movimientos rápidos de «Stock general» y en la card de un entero fraccionable solo con «Yo · bodega», y lleva a `/admin/fraccionar` (la card, con ese entero ya elegido). **Actualizado por `M5-hu24`:** el botón de la card se retiró; «Fraccionar» queda solo en los movimientos rápidos de «Stock general».
- [x] Elijo un entero con piezas, escribo las bolsitas y el precio, y confirmo (criterio 1 de `SCRUM-63`).
- [x] Tras confirmar, el resultado muestra el entero con 1 pieza menos y la bolsita con N más en la bodega, y «Stock general» lo refleja (criterio 2).
- [x] El resultado muestra el costo por bolsita que manda el backend (`450.0000 ÷ 7` → $64.29 en pantalla) sin que el frontend calcule dinero (criterio 3).
- [x] Un entero con 0 piezas se ve deshabilitado; si llega elegido por la URL o el backend responde `409` de piezas, el campo producto muestra «Sin piezas en bodega» y no se guarda nada (criterio 4).
- [x] Bolsitas vacías, `1`, `1001` o `2.5`, y precio vacío, `0`, con 3 decimales o con letras muestran error de campo al enviar y no mandan la petición (criterio 4).
- [x] Un precio menor que el costo por bolsita muestra el error del backend en el campo precio, sin guardar (criterio 4).
- [x] Mientras el envío está en curso, el botón está deshabilitado y un segundo clic no manda otra petición (criterio 5).
- [x] Si el envío falla sin conexión, reintentar manda el mismo `requestId` y no fracciona dos veces.
- [x] Con bolsita existente, el precio se prellena con el suyo; con bolsita nueva, empieza vacío y se ve el nombre que tendrá.
- [x] «Fraccionar otro» deja el formulario vacío con un `requestId` nuevo y opciones recargadas.
- [x] Con un vendedor en «Viendo», `/admin/fraccionar` fracciona de la bodega y lo dice.
- [x] `ng build`, `npm test`, `npm run check:architecture`, y en `backend/` `npm run type-check` y `npm test` (con `SUPABASE_SERVICE_ROLE_KEY`) pasan.
- [x] La pantalla se usa sin desplazamiento horizontal a 375 px.

## 7. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El administrador pone un precio menor que el costo porque no lo ve antes de confirmar | El backend responde `422` y el campo muestra el mensaje; se ve el costo de fábrica del entero como referencia. Una vista previa del costo queda fuera (§10). |
| Las piezas cambian entre cargar las opciones y confirmar | El `409` del backend manda; se pinta en el campo y se recargan las opciones. |
| `options` choca con la ruta dinámica `[requestId]` | Next prioriza el segmento estático; una prueba llama a `GET /api/fractions/options` vía el caso de uso y el `type-check` revisa la ruta. |
| Recargar la página pierde el resultado y su «antes» | Decisión aceptada (§10): el fraccionado ya quedó guardado y se ve en «Stock general». |
| Un `.spec.ts` con commit de `stock` o `product-card` se rompe por la acción nueva | Se detiene y se pide aprobación (`CLAUDE.md` global); las pruebas nuevas van en archivos nuevos. |
| `architecture.test.ts` no revisa `@fractions` (T-24 §7) | Sin cambio; agregar el alias al mapa requiere aprobación del usuario. |

## 8. Textos de la pantalla

En `constants/fraction-page.constants.ts` y en los `.constants.ts` de cada componente:

- Título «Fraccionar» y subtítulo «De la bodega».
- Campos «Producto a abrir», «Bolsitas que salieron», «Precio de venta de la bolsita».
- Opción deshabilitada y error: «Sin piezas en bodega».
- Vista previa: «Baja 1 entero» · «Suben N bolsitas».
- Botón «Fraccionar» (en espera: «Fraccionando…»).
- Resultado: «Fraccionado listo», «Costo por bolsita», «Precio de la bolsita», «Bodega», «Bolsita nueva», «Fraccionar otro», «Ver stock general».
- Estados: «Cargando productos…», «No pudimos cargar los productos» + «Reintentar», «No hay productos que se fraccionen» + «Ir a Productos».

## 9. Plan de pruebas

- **Backend** (`backend/tests/fraction-options.test.ts`, nuevo, contra la base real, saltado sin `SUPABASE_SERVICE_ROLE_KEY`): entero con y sin bolsita, entero con 0 piezas, bolsita desactivada (aparece con `active: false`), producto no fraccionable y desactivado (no aparecen), orden por nombre y `403` del vendedor. Datos `test-frac-opt-` + `Date.now()`, limpieza como T-24.
- **Frontend** (Vitest, archivos nuevos):
  - `fraction.service.spec.ts`: URL y cuerpo; cada error de §2 → su `reason`.
  - `fraction-form.validators.spec.ts` y `fraction-preview.rules.spec.ts`.
  - `fraction-form.component.spec.ts`: opción deshabilitada, prellenado del precio, errores al enviar y no al tocar, vista previa, `submitted` con el payload.
  - `fraction-page.component.spec.ts`: `?producto=`, mismo `requestId` al reintentar, sin doble envío, errores de campo y aviso, resultado y «Fraccionar otro».
  - `fraction-result.component.spec.ts`: antes → después, solo después con `replayed`, «Bolsita nueva».
  - Pruebas nuevas para el movimiento rápido «Fraccionar» y el botón de la card (solo con «Yo» y `fractionable`).
- **Manual:** fraccionar un entero real en local (`npm run dev:all`) y revisar «Stock general» y «Productos».

## 10. Decisiones

- **Sí:** página `/admin/fraccionar` con el resultado en la misma página (decisión del usuario). El «antes» solo existe en la primera respuesta del `POST`.
- **No:** resultado en su URL con `GET /api/fractions/[requestId]`. Al releer no hay «antes».
- **No:** pop-up en el outlet `ventana`. El antes → después no cabe en un toast.
- **Sí:** endpoint nuevo `GET /api/fractions/options` (decisión del usuario). `GET /api/products` no trae costo, porción ni bolsita, y su `stock` sigue a «Viendo».
- **No:** reusar `GET /api/products` filtrando en el frontend.
- **Sí:** costo por bolsita solo en el resultado, tomado del backend (decisión del usuario, como dice Jira). El `422` de precio bajo el costo va al campo precio.
- **No:** endpoint de vista previa del costo. Más backend y llamadas por cada tecla.
- **No:** `divideMoney` en el frontend. Contradice T-24 y «el frontend no calcula dinero».
- **Sí:** siempre bodega; las entradas solo con «Yo · bodega» y la página funciona igual con un vendedor elegido (decisión del usuario).
- **No:** bloquear la página con un vendedor en «Viendo».
- **Sí:** listar todos los enteros fraccionables y deshabilitar los de 0 piezas (decisión del usuario). Deja visible el criterio 4.
- **Sí:** precio prellenado con el de la bolsita existente y siempre obligatorio (decisión del usuario). Una sola regla; el backend lo acepta al reusar.
- **No:** precio opcional al reusar la bolsita. Dos reglas de validación en pantalla.
- **Sí:** botón «Fraccionar» en el pie de la card, solo para enteros fraccionables con «Yo · bodega», aunque tengan 0 piezas (decisión del usuario).
- **Sí:** el resultado ofrece «Fraccionar otro» y «Ver stock general», más un toast (decisión del usuario).
- **Sí:** el `requestId` se conserva en fallos y se renueva con «Fraccionar otro». Reintentar no fracciona dos veces.
- **Sí:** con `replayed: true` solo se pinta el «después». El «antes» calculado sería falso si hubo otros movimientos.
- **Sí:** validadores propios en `features/fraction/validators/`. Una feature no importa otra; moverlos a `shared/` es otro cambio.

## Lo que **no** entra en este spec

- Costo por bolsita antes de confirmar.
- Fraccionar piezas de un vendedor o varios enteros a la vez.
- Etiqueta de la bolsita e historial de fraccionados (HU-24).
- Deshacer un fraccionado.
- URL propia del resultado.
- Cambios en `POST /api/fractions`, migraciones o seed.
