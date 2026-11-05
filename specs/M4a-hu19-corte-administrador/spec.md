# Spec técnico — HU-19 · Generar el corte con los precios del vendedor (administrador)

> **Estado:** Implementado
> **Depende de:** M4a-t20-base-cortes (`specs/M4a-t20-base-cortes/spec.md`) — `GET /api/cuts` con totales, desglose y ventas; M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`) — titular de «Viendo» (`ViewingService`); M3-hu16-confirmar-venta (`specs/M3-hu16-confirmar-venta/spec.md`) — ventas del vendedor; M3-hu17-vender-como-administrador (`specs/M3-hu17-vender-como-administrador/spec.md`) — ventas del administrador desde el stock de un vendedor; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — dinero como texto
> **Fecha:** 2026-11-04
> **Objetivo:** que el administrador, en «Corte», genere el corte con precios del titular de «Viendo» (un vendedor o la bodega) para un día, semana o mes, actual o anterior, y vea lo vendido, el costo, la ganancia, el desglose por producto y las ventas que lo forman.

Fuentes:

- **Jira:** historia `SCRUM-55 · HU-19`, épica `SCRUM-9 · M4a · Corte del vendedor`. Requerimientos RF-11, RF-28, RF-30, RF-02, RNF-02, RNF-03, RNF-04. Talla M. Depende de T-20, HU-10, HU-16 y HU-17.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantalla 08 Corte de caja, v1 parcial: sin crédito, más vendidos ni Exportar).
- **Canvas:** tableros `CorteAdmin` (sin generar y generado), `CorteLuis` (corte de un vendedor) y `EstadosCorteAdmin` (cargando, vacío y error).
- **Código:** `backend/src/cuts/cuts.ts` (`CashCut`), `core/viewing/viewing.service.ts` (`selectedSeller`, `listStatus`), `core/layout/routes/admin.routes.ts` (hoy «Corte» carga «Próximamente»), `features/sell` (página con `rxResource`, renglones de venta) y `shared/utils/money.ts`.
- **Decisiones del usuario del 2026-11-04** (§9).

## 1. Alcance

**Entra en este spec:**

- **Frontend · feature nueva `features/cash-cut/`:** compartida con HU-20 («Mi corte» del vendedor), que agregará ahí su página.
  - Página del administrador en `/admin/corte`, que reemplaza a «Próximamente».
  - Servicio de `GET /api/cuts`, modelos, reglas de periodo y componentes presentacionales.
- **Selección:**
  - Titular: el de «Viendo» (vendedor o «Yo · bodega»).
  - Periodo: Día, Semana o Mes, con flechas «anterior / siguiente».
  - Tipo de corte: selector visible con «Corte (para casa)» deshabilitado.
- **«Generar corte»** y el resultado:
  - Resumen con vendido, costo y ganancia.
  - Desglose por producto.
  - Lista de ventas plegada por venta.
  - Hora de generación y «Generar de nuevo».
- **Estados del canvas:** sin generar, cargando, vacío y error con «Reintentar».
- **Diseño:** flujo de `CLAUDE.md` (ui-ux-pro-max y luego frontend-design) sobre los tableros del canvas.
- **Pruebas** del frontend (§7) y verificación manual a 375 px.

**No entra en este spec:**

- Corte para casa: costo de fábrica, ganancia real y «para cubrir envíos» (M4b, RF-29). El selector existe, pero «para casa» está deshabilitado.
- «Resumen del negocio» con bodega y vendedores juntos (canvas con «Yo»). Necesita un endpoint o una llamada por titular.
- «Mi corte» del vendedor (HU-20).
- La etiqueta «Precio de Luis · general $35» del canvas: T-20 no manda el precio general.
- Selector de fecha libre: solo flechas sobre el periodo.
- Guardar, enviar o cobrar cortes. Crédito, «¿a crédito?», «cobrado», productos más vendidos (RF-18) y Exportar (RF-20).
- Cambios en el backend, migraciones y seed: `GET /api/cuts` (T-20) se usa tal como está.
- Un acceso «Ver su corte» desde «Stock general».

## 2. Reglas de negocio

- **Titular (criterio 1):**
  - Es el de «Viendo» (`ViewingService.selectedSeller()`): un vendedor o «Yo · bodega» (`null`). La pantalla no tiene selector propio.
  - Mientras la lista de «Viendo» carga (`listStatus() === 'loading'`), «Generar corte» está deshabilitado, para no cortar la bodega por error cuando había un vendedor guardado.
- **Periodo:**
  - Día, Semana (lunes a domingo) o Mes, en hora de México (`America/Mexico_City`). Al entrar es «Día» del periodo actual.
  - **‹ Anterior** retrocede un periodo y **Siguiente ›** avanza uno. «Siguiente» está deshabilitado en el periodo actual: no se cortan periodos futuros.
  - Cambiar entre Día, Semana y Mes vuelve al periodo actual de esa clase.
  - La fecha de referencia que se manda (`date`) es un día dentro del periodo elegido:
    - Día: el propio día.
    - Semana: el lunes.
    - Mes: el día 1.
  - «Hoy» se calcula con `Intl.DateTimeFormat` en la zona de México, nunca con la hora local del dispositivo.
- **Texto del periodo** (antes y después de generar):
  - Día: «mié 4 nov».
  - Semana: «2 al 8 nov», o «26 oct al 1 nov» si cruza de mes.
  - Mes: «noviembre».
  - Si el periodo no es del año en curso, se agrega el año («28 dic 2025 al 3 ene 2026», «diciembre 2025»).
  - Al generar, el texto sale del `period.from/to` que devuelve el backend. Si no coincide con el calculado, manda el del backend.
- **Tipo de corte:**
  - «Corte con precios (para vendedor)» siempre está elegido.
  - «Corte (para casa)» está deshabilitado y lleva el texto «Próximamente».
  - La ayuda dice «Usa los precios y el costo con envío que le pusiste a cada vendedor.».
- **Generar:**
  - **Antes de generar**, la tarjeta «Generar corte» dice «Corte de {Luis | mis ventas} · {periodo}» y «Revisa a quién, el periodo y el tipo de corte. El corte se calcula cuando lo generes.».
  - **Al tocar «Generar corte»** se pide `GET /api/cuts?holderId=…&period=…&date=…`. Con «Yo · bodega», `holderId` no se manda.
  - **Al cambiar el periodo, la flecha o el titular de «Viendo»**, el resultado se quita y vuelve la tarjeta «Generar corte». Nunca se ve un corte de otra selección (criterio 6). Una respuesta que llega después de cambiar la selección se descarta.
  - **Generado:** muestra «Generado hoy a las 18:42», con la hora del dispositivo, y «Generar de nuevo», que vuelve a pedir el mismo corte con las ventas nuevas.
- **Resultado (criterios 2 a 4):**
  - **Título:**
    - Con un vendedor: «Corte con precios · Luis».
    - Con la bodega: «Corte con precios».
  - **Resumen:**
    - «Vendido»: «Vendió Luis · 2 al 8 nov · 5 piezas», o «Mis ventas desde bodega · … · N piezas».
    - «Costo con envío» (con un vendedor) o «Costo» (con la bodega, donde es el costo general guardado en la venta).
    - «Ganancia». Si es negativa, se muestra con signo menos.
    - Las cifras son `totals.total`, `totals.cost` y `totals.profit` de T-20. No se recalcula nada en el frontend.
  - **Desglose:**
    - Encabezado: «Lo que vendió Luis» o «Lo que vendí», con «vendido · ganancia».
    - Un renglón por producto y precio, en el orden de T-20: foto, nombre, «2 × $920.00», «costo con envío $1,400.00» (o «costo»), el subtotal y «+$440.00».
    - Un mismo producto con dos precios sale en dos renglones.
  - **Ventas:**
    - Sección «Ventas (N)», con la más reciente primero.
    - Cada venta, plegada, muestra la hora (con «Día») o la fecha y la hora (con Semana o Mes), el total, la ganancia y la etiqueta «Registrada por ti» si `registeredByAdmin`.
    - Las listas del desglose y de ventas tienen alto máximo y se desplazan por dentro (scroll propio, con el encabezado fuera), para ver ambas secciones sin alargar la página (ajuste del 2026-11-04 tras la revisión visual).
    - Al tocarla se despliegan sus productos (cantidad × precio, subtotal y ganancia). Se despliega una a la vez o varias, según lo que decida diseño.
  - **Precios y costos:** son los guardados en cada venta (precio y costo con envío del vendedor, o los generales). La pantalla nunca relee los precios actuales (criterio 3).
- **Dinero (criterio 4):** los montos llegan como texto y solo se convierten con `Number()` para el pipe `currency` al mostrarlos (`$1,840.00`). Ninguna suma ni resta se hace en el frontend.
- **Estados (criterios 5 y 7):**
  - **Cargando:** «Calculando el corte…», «Sumando las ventas del periodo.» y esqueletos. Los controles siguen visibles.
  - **Vacío:** con `totals.salesCount === 0` no se muestra un corte en ceros. En su lugar sale «No hay ventas en este periodo» y «Cambia el periodo o el vendedor para ver otro corte.».
  - **Error:** «No se pudo generar el corte», con el mensaje de `http-errors.ts` (sin conexión: «Revisa tu conexión e inténtalo de nuevo.»), y «Reintentar».
- **Solo administrador (RNF-04):** la ruta vive bajo `/admin` (`roleGuard`). Los campos de costo y ganancia de los modelos son opcionales, porque HU-20 reutiliza los mismos modelos sin ellos.
- **Celular (RNF-03):** a 375 px se usa sin zoom ni scroll horizontal y los botones miden al menos 44 px. Generar un corte toma unos pocos toques, dentro de los 5 minutos de RNF-02.
- **Textos:** los de este spec son los del canvas. Se confirman en el paso de diseño (§5, paso 5).

## 3. Endpoint

No hay endpoints nuevos. Se usa `GET /api/cuts` de T-20 (`specs/M4a-t20-base-cortes/spec.md` §3):

| Selección | Petición |
| --- | --- |
| Luis · Semana actual (hoy mié 4 nov 2026) | `GET /api/cuts?holderId=<id de Luis>&period=week&date=2026-11-02` |
| Yo · bodega · Día anterior | `GET /api/cuts?period=day&date=2026-11-03` |
| Luis · Mes anterior | `GET /api/cuts?holderId=<id>&period=month&date=2026-10-01` |

Respuestas: `200` con `{ cut }`. `401`/`403` los maneja el interceptor de sesión. `404` (vendedor que ya no existe) y `422` se muestran como error con «Reintentar».

## 4. Modelo de datos

Sin tablas, migraciones ni cambios en el backend. Archivos nuevos en `src/app/features/cash-cut/`:

```ts
// interfaces/cash-cut.models.ts — forma de GET /api/cuts (T-20), compartida con HU-20
export type CutPeriodKind = 'day' | 'week' | 'month';

