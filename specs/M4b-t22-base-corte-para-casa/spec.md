# Spec técnico — T-22 · Base del corte para casa: costo de fábrica en cada venta (backend)

> **Estado:** Implementado
> **Depende de:** M3-t18-base-ventas (`specs/M3-t18-base-ventas/spec.md`) — `direct_sale_items` con precio y costo del momento, `createSale`; M4a-t20-base-cortes (`specs/M4a-t20-base-cortes/spec.md`) — `GET /api/cuts`, periodo, titular y redondeo; M4a-hu20-mi-corte-vendedor (`specs/M4a-hu20-mi-corte-vendedor/spec.md`) — el vendedor recibe costo y ganancia en el corte con precios; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — dinero como texto y redondeo una sola vez; M2-t10-base-vendedores (`specs/M2-t10-base-vendedores/spec.md`) — `vendor_stock.unit_cost_with_shipping`
> **Fecha:** 2026-11-05
> **Objetivo:** que cada venta guarde también el costo de fábrica del momento y que `GET /api/cuts?type=home` calcule para el administrador el corte para casa de un titular: vendido, costo de fábrica, ganancia real y «para cubrir envíos», con las mismas ventas del corte con precios.
>
> **Nota (2026-11-05):** implementado en el PR #51. La migración se aplicó a producción a mano en el SQL Editor (`db push` no sirve, ver `CLAUDE.md`). Las dos consultas de revisión dieron `0`, y la columna quedó `not null`, `numeric(10,4)` y con su `check`.

Fuentes:

- **Jira:** tarea `SCRUM-58 · T-22`, épica `SCRUM-10 · M4b · Corte para casa`. Requerimientos RF-29, RF-30, RNF-04. La consumen HU-21 (`SCRUM-59`, pantalla del corte para casa) y HU-22 (`SCRUM-60`, resumen del negocio con «Yo»).
- **Código:** `backend/src/sales/sales.ts` (`createSale`: `unitCost: held?.unitCostWithShipping ?? product.unitCost`), `backend/src/cuts/cuts.ts` (`resolveCutPeriod`, `resolveCutHolder`, `salesOf`, consultas de totales, productos y ventas), `backend/app/api/cuts/route.ts`, `backend/src/db/schema.ts` (`direct_sale_items`), `supabase/migrations/20261103000000_direct_sales_holder_request.sql`.
- **Decisiones del usuario del 2026-11-05** (§9). Cierran los dos «Por decidir» de `SCRUM-58`.

## 1. Por qué existe este spec

Hoy `direct_sale_items.unit_cost` guarda un solo costo: el costo con envío del vendedor o, si no tiene uno propio, el de fábrica. Con eso no se sabe el costo de fábrica de una venta de un vendedor con costo con envío propio. El corte para casa (RF-29) necesita los dos costos de cada venta, guardados en el momento de vender, para no releer costos actuales.

## 2. Alcance

**Entra en este spec:**

- **Base:** migración `supabase/migrations/20261105000000_direct_sale_items_factory_unit_cost.sql`, que agrega `direct_sale_items.factory_unit_cost` y rellena las filas que ya existen (§4).
- **Backend:**
  - `createSale` guarda `factory_unit_cost = products.unit_cost` en cada renglón. La respuesta de la venta no cambia.
  - Archivo nuevo `backend/src/cuts/home-cut.ts` con el caso de uso `getHomeCut(input, actor)`, de solo lectura. Reusa `resolveCutPeriod`, `resolveCutHolder` y `salesOf` de `cuts.ts`.
  - Parámetro `type` (`prices` | `home`) en `GET /api/cuts`. La ruta elige `getCashCut` o `getHomeCut`.
  - El corte con precios agrega `type: 'prices'` a su respuesta. Nada más cambia en él.
- **Pruebas** contra la base real: archivos nuevos `backend/tests/sales-factory-cost.test.ts` y `backend/tests/home-cut.test.ts` (§7). Los tests que ya tienen commit no se tocan.

**No entra en este spec:**

- La pantalla del corte para casa (HU-21) y el selector «Tipo de corte», que sigue deshabilitado hasta HU-21.
- El resumen de todo el negocio con «Yo» y el desglose por titular (HU-22). Aquí, sin `holderId`, el corte para casa es solo de la bodega.
- La prueba de cuentas con un ejemplo completo (T-23).
- Exponer el costo de fábrica en `POST /api/sales`, en la venta confirmada o en el corte con precios.
- Cambios en el frontend (modelos de `features/cash-cut/` incluidos). La llave nueva `type` del corte con precios no rompe nada.
- Guardar cortes, anular ventas, crédito, exportar y productos más vendidos.
- Cambios en `supabase/seed.sql` (no tiene ventas).

