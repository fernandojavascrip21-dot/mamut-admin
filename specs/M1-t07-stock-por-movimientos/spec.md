# Spec técnico — T-07 · El stock solo cambia con movimientos (trigger en la base)

> **Estado:** Borrador
> **Depende de:** M1-t03-tablas-productos-stock (`specs/M1-t03-tablas-productos-stock/spec.md`) — reusa `stock_movements`, `vendor_stock` y `products.stock`, y cambia cómo se mantiene esa caché; M1-hu04-dar-de-alta-producto (`specs/M1-hu04-dar-de-alta-producto/spec.md`) — cambia `createProduct`
> **Fecha:** 2026-10-26
> **Objetivo:** que `products.stock` y `vendor_stock.qty` los mantenga un trigger de Postgres a partir de `stock_movements`, y que la base rechace cualquier escritura directa de esos saldos o que los deje negativos.

Fuentes: la regla «Toda operación que modifique inventario o caja debe registrar un movimiento; no sobrescribir saldos directamente» de «Buenas prácticas de código» en `CLAUDE.md`/`AGENTS.md` (2026-10-26); tarea `SCRUM-28 · T-07` del proyecto Jira `MammutSuplements` (espacio `SCRUM`), épica `SCRUM-6 · M1 · Productos y bodega`; `specs/M1-t03-tablas-productos-stock/spec.md` §2 y §8; los tipos de `stock_movements` de `supabase/migrations/20261025000000_mammut_products_and_stock.sql`; el código de `backend/src/products/products.ts` y `backend/tests/products-id.test.ts`; el sitio Vue hermano `../mammutSuplements/mammut-Suplements` (`src/services/products.ts`, `src/components/ProductForm.vue`); y consultas de solo lectura a la base real del 2026-10-26 (resultados en §1).

## 1. Por qué existe este spec

`M1-t03` decidió que `products.stock` y `vendor_stock.qty` fueran una **caché** que el **código** recalcula en la misma transacción que inserta el movimiento. Hoy eso solo existe en `createProduct`, que escribe `stock = initialQty` a mano junto al movimiento `initial`. Con las historias que vienen (HU-07 fraccionar, entrada a bodega, dejar/retirar a vendedores, ventas, merma), cada caso de uso tendría que acordarse de actualizar el saldo correcto. Este spec mueve esa responsabilidad a la base: el código **solo inserta movimientos**.

Lo que encontraron las consultas de solo lectura del 2026-10-26:

| Hallazgo | Detalle |
| --- | --- |
| Movimientos existentes | 1 fila: `initial`, bodega, `qty = 1` (producto 46). Ninguna con `client_id` ni de otro tipo |
| `vendor_stock` | 0 filas |
| Triggers en `products`, `stock_movements`, `vendor_stock` | Ninguno |
| Rol del backend | `postgres`, sin superusuario pero con `bypassrls`: revocar permisos de columna no lo detendría |
| Saldos vs. movimientos | Producto 46: `stock = 1` = suma de movimientos ✅. **Productos 77 y 91: `stock = 8` sin ningún movimiento** ❌ |
| Origen de 77 y 91 | Restos de `tests/products-id.test.ts`: (1) insertan `stock: 8` directo, sin movimiento; (2) el caso «renombrar a sí mismo con otras mayúsculas» los deja como `TEST-PROD-ID-…` y la limpieza usa `like 'test-prod-id-%'`, que distingue mayúsculas, así que nunca se borran. Quedan **activos** en `products`, que también lee el sitio Vue |
| Sitio Vue hermano | `ProductForm.vue` sí edita `stock` a mano, pero lo guarda en `localStorage` (`src/services/products.ts`), no en Supabase. Hoy no escribe en la base |

## 2. Alcance

**Entra en este spec:**

