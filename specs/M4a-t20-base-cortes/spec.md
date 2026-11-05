# Spec técnico — T-20 · Base de cortes: ventas por titular y periodo (backend)

> **Estado:** Aprovado
> **Depende de:** M3-t18-base-ventas (`specs/M3-t18-base-ventas/spec.md`) — `direct_sales`/`direct_sale_items` con titular, quién vendió, precio y costo del momento; M3-hu17-vender-como-administrador (`specs/M3-hu17-vender-como-administrador/spec.md`) — ventas del administrador desde el stock de un vendedor; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — dinero como texto y redondeo una sola vez; M2-t10-base-vendedores (`specs/M2-t10-base-vendedores/spec.md`) — precio y costo con envío por vendedor
> **Fecha:** 2026-11-04
> **Objetivo:** que el backend calcule, sin guardar nada, el corte de un titular (un vendedor o la bodega) para un día, semana o mes calendario a partir de las ventas ya registradas, con totales, desglose por producto y lista de ventas, y sin costos ni ganancia para el vendedor.

Fuentes:

- **Jira:** tarea `SCRUM-54 · T-20`, épica `SCRUM-9 · M4a · Corte del vendedor`. Requerimientos RF-11, RF-28, RF-30, RF-02, RNF-04, RNF-05. La consumen HU-19 (`SCRUM-55`, corte del administrador) y HU-20 (`SCRUM-56`, «Mi corte» del vendedor); la verifica T-21 (`SCRUM-57`).
- **Confluence:** «Requerimientos» (RF-11, RF-28, RF-30) y «Mockups y flujo de pantallas · MVP v1» (§3, pantallas 08 Corte de caja y 10 Mi corte).
- **Código:** `backend/src/sales/sales.ts` (forma de `Sale`, recorte por rol, ganancia en diezmilésimas), `backend/src/db/schema.ts` (`direct_sales`, `direct_sale_items`, `cuts` heredada), `backend/src/accounts/sellers.ts` (`getSellerName`), `backend/src/lib/handler.ts` y `backend/app/api/sales/route.ts` (patrón de ruta delgada).
- **Decisiones del usuario del 2026-11-04** (§9).

## 1. Alcance

**Entra en este spec:**

- **Backend:**
  - Módulo nuevo `backend/src/cuts/` (`index.ts`, `constants.ts`, `cuts.ts`) con alias `@cuts` en `backend/tsconfig.json` y en `backend/tests/architecture.test.ts`.
  - Caso de uso `getCashCut(input, actor)`, de solo lectura.
  - Ruta `GET /api/cuts` (`backend/app/api/cuts/route.ts`) para administrador y vendedor.
- **Pruebas** del backend contra la base real en `backend/tests/cuts.test.ts` (§7).

**No entra en este spec:**

- Las pantallas «Corte» del administrador (HU-19) y «Mi corte» del vendedor (HU-20).
- Corte para casa: costo de fábrica, ganancia real y «para cubrir envíos» (M4b, RF-29).
- Guardar cortes, «Enviar corte al administrador» y marcar un corte como cobrado.
- La tabla heredada `cuts` (es de `clients`, reservada para el distribuidor): no se toca.
- Anular ventas (`direct_sale_void`). El corte solo respeta `direct_sales.voided_at` si algún día se llena.
- Migraciones y cambios en `supabase/seed.sql`.
- Crédito, forma de pago, exportar a PDF o Excel y productos más vendidos (v2).

## 2. Reglas de negocio

- **De quién es el corte (titular):**
  - El corte suma las ventas cuyo `direct_sales.holder_profile_id` es el titular. `null` = bodega.
  - Una venta que el administrador registró desde el stock de un vendedor (HU-17) **cuenta** en el corte de ese vendedor. Va marcada con `registeredByAdmin: true` (cuando `sold_by ≠ holder_profile_id`).
  - En el corte de la bodega, `registeredByAdmin` siempre es `false`.
- **Quién puede pedir qué:**
  - Un **vendedor** solo pide su corte: `holderId` ausente o igual a su id. Un `holderId` distinto da `403`.
  - El **administrador** pide el de la bodega (`holderId` ausente) o el de cualquier vendedor, **activo o desactivado** (`getSellerName`). Un `holderId` que no es de un vendedor da `404`.
  - Una cuenta desactivada no llega al caso de uso: `requireRole` responde `401`/`403`.
