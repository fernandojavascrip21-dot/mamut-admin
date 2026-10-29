# Spec técnico — T-10 · Preparar la base para los vendedores (teléfono y precios por vendedor)

> **Estado:** Implementado
> **Depende de:** M1-t03-tablas-productos-stock (`specs/M1-t03-tablas-productos-stock/spec.md`) — crea `vendor_stock` y reusa `profiles.role = 'vendedor'`; M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`) — `vendor_stock.qty` solo cambia con movimientos; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — escalas de precio y costo
> **Fecha:** 2026-10-29
> **Objetivo:** que la base guarde el teléfono obligatorio de cada vendedor y rechace precios o costos por vendedor menores o iguales a 0, para que las historias de M2 se construyan sobre datos ya validados.

Fuentes: tarea `SCRUM-31 · T-10` del proyecto Jira `MammutSuplements` (espacio `SCRUM`), épica `SCRUM-7 · M2 · Vendedores y entregas`; RF-26, RF-27 y RF-31 de la página de Confluence «Requerimientos»; «Mockups y flujo de pantallas · MVP v1» §3 (pantalla 15) y §4 (reglas de precios y costos); el esquema actual (`supabase/migrations/20261025000000_mammut_products_and_stock.sql`, `backend/src/db/schema.ts`), `supabase/seed.sql` y `backend/tests/helpers/users.ts`; decisiones del usuario del 2026-10-29.

## 1. Por qué existe este spec

RF-31 pide dar de alta vendedores con «nombre, teléfono, usuario y contraseña temporal». Hoy:

| Dato que pide M2 | Dónde está hoy | Falta |
| --- | --- | --- |
| Nombre | `profiles.full_name` | — |
| Usuario | El correo de Supabase Auth (`vendedor1@mammut.local`) | — (decisión: el «usuario» es el correo, §6) |
| Contraseña temporal | Supabase Auth (`createAccount`) | — |
| Teléfono | **No existe** en `profiles` | Columna nueva |
| Precio de venta por vendedor (RF-26) | `vendor_stock.unit_price numeric(10,2)`, nula | Validar que sea `> 0` |
| Costo con envío por vendedor (RF-27) | `vendor_stock.unit_cost_with_shipping numeric(10,4)`, nula | Validar que sea `> 0` |

Las escalas de `vendor_stock` ya coinciden con la convención de T-08 (precio 2 decimales, costo 4). Este spec solo agrega lo que falta en la base, para que HU-08 (alta de vendedor) y HU-11 (dejar a vendedor) no tengan que tocar migraciones.

## 2. Alcance

**Entra en este spec:**

- Una migración nueva en `supabase/migrations/` con:
  - Columna `profiles.phone text`, nula.
  - Check `profiles_phone_format_check`: si `phone` no es nulo, son exactamente 10 dígitos (`^[0-9]{10}$`).
  - Check `profiles_seller_phone_required_check`: todo perfil con `role = 'vendedor'` tiene `phone` no nulo. Administradores y clientes pueden no tenerlo.
  - Checks `vendor_stock_unit_price_check` (`unit_price is null or unit_price > 0`) y `vendor_stock_unit_cost_with_shipping_check` (`unit_cost_with_shipping is null or unit_cost_with_shipping > 0`).
  - Precondición, como en T-07: si existe algún vendedor sin teléfono o algún precio o costo `<= 0` en `vendor_stock`, la migración falla con un mensaje que lista los ids, en vez de dejar checks sobre datos que no los cumplen.
- `supabase/seed.sql`: teléfono de 10 dígitos para los tres vendedores del seed (`vendedor1`, `vendedor2`, `inactivo`).
- `backend/tests/helpers/users.ts`: `createTestUser` pone un teléfono de prueba cuando el rol es `'vendedor'`, para que las 6 suites que crean vendedores sigan pasando con el check nuevo.
- `npm run db:pull` y los dos fixups de `CLAUDE.md`, para que `backend/src/db/schema.ts` refleje la columna y los checks.
- Pruebas nuevas en `backend/tests/seller-schema.test.ts` (§5).
- Documentación: en `CLAUDE.md` y `AGENTS.md`, la línea del seed menciona que los vendedores tienen teléfono; en `specs/README.md`, este spec en la tabla y sus relaciones.

**No entra en este spec:**

- Endpoints, casos de uso o pantallas de vendedores: el alta (`createSeller`, `POST /api/sellers`, pantalla 15) es HU-08; dejar y retirar son HU-11 y HU-12.
- Agregar `phone` a `AccountView`, `AuthContext` o cualquier respuesta de la API: lo hace HU-08 cuando lo muestre.
- Un costo con envío por defecto en `products` (decisión del usuario, §6).
- Un `username` propio para iniciar sesión (decisión del usuario, §6).
- Validar que el `profile_id` de `vendor_stock` sea un vendedor: hoy solo lo escriben el trigger de movimientos y HU-11; si hiciera falta, va en otro spec.
- Cambiar la contraseña temporal en el primer inicio de sesión (por decidir en HU-08).

## 3. Reglas de negocio

- **Teléfono del vendedor** (decisión del usuario): obligatorio para `role = 'vendedor'`; exactamente 10 dígitos, sin espacios, guiones, `+52` ni lada aparte. El formulario de HU-08 se encargará de quitar espacios antes de enviar; la base solo acepta los 10 dígitos limpios.
- **Administradores y clientes** pueden tener `phone` nulo. Si alguno lo tiene, también son 10 dígitos.
- **Precio y costo por vendedor** (decisión del usuario): nulos significan «usar el precio general» y «usar el costo de fábrica» (RF-26, RF-27). Si se escriben, son `> 0`, igual que el precio y el costo de un producto (HU-04 criterio 3).
- **Los checks no tocan `qty`**: `vendor_stock.qty` lo sigue manteniendo el trigger de T-07, y los precios se siguen pudiendo escribir directo (los guardas de T-07 solo protegen `qty`).
- **El «usuario» del vendedor es su correo** (decisión del usuario): no hay columna nueva para eso.

## 4. Modelo de datos

Migración nueva: `supabase/migrations/20261029000000_seller_phone_and_prices.sql` (forma, no texto final):

```sql
-- 0. Precondición: los datos actuales tienen que cumplir los checks nuevos.
do $$ begin
  -- vendor_stock con unit_price <= 0 o unit_cost_with_shipping <= 0 → raise exception con los ids