- Una migración en `supabase/migrations/` con:
  - Precondición: si algún `products.stock` o `vendor_stock.qty` no coincide con la suma de sus movimientos, la migración falla con un mensaje que lista los ids, en vez de crear triggers sobre datos inconsistentes.
  - `qty <> 0` y check de **signo por tipo y dueño** en `stock_movements` (§3).
  - `products.stock >= 0` (`vendor_stock.qty >= 0` ya existe).
  - Trigger `AFTER INSERT` en `stock_movements`: suma `qty` al saldo de su dueño (`holder_profile_id` nulo = bodega → `products.stock`; no nulo = vendedor → `vendor_stock.qty`, creando la fila si no existe).
  - Trigger `AFTER DELETE` en `stock_movements`: resta `qty` del mismo saldo (para que borrar un movimiento, cosa que solo hacen las pruebas al limpiar, no desincronice la caché).
  - Trigger `BEFORE UPDATE` en `stock_movements`: rechaza cualquier `UPDATE` (un movimiento no se edita; se corrige con otro: `*_void` o `adjustment`).
  - Guardas `BEFORE INSERT/UPDATE` en `products` y `vendor_stock`: rechazan escribir `stock`/`qty` salvo desde el trigger de movimientos (`pg_trigger_depth() > 1`); un `INSERT` de producto debe traer `stock = 0`.
- Backend:
  - `backend/src/db/errors.ts`: `isCheckViolation` (`23514`).
  - `backend/src/stock/movements.ts` (nuevo): `insertMovements(tx, rows)` — único punto para insertar movimientos; traduce la violación de `products_stock_nonnegative` / `vendor_stock_qty_check` a `409` «No hay piezas suficientes».
  - `createProduct` inserta el producto sin `stock`, inserta el movimiento `initial` con `insertMovements`, y devuelve el producto releído (con el `stock` que dejó el trigger).
  - `npm run db:pull` + los dos fixups de `CLAUDE.md` para reflejar los checks nuevos en `schema.ts`.
- Pruebas:
  - `backend/tests/stock-movements.test.ts` (nuevo, §6).
  - Arreglar `tests/products-id.test.ts`: crear sus productos con `createProduct` (o insertando un movimiento `initial`), nunca con `stock` directo; limpiar con `ilike` en `products.test.ts` y `products-id.test.ts`.
  - Borrar los productos 77 y 91 con la limpieza corregida antes de aplicar la migración.
- Documentación: en `CLAUDE.md`/`AGENTS.md`, el patrón «el inventario solo cambia insertando `stock_movements` vía `insertMovements`; nunca escribir `products.stock` ni `vendor_stock.qty`», y la convención de signo de §3.

**No entra en este spec:**

- Endpoints o pantallas de entrada a bodega, dejar/retirar a vendedor, fraccionar, ventas o merma: cada uno en su historia, usando `insertMovements`.
- Recalcular saldos «al vuelo» (sumar movimientos en cada lectura): se mantiene la caché por RNF-01 (`M1-t03` §8).
- Conectar el sitio Vue hermano a la base: si algún día lo hace, ya no podrá escribir `stock` (la base lo rechaza). Se anota como riesgo.
- La columna vieja `stock_movements.client_id` (sin uso para Mammut, sigue intacta).
- Reglas de dinero (`unit_price` del movimiento) — T-08.

## 3. Reglas de negocio

- **Un movimiento por dueño, `qty` con signo** (decisión del usuario): entrada `> 0`, salida `< 0`; cada fila afecta solo al saldo de su dueño. Un traspaso son dos filas en la misma transacción: «dejar 10 a un vendedor» = `delivery` bodega `−10` + `delivery` vendedor `+10`.
- **Signo permitido por tipo** (check `stock_movements_qty_sign_check`):

| Tipo | Bodega (`holder` nulo) | Vendedor (`holder` no nulo) |
| --- | --- | --- |
| `initial`, `purchase` | `> 0` | no permitido |
| `delivery` | `< 0` | `> 0` |
| `return` | `> 0` | `< 0` |
| `direct_sale`, `shrinkage`, `fraction_out` | `< 0` | `< 0` |
| `direct_sale_void`, `shrinkage_void`, `fraction_in` | `> 0` | `> 0` |
| `adjustment` | `≠ 0` | `≠ 0` |