- **Periodo** (zona horaria `America/Mexico_City`):
  - `period`: `day`, `week` o `month`. Si falta, es `day`. Otro valor da `422`.
  - `date`: fecha de referencia `YYYY-MM-DD`. Si falta, es hoy en hora de México. Un formato malo o una fecha inexistente (`2026-02-30`) da `422`.
  - El corte cubre el día, la semana (de **lunes** a domingo) o el mes calendario que contiene `date`.
  - El rango es `[inicio 00:00, fin+1 00:00)` en hora local, convertido a instantes con `AT TIME ZONE` dentro de SQL. Una venta a las 23:59:59 locales cae en ese día; una a las 00:00:00 del siguiente, en el siguiente.
  - Se puede pedir cualquier fecha, pasada o futura. Un periodo futuro devuelve un corte vacío.
- **Qué ventas cuentan:** las del titular y periodo con `direct_sales.voided_at IS NULL`.
- **Dinero** (T-08, sin flotantes; los montos viajan como texto):
  - `total` = `Σ qty × unit_price` con `sum()` en SQL sobre `numeric`. Es exacto, a 2 decimales.
  - `cost` (solo administrador) = `Σ qty × unit_cost` exacto a 4 decimales, redondeado a centavos **una sola vez**, al final, mitad hacia arriba (`round(…, 2)` sobre un valor `≥ 0`).
  - `profit` (solo administrador) = `total − cost`, ya en centavos. Puede ser negativo.
  - Lo mismo aplica a cada renglón del desglose por producto.
  - En la lista de ventas, `total` y `profit` de cada venta salen con la regla de T-18. La suma de esos `profit` puede diferir del `profit` del corte en un centavo por venta; manda el del corte.
  - `unit_price` y `unit_cost` son los guardados en `direct_sale_items` al vender (precio y costo con envío del vendedor, o los generales). El corte nunca relee precios actuales.
- **Recorte por rol (RF-02, RNF-04):** la respuesta al vendedor no trae `cost`, `unitCost` ni `profit` en ningún nivel. La del administrador sí.

## 3. Endpoint

### `GET /api/cuts`

Parámetros de consulta: `holderId` (UUID, opcional), `period` (`day` | `week` | `month`, opcional) y `date` (`YYYY-MM-DD`, opcional).

Responde `200` con `{ "cut": … }`. Errores: `422` (parámetros), `403` (vendedor pidiendo otro titular), `404` (`holderId` que no es de un vendedor), `401` (sin sesión o desactivado).

```jsonc
// Administrador, corte semanal de Luis
{
  "cut": {
    "holder": { "id": "a000…0002", "fullName": "Víctor Vendedor" }, // null = bodega
    "period": { "kind": "week", "from": "2026-11-02", "to": "2026-11-08", "timeZone": "America/Mexico_City" },
    "totals": { "salesCount": 3, "units": 5, "total": "3339.00", "cost": "2580.50", "profit": "758.50" },
    "products": [
      // uno por (producto, precio de venta); si el precio cambió en el periodo, salen dos renglones
      { "productId": 3, "name": "Proteína Demo Whey 2 lb", "image": null, "unitPrice": "920.00",
        "units": 2, "total": "1840.00", "cost": "1400.00", "profit": "440.00" }
    ],
    "sales": [
      // más reciente primero
      { "requestId": "…", "soldAt": "2026-11-04T18:20:11.000Z", "registeredByAdmin": false,
        "soldBy": { "id": "a000…0002", "fullName": "Víctor Vendedor" },
        "total": "920.00", "profit": "220.00",
        "lines": [{ "productId": 3, "name": "Proteína Demo Whey 2 lb", "qty": 1,
                    "unitPrice": "920.00", "subtotal": "920.00", "unitCost": "700.0000", "profit": "220.00" }] }
    ]
  }
}
```

- **Vendedor:** la misma forma, sin `totals.cost`, `totals.profit`, `products[].cost`, `products[].profit`, `sales[].profit`, `lines[].unitCost` ni `lines[].profit`.
- **Periodo sin ventas:** `totals` en ceros (`"0.00"`, `units: 0`, `salesCount: 0`), con `products: []` y `sales: []`. La pantalla decide el estado vacío.

## 4. Modelo de datos

No hay tablas, columnas ni migraciones nuevas. El corte lee:

- `direct_sales`: `holder_profile_id`, `sold_by`, `sold_at`, `voided_at` y `request_id`. El índice `direct_sales_holder_sold_at_idx (holder_profile_id, sold_at DESC)` ya cubre el filtro.
- `direct_sale_items`: `product_id`, `qty`, `unit_price` y `unit_cost`.
- `products`: `name` e `image` (los actuales).
- `profiles`: `full_name` del titular y de quien vendió.

Tipos públicos de `@cuts` (en `backend/src/cuts/cuts.ts`):