## 3. Reglas de negocio

- **Costo de fábrica de cada venta:**
  - Al vender, cada renglón guarda `factory_unit_cost = products.unit_cost` del momento, leído de la misma fila bloqueada que ya usa `createSale`.
  - `unit_cost` sigue igual: costo con envío del vendedor, o el de fábrica si no tiene uno propio o si la venta es de la bodega.
  - Sin costo con envío propio, o en la bodega, `unit_cost = factory_unit_cost`, y ese renglón no suma a «para cubrir envíos».
- **Relleno de las ventas que ya existen** (una sola vez, en la migración):
  - Ventas de la bodega (`direct_sales.holder_profile_id is null`): `factory_unit_cost = unit_cost`. Es exacto, porque `unit_cost` ya era el de fábrica del momento.
  - Ventas de un vendedor: `factory_unit_cost = products.unit_cost` actual. Es **aproximado**. Las ventas nuevas guardan el del momento.
- **Quién lo pide:**
  - Solo el **administrador** pide `type=home`. Un vendedor recibe `403`, aun para su propio corte (RNF-04).
  - Titular igual que en T-20: `holderId` ausente = bodega; con `holderId`, cualquier vendedor activo o desactivado; un `holderId` que no es de un vendedor da `404`.
  - `type` ausente = `prices`. Otro valor da `422`.
- **Periodo y ventas que cuentan:** los mismos de T-20 (`period`, `date`, hora de México, `voided_at is null`). Los dos cortes del mismo titular y periodo tienen las mismas ventas, piezas y vendido (RF-30).
- **Dinero** (T-08, sumas en SQL sobre `numeric`, montos como texto):
  - `total` = `Σ qty × unit_price`, exacto a 2 decimales (igual que el corte con precios).
  - `factoryCost` = `round(Σ qty × factory_unit_cost, 2)`: exacto a 4 decimales y redondeado a centavos **una sola vez**, al final, mitad hacia arriba.
  - `realProfit` = `total − factoryCost`. Puede ser negativo.
  - `shippingCover` = `round(Σ qty × unit_cost, 2) − factoryCost`. Es la resta de los dos costos ya redondeados, así que siempre cumple `profit` del corte con precios `+ shippingCover = realProfit`, al centavo.
  - `shippingCover` puede ser negativo si un costo con envío quedó por debajo del de fábrica. Se muestra tal cual, sin recortarlo a cero.
  - Las mismas fórmulas aplican a cada renglón del desglose por producto y a cada venta de la lista.
  - En la lista de ventas, `realProfit` de cada renglón y de cada venta sale con la regla de T-18 (`qty × (unit_price − factory_unit_cost)` en diezmilésimas, redondeado una vez por renglón y por venta). La suma de las ventas puede diferir del total en un centavo por venta; mandan los `totals`.

## 4. Modelo de datos

### Migración `20261105000000_direct_sale_items_factory_unit_cost.sql`

1. `alter table public.direct_sale_items add column factory_unit_cost numeric(10,4);` (nullable mientras se rellena).
2. Relleno: bodega con su propio `unit_cost`; vendedores con `products.unit_cost` actual (§3).
3. `alter column factory_unit_cost set not null` y `add constraint direct_sale_items_factory_unit_cost_check check (factory_unit_cost >= 0)`.

Sin valor por omisión: un `insert` que no lo mande falla, y así ningún renglón nuevo queda sin costo de fábrica. Solo `createSale` inserta en `direct_sale_items`.

Después de `npm run db:reset`, con `backend/.env` en LOCAL: `npm run db:pull`, los fixups de `CLAUDE.md` y borrar los archivos que genera Drizzle (como T-18). `schema.ts` queda con `factoryUnitCost: numeric("factory_unit_cost", { precision: 10, scale: 4 }).notNull()`.

### Respuesta de `GET /api/cuts?type=home`

Parámetros: `type=home`, más los de T-20 (`holderId`, `period`, `date`). Responde `200` con `{ "cut": … }`. Errores: `422` (parámetros), `403` (vendedor), `404` (`holderId` que no es de un vendedor), `401` (sin sesión o desactivado).

