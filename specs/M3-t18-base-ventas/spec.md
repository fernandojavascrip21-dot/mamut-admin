# Spec técnico — T-18 · Base de ventas: registrar una venta que descuenta el stock (backend)

> **Estado:** Implementado
> **Depende de:** M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`) — `insertMovements` y el signo de `direct_sale`; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — `money.ts` y la regla de redondeo; M2-t10-base-vendedores (`specs/M2-t10-base-vendedores/spec.md`) — `vendor_stock.unit_price`/`unit_cost_with_shipping`; M2-hu11-dejar-a-vendedor (`specs/M2-hu11-dejar-a-vendedor/spec.md`) — patrón de idempotencia por `requestId` y saldos antes → después leídos de los movimientos
> **Fecha:** 2026-11-03
> **Objetivo:** que el backend registre en una sola transacción una venta de uno o varios productos, de la bodega o del stock de un vendedor, con el precio y el costo del momento, y que el stock baje por movimientos `direct_sale`.

Fuentes:

- **Jira:** tarea `SCRUM-47 · T-18`, épica `SCRUM-8 · M3 · Ventas`. Requerimientos RF-10, RF-21, RF-02, RNF-04, RNF-05. La consumen HU-16 (`SCRUM-50`) y HU-17 (`SCRUM-51`).
- **Código:** `backend/src/db/schema.ts` (`direct_sales`, `direct_sale_items`, `stock_movements`, `vendor_stock`), `backend/src/stock/` (`insertMovements`, `balanceUpTo`, `movementsOfRequest`), `backend/src/deliveries/deliveries.ts` (patrón de `findReplay` y carrera por índice único), `backend/src/lib/money.ts` y `supabase/migrations/20261030000000_stock_movements_request_id.sql`.
- **Decisiones del usuario del 2026-11-03** (§9).

## 1. Alcance

**Entra en este spec:**

- **Base:** migración `supabase/migrations/20261103000000_direct_sales_holder_request.sql`, que adapta las tablas heredadas `direct_sales` / `direct_sale_items` y liga los movimientos con su venta (§4).
- **Backend:**
  - Módulo nuevo `backend/src/sales/` (`index.ts`, `constants.ts`, `sales.ts`) con alias `@sales`, y los casos de uso `createSale` y `getSale`.
  - `POST /api/sales` (vendedor y administrador) y `GET /api/sales/:requestId` (resumen de «Venta confirmada», sobrevive a una recarga).
  - En `@stock`: `NewStockMovement.directSaleId` y la lectura `movementsOfSale(directSaleId)` con el stock antes → después de cada renglón.
- **Pruebas** del backend contra la base real (§7), y la limpieza de ventas de prueba en `backend/tests/helpers/users.ts`.

**No entra en este spec:**

- Las pantallas: «Vender», «Carrito» y «Venta confirmada» (HU-14 a HU-17).
- Anular una venta (`direct_sale_void`), el aviso de baja existencia (HU-18) y los cortes (M4a/M4b).
- Listas o historiales de ventas (p. ej. «Vendió hoy»).
- Forma de pago, crédito (RF-13), precio especial (RF-12) y nota del comprador.
- Cambios en `supabase/seed.sql`.
- La tabla `sales` heredada (ventas a consignación de `clients`): no se toca.

## 2. Reglas de negocio

- **Quién vende y de qué stock:**
  - Un **vendedor** vende solo de su stock (`vendor_stock`, `holder_profile_id = su id`). Si manda `holderId` distinto de su id, recibe `403`.
  - El **administrador** vende de la bodega (`holderId` ausente o `null`) o del stock de un vendedor **activo** (`holderId` = id del vendedor, HU-17 criterios 2 y 5). Un `holderId` que no es de un vendedor activo da `404`.
  - `direct_sales.sold_by` = quien registró la venta (`ctx.userId`). `direct_sales.holder_profile_id` = de quién es el stock (`null` = bodega). El corte de M4a podrá filtrar por cualquiera de los dos.
  - Una cuenta desactivada no llega al caso de uso: `getAuthContext` responde `401`/`403`.
- **Renglones:**
  - Entre 1 y `MAX_LINES` (50) renglones. Cero renglones da `422`.
  - `qty` entero `> 0` y `≤ MAX_QTY`. `0`, negativo, decimal o texto da `422`.
  - El mismo `productId` dos veces en la venta da `422` «Un producto aparece dos veces en la venta».
  - Un producto archivado se puede vender si el titular tiene piezas. Un producto que no existe da `404`.
- **Precio y costo del momento** (se leen dentro de la transacción y se guardan en `direct_sale_items`):
  - Bodega: `products.price` y `products.unit_cost`.
  - Vendedor: `vendor_stock.unit_price` (si es `null`, `products.price`) y `vendor_stock.unit_cost_with_shipping` (si es `null`, `products.unit_cost`).
  - Si después cambian los precios, la venta guardada no cambia.
- **Stock:**
  - Un movimiento `direct_sale` por renglón, con `qty = −piezas`, `holder_profile_id` = titular y `direct_sale_id` = la venta. Se inserta con `insertMovements`; nunca se escribe `products.stock` ni `vendor_stock.qty`.
  - Si cualquier renglón no alcanza, `insertMovements` lanza `409` «No hay piezas suficientes» y la transacción se revierte: no queda la venta, ningún renglón ni ningún movimiento.
  - Un vendedor que nunca tuvo el producto cae en el mismo `409` (sin fila nueva en `vendor_stock`), como en HU-12.
- **Dinero** (T-08, todo con `backend/src/lib/money.ts`, sin flotantes):
  - `subtotal = qty × unitPrice` en centavos. `total = Σ subtotal`. Ambos exactos.
  - `profit` de un renglón = `qty × (unitPrice − unitCost)`, calculado en diezmilésimas y redondeado a centavos (mitad hacia arriba) al final.
  - `profit` de la venta = suma de los renglones **en diezmilésimas**, redondeada a centavos una sola vez. Puede diferir en un centavo de la suma de los `profit` redondeados; manda el de la venta.
  - Ganancia negativa (precio menor que el costo) se permite y se reporta tal cual.
- **Idempotencia por `requestId`** (UUID, obligatorio):
  - `direct_sales.request_id` es único. Repetir la petición con el mismo titular y los mismos renglones (mismo conjunto `productId`/`qty`, sin importar el orden) responde la venta ya hecha con `200` y no mueve nada.
  - Mismo `requestId` con otro titular u otros renglones, o de otra cuenta vendedora: `409` «Esta venta ya se registró con otros datos.».
  - Dos peticiones iguales a la vez: el índice único deja pasar una y la otra cae en la respuesta de la primera, como `createDelivery`.
- **Lo que ve cada rol** (RF-02, RNF-04):
  - Vendedor: sin `unitCost` ni `profit`, ni en renglones ni en la venta.
  - Administrador: con `unitCost`, `profit` por renglón y `profit` de la venta.
- **`GET /api/sales/:requestId`:** el vendedor solo ve las ventas de su stock (otra da `404`). El administrador ve cualquiera. Un `requestId` que no es UUID da `422`, uno que no existe `404`.

## 3. Endpoints

### `POST /api/sales`

```json
// Petición
{
  "requestId": "6f1c…-uuid",
  "holderId": null,
  "lines": [
    { "productId": 10, "qty": 2 },
    { "productId": 12, "qty": 1 }
  ]
}
```

```json
// 201 (nueva) o 200 (repetida) — respuesta al administrador
{
  "sale": {
    "id": 31,
    "requestId": "6f1c…-uuid",
    "soldAt": "2026-11-03T18:20:11.512Z",
    "soldById": "uuid",
    "holder": null,
    "lines": [
      {
        "productId": 10,
        "name": "Proteína Demo Whey 2 lb",
        "image": null,
        "qty": 2,
        "unitPrice": "450.00",
        "subtotal": "900.00",
        "stock": { "before": 4, "after": 2 },
        "unitCost": "300.5000",
        "profit": "299.00"
      }
    ],
    "total": "1150.00",
    "profit": "379.00"
  },
  "replayed": false
}
```

- `holder`: `null` para la bodega, o `{ "id", "fullName" }` del vendedor.
- Al vendedor se le responde lo mismo **sin** `unitCost` ni `profit`. No es un campo vacío: la llave no viene.
- `image` vacía responde `null`, como en HU-09.
- `stock.before`/`after` son los del titular en ese producto y salen de los movimientos, no de la caché actual.

| Caso | Status | `error.message` |
| --- | --- | --- |
| Sin sesión / cuenta desactivada | 401 / 403 | Los de `requireAuth` |
| Rol `client` | 403 | El de `requireRole` |
| Vendedor con `holderId` ajeno | 403 | El de `forbidden()` |
| `requestId` ausente o no UUID, `lines` vacío o de más de 50, `qty` inválida, producto repetido, `holderId` no UUID | 422 | El de cada campo |
| Producto inexistente; `holderId` que no es de un vendedor activo | 404 | El de `notFound()` |
| Alguna pieza no alcanza | 409 | «No hay piezas suficientes» |
| `requestId` usado con otros datos | 409 | `SALE_MISMATCH` |

### `GET /api/sales/:requestId`

Responde `200` con `{ "sale": … }`, el mismo objeto del POST y con el mismo recorte por rol. `404` si no existe o si un vendedor pide la venta de otro stock. `422` si `requestId` no es UUID.

## 4. Modelo de datos

Migración `supabase/migrations/20261103000000_direct_sales_holder_request.sql`:

```sql
-- Guardia: la v1 empieza a usar direct_sales. Si ya trae filas del proyecto anterior,
-- holder_profile_id null las haría pasar por ventas de bodega: se detiene la migración.
do $$ begin
  if exists (select 1 from public.direct_sales) then
    raise exception 'direct_sales tiene filas heredadas: revisar antes de migrar (spec M3-t18 §8)';
  end if;