```ts
export type CutPeriodKind = 'day' | 'week' | 'month'

export interface CashCutInput {
  holderId: string | null | undefined // null/undefined = bodega (admin) o "yo" (vendedor)
  period: CutPeriodKind
  date: string | undefined            // 'YYYY-MM-DD'; undefined = hoy en CUT_TIME_ZONE
}

export interface CashCut {
  holder: { id: string; fullName: string } | null
  period: { kind: CutPeriodKind; from: string; to: string; timeZone: string }
  totals: { salesCount: number; units: number; total: string; cost?: string; profit?: string }
  products: CutProductLine[]
  sales: CutSale[]
}
// CutProductLine y CutSale siguen la forma de §3 (campos de costo y ganancia opcionales).
```

Constantes en `backend/src/cuts/constants.ts`: `CUT_TIME_ZONE = 'America/Mexico_City'`, `CUT_PERIODS = ['day', 'week', 'month']`, `DEFAULT_CUT_PERIOD = 'day'`, `ISO_DATE = /^\d{4}-\d{2}-\d{2}$/` y los mensajes de `422`.

## 5. Plan de implementación

1. **Esqueleto del módulo:** crear `backend/src/cuts/` (`index.ts`, `constants.ts`, `cuts.ts` vacío con los tipos) y el alias `@cuts` en `backend/tsconfig.json` y `backend/tests/architecture.test.ts`. `npm run type-check` y `npx vitest run tests/architecture.test.ts` pasan.
2. **Periodo:** en `cuts.ts`, validar `period` y `date` (formato y fecha real) y calcular `from`/`to` locales y los instantes de inicio y fin en SQL (`date_trunc('week'|'month', …)`, `AT TIME ZONE CUT_TIME_ZONE`). Prueba de bordes (§7).
3. **Titular y permisos:** resolver el titular por rol (vendedor → él mismo o `403`; admin → bodega o `getSellerName`, que da `404`).
4. **Totales y desglose por producto:** una consulta con `sum()` agrupada por `(product_id, unit_price)` y sus totales, sin anuladas. Redondeo del costo una vez y `profit = total − cost`.
5. **Lista de ventas:** ventas del periodo con sus renglones, `soldBy`, `registeredByAdmin` y `total`/`profit` con la regla de T-18. El recorte por rol se hace en una sola función privada de `cuts.ts`, que quita las llaves de costo y ganancia cuando el actor no es administrador.
6. **Ruta:** `backend/app/api/cuts/route.ts` con `handle` y `requireRole(request, 'admin', 'vendedor')`. Lee `holderId`, `period` y `date` de la URL, valida el `holderId` con `UUID` y llama a `getCashCut`. Sin lógica de negocio.
7. **Pruebas** en `backend/tests/cuts.test.ts` (§7), creando ventas con `createSale` y fijando `sold_at`/`voided_at` en los datos de prueba. Limpieza con `cleanupSales`.

## 6. Criterios de aceptación

- [ ] `GET /api/cuts` como administrador con `holderId` de un vendedor y `period=week` devuelve `200` con `holder`, `period` (lunes a domingo), `totals`, `products` y `sales`.
- [ ] Sin `holderId`, el administrador recibe el corte de la bodega (`holder: null`), solo con ventas de titular `null`.
- [ ] Un vendedor sin `holderId` recibe su corte. Con el `holderId` de otro vendedor recibe `403`.
- [ ] El administrador recibe el corte de un vendedor desactivado. Un `holderId` que no es de un vendedor da `404`.
- [ ] Una venta del administrador desde el stock de un vendedor aparece en el corte de ese vendedor con `registeredByAdmin: true`. Las del vendedor llevan `false`.
- [ ] Una venta a las 23:59:59 hora de México cae en ese día. Una a las 00:00:00 del día siguiente, no.
- [ ] Una venta del domingo cae en la semana que empezó el lunes anterior. Una del lunes siguiente, no.
- [ ] Las ventas del 31 de un mes no entran en el corte del mes siguiente, y viceversa.
- [ ] Sin `period` el corte es de un día. Sin `date`, de hoy en hora de México.
- [ ] `period=year`, `date=2026-13-01`, `date=2026-02-30` y `date=04/11/2026` dan `422`. Un `holderId` que no es UUID también.
- [ ] Una venta con `voided_at` no cuenta en totales, productos ni lista.
- [ ] Ejemplo de cifras: 2 piezas a `920.00` con costo `700.0000` dan `total "1840.00"`, `cost "1400.00"` y `profit "440.00"`.
- [ ] Un costo con 4 decimales se redondea una sola vez: 3 piezas a costo `0.3335` dan `cost "1.00"` (no `0.99` ni `1.02`).
- [ ] Si el precio de un producto cambió dentro del periodo, el desglose trae un renglón por cada precio.
- [ ] La respuesta al vendedor no contiene las llaves `cost`, `unitCost` ni `profit` en ningún nivel (se revisa el JSON completo).
- [ ] Un periodo sin ventas devuelve totales en cero y listas vacías con `200`.
- [ ] `npm run type-check`, `npm test` (con `SUPABASE_SERVICE_ROLE_KEY`) y `tests/architecture.test.ts` pasan.