export interface CashCutQuery {
  holderId: string | null; // null = bodega (no se manda)
  period: CutPeriodKind;
  date: string; // 'YYYY-MM-DD'
}

export interface CashCut {
  holder: { id: string; fullName: string } | null;
  period: { kind: CutPeriodKind; from: string; to: string; timeZone: string };
  totals: { salesCount: number; units: number; total: string; cost?: string; profit?: string };
  products: CutProductLine[];
  sales: CutSale[];
}

export interface CutProductLine {
  productId: number; name: string; image: string | null; unitPrice: string;
  units: number; total: string; cost?: string; profit?: string;
}

export interface CutSale {
  requestId: string; soldAt: string; registeredByAdmin: boolean;
  soldBy: { id: string; fullName: string };
  total: string; profit?: string;
  lines: { productId: number; name: string; qty: number; unitPrice: string; subtotal: string; unitCost?: string; profit?: string }[];
}
```

```ts
// rules/cash-cut-period.rules.ts — funciones puras (fechas como texto 'YYYY-MM-DD', calendario sin horas)
export function todayInMexico(now: Date): string;
export function periodRange(kind: CutPeriodKind, reference: string): { from: string; to: string };
export function shiftPeriod(kind: CutPeriodKind, today: string, offset: number): string; // offset ≤ 0 → fecha de referencia
export function periodLabel(kind: CutPeriodKind, from: string, to: string, today: string): string;
```

- **`constants/cash-cut.constants.ts`:** `CUT_TIME_ZONE = 'America/Mexico_City'` y los textos compartidos con HU-20.
- **`constants/admin-cash-cut-page.constants.ts`:** textos de la página: títulos, ayudas, estados, «Próximamente» y «Registrada por ti».
- **`models/admin-cash-cut-page.models.ts`:** estado de la selección de la página (`{ kind, offset }`) y la petición generada.
- **`services/cash-cut.service.ts`:** `get(query: CashCutQuery): Observable<CashCut>` con `HttpClient`. Arma los parámetros y omite `holderId` cuando es `null`.
- **`components/`** (presentacionales, solo `input()`/`output()`):
  - `cut-period-picker`: Día, Semana y Mes con las flechas y el texto del periodo.
  - `cut-summary`: vendido, costo y ganancia.
  - `cut-product-line`: un renglón del desglose.
  - `cut-sale-item`: una venta plegable con sus renglones.
- **`pages/admin-cash-cut-page/`:**
  - Lee «Viendo» y guarda la selección y la petición generada en señales.
  - Pide el corte con `rxResource({ params: () => request(), stream })`. `request()` es `undefined` hasta tocar «Generar corte» y vuelve a `undefined` al cambiar la selección. «Reintentar» y «Generar de nuevo» llaman a `reload()`.
- **`cash-cut.routes.ts`:** `ADMIN_CASH_CUT_ROUTES` (página con `loadComponent`, `data.title` «Corte»).
- **`core/layout/routes/admin.routes.ts`:** `corte` pasa de `comingSoon` a `loadChildren` de `ADMIN_CASH_CUT_ROUTES`.

## 5. Plan de implementación

1. **Esqueleto y datos.**
   - Crear el esqueleto de carpetas de `features/cash-cut/`, `interfaces/cash-cut.models.ts`, `constants/cash-cut.constants.ts`, `services/cash-cut.service.ts` y `cash-cut.routes.ts` con una página vacía generada con `ng generate component`.
   - Montarla en `admin.routes.ts`.
   - Specs del servicio (parámetros, sin `holderId` para la bodega) y de `admin.routes.spec.ts` («corte» carga `ADMIN_CASH_CUT_ROUTES`).
   - `ng test`, `ng build` y `npm run check:architecture` pasan.
2. **Reglas de periodo.**
   - `rules/cash-cut-period.rules.ts` con `todayInMexico`, `periodRange`, `shiftPeriod` y `periodLabel`.
   - Sus pruebas: bordes de zona horaria (23:59 en México contra UTC), semana de lunes a domingo, semana que cruza mes y año, meses de 28 a 31 días, febrero bisiesto, offsets negativos y año en el texto.
   - `ng test` pasa.
3. **Componentes presentacionales.**
   - `cut-period-picker`, `cut-summary`, `cut-product-line` y `cut-sale-item` con `ng generate component`, con sus `.constants.ts`/`.models.ts` si los necesitan y sus specs.
   - Los specs cubren: entradas y salidas, «Siguiente» deshabilitado en el actual, ganancia negativa, «Registrada por ti», plegar y desplegar con `aria-expanded`, y sin llaves de costo cuando faltan.
   - `ng test` pasa.
4. **Página del administrador.**
   - `admin-cash-cut-page` con titular de «Viendo», selección, tipo de corte con «para casa» deshabilitado, tarjeta «Generar corte», `rxResource` y los estados (cargando, vacío, error con «Reintentar»).
   - Resultado con hora de generación y «Generar de nuevo».
   - El resultado se quita al cambiar periodo, flecha o «Viendo».
   - Spec de la página (§7). `ng test`, `ng build` y `npm run check:architecture` pasan.
5. **Diseño.**
   - El flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design sobre `CorteAdmin`, `CorteLuis` y `EstadosCorteAdmin`, traducidos a los tokens de `styles.css`, con PrimeNG para botones, `Tag`, `Skeleton` y tarjetas. No se copian colores del canvas.
   - Se confirman los textos de §2 y cómo se despliegan las ventas.
   - Cierre del paso: `ng build`, `ng test` y `npm run check:architecture` pasan.
6. **Verificación manual** contra la base local con el seed, en escritorio y a 375 px:
   - Con Víctor en «Viendo», vender y generar «Día»: las cifras coinciden con las ventas y el desglose usa sus precios y su costo con envío.
   - Una venta del administrador desde el stock de Víctor sale con «Registrada por ti».
   - Cambiar a «Semana» y a «‹ Anterior»: se pide «Generar corte» otra vez y el texto del periodo cambia. «Siguiente ›» está deshabilitado en el actual.
   - Cambiar a «Yo · bodega»: el resultado se quita y el corte generado es el de la bodega.
   - Un periodo sin ventas muestra el estado vacío.
   - Con el backend apagado se ve el error, y «Reintentar» funciona al prenderlo.
   - A 375 px no hay scroll horizontal.
   - Al terminar, `npm run db:reset` deja la base como el seed.
7. **Cierre.**
   - Actualizar `specs/README.md` (fila y relaciones).
   - Actualizar `CLAUDE.md` y `AGENTS.md` con la feature `cash-cut` y la regla de periodo en el frontend.
   - Comentar el avance en `SCRUM-55` en cada paso y moverla de estado según el flujo de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-55`:

- [x] **1.** En «Corte», el administrador ve a quién corta (el titular de «Viendo»: un vendedor o «Yo · bodega»), el periodo (Día, Semana, Mes) y «Generar corte».
- [x] **2.** Con Luis y «Semana», «Generar corte» muestra lo vendido, el costo con envío, la ganancia y el desglose por producto (foto, piezas, precio de Luis y subtotal).
- [x] **3.** Si Luis tiene precio y costo con envío propios, el corte usa los guardados en cada venta, no los precios actuales del producto.
- [x] **4.** 2 piezas a $920 con costo con envío $700 se muestran como vendido $1,840.00, costo $1,400.00 y ganancia $440.00, sin sumar ni redondear en el frontend.
- [x] **5.** Un periodo sin ventas muestra el estado vacío del canvas, no un corte en ceros.
- [x] **6.** Al cambiar de periodo o de titular en «Viendo» el resultado se quita, y el nuevo corte generado corresponde a la nueva selección sin mezclar ventas de otro titular.
- [x] **7.** Mientras carga se ve «Calculando el corte…». Si falla o no hay conexión se ve el error con «Reintentar», y «Reintentar» vuelve a pedirlo.
- [x] **8.** A 375 px se usa sin zoom ni scroll horizontal (RNF-03), y generar un corte toma unos pocos toques (RNF-02).