end $$;

alter table public.direct_sales
  add column holder_profile_id uuid references public.profiles(id) on delete restrict, -- null = bodega
  add column request_id uuid;

create unique index direct_sales_request_id_key
  on public.direct_sales (request_id) where request_id is not null;
create index direct_sales_holder_sold_at_idx
  on public.direct_sales (holder_profile_id, sold_at desc);

alter table public.direct_sale_items
  add constraint direct_sale_items_sale_product_key unique (direct_sale_id, product_id);

alter table public.stock_movements
  add column direct_sale_id bigint references public.direct_sales(id) on delete restrict,
  add constraint stock_movements_direct_sale_type_check
    check (direct_sale_id is null or type in ('direct_sale', 'direct_sale_void'));

create unique index stock_movements_direct_sale_product_key
  on public.stock_movements (direct_sale_id, product_id)
  where type = 'direct_sale';
```

- Las columnas heredadas de crédito se quedan con sus valores por defecto: `on_credit = false`, `payment_status = 'paid'`, `payment_method`, `debtor_id` y `buyer_note` en `null`.
- Los movimientos de venta llevan `request_id = null`. El índice `stock_movements_request_holder_key` de HU-11 no cambia.
- `direct_sale_items.unit_price` (`numeric(10,2)`) y `unit_cost` (`numeric(10,4)`) ya tienen las escalas de T-08.
- Tras `npm run db:reset`, con `backend/.env` en LOCAL: `npm run db:pull`, los dos fixups de `CLAUDE.md` y borrar los archivos que genera Drizzle (como HU-11).

Tipos del módulo (en `backend/src/sales/sales.ts`, exportados por `index.ts`):

```ts
export interface CreateSaleInput {
  requestId: string
  holderId: string | null        // null = bodega; para un vendedor siempre es su id
  lines: { productId: number; qty: number }[]
}