- **Nunca negativo** (decisión del usuario): `products.stock >= 0` y `vendor_stock.qty >= 0`. Un movimiento que dejaría un saldo negativo falla dentro de la transacción y el backend responde `409` «No hay piezas suficientes».
- **El saldo no se escribe a mano** (decisión del usuario): ni el backend, ni SQL en Supabase Studio, ni otro cliente pueden cambiar `products.stock`/`vendor_stock.qty` directamente; solo el trigger de movimientos. Un `INSERT` de producto nace con `stock = 0` y su primer movimiento lo sube.
- **Los movimientos no se editan**: un error se corrige con un movimiento compensatorio (`*_void` o `adjustment`). Borrar movimientos solo lo hacen las pruebas al limpiar; el trigger de borrado mantiene la caché consistente, y las FK `restrict` siguen impidiendo borrar productos o perfiles con historial.
- **Concurrencia**: el trigger hace `update … set stock = stock + new.qty` (atómico, toma el candado de la fila), así que dos movimientos simultáneos del mismo producto no se pisan, sin `lockRows` explícito para el saldo.

## 4. Modelo de datos

No agrega tablas ni columnas. Migración nueva: `supabase/migrations/20261027000000_stock_from_movements.sql` (forma, no texto final):

```sql
-- 0. Precondición: los saldos actuales deben coincidir con sus movimientos.
do $$ begin
  if exists (select 1 from products p
             where p.stock <> coalesce((select sum(qty) from stock_movements m
                                        where m.product_id = p.id and m.holder_profile_id is null), 0))
  then raise exception 'products.stock no coincide con stock_movements: %', (select string_agg(...));
  end if;
  -- …igual para vendor_stock.qty vs. movimientos por (holder_profile_id, product_id)
end $$;

-- 1. Checks
alter table stock_movements add constraint stock_movements_qty_nonzero check (qty <> 0);
alter table stock_movements add constraint stock_movements_qty_sign_check check ( /* tabla de §3 */ );
alter table products add constraint products_stock_nonnegative check (stock >= 0);

-- 2. Mantener la caché
create function apply_stock_movement() returns trigger …   -- AFTER INSERT: +new.qty
create function revert_stock_movement() returns trigger …  -- AFTER DELETE: −old.qty
create function reject_stock_movement_update() returns trigger … -- BEFORE UPDATE: raise

-- 3. Guardas del saldo
create function guard_products_stock() returns trigger as $$
begin
  if pg_trigger_depth() <= 1 and (tg_op = 'INSERT' and new.stock <> 0
                                  or tg_op = 'UPDATE' and new.stock is distinct from old.stock) then
    raise exception 'products.stock solo cambia con stock_movements';
  end if;
  return new;
end $$ language plpgsql;
-- …guard_vendor_stock_qty igual para vendor_stock.qty
```

**Backend — `backend/src/stock/movements.ts` (nuevo):**

```ts
export interface NewStockMovement {
  productId: number
  type: StockMovementType           // unión de los tipos del check
  qty: number                       // con signo (ver spec T-07 §3)
  holderProfileId: string | null    // null = bodega
  createdBy: string
  reason?: string | null
}

// Único punto para mover inventario. El trigger de la base ajusta products.stock /
// vendor_stock.qty; aquí solo se traduce "saldo negativo" a 409.
export async function insertMovements(tx: Tx, rows: NewStockMovement[]): Promise<void> { /* ... */ }
```

**Backend — `backend/src/db/errors.ts` (agrega):** `export const isCheckViolation = (err: unknown, constraint?: string) => …` (`23514`, opcionalmente filtrando por nombre de constraint).

## 5. Plan de implementación