Además (decisiones del 2026-11-04, §9):

- [x] Las flechas «‹ Anterior» y «Siguiente ›» cambian el periodo y su texto. «Siguiente ›» está deshabilitado en el periodo actual.
- [x] El texto del periodo coincide con el `period.from/to` del backend (lunes a domingo, mes calendario) en hora de México.
- [x] El selector «Tipo de corte» muestra «Corte con precios (para vendedor)» elegido y «Corte (para casa)» deshabilitado con «Próximamente».
- [x] Con «Yo · bodega» el corte es el de la bodega («Mis ventas desde bodega», «Lo que vendí»), sin «Resumen del negocio».
- [x] La sección «Ventas» lista cada venta plegada (hora, total, ganancia), con «Registrada por ti» en las del administrador desde el stock del vendedor, y se despliega con sus productos.
- [x] El resultado muestra «Generado hoy a las HH:MM», y «Generar de nuevo» vuelve a pedir el mismo corte.
- [x] «Generar corte» está deshabilitado mientras carga la lista de «Viendo».
- [x] `features/cash-cut` no importa otras features. `npm run check:architecture`, `ng build` y `ng test` pasan.

## 7. Plan de pruebas

- **`features/cash-cut/services/cash-cut.service.spec.ts`:** `GET /api/cuts` con `holderId`, `period` y `date`. Sin `holderId` para la bodega.
- **`features/cash-cut/rules/cash-cut-period.rules.spec.ts`:**
  - `todayInMexico` con instantes cerca de la medianoche de México.
  - `periodRange` de día, semana (también de domingo a lunes) y mes (también febrero de 2028 y diciembre).
  - `shiftPeriod` con offsets 0, -1 y -12.
  - `periodLabel` en el mismo mes, cruzando mes y en otro año.