end $$;

-- 1. Teléfono
alter table public.profiles add column phone text;
alter table public.profiles add constraint profiles_phone_format_check
  check (phone is null or phone ~ '^[0-9]{10}$');

-- 2. Vendedores existentes: la migración no inventa teléfonos.
do $$ begin
  -- si hay perfiles 'vendedor' (con phone nulo, porque la columna es nueva) → raise exception con los ids
end $$;
alter table public.profiles add constraint profiles_seller_phone_required_check
  check (role <> 'vendedor' or phone is not null);

-- 3. Precio y costo por vendedor
alter table public.vendor_stock add constraint vendor_stock_unit_price_check
  check (unit_price is null or unit_price > 0);
alter table public.vendor_stock add constraint vendor_stock_unit_cost_with_shipping_check
  check (unit_cost_with_shipping is null or unit_cost_with_shipping > 0);
```

`supabase db reset` aplica las migraciones **antes** del seed, así que en local no hay vendedores cuando corre la precondición del paso 2. El seed los inserta ya con teléfono:

```sql
insert into public.profiles (id, role, full_name, phone, active) values
  ('a0000000-0000-4000-8000-000000000001', 'admin',    'Ana Administradora', null,         true),
  ('a0000000-0000-4000-8000-000000000002', 'vendedor', 'Víctor Vendedor',    '5510000001', true),
  ('a0000000-0000-4000-8000-000000000003', 'vendedor', 'Valeria Vendedora',  '5510000002', true),
  ('a0000000-0000-4000-8000-000000000004', 'vendedor', 'Iván Inactivo',      '5510000003', false);