## 7. Plan de pruebas

`backend/tests/cuts.test.ts`, contra la base real, saltado sin `SUPABASE_SERVICE_ROLE_KEY` como el resto:

- **Datos:** un vendedor `test-auth-` con piezas dejadas (con precio y costo con envío propios) y ventas creadas con `createSale` como vendedor y como administrador. Para los bordes, se actualiza `direct_sales.sold_at` de la venta de prueba a instantes fijos (por ejemplo `2026-11-08T05:59:59Z` = domingo 23:59:59 en México).
- **Casos:** permisos por rol; bodega; desactivado; marca `registeredByAdmin`; bordes de día, semana y mes; anuladas (se fija `voided_at` a mano); cifras y redondeo; dos precios de un mismo producto; recorte del vendedor (recorrer el JSON buscando las llaves prohibidas); periodo vacío; `422` de parámetros.
- **Limpieza:** `cleanupSales()` y `cleanupTestData()` de `tests/helpers/users.ts`.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Zona horaria del servidor distinta a México | El rango se calcula en SQL con `AT TIME ZONE 'America/Mexico_City'`; nunca con la hora local de Node. |
| Cambio de horario de verano | México no tiene horario de verano desde 2022; aun así, `AT TIME ZONE` con el nombre de la zona lo resolvería. |
| `round()` de Postgres es «mitad lejos de cero» | Solo se aplica a costos `≥ 0`, donde coincide con «mitad hacia arriba». |
| Muchas ventas en un mes hacen pesada la lista | El índice `(holder_profile_id, sold_at)` cubre el filtro. Si T-21 mide lentitud, se pagina la lista en otro spec. |
| El nombre o la foto del producto cambiaron después de la venta | El corte muestra los actuales. El precio y el costo sí son los de la venta. |

## 9. Decisiones

- **Sí:** el corte es por titular (`holder_profile_id`), y las ventas que el administrador registró desde el stock de un vendedor cuentan en el corte de ese vendedor con la marca `registeredByAdmin` (decisión del usuario). Cierra la pregunta abierta en HU-17.
- **No:** filtrar solo por `sold_by`. Lo vendido del stock de Luis por el administrador no aparecería en ningún corte de vendedor.
- **Sí:** periodos calendario (día, semana de lunes a domingo, mes) alrededor de una fecha de referencia, en hora de México (decisión del usuario).
- **No:** rango libre desde/hasta. Los botones Día, Semana y Mes tendrían que calcular rangos en el frontend.
- **Sí:** calcular el corte cada vez, sin guardarlo (decisión del usuario). Sale de las mismas ventas sin capturar nada (RF-30).
- **No:** reutilizar la tabla heredada `cuts`. Exige `client_id` y es del distribuidor.
- **No:** tabla nueva de cortes guardados. Si entra «Enviar corte al administrador», ese spec la agrega.
- **Sí:** el corte de la bodega con el mismo endpoint, solo para el administrador (decisión del usuario). HU-19 decide si lo muestra.
- **Sí:** módulo nuevo `src/cuts/` con alias `@cuts` (decisión del usuario). M4b crece ahí y `@sales` se queda con registrar ventas.
- **Sí:** respuesta con totales, desglose por producto y lista de ventas con su marca (decisión del usuario).
- **Sí:** el administrador puede pedir el corte de un vendedor desactivado (decisión del usuario). Sus ventas son historial.
- **Sí:** el vendedor puede pedir cualquier fecha (decisión del usuario). HU-20 decide si la pantalla lo ofrece.
- **Sí:** desglose agrupado por producto **y precio de venta**. Un producto con dos precios en el periodo no promedia el precio.
- **Sí:** `profit` del corte = `total − cost` redondeado una vez. Manda sobre la suma de las ganancias por venta.
- **Sí:** sin migración. El índice `(holder_profile_id, sold_at)` de T-18 ya cubre la consulta.

## Lo que **no** entra en este spec

- Pantallas de corte (HU-19, HU-20) y su verificación de tiempos (T-21).
- Corte para casa y «para cubrir envíos» (M4b).
- Guardar, enviar o cobrar cortes, y la tabla heredada `cuts`.
- Anular ventas, crédito, forma de pago, exportar y más vendidos.
- Migraciones y cambios en el seed.