export interface SaleLine {
  productId: number
  name: string
  image: string | null
  qty: number
  unitPrice: string
  subtotal: string
  stock: { before: number; after: number }
  unitCost?: string              // solo administrador
  profit?: string                // solo administrador
}

export interface Sale {
  id: number
  requestId: string
  soldAt: string
  soldById: string
  holder: { id: string; fullName: string } | null
  lines: SaleLine[]
  total: string
  profit?: string                // solo administrador
}
```

En `backend/src/stock/`:

- `NewStockMovement.directSaleId?: number | null`, que `insertMovements` pasa a la fila.
- `movementsOfSale(directSaleId)` en `holdings.ts`: los movimientos `direct_sale` de esa venta con `before`/`after` por producto, con el mismo `balanceUpTo` que usa `movementsOfRequest`.

`backend/src/sales/constants.ts`: `MAX_LINES = 50`, `MAX_QTY`, `SALE_MISMATCH = 'Esta venta ya se registró con otros datos.'` y `DUPLICATE_PRODUCT = 'Un producto aparece dos veces en la venta'`.

## 5. Plan de implementación

1. **Base.**
   - Escribir la migración de §4 y correr `npm run db:reset`.
   - Con `backend/.env` en LOCAL, `npm run db:pull`, los dos fixups y borrar los archivos de Drizzle.
   - En producción, solo leer `select count(*) from direct_sales`, **sin aplicar la migración**. Si no es 0, parar y decidir con el usuario (§8).
   - `npm run type-check` pasa.
2. **Stock.**
   - Agregar `directSaleId` a `NewStockMovement`/`insertMovements` y `movementsOfSale` a `holdings.ts`, exportados en `stock/index.ts`.
   - `npm test` sigue pasando (`deliveries`, `returns`, `stock-movements`).
3. **Módulo `sales`.**
   - Crear `src/sales/` (`index.ts`, `constants.ts`, `sales.ts`) y agregar el alias `@sales` a `backend/tsconfig.json`.
   - `createSale(input, ctx)`: validar, buscar la repetición, y luego en un `withTransaction`: bloquear los saldos del titular con `lockRows`, leer precio y costo, insertar `direct_sales`, `direct_sale_items` y los movimientos con `insertMovements`. Cubre la carrera por índice único con `isUniqueViolation`, como `createDelivery`.
   - `getSale(requestId, ctx)` y la función que recorta `unitCost`/`profit` según el rol.
   - `npm run type-check` y `architecture.test.ts` pasan: `sales` solo usa `@stock`, `@accounts`, `@products`, `@db/*` y `@lib/*`.
4. **Rutas.**
   - `app/api/sales/route.ts` (POST, `requireRole(request, 'admin', 'vendedor')`) y `app/api/sales/[requestId]/route.ts` (GET), delgadas.
   - Validan con `readJson`, `parseUuid` y los helpers de `handler.ts`, y llaman al caso de uso.
5. **Pruebas.**
   - Crear `backend/tests/sales.test.ts` (§7).
   - Ampliar `cleanupTestData` para borrar, en este orden, los movimientos `direct_sale` de prueba (del más nuevo al más viejo) y luego las `direct_sales` con `sold_by` de una cuenta `test-auth-`. Los renglones se borran en cascada.
   - `npm test` pasa con `SUPABASE_SERVICE_ROLE_KEY` puesta.
6. **Cierre.**
   - Actualizar `specs/README.md`.
   - Actualizar `CLAUDE.md`/`AGENTS.md`: el módulo `src/sales/`, el alias `@sales`, los dos endpoints, y que `direct_sales` ya no es solo del dominio heredado.
   - Comentar el avance en `SCRUM-47` en cada paso, con el patrón de `CLAUDE.md`.
   - Recordar que la migración se aplica a producción antes de desplegar HU-16/HU-17.

## 6. Criterios de aceptación

Por criterio de `SCRUM-47`:

- [x] **1.** `createSale` vive en `src/sales/` (con `index.ts`, `constants.ts` y alias `@sales`). En un solo `withTransaction` guarda la venta, sus renglones y un movimiento `direct_sale` (`qty < 0`) por producto con `insertMovements`. Ningún archivo de `src/sales/` escribe `products.stock` ni `vendor_stock.qty`.
- [x] **2.** Una venta de un vendedor baja su `vendor_stock.qty` y no cambia `products.stock`. Una del administrador con `holderId: null` baja `products.stock`. En los dos casos, `GET /api/stock` baja el total en las piezas vendidas.
- [x] **3.** Cada renglón guarda en `direct_sale_items` el precio y el costo del momento según §2, incluidos los casos con `vendor_stock.unit_price`/`unit_cost_with_shipping` en `null`. Cambiar después el precio del producto no cambia la venta guardada. `subtotal`, `total` y `profit` cuadran con el cálculo en enteros de §2.
- [x] **4.** Si un renglón no alcanza, la respuesta es `409` «No hay piezas suficientes» y no queda ninguna fila nueva en `direct_sales`, `direct_sale_items` ni `stock_movements`, aunque otros renglones sí alcanzaran.
- [x] **5.** Dos peticiones iguales (también simultáneas) dejan una sola venta y sus movimientos. La segunda responde `200` con la misma venta y `replayed: true`. El mismo `requestId` con otros datos da `409`.
- [x] **6.** Un vendedor con `holderId` ajeno recibe `403`. Una cuenta desactivada recibe `401`/`403`. `qty` `0`, negativa, decimal o texto, cero renglones, más de 50 renglones y un producto repetido dan `422`.
- [x] **7.** La respuesta al vendedor (POST y GET) no trae las llaves `unitCost` ni `profit`. La del administrador sí las trae.
- [x] **8.** La migración está en `supabase/migrations/` y pasa `npm run db:reset`. `backend/tests/sales.test.ts` cubre los puntos 1 a 7 contra la base real.

Además:

- [x] El administrador puede vender del stock de un vendedor activo (`sold_by` = admin, `holder_profile_id` = vendedor). Con un vendedor desactivado o un id que no es de vendedor, recibe `404`.
- [x] Un producto archivado con piezas se vende. Un producto inexistente da `404`.
- [x] `GET /api/sales/:requestId` devuelve la misma venta tras la recarga, con `stock.before`/`after` iguales a los del POST. Un vendedor que pide una venta de otro stock recibe `404`.
- [x] Un movimiento con `direct_sale_id` y otro tipo es rechazado por la base (`stock_movements_direct_sale_type_check`).
- [x] `npm run type-check` y `npm test` pasan, incluidos `architecture.test.ts`, `deliveries.test.ts` y `returns.test.ts`.

## 7. Plan de pruebas

**`backend/tests/sales.test.ts`** (contra la base local; cuentas `test-auth-`, productos y movimientos de prueba borrados al terminar):

- **Bodega:** el admin vende 2 de un producto con `initial` 4. `products.stock` queda en 2, hay un `direct_sale` `−2` con `holder` null y `direct_sale_id`, y la respuesta trae `stock: { before: 4, after: 2 }`.
- **Vendedor:** tras un `delivery` de 6 al vendedor de prueba, el vendedor vende 2. Su `vendor_stock.qty` queda en 4 y la bodega no cambia.
- **Varios productos:** una venta con dos productos deja dos renglones y dos movimientos con el mismo `direct_sale_id`.
- **Admin a nombre de un vendedor:** `sold_by` es el admin, `holder_profile_id` el vendedor, y baja el stock del vendedor.
- **Precios:**
  - Vendedor con precio y costo propios.
  - Vendedor con los dos en `null`: usa los generales.
  - Bodega.
  - Un costo de 4 decimales (`"10.1235"` × 3) da la ganancia redondeada una sola vez.
  - Editar el producto después no cambia el GET.
- **Atomicidad:** con un renglón que alcanza y otro que no, `409` y los conteos de las tres tablas no cambian.
- **Idempotencia:**
  - Repetir con los renglones en otro orden da `200` y `replayed: true`.
  - Dos peticiones simultáneas con `Promise.all` dejan una sola venta.
  - Otro `qty` u otro titular dan `409`.
  - El `requestId` de otro vendedor da `409`.
- **Validaciones `422`:** `qty` 0, −1, 1.5 y `"2"`; `lines` vacío y de 51; producto repetido; `requestId` ausente o no UUID.
- **Permisos:**
  - Vendedor con `holderId` de otro: `403`.
  - Sin token: `401`.
  - Cuenta desactivada: `401`/`403`.
  - Admin con `holderId` de un vendedor desactivado o del propio admin: `404`.
- **Recorte por rol:** el POST y el GET del vendedor no tienen `unitCost` ni `profit`, y los del admin sí.
- **GET:** el resumen es igual al POST, `404` para otro vendedor y para un `requestId` que no existe, `422` para uno inválido.
- **Base:** insertar a mano un movimiento `delivery` con `direct_sale_id` falla por el check.

Además, `deliveries.test.ts`, `returns.test.ts` y `stock-movements.test.ts` siguen pasando con `directSaleId`, y `architecture.test.ts` cubre `sales`.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `direct_sales` ya trae filas del proyecto anterior en producción, y con `holder_profile_id` null pasarían por ventas de bodega | La migración se detiene si la tabla no está vacía, y el paso 1 revisa el conteo en producción antes de aplicarla. Si hay filas, se decide con el usuario antes de seguir |
| Dos ventas a la vez del mismo titular y producto venden más de lo que hay | `lockRows` sobre los saldos del titular dentro de la transacción, y el check `vendor_stock_qty_check`/`products_stock_check` como respaldo (`409`) |
| La ganancia de la venta no cuadra con la suma de los renglones redondeados | Regla explícita en §2: manda la suma en diezmilésimas redondeada una vez; la prueba fija el caso |
| Un reintento llega con otra cuenta o con otros renglones | `findReplay` compara titular, cuenta vendedora y el conjunto de renglones, y responde `409` |
| Las pruebas dejan ventas que bloquean el borrado de productos o movimientos de prueba (FK `restrict`) | `cleanupTestData` borra primero los movimientos `direct_sale` y después las ventas, antes de los productos |
| `schema.ts` queda desfasado si se corre `db:pull` contra producción antes de aplicar la migración | `db:pull` se corre contra LOCAL después de `db:reset`, como HU-11 |
| La migración no está en producción cuando se despliegan HU-16/HU-17 | El cierre del paso 6 lo deja anotado en `SCRUM-47` y en el índice de specs |

## 9. Decisiones

- **Sí:** reusar `direct_sales`/`direct_sale_items` con `holder_profile_id` y `request_id` nuevos (decisión del usuario). Van con el tipo de movimiento `direct_sale` y no dejan tablas muertas. Las columnas de crédito se quedan con sus valores por defecto.
- **No:** tablas nuevas para las ventas. Duplicarían la estructura y dejarían `direct_sales` sin uso.
- **No:** la tabla `sales` heredada. Es de la consignación a `clients`, que la app no usa.
- **Sí:** la idempotencia vive en `direct_sales.request_id` (único), y los movimientos se ligan con la columna nueva `stock_movements.direct_sale_id` y `request_id = null` (decisión del usuario). El índice de HU-11/HU-12 no cambia.
- **No:** cambiar `stock_movements_request_holder_key` para incluir `product_id`. Toca la idempotencia de entregas y retiros, y la venta quedaría ligada solo por un UUID sin FK.
- **Sí:** el administrador puede vender del stock de un vendedor activo. `sold_by` es quien registra y `holder_profile_id` es de quién es el stock (decisión del usuario). Lo piden los criterios 2 y 5 de HU-17.
- **No:** guardar la forma de pago (decisión del usuario). No la pide ningún requerimiento, y el crédito es de la v2.
- **Sí:** `POST /api/sales` y `GET /api/sales/:requestId` (decisión del usuario). El GET permite recargar «Venta confirmada», como los resúmenes de HU-11/HU-12.
- **No:** listas e historiales de ventas. Llegan con la pantalla que los use.
- **Sí:** un producto repetido en la venta da `422` (decisión del usuario). El carrito ya junta las piezas por producto.
- **Sí:** se vende un producto archivado si el titular tiene piezas (decisión del usuario), como HU-12 con los retiros.
- **Sí:** cada renglón trae el stock antes → después del titular, leído de los movimientos (decisión del usuario). HU-17 lo muestra («Bodega: 4 → 2») y sobrevive a la recarga.
- **Sí:** `unitCost` y `profit` se quitan de la respuesta al vendedor, no se mandan vacíos. RNF-04 pide que no lleguen al vendedor.
- **Sí:** la ganancia de la venta se redondea una sola vez sobre la suma en diezmilésimas. Es la regla de T-08. HU-17 la confirma con el negocio.
- **Sí:** la migración se detiene si `direct_sales` ya tiene filas. Es más seguro que adivinar de qué stock salieron las ventas heredadas.
- **Sí:** un endpoint único `/api/sales` para los dos roles, con `holderId` solo para el administrador. Evita duplicar el caso de uso en `/api/sellers/:id/sales`.
- **Sí:** `MAX_LINES = 50` renglones por venta. Sobra para un carrito real y acota la transacción.
- **No:** cambiar el seed. Las pruebas crean sus propios datos.

## Lo que **no** entra en este spec

- Las pantallas de venta (HU-14 a HU-17).
- Anular una venta (`direct_sale_void`).
- Aviso de baja existencia (HU-18) y cortes (M4a/M4b).
- Historiales de ventas y «Vendió hoy».
- Forma de pago, crédito, precio especial y nota del comprador.

Cada uno, si llega, va en su propio spec o en su historia.