```

`backend/src/db/schema.ts` (generado por `db:pull`) queda con `phone: text()` en `profiles` y los cuatro checks nuevos.

`backend/tests/helpers/users.ts`: el `insert` de `createTestUser` agrega `phone: profile.role === 'vendedor' ? '5500000000' : null`.

## 5. Plan de implementación

1. **Migración.** Escribir `20261029000000_seller_phone_and_prices.sql` (§4) y actualizar `supabase/seed.sql` con los teléfonos en el mismo paso, porque sin ellos el seed falla con el check nuevo. Probar con `npm run db:reset`: sin errores, y `select id, role, phone from profiles` muestra los tres teléfonos.
2. **Schema.** `npm run db:pull` (con `backend/.env` en el bloque LOCAL), aplicar los dos fixups de `CLAUDE.md` y borrar `src/db/0000_*.sql` y `src/db/meta/`. `npm run type-check` pasa.
3. **Helper de pruebas.** Agregar el teléfono de prueba en `createTestUser`. `npm test` en `backend/` pasa igual que antes del cambio.
4. **Pruebas de los checks.** Crear `backend/tests/seller-schema.test.ts`, con datos con prefijo `test-auth-` y limpieza antes y después, que compruebe:
   - Un perfil `'vendedor'` sin teléfono se rechaza.
   - Un teléfono de 9 dígitos, de 11 o con espacios se rechaza.
   - Un vendedor con `'5512345678'` se acepta; un administrador sin teléfono se acepta.
   - En `vendor_stock`, `unit_price = 0` y `unit_cost_with_shipping = 0` se rechazan; nulos y `> 0` se aceptan (la fila nace por un movimiento `delivery`, no con `insert` directo, por los guardas de T-07).
5. **Documentación.** Actualizar la línea del seed en `CLAUDE.md` y `AGENTS.md`, y agregar este spec a `specs/README.md` con sus relaciones.
6. **Producción.** Con `backend/.env` en el bloque PRODUCCIÓN, revisar con una consulta de solo lectura si hay perfiles `'vendedor'`. Si hay, el usuario decide sus teléfonos antes de aplicar (la migración fallará y los listará). Aplicar la migración a producción solo después.

## 6. Criterios de aceptación

- [x] `npm run db:reset` termina sin errores y los tres vendedores del seed tienen teléfono de 10 dígitos.
- [x] Insertar un perfil `'vendedor'` sin teléfono falla con `profiles_seller_phone_required_check`.
- [x] Insertar un perfil con teléfono `'551234567'`, `'55123456789'` o `'55 1234 5678'` falla con `profiles_phone_format_check`.
- [x] Un administrador sin teléfono se inserta sin error.
- [x] Guardar `vendor_stock.unit_price = 0` o `unit_cost_with_shipping = 0` falla; guardar nulos o valores `> 0` funciona.
- [x] Aplicar la migración sobre una base con un vendedor sin teléfono falla con un mensaje que incluye su id.
- [x] `backend/src/db/schema.ts` tiene `phone` en `profiles` y los cuatro checks, sin archivos de Drizzle sobrantes.
- [x] `npm run type-check` y `npm test` en `backend/` pasan, con `SUPABASE_SERVICE_ROLE_KEY` puesta (sin ella las pruebas de cuentas se saltan).
- [x] `ng build` y `ng test` del frontend siguen pasando (no se toca el frontend).
- [x] `CLAUDE.md`, `AGENTS.md` y `specs/README.md` están actualizados.

**Producción (2026-10-29):** una consulta de solo lectura encontró un perfil `'vendedor'` sin teléfono, `m0-test-vendedor@mammut.local` («Vendedor Prueba»): una cuenta de prueba de M0 que nadie referenciaba. Por decisión del usuario se borró, se aplicó la migración en una transacción (columna `phone` y los 4 checks confirmados) y se volvió a crear la misma cuenta con teléfono `5500000001` y una contraseña nueva que no está en el repo. `vendor_stock` estaba vacía.

**Hallazgo al aplicar (resuelto el 2026-10-29):** producción no tenía T-07 (`20261027000000_stock_from_movements.sql`): faltaban los triggers de stock y `stock_movements_qty_sign_check`, y los productos 77 y 91 tenían `stock` sin movimientos. T-10 no depende de esos objetos y se aplicó sola. Después se borraron 77 y 91 (restos de prueba, sin referencias) y se aplicó T-07 en una transacción; ver la nota de producción en `specs/M1-t07-stock-por-movimientos/spec.md`.

## 7. Decisiones

- **Sí:** el «usuario» del vendedor es su correo (decisión del usuario). Supabase Auth ya funciona así y el login de M0 no cambia.
- **No:** columna `username` y traducir usuario → correo al iniciar sesión. Agrega una búsqueda antes de cada login y otro dato único que mantener, sin necesidad en la v1.
- **Sí:** teléfono obligatorio para vendedores, 10 dígitos exactos (decisión del usuario), validado en la base con un check.
- **No:** texto libre ni formato internacional. Los vendedores son locales y un solo formato facilita abrir WhatsApp o marcar después.
- **Sí:** `phone` nula en la columna y obligatoria por check según el rol. Así los administradores y clientes existentes no necesitan teléfono.
- **No:** tabla aparte de vendedores. `profiles` ya es la ficha de cada cuenta; separar el teléfono solo agregaría un join.
- **Sí:** checks `> 0` en el precio y el costo de `vendor_stock` (decisión del usuario). Es la misma regla de los productos, y la base la cumple aunque un cliente se salte el backend.
- **No:** costo con envío por defecto en `products` (decisión del usuario). Vacío ya significa «costo de fábrica»; si se necesita recordar el envío, va en otro spec.
- **Sí:** T-10 solo cubre base, schema, seed y pruebas (decisión del usuario), como T-03 en M1. Los endpoints van con la historia que los usa.
- **Sí:** la migración falla con una lista en vez de inventar teléfonos para vendedores existentes, igual que la precondición de T-07.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Producción ya tiene perfiles `'vendedor'` sin teléfono | Paso 6: consulta de solo lectura antes de aplicar; la migración falla y los lista en vez de dejar datos inválidos |
| Las 6 suites que crean vendedores fallan con el check nuevo | Paso 3: `createTestUser` pone un teléfono de prueba a los vendedores |
| `db:pull` vuelve a perder `auth.users` o los defaults vacíos | Los dos fixups documentados en `CLAUDE.md`, revisados en el paso 2 |
| HU-08 recibe teléfonos con espacios o `+52` | La base los rechaza; HU-08 debe normalizar en el formulario y responder `422` con un mensaje claro |

## Lo que **no** entra en este spec

- Alta, lista, edición o desactivación de vendedores (HU-08, HU-09).
- Dejar y retirar producto con precio y costo por vendedor (HU-11, HU-12).
- `username` propio y costo con envío por defecto por producto.
- Mostrar el teléfono en la API o en pantallas.

Cada uno, si llega, va en su propio spec o en su historia.