```jsonc
// Administrador, corte para casa semanal de un vendedor
{
  "cut": {
    "type": "home",
    "holder": { "id": "a000…0002", "fullName": "Víctor Vendedor" }, // null = bodega
    "period": { "kind": "week", "from": "2026-11-02", "to": "2026-11-08", "timeZone": "America/Mexico_City" },
    "totals": { "salesCount": 2, "units": 2, "total": "1840.00",
                "factoryCost": "1200.00", "realProfit": "640.00", "shippingCover": "200.00" },
    "products": [
      // uno por (producto, precio de venta), igual que el corte con precios
      { "productId": 3, "name": "Proteína Demo Whey 2 lb", "image": null, "unitPrice": "920.00", "units": 2,
        "total": "1840.00", "factoryCost": "1200.00", "realProfit": "640.00", "shippingCover": "200.00" }
    ],
    "sales": [
      // más reciente primero
      { "requestId": "…", "soldAt": "2026-11-04T18:20:11.000Z", "registeredByAdmin": false,
        "soldBy": { "id": "a000…0002", "fullName": "Víctor Vendedor" },
        "total": "920.00", "realProfit": "320.00", "shippingCover": "100.00",
        "lines": [{ "productId": 3, "name": "Proteína Demo Whey 2 lb", "qty": 1, "unitPrice": "920.00",
                    "subtotal": "920.00", "unitCost": "700.0000", "factoryUnitCost": "600.0000",
                    "realProfit": "320.00" }] }
    ]
  }
}
```

- La respuesta no trae las llaves `cost` ni `profit` en ningún nivel. Así un costo no se confunde con el otro.
- **Periodo sin ventas:** totales en cero (`"0.00"`, `units: 0`, `salesCount: 0`), con `products: []` y `sales: []`, igual que el corte con precios.
- **Corte con precios** (`type` ausente o `prices`): la misma respuesta de hoy más `"type": "prices"`.

### Tipos públicos de `@cuts`

En `backend/src/cuts/cuts.ts`: `export type CutType = 'prices' | 'home'`, y `CashCut` gana `type: 'prices'`.

En `backend/src/cuts/home-cut.ts`:

```ts
export interface HomeCutTotals {
  salesCount: number
  units: number
  total: string
  factoryCost: string
  realProfit: string
  shippingCover: string
}

export interface HomeCut {
  type: 'home'
  holder: { id: string; fullName: string } | null
  period: { kind: CutPeriodKind; from: string; to: string; timeZone: string }
  totals: HomeCutTotals
  products: HomeCutProductLine[] // CutProductLine sin cost/profit, con factoryCost, realProfit, shippingCover
  sales: HomeCutSale[]           // CutSale sin profit, con realProfit, shippingCover y lines de §4
}
```

`index.ts` reexporta `home-cut.ts`. Constantes nuevas en `backend/src/cuts/constants.ts`: `CUT_TYPES = ['prices', 'home']`, `DEFAULT_CUT_TYPE = 'prices'` y `INVALID_CUT_TYPE = 'El tipo de corte debe ser prices o home'`. `parseCutType` va en `cuts.ts`, junto a `parseCutPeriod`.

## 5. Plan de implementación

1. **Migración y guardado al vender:** escribir `20261105000000_direct_sale_items_factory_unit_cost.sql` (§4) y correr `npm run db:reset`. Con `backend/.env` en LOCAL: `npm run db:pull`, los fixups y borrar los archivos de Drizzle. En `createSale`, `factoryUnitCost: product.unitCost` en cada renglón: sin esa línea la columna obligatoria rompe la venta y `type-check`. `npm run type-check` pasa.
2. **Pruebas del guardado al vender:** archivo nuevo `backend/tests/sales-factory-cost.test.ts`: vendedor con costo con envío `700` sobre fábrica `600` guarda `700`/`600`; sin costo propio y en bodega, los dos iguales. La respuesta de la venta no trae `factoryUnitCost`.
3. **Tipo de corte:** constantes, `CutType`, `parseCutType` y `type: 'prices'` en `getCashCut`. La ruta lee `type`; con `home` todavía responde lo mismo que hoy. Las pruebas de `cuts.test.ts` siguen pasando.
4. **Esqueleto de `home-cut.ts`:** tipos, `getHomeCut` con el `403` para el vendedor, y titular y periodo resueltos con las funciones de `cuts.ts` (se exportan `salesOf` y lo que falte, sin cambiar su comportamiento). Reexportar en `index.ts`. La ruta llama a `getHomeCut` con `type=home`.
5. **Totales y desglose por producto:** consultas con `sum()` agrupadas como en T-20, con `factoryCost`, `realProfit` y `shippingCover` según §3.
6. **Lista de ventas:** ventas del periodo con renglones, `soldBy`, `registeredByAdmin`, `unitCost`, `factoryUnitCost`, y `realProfit`/`shippingCover` por venta y por renglón.
7. **Pruebas** en `backend/tests/home-cut.test.ts` (§7) y comentario de cierre en `SCRUM-58`.