1. Arreglar las pruebas que escriben `stock` y dejan basura: `tests/products-id.test.ts` crea sus productos con `createProduct` (o producto con `stock` 0 + movimiento `initial`); `products.test.ts` y `products-id.test.ts` limpian con `ilike`. Correr `npx vitest run tests/products-id.test.ts tests/products.test.ts` — esto también borra los productos 77 y 91. Confirmar con una consulta de solo lectura que todo saldo coincide con sus movimientos.
2. `isCheckViolation` en `src/db/errors.ts` y `src/stock/movements.ts` con `insertMovements`.
3. `createProduct`: insertar sin `stock`, movimiento vía `insertMovements`, releer el producto. Hasta aquí todo funciona sin triggers (el `stock` queda en 0 temporalmente solo si se corre sin el paso 4 — por eso los pasos 3 y 4 se verifican juntos).
4. Crear y aplicar la migración de §4 (mismo mecanismo manual que `M1-t03` §6). `npm run db:pull` + fixups de `CLAUDE.md`; borrar los archivos de migración de Drizzle.
5. `tests/stock-movements.test.ts` con los casos de §6; correr `npm run type-check` y `npm test` en `backend/`.
6. `CLAUDE.md`/`AGENTS.md` (§2). `specs/README.md`: relación con `M1-t03` (decisión revertida).
7. Verificación manual: alta de un producto desde la app (el stock aparece igual que antes) e intento de `update products set stock = 99` en Supabase Studio (debe fallar).

## 6. Criterios de aceptación

- [ ] Insertar un movimiento de bodega cambia `products.stock` en exactamente `qty`; uno de vendedor cambia (o crea) su fila en `vendor_stock`.
- [ ] Un `delivery` de 10 (bodega `−10` + vendedor `+10`, misma transacción) deja la bodega 10 abajo y al vendedor 10 arriba.
- [ ] Un movimiento que dejaría `products.stock` o `vendor_stock.qty` negativo falla, no cambia nada, y `insertMovements` lo traduce a `409` «No hay piezas suficientes».
- [ ] `update products set stock = …`, `insert into products (…, stock) values (…, 5)` y cualquier escritura directa de `vendor_stock.qty` fallan, también desde Supabase Studio.
- [ ] `update stock_movements …` falla; `delete` de un movimiento revierte su efecto en el saldo.
- [ ] `qty = 0` y cada combinación tipo/dueño/signo fuera de la tabla de §3 son rechazadas por la base.
- [ ] La migración falla con la lista de ids si algún saldo no coincide con sus movimientos.
- [ ] `createProduct` ya no escribe `stock`, y dar de alta un producto deja `stock = initialQty` con su movimiento `initial`, igual que antes (las pruebas de `HU-04` siguen pasando).
- [ ] `tests/products-id.test.ts` ya no escribe `stock` directo, y después de `npm test` no queda ningún producto cuyo nombre empiece con `test-prod-` (sin distinguir mayúsculas).
- [ ] Los productos 77 y 91 ya no existen.
- [ ] `CLAUDE.md` y `AGENTS.md` documentan `insertMovements` y la convención de signo.
- [ ] `npm run type-check` y `npm test` (`backend/`, con `SUPABASE_SERVICE_ROLE_KEY`) pasan.

## 7. Plan de pruebas

**Backend (`backend/tests/stock-movements.test.ts`, Vitest contra la base real, prefijo `test-stock-` y limpieza con `ilike` que borra movimientos antes que productos):**

- `initial` +5 → `stock` 5; `purchase` +3 → 8; `shrinkage` −2 → 6.
- `delivery` bodega −4 + vendedor +4 (vendedor de prueba de `tests/helpers/users.ts`) → bodega 2, `vendor_stock.qty` 4 (fila creada).
- `return` vendedor −1 + bodega +1 → bodega 3, vendedor 3.
- `shrinkage` −10 en bodega → `409` vía `insertMovements`, saldo sin cambio; igual para el vendedor.
- Signos inválidos (`initial` −1, `purchase` en vendedor, `delivery` bodega +1, `qty` 0) → rechazados.
- `update products set stock` directo, `insert` de producto con `stock` ≠ 0, `update vendor_stock set qty` directo → rechazados.
- `update stock_movements` → rechazado; `delete` de un movimiento → el saldo vuelve atrás.
- Dos `insertMovements` concurrentes de −1 sobre `stock` 1 → uno pasa y el otro da `409` (nunca queda en −1).