- **`components/cut-period-picker/cut-period-picker.component.spec.ts`:** emite la clase y el offset, «Siguiente» deshabilitado con offset 0, nombres accesibles de las flechas.
- **`components/cut-summary/cut-summary.component.spec.ts`:** cifras con formato `$1,840.00`, etiqueta «Costo con envío» o «Costo», ganancia negativa con signo.
- **`components/cut-product-line/cut-product-line.component.spec.ts`:** foto o marcador, «2 × $920.00», subtotal, costo y ganancia.
- **`components/cut-sale-item/cut-sale-item.component.spec.ts`:** plegado por defecto, `aria-expanded`, renglones al desplegar, «Registrada por ti» solo con `registeredByAdmin`.
- **`pages/admin-cash-cut-page/admin-cash-cut-page.component.spec.ts`:**
  - Tarjeta «Generar corte» con el titular de «Viendo» y el periodo; deshabilitada mientras carga «Viendo».
  - Petición correcta para un vendedor y para la bodega; resultado con resumen, desglose y ventas.
  - Estado vacío con `salesCount 0`.
  - Error con «Reintentar».
  - El resultado se quita al cambiar periodo, flecha o «Viendo», y una respuesta tardía no se muestra.
  - «Generar de nuevo».
  - Tipo de corte con «para casa» deshabilitado.