## 6. Criterios de aceptación

- [x] Tras `npm run db:reset`, `direct_sale_items.factory_unit_cost` existe como `numeric(10,4) not null` con `check (factory_unit_cost >= 0)`.
- [x] Tras aplicar la migración a producción, dan `0` las dos consultas de revisión: filas de bodega con `factory_unit_cost <> unit_cost`, y filas de vendedores con `factory_unit_cost <>` el `products.unit_cost` de su producto.
- [x] Un vendedor con costo con envío `700` vende un producto con costo de fábrica `600`: el renglón guarda `unit_cost = 700.0000` y `factory_unit_cost = 600.0000`.
- [x] Sin costo con envío propio, y en las ventas de la bodega, el renglón guarda `unit_cost = factory_unit_cost`.
- [x] La respuesta de `POST /api/sales` no contiene la llave `factoryUnitCost`.
- [x] `GET /api/cuts?type=home` como administrador con el `holderId` de un vendedor devuelve `200` con `type: "home"`, `holder`, `period`, `totals`, `products` y `sales` en la forma de §4.
- [x] La respuesta con `type=home` no contiene las llaves `cost` ni `profit` en ningún nivel (se revisa el JSON completo).
- [x] Ejemplo de cifras: 2 piezas a `920.00`, con costo con envío `700.0000` y de fábrica `600.0000`, dan `total "1840.00"`, `factoryCost "1200.00"`, `realProfit "640.00"` y `shippingCover "200.00"`.
- [x] Un costo de fábrica de 4 decimales se redondea una sola vez: 3 piezas a `0.3335` dan `factoryCost "1.00"`.
- [x] Para el mismo titular y periodo, `profit` del corte con precios `+ shippingCover` del corte para casa `= realProfit`, al centavo, en los totales y en cada renglón del desglose.
- [x] Para el mismo titular y periodo, los dos cortes tienen los mismos `salesCount`, `units`, `total`, renglones de producto (`productId`, `unitPrice`, `units`, `total`) y `requestId` de ventas.
- [x] Un producto sin costo con envío propio suma `0.00` a `shippingCover`.
- [x] Sin `holderId`, el corte para casa es solo de la bodega (`holder: null`), con `shippingCover "0.00"`.
- [x] Un vendedor que pide `type=home` recibe `403`, con o sin `holderId`.
- [x] `type=otro` da `422`. Sin `type`, la respuesta es el corte con precios con `type: "prices"`.
- [x] Un periodo sin ventas devuelve, con `type=home`, totales en cero y listas vacías con `200`.
- [x] El administrador recibe el corte para casa de un vendedor desactivado. Un `holderId` que no es de un vendedor da `404`.
- [x] `npm run type-check`, `npm test` (con `SUPABASE_SERVICE_ROLE_KEY`), `tests/cuts.test.ts` sin cambios y `tests/architecture.test.ts` pasan.

## 7. Plan de pruebas

Contra la base real, saltadas sin `SUPABASE_SERVICE_ROLE_KEY` como el resto:

- **`backend/tests/sales-factory-cost.test.ts`** (nuevo; `sales.test.ts` no se toca porque ya tiene commit): los dos costos guardados en los tres casos (vendedor con costo propio, vendedor sin él, bodega) y la respuesta sin `factoryUnitCost`.
- **`backend/tests/home-cut.test.ts`** (nuevo):
  - **Datos:** un vendedor `test-auth-` con piezas dejadas con costo con envío propio en un producto y sin él en otro, y ventas creadas con `createSale`. Para el redondeo y los bordes, se fijan `sold_at` y el `products.unit_cost` de productos de prueba.
  - **Casos:** permisos (`403` del vendedor, `404`, desactivado); bodega; cifras del ejemplo; redondeo una sola vez; identidad `profit + shippingCover = realProfit`; mismas ventas que el corte con precios; producto sin costo propio; llaves prohibidas; periodo vacío; `422` de `type`.
  - **Limpieza:** `cleanupSales()` y `cleanupTestData()` de `tests/helpers/users.ts`.