**`products.test.ts` / `products-id.test.ts`:** siguen pasando sin escribir `stock`; un `PATCH` que manda `stock` no cambia nada (ya lo prueba HU-06).

**Manual:** alta desde la app; `update products set stock = 99 where id = …` en Supabase Studio falla con «products.stock solo cambia con stock_movements».

## 8. Decisiones tomadas y descartadas

- **Sí:** trigger en Postgres mantiene `products.stock` y `vendor_stock.qty`. Razón (decisión del usuario): la base garantiza la regla aunque escriba otro cliente (el sitio Vue si se conecta, SQL a mano), no solo el backend. **Revierte** la parte de `M1-t03` §2/§8 de «la caché la recalcula el código en la transacción»; se mantiene que es una caché (no suma al vuelo) por RNF-01.
- **No:** una función única del backend (`recordMovement`) que actualiza la caché con `lockRows`. Razón: depende de que nadie escriba por fuera.
- **Sí:** `qty` con signo y una fila por dueño; traspasos como dos filas. Razón (decisión del usuario): el trigger solo suma, y el historial de cada dueño se lee filtrando por `holder_profile_id`.
- **No:** `qty` siempre positiva con el tipo decidiendo el signo y el dueño. Razón: la lógica de traspaso quedaría escondida en el trigger.
- **Sí:** guardas `BEFORE INSERT/UPDATE` con `pg_trigger_depth()`. Razón (decisión del usuario): el backend se conecta como `postgres` con `bypassrls`, así que revocar permisos de columna no lo detendría.
- **Sí:** saldos nunca negativos, `409` «No hay piezas suficientes». Razón (decisión del usuario).
- **Sí:** prohibir `UPDATE` de movimientos y revertir el saldo en `DELETE`. Razón (decisión técnica de esta sesión): un movimiento editado rompería la caché sin dejar rastro; el `DELETE` existe solo para la limpieza de pruebas, y revertirlo evita que la limpieza deje saldos inconsistentes.
- **Sí:** precondición en la migración en vez de corregir saldos en silencio. Razón (decisión técnica de esta sesión): los únicos datos inconsistentes (77, 91) son basura de pruebas; si apareciera un producto real descuadrado, hay que decidir a mano con qué movimiento cuadrarlo.
- **Sí:** arreglar `tests/products-id.test.ts` aquí. Razón (decisión técnica de esta sesión): escribe `stock` a mano (lo que este spec prohíbe) y su limpieza dejó 2 productos de prueba activos en la tabla que comparte el catálogo Vue.
- **Sí:** tarea Jira `SCRUM-28 · T-07`, ejecutada antes de HU-07 y de «Entrada a bodega». Razón (decisión del usuario): esas historias son las primeras que mueven inventario además del alta.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La migración se aplica antes de limpiar 77 y 91 | La precondición la hace fallar sin cambiar nada; el paso 1 del plan los limpia primero |
| Una prueba futura vuelve a escribir `stock` directo | La base lo rechaza; la prueba falla en vez de dejar datos inconsistentes |
| El sitio Vue hermano se conecta a Supabase con su formulario que edita `stock` | La guarda lo rechaza; ese proyecto tendría que registrar movimientos (anotado aquí y en `CLAUDE.md`) |
| `db:pull` no refleja triggers ni funciones | Es esperado: Drizzle solo introspecciona tablas, columnas y checks; la fuente de verdad es la migración |
| Errores del trigger llegan como `500` en casos no previstos (p. ej. signo inválido desde un caso de uso con un bug) | Son errores de programación, no del usuario; `insertMovements` solo traduce el saldo negativo, que sí es un caso de negocio |
