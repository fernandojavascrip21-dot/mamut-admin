# Spec técnico — T-24 · Base del fraccionado: fraccionar un entero en bolsitas en una transacción (backend)

> **Estado:** Implementado
> **Depende de:** M1-t03-tablas-productos-stock (`specs/M1-t03-tablas-productos-stock/spec.md`) — `products.fractionable`, `portion_size`, `parent_product_id` (una bolsita por entero) y los tipos `fraction_out`/`fraction_in`; M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`) — saldos por trigger, `insertMovements` y signos; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — dinero como texto, `money.ts`, sin redondeo silencioso; M3-t18-base-ventas (`specs/M3-t18-base-ventas/spec.md`) — patrón de idempotencia con `request_id` y tabla propia ligada a los movimientos
> **Fecha:** 2026-11-07
> **Objetivo:** que `POST /api/fractions` registre en una sola transacción que se abrió 1 entero de la bodega y salieron N bolsitas (crea o reusa la bolsita, le pone su costo por bolsita y su precio) y que reintentar la misma petición no fraccione dos veces.
>
> **Nota (2026-11-07):** implementado. La migración se aplicó a producción a mano en el SQL Editor y `db:pull` se corrió contra producción. `npm run type-check` y `npm test` pasan (335 pruebas, con `SUPABASE_SERVICE_ROLE_KEY`). Los `403`, `404` y `422` y el `GET` se probaron en el caso de uso; las rutas `app/api/fractions/**` solo se revisaron con `type-check` (§7). Un reintento sin `price` se acepta (§9, opción A).

Fuentes:

- **Jira:** tarea `SCRUM-62 · T-24`, épica `SCRUM-11 · M5 · Fraccionado`. Requerimientos RF-14, RNF-05. La consumen HU-23 (`SCRUM-63`, pantalla «Fraccionar») y HU-24 (`SCRUM-64`, la bolsita en el inventario e historial).
- **Código:** `backend/src/stock/movements.ts` (`insertMovements`), `backend/src/sales/sales.ts` (`createSale`, `findReplay`: patrón de `requestId`), `backend/src/products/products.ts` (`priceBelowCost`, `DUPLICATE_NAME`), `backend/src/lib/money.ts`, `supabase/migrations/20261025000000_mammut_products_and_stock.sql` (columnas del fraccionado), `supabase/migrations/20261030000000_stock_movements_request_id.sql` (índice `stock_movements_request_holder_key`), `supabase/migrations/20261103000000_direct_sales_holder_request.sql` (`direct_sale_id`, el modelo a seguir).
- **Decisiones del usuario del 2026-11-07** (§9). Cierran los tres «Por decidir» de `SCRUM-62`.

## 1. Por qué existe este spec

El esquema del fraccionado existe desde T-03 (`fractionable`, `portion_size`, `parent_product_id`, `fraction_out`/`fraction_in`), pero nada lo usa: el alta de producto solo guarda la casilla. Fraccionar toca dos productos, crea uno la primera vez y calcula un costo que no es exacto, así que necesita su propio caso de uso transaccional antes de la pantalla (HU-23).

El patrón de idempotencia de las entregas no sirve tal cual: el índice `stock_movements_request_holder_key` es único por `(request_id, holder_profile_id)` y los dos movimientos del fraccionado son de la bodega (`holder` null). Por eso el fraccionado tiene su propia tabla con el `request_id`, igual que las ventas.

## 2. Alcance

**Entra en este spec:**

- **Base:** migración `supabase/migrations/20261107000000_fractions.sql` con la tabla `fractions` y la columna `stock_movements.fraction_id` (§4).
- **Backend:**
  - Módulo nuevo `backend/src/fractions/` (`index.ts`, `constants.ts`, `fractions.ts`) con alias `@fractions` en `backend/tsconfig.json`.
  - Caso de uso `createFraction(input, actor)`: bloquea el entero, crea o reusa la bolsita, inserta los dos movimientos y la fila de `fractions` en un solo `withTransaction`.
  - Caso de uso `getFraction(requestId)`, de solo lectura, para releer un fraccionado si se perdió la respuesta.
  - Rutas `backend/app/api/fractions/route.ts` (`POST`) y `backend/app/api/fractions/[requestId]/route.ts` (`GET`), solo administrador.
  - Función nueva `divideMoney` en `backend/src/lib/money.ts`.
  - `backend/src/db/schema.ts` regenerado con `db:pull` y sus fixups de `CLAUDE.md`.
- **Pruebas** contra la base real: archivos nuevos `backend/tests/fractions.test.ts` y `backend/tests/money-divide.test.ts` (§7). Los tests que ya tienen commit no se tocan.

**No entra en este spec:**

- La pantalla «Fraccionar», la vista previa y la entrada desde «Stock general» o la card del producto (HU-23).
- La etiqueta «Fraccionado» en «Productos» y el historial del fraccionado en pantalla (HU-24).
- Fraccionar piezas de un vendedor, o más de 1 entero por operación.
- Deshacer un fraccionado (`fraction_*_void` no existe; una corrección sería un `adjustment`, fuera de este spec).
- Resincronizar la bolsita (nombre, categoría, foto, porción) cuando cambia el entero.
- Cambios en `listProducts`, `GET /api/stock`, entregas, retiros, ventas o cortes. La bolsita ya funciona en ellos por ser un producto normal.
- `divideMoney` en el frontend (`src/app/shared/utils/money.ts`): el frontend no calcula el costo por bolsita.
- Cambios en `supabase/seed.sql`.

## 3. Reglas de negocio

- **Quién y de dónde:**
  - Solo el **administrador** fracciona y relee fraccionados. Un vendedor recibe `403`.
  - Siempre se abre **1 entero de la bodega** y las bolsitas entran a la **bodega**.
- **Qué se puede fraccionar:**
  - `productId` de un producto activo. Inexistente o desactivado → `404`.
  - El producto debe tener `fractionable = true` → si no, `422` «Este producto no se fracciona». Una bolsita tiene `fractionable = false`, así que no se fracciona.
  - El entero sin piezas en bodega → `409` «No hay piezas suficientes» (lo lanza `insertMovements`; no queda nada escrito).
- **Bolsitas que salieron (`portions`):** entero de **2 a 1000**. Decimal, menor o mayor → `422`.
- **La bolsita (producto con `parent_product_id = entero`):**
  - **No existe:** se crea en la misma transacción con nombre `«<nombre del entero> · bolsita <portion_size>»`, la categoría, la foto y el `portion_size` del entero, `fractionable = false`, `stock = 0` y `active = true`. Si el nombre ya lo usa otro producto → `409` «Ya existe un producto con el nombre «…»» y no se escribe nada.
  - **Existe:** se reusa (hay una sola por entero, `products_parent_product_id_key`). Si está desactivada, se **reactiva**. Nombre, categoría, foto y porción **no** se resincronizan.
- **Costo por bolsita:**
  - `portionUnitCost = divideMoney(unitCost del entero, 4, portions)`: entero ÷ bolsitas en unidades enteras, redondeado **una sola vez a 4 decimales, mitad hacia arriba**. Ejemplo: `450.0000 ÷ 7 = 64.2857`.
  - Se guarda en `products.unit_cost` de la bolsita, **sobrescribiendo** el anterior (el del último fraccionado). Las ventas ya guardan su costo del momento, así que no se pierde historia.
  - Si el resultado es `0.0000` (costo del entero demasiado bajo para N bolsitas) → `422`.
  - Los centavos se redondean después, donde ya se hace (cortes, ventas), no aquí.
- **Precio de la bolsita (`price`, hasta 2 decimales, `requireMoney` escala 2):**
  - **Obligatorio** cuando la bolsita se crea; sin él → `422`.
  - **Opcional** cuando se reusa: si viene, sobrescribe `products.price`; si no, se queda el actual.
  - Precio (el nuevo o el que se queda) menor que el costo por bolsita → `422` con el mismo `PRICE_BELOW_COST` de HU-04.
- **Movimientos (signos de T-07), los dos con `holder_profile_id = null` y el mismo `fraction_id`:**
  - `fraction_out`, `qty = -1`, en el entero.
  - `fraction_in`, `qty = +portions`, en la bolsita.
- **Idempotencia (`requestId`, UUID, patrón de ventas):**
  - Primera vez → `201`.
  - Mismo `requestId` con el mismo `productId` y `portions` → `200` con el mismo fraccionado y `replayed: true`; no se mueve nada. Si la repetición trae `price`, debe ser igual al `portion_price` guardado; si no lo trae, no se compara (la tabla guarda el precio que quedó, no el que mandó el cliente).
  - Mismo `requestId` con otro `productId`, otras `portions` u otro `price` (cuando viene) → `409` «Este fraccionado ya se registró con otros datos.».
  - Dos peticiones iguales a la vez: el índice único de `fractions.request_id` deja pasar una; la otra cae en la respuesta de repetición.
- **Concurrencia:** el entero se bloquea con `lockRows` (`select … for update`) antes de buscar o crear la bolsita, así que dos primeros fraccionados del mismo entero no crean dos bolsitas.

## 4. Modelo de datos

Migración `supabase/migrations/20261107000000_fractions.sql` (la RLS la activa sola el trigger `ensure_rls` del baseline; el backend entra con `bypassrls`):

```sql
create table public.fractions (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  product_id bigint not null references public.products(id) on delete restrict,         -- el entero
  portion_product_id bigint not null references public.products(id) on delete restrict, -- la bolsita
  portions integer not null check (portions between 2 and 1000),
  whole_unit_cost numeric(10,4) not null,                       -- costo del entero en ese momento
  portion_unit_cost numeric(10,4) not null check (portion_unit_cost > 0),
  portion_price numeric(10,2) not null check (portion_price > 0), -- precio de la bolsita tras el fraccionado
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint fractions_request_id_key unique (request_id),
  constraint fractions_distinct_products check (product_id <> portion_product_id)
);

create index fractions_product_created_at_idx on public.fractions (product_id, created_at desc);

alter table public.stock_movements
  add column fraction_id bigint references public.fractions(id) on delete restrict,
  add constraint stock_movements_fraction_type_check
    check (fraction_id is null or type in ('fraction_out', 'fraction_in'));
```

Tipos del backend (`backend/src/fractions/fractions.ts` declara solo funciones; los tipos van en un archivo aparte del módulo, p. ej. `backend/src/fractions/types.ts`, y se exportan desde `index.ts`):

```ts
export interface CreateFractionInput {
  requestId: string        // UUID en minúsculas
  productId: number        // el entero
  portions: number         // 2..1000
  price: string | null     // escala 2; obligatorio si la bolsita no existe
}

export interface Fraction {
  id: number
  requestId: string
  portions: number
  wholeUnitCost: string    // "450.0000"
  portionUnitCost: string  // "64.2857"
  createdAt: string
  product: { id: number; name: string; stock: number }          // el entero; stock = piezas en bodega
  portionProduct: {
    id: number
    name: string
    created: boolean       // este fraccionado creó la bolsita (es su fraccionado más antiguo)
    price: string          // "85.00"
    stock: number          // piezas en bodega
  }
}
```

Respuestas:

- `POST /api/fractions` con `{ requestId, productId, portions, price? }` → `201 { fraction, replayed: false }` o `200 { fraction, replayed: true }`.
- `GET /api/fractions/[requestId]` → `200 { fraction }`; `404` si no existe; `422` si no es UUID.
- `stock` es el saldo de la bodega **leído al responder**: en la primera respuesta, justo después del fraccionado; en una repetición o un `GET`, el actual. El «antes» de HU-23 es `product.stock + 1` y `portionProduct.stock − portions` solo en la primera respuesta.

`backend/src/lib/money.ts` (mismo estilo que `toMinorUnits`/`fromMinorUnits`):

```ts
// value ÷ divisor a la misma escala, en unidades enteras, mitad hacia arriba. Solo valores >= 0.
export function divideMoney(value: string, scale: MoneyScale, divisor: number): string
```

Constantes nuevas en `backend/src/fractions/constants.ts`: `MIN_PORTIONS = 2`, `MAX_PORTIONS = 1000` y los mensajes `NOT_FRACTIONABLE`, `FRACTION_MISMATCH`, `PRICE_REQUIRED` y `PORTION_COST_ZERO`. El nombre derivado de la bolsita lo arma una función de `fractions.ts`.

## 5. Plan de implementación

1. **Migración.** Escribir `supabase/migrations/20261107000000_fractions.sql` (§4) y comprobarla con `npm run db:reset`. Aplicarla a producción a mano en el SQL Editor (revisión de solo lectura: `fractions` y `stock_movements.fraction_id` no existen; luego la migración dentro de `begin; … commit;`). Correr `npm run db:pull` en `backend/` y aplicar los fixups de `CLAUDE.md`. `npm run type-check` y `npm test` pasan sin cambios.
2. **`divideMoney`.** Agregarla a `backend/src/lib/money.ts` y escribir `backend/tests/money-divide.test.ts` (exacta, mitad hacia arriba, escala 2 y 4, divisor no entero o `< 1` lanza).
3. **Módulo `fractions`.** Crear `backend/src/fractions/` (`index.ts`, `constants.ts`, tipos y `fractions.ts` vacío) y el alias `@fractions` en `backend/tsconfig.json`. `npm run type-check` pasa.
4. **`createFraction`.** En `withTransaction`: `lockRows` del entero, validaciones (§3), buscar o crear y reactivar la bolsita, costo y precio, insertar `fractions` y luego los dos movimientos con `insertMovements` (`fractionId`). Repetición con `findReplay` y captura de `isUniqueViolation` como en ventas; nombre duplicado de la bolsita → `409`. `insertMovements`/`NewStockMovement` aceptan el campo nuevo opcional `fractionId`.
5. **`getFraction` y rutas.** `app/api/fractions/route.ts` (`POST`: `requireRole(request, 'admin')`, valida `requestId`, `productId`, `portions` con `requireNumber` y `price` con `requireMoney` si viene) y `app/api/fractions/[requestId]/route.ts` (`GET`). Sin lógica de negocio en las rutas.
6. **Pruebas.** Escribir `backend/tests/fractions.test.ts` (§7) y correr `npm run type-check` y `npm test` con `SUPABASE_SERVICE_ROLE_KEY`.
7. **Índice de specs.** Actualizar `specs/README.md` (estado y relaciones) y comentar el avance en `SCRUM-62`.

## 6. Criterios de aceptación

- [x] La migración pasa con `npm run db:reset` y en producción deja `fractions` con `fractions_request_id_key` y `stock_movements.fraction_id` con `stock_movements_fraction_type_check`.
- [x] Fraccionar un entero con 3 piezas en bodega en 7 bolsitas deja el entero en 2 y la bolsita en +7, con un `fraction_out` (`-1`) y un `fraction_in` (`+7`), los dos de la bodega y con el mismo `fraction_id` (criterio 1 de `SCRUM-62`).
- [x] Con `unitCost = 450.0000` y 7 bolsitas, la respuesta trae `portionUnitCost = "64.2857"` y la bolsita queda con `unit_cost = 64.2857` (criterio 2).
- [x] El primer fraccionado crea la bolsita «<entero> · bolsita <porción>» con la categoría, la foto y la porción del entero, `fractionable = false`, `parent_product_id = entero` y `portionProduct.created = true`.
- [x] Un segundo fraccionado del mismo entero reusa la misma bolsita (`created = false`), sobrescribe su costo con el nuevo y, sin `price`, conserva el precio anterior (criterio 3).
- [x] Una bolsita desactivada se reactiva al fraccionar su entero.
- [x] Entero con 0 piezas en bodega → `409` sin filas nuevas en `fractions`, `stock_movements` ni `products` (criterio 4).
- [x] Producto con `fractionable = false` → `422`; producto inexistente o desactivado → `404`; vendedor → `403` (criterio 4).
- [x] `portions` de `1`, `1001` o `2.5` → `422`; sin `price` al crear la bolsita → `422`; precio menor que el costo por bolsita → `422`; costo por bolsita `0.0000` → `422`; nombre de bolsita ocupado por otro producto → `409`.
- [x] Reintentar con el mismo `requestId` y los mismos datos responde `200`, `replayed: true` y no mueve piezas; con otros datos responde `409` (criterio 5).
- [x] `GET /api/fractions/[requestId]` devuelve el fraccionado; uno inexistente da `404`.
- [x] `npm run type-check`, `npm test` (con `SUPABASE_SERVICE_ROLE_KEY`) y `tests/architecture.test.ts` pasan.

## 7. Plan de pruebas

Contra la base real, saltadas sin `SUPABASE_SERVICE_ROLE_KEY` como el resto:

- **`backend/tests/money-divide.test.ts`** (nuevo; el test de `money.ts` que ya tiene commit no se toca): división exacta, redondeo mitad hacia arriba (`450.0000 ÷ 7`, un caso que cae justo en la mitad), escala 2 y 4, y divisor inválido.
- **`backend/tests/fractions.test.ts`** (nuevo):
  - **Datos:** productos de prueba con prefijo `test-frac-` + `Date.now()`, creados con `createProduct` (`fractionable = true`, `portionSize`), y un vendedor `test-auth-` para el `403`.
  - **Casos:** los de §6, uno por criterio; la repetición concurrente (dos `createFraction` iguales con `Promise.all`) deja un solo fraccionado.
  - **Limpieza:** borra los movimientos de los productos de prueba del más nuevo al más viejo (revierte saldos), luego `fractions`, luego la bolsita y después el entero (FK `restrict`), y `cleanupTestData()` de `tests/helpers/users.ts` para el vendedor.
- **Arquitectura:** `tests/architecture.test.ts` sigue pasando sin cambios. Su mapa `ALIASES` no lista `@fractions`, así que no revisa ese alias; agregarlo sería tocar un test con commit y requiere aprobación del usuario antes de hacerlo (`CLAUDE.md` global).

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La migración no está en producción cuando se despliega el backend | `createFraction` fallaría al insertar en `fractions`. Se aplica a producción en el paso 1, antes de escribir el código, y queda anotado en `SCRUM-62` y en el índice. |
| `db push` no sirve en este proyecto (historia compartida con el repo hermano) | Se aplica a mano en el SQL Editor, como dice `CLAUDE.md`. Nunca `migration repair` ni `db pull` de Supabase. |
| El costo por bolsita no es exacto y la suma de N bolsitas no da el costo del entero | Se guarda a 4 decimales una sola vez; la diferencia es de diezmilésimas por bolsita. Los cortes redondean a centavos al final, como ya hacen. |
| Sobrescribir el costo de la bolsita cambia el costo de las piezas que ya había | Es la decisión tomada (§9). Las ventas ya hechas guardaron su costo del momento; solo cambian las futuras. |
| Dos primeros fraccionados simultáneos del mismo entero | `lockRows` del entero los serializa; además `products_parent_product_id_key` impide una segunda bolsita. |
| Nombre de la bolsita ya usado por otro producto | `409` con el nombre en el mensaje; el administrador renombra el otro producto. |
| Un reintento sin `price` de un fraccionado que sí lo mandó se acepta (§3 pedía `409`) | `fractions` guarda el precio que quedó, no el que mandó el cliente. Distinguirlo pide una columna y otra migración en producción, por un borde casi inexistente; se acepta la diferencia (§9). Con `price`, la comparación sí se hace. |
| `@fractions` sin revisión en `architecture.test.ts` | Los imports se escriben con el alias igual; se pide aprobación para agregarlo al mapa. |

## 9. Decisiones

- **Sí:** tabla `fractions` con `request_id` único y `stock_movements.fraction_id`, como `direct_sales`/`direct_sale_id` (decisión del usuario). Da idempotencia y guarda bolsitas, costo y precio del momento para el historial de HU-24.
- **No:** ampliar el índice `stock_movements_request_holder_key` de HU-11. Toca una migración ajena y no guarda N ni el costo.
- **No:** poner el `request_id` solo en el `fraction_out`. Frágil y sin historial del costo.
- **Sí:** costo por bolsita a 4 decimales, mitad hacia arriba, una sola vez (decisión del usuario). Cabe en `numeric(10,4)` y los centavos se redondean al final, como en T-08.
- **No:** guardar el costo ya en centavos. Pierde precisión al multiplicar por muchas bolsitas.
- **No:** rechazar divisiones no exactas. Casi ninguna lo es; estorbaría al administrador.
- **Sí:** al reusar la bolsita, su costo es el del último fraccionado (decisión del usuario). Simple, y las ventas conservan su costo del momento.
- **No:** promedio ponderado. Más reglas y otro redondeo para poca diferencia.
- **Sí:** precio obligatorio al crear la bolsita y opcional al reusarla (decisión del usuario).
- **Sí:** nombre derivado «<entero> · bolsita <portion_size>»; si está ocupado, `409` (decisión del usuario). `products.name` es único sin mayúsculas ni espacios.
- **Sí:** solo bodega y 1 entero por operación (decisión del usuario, igual que el mockup). Cierra dos «Por decidir» de `SCRUM-62`.
- **Sí:** precio menor que el costo por bolsita → `422` con `PRICE_BELOW_COST` (decisión del usuario), igual que HU-04 y HU-06.
- **Sí:** módulo propio `src/fractions/` con `POST /api/fractions` y `GET /api/fractions/[requestId]` (decisión del usuario). Escribe en `products` y `stock` en una transacción, como `sales`.
- **No:** `fractionProduct` dentro de `src/products/`. Mezclaría el catálogo con un flujo de inventario.
- **Sí:** `portions` entero de 2 a 1000 (decisión del usuario). Una bolsita no es fraccionar; el tope evita errores de dedo.
- **Sí:** una bolsita desactivada se reactiva al fraccionar (decisión del usuario).
- **Sí:** la bolsita copia categoría, foto y porción del entero al crearse y no se resincroniza después (decisión del usuario). Cierra el «Por decidir» de la porción; se edita con HU-06.
- **Sí:** costo por bolsita `0.0000` → `422`. Un producto con costo 0 rompería la regla de HU-04 (`unitCost > 0`).
- **Sí:** `stock` de la respuesta es el saldo de la bodega al responder. No se guardan saldos en `fractions` (los mantiene el trigger).
- **Sí:** un reintento sin `price` se acepta si coinciden entero y bolsitas; con `price`, debe coincidir con el guardado (decisión del usuario, opción A, 2026-11-07). Es más laxo que lo que pedía §3 en su primera versión.
- **No:** columna `price_given` en `fractions` para distinguirlo. Otra migración en producción para un caso casi inexistente.
- **Sí:** `backend/src/products/index.ts` reexporta `PRICE_BELOW_COST` para que `fractions` lo use sin importar internos de `products`.
- **Sí:** `divideMoney` solo en el backend. El frontend pinta el costo que manda el backend (HU-23 lo dice así).

## Lo que **no** entra en este spec

- Pantalla «Fraccionar» y sus entradas desde «Stock general» y la card (HU-23).
- Etiqueta «Fraccionado» e historial en pantalla (HU-24).
- Fraccionar piezas de un vendedor o varios enteros a la vez.
- Deshacer un fraccionado.
- Resincronizar la bolsita con el entero.
- Cambios en productos, stock, entregas, retiros, ventas, cortes, frontend o seed.