- **Relleno de la migración:** no queda como prueba automática, porque `db:reset` parte de una base vacía y las pruebas corren sobre la base ya migrada. Antes de aplicarla a producción se lee `select count(*) from direct_sale_items`; después se corren las dos consultas de revisión del criterio 2.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Producción tiene ventas de vendedores anteriores a T-22 | Su costo de fábrica es el actual del producto (aproximado). Queda dicho en `SCRUM-58` y en este spec. Las nuevas guardan el del momento. |
| La migración no está en producción cuando se despliega el backend | `createSale` fallaría al insertar. La migración se aplica a producción antes de desplegar, y queda anotado en `SCRUM-58` y en el índice de specs. |
| Un costo con envío por debajo del de fábrica da `shippingCover` negativo | Se devuelve tal cual. Es un dato real del vendedor; HU-21 decide cómo se muestra. |
| `round()` de Postgres es «mitad lejos de cero» | Solo se aplica a costos `≥ 0`, donde coincide con «mitad hacia arriba» (igual que T-20). |
| Se rompe el corte con precios al compartir funciones | `tests/cuts.test.ts` corre sin cambios en el paso 3 y al final. |

## 9. Decisiones

- **Sí:** columna nueva `factory_unit_cost` en `direct_sale_items`, sin tocar `unit_cost` (Jira). Las ventas no se reescriben.
- **Sí:** relleno exacto para la bodega (`unit_cost`) y aproximado para vendedores (costo actual) (decisión del usuario). Ajusta el criterio 1 de `SCRUM-58`, que pedía el costo actual para todas las filas.
- **No:** rellenar todo con el costo actual. Perdería el dato exacto que ya tenían las ventas de la bodega.
- **Sí:** parámetro `type=prices|home` en `GET /api/cuts`, con `prices` por omisión (decisión del usuario). Cierra el primer «Por decidir».
- **No:** endpoint aparte `/api/cuts/home`. Duplica la ruta y la validación.
- **Sí:** el corte con precios queda igual, solo con `type: 'prices'` agregado (decisión del usuario). HU-19 y HU-20 no cambian.
- **Sí:** llaves explícitas `factoryCost`, `realProfit`, `shippingCover` y `factoryUnitCost`, sin `cost`/`profit` (decisión del usuario).
- **No:** reusar `cost`/`profit` con otro sentido según `type`. Un mismo nombre con dos significados se presta a errores en HU-21.
- **Sí:** `shippingCover` = resta de los dos costos ya redondeados (decisión del usuario). Las tres cifras cuadran siempre al centavo.
- **No:** redondear la diferencia de costos. Puede descuadrar un centavo contra los otros totales.
- **Sí:** sin `holderId`, el corte para casa es solo de la bodega; el resumen del negocio va en HU-22 (decisión del usuario). Cierra el segundo «Por decidir».
- **Sí:** cada venta de la lista lleva `realProfit` y `shippingCover`, y cada renglón `unitCost`, `factoryUnitCost` y `realProfit` (decisión del usuario).
- **Sí:** el costo de fábrica solo se guarda al vender; `POST /api/sales` no lo expone (decisión del usuario, RNF-04).
- **Sí:** `getHomeCut` en `src/cuts/home-cut.ts`, reusando periodo y titular de `cuts.ts` (decisión del usuario). `cuts.ts` no crece.
- **Sí:** solo el administrador ve el corte para casa; el vendedor recibe `403` (Jira, RNF-04).
- **Sí:** `shippingCover` negativo se devuelve sin recortar. Recortarlo a cero rompería la identidad de las tres cifras.

## Lo que **no** entra en este spec

- Pantalla del corte para casa y el selector «Tipo de corte» (HU-21).
- Resumen del negocio con «Yo» y desglose por titular (HU-22).
- Prueba de cuentas con un ejemplo completo (T-23).
- Costo de fábrica en `POST /api/sales`, en la venta confirmada o en el corte con precios.
- Cambios en el frontend y en el seed.
- Guardar, enviar o cobrar cortes, anular ventas, crédito, exportar y más vendidos.