- **`core/layout/routes/admin.routes.spec.ts`** (se amplía): «corte» carga `ADMIN_CASH_CUT_ROUTES`.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La regla de periodo del frontend se desfasa de la del backend | El frontend solo la usa para el texto y la fecha de referencia. Al generar, manda el `period.from/to` del backend. Las pruebas cubren los mismos bordes que T-20 |
| El dispositivo tiene otra zona horaria u hora equivocada | «Hoy» se calcula con `Intl` en `America/Mexico_City`. La hora «Generado a las» es del dispositivo y solo informa |
| Se genera la bodega cuando «Viendo» aún no carga al vendedor guardado | «Generar corte» está deshabilitado mientras `listStatus()` es `'loading'` |
| Una respuesta lenta llega después de cambiar la selección | La petición vive en una señal que vuelve a `undefined` al cambiar; `rxResource` descarta la respuesta anterior |
| Con muchas ventas en un mes la pantalla se alarga | Las ventas van plegadas. Si T-21 mide lentitud, se pagina en otro spec |
| «Para casa» deshabilitado confunde | Lleva «Próximamente» y no reacciona. Se habilita en M4b |
| El costo de la bodega no es «con envío» | Con la bodega la etiqueta es «Costo» (§2) |

## 9. Decisiones

- **Sí:** el resumen muestra vendido, costo con envío y ganancia (decisión del usuario). Cierra el primer «Por decidir» de `SCRUM-55`.
- **No:** solo vendido y costo.
- **Sí:** el selector «Tipo de corte» se muestra con «Corte (para casa)» deshabilitado y «Próximamente» hasta M4b (decisión del usuario). Cierra el segundo «Por decidir».
- **No:** ocultarlo hasta M4b.
- **Sí:** con «Yo · bodega» se genera el corte de la bodega, con el mismo formato que el de un vendedor (decisión del usuario). Cierra el tercer «Por decidir».
- **No:** el «Resumen del negocio» con todos los titulares (necesita otro endpoint o una llamada por titular), ni limitar la pantalla a vendedores.
- **Sí:** lista «Ventas» debajo del desglose, plegada por venta, con la marca «Registrada por ti» (decisión del usuario).
- **No:** solo totales y desglose, ni la lista desplegada completa.
- **Sí:** flechas «anterior / siguiente» sobre el periodo, sin pasar del actual (decisión del usuario).
- **No:** solo el periodo actual, ni un selector de fecha (control nuevo).
- **Sí:** el frontend calcula el texto exacto del periodo antes de generar, con una regla pura en hora de México. Manda el `period` del backend al generar (decisión del usuario).
- **No:** textos relativos («Semana pasada») sin fechas.
- **Sí:** cambiar periodo o «Viendo» quita el resultado y pide «Generar corte» otra vez, como el canvas (decisión del usuario).
- **No:** regenerar solo.
- **Sí:** feature nueva `features/cash-cut/`, que HU-20 comparte (decisión del usuario).
- **No:** meter el corte en `features/sell` ni en `features/stock`.
- **Sí:** se omite la etiqueta «Precio de Luis · general $…» (decisión del usuario). El backend de T-20 no cambia.
- **No:** ampliar `@cuts` con el precio general.
- **Sí:** «Generado hoy a las HH:MM» y «Generar de nuevo» (decisión del usuario).
- **Sí:** con la bodega, la etiqueta del costo es «Costo» y no «Costo con envío». Lo guardado en esas ventas es el costo general.
- **Sí:** cambiar entre Día, Semana y Mes vuelve al periodo actual de esa clase. Mantener el desplazamiento entre clases distintas no tiene un significado claro.

## Lo que **no** entra en este spec

- Corte para casa y «para cubrir envíos» (M4b).
- «Resumen del negocio» de todos los titulares.
- «Mi corte» del vendedor (HU-20).
- Selector de fecha libre, Exportar, más vendidos y crédito.
- Guardar, enviar o cobrar cortes.
- Cambios en el backend.

Cada uno, si llega, va en su propio spec o en su historia.
