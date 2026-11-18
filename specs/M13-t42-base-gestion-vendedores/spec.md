# Spec técnico — T-42 · Base de gestión de vendedores: editar, desactivar, reactivar, eliminar y contraseña (backend)

> **Estado:** Implementado
> **Depende de:**
> - M2-t10-base-vendedores (`specs/M2-t10-base-vendedores/spec.md`): `profiles.phone` de 10 dígitos, obligatorio para `role = 'vendedor'`.
> - M2-hu08-alta-vendedor (`specs/M2-hu08-alta-vendedor/spec.md`): `createSeller`, `normalizePhone` y `POST /api/sellers`.
> - M2-hu09-ver-mis-vendedores (`specs/M2-hu09-ver-mis-vendedores/spec.md`): `listSellers`, `getSeller`, `GET /api/sellers` y `GET /api/sellers/[id]`.
> - M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`): `vendor_stock.qty` solo cambia con movimientos; las FK a `profiles` son `restrict`.
> **Fecha:** 2026-11-16
> **Objetivo:** que el backend deje al administrador editar los datos de un vendedor (con el nombre de su negocio), desactivarlo y reactivarlo, eliminarlo si nunca tuvo movimientos y ponerle una contraseña temporal que cierre sus sesiones, con las reglas de negocio de Mammut.

Fuentes:

- **Jira:** tarea `SCRUM-106 · T-42`, épica `SCRUM-105 · M13 · Gestión de vendedores (v2)`. Bloquea a HU-43 (`SCRUM-107`), HU-44 (`SCRUM-108`) y HU-45 (`SCRUM-109`). Requerimientos RF-34 a RF-37 de la página de Confluence «Requerimientos».
- **Código:**
  - `backend/src/accounts/logins.ts`: `updateLogin`, `setLoginActive`, `setLoginPassword` y `deleteLogin`, el mismo flujo para los logins de cliente.
  - `backend/src/accounts/admins.ts`: `deactivateAdmin`, que desactiva con `withTransaction` + `lockRows`.
  - `backend/src/accounts/accounts.ts`: `toView`, `normalizeEmail`, `validatePassword` y el manejo del correo repetido en `createAccount`.
  - `backend/src/accounts/sellers.ts`: `normalizePhone`, `listSellers`, `getSeller` y `isActiveSeller`.
  - `backend/src/auth/context.ts` y `session.ts`: cada petición, login y refresh vuelve a leer `profiles.active`.
  - `backend/tests/sellers-list.test.ts` (con commit): exige `404` en `GET /api/sellers/[id]` para un vendedor desactivado. Este spec no lo cambia (§9).
  - FK a `profiles` con `on delete restrict`: `stock_movements.holder_profile_id`, `stock_movements.created_by`, `vendor_stock.profile_id`, `direct_sales.holder_profile_id`, `direct_sales.sold_by` y las del dominio viejo (`sales`, `shrinkage`, `cuts`…).
- **Decisiones del usuario** del 2026-11-16 (§9).

## 1. Por qué existe este spec

Hoy el administrador solo puede dar de alta vendedores (HU-08) y verlos (HU-09). No puede corregir un teléfono, dar de baja a quien ya no trabaja con él, ayudar a alguien que olvidó su contraseña ni borrar un alta hecha por error. Los logins de cliente del proyecto viejo ya tienen estos casos de uso, pero no sirven para vendedores: un vendedor tiene piezas a su cargo y un historial de entregas, ventas y mermas que no se puede perder.

Este spec agrega solo el backend y la columna nueva. Las pantallas van en HU-43, HU-44 y HU-45.

## 2. Alcance

**Entra en este spec:**

- **Base:** la migración `supabase/migrations/20261116000000_seller_business_name.sql` (§4):
  - columna `profiles.business_name text`, nula;
  - check `profiles_business_name_check` (de 1 a 80 caracteres sin espacios en los extremos, si no es nula).
- **Seed:** `supabase/seed.sql` le pone negocio a `vendedor2` («Gimnasio Fuerza Norte»), para que HU-43 tenga un ejemplo con y otro sin negocio.
- **`backend/src/db/schema.ts`:** regenerado con `db:pull`, más los fixups de `CLAUDE.md`.
- **`backend/src/accounts/`**:
  - `constants.ts`: `MAX_BUSINESS_NAME` y los mensajes nuevos.
  - `sellers.ts`: `normalizeBusinessName`, `updateSeller`, `deactivateSeller`, `reactivateSeller`, `deleteSeller` y `setSellerPassword`. Además, `createSeller` acepta `businessName`, `listSellers` acepta `status` y `getSeller` acepta `{ includeInactive }`.
  - `SellerView` y `SellerSummary` suman `businessName`.
- **`@auth`:** `revokeSessions(userId)` en `backend/src/auth/session.ts`, exportada en `index.ts`, para cerrar todas las sesiones de una cuenta.
- **Rutas** (todas solo administrador):
  - `backend/app/api/sellers/route.ts`: `POST` acepta `businessName`; `GET` acepta `?status=active|inactive`.
  - `backend/app/api/sellers/[id]/route.ts`: `GET` acepta `?status=any`; `PUT` nuevo (editar); `DELETE` nuevo (eliminar).
  - `backend/app/api/sellers/[id]/deactivate/route.ts` (`POST`).
  - `backend/app/api/sellers/[id]/reactivate/route.ts` (`POST`).
  - `backend/app/api/sellers/[id]/password/route.ts` (`PUT`).
- **Pruebas** contra la base real en un archivo nuevo, `backend/tests/sellers-manage.test.ts` (§7). No se toca ningún test con commit.
- **Documentación:**
  - `CLAUDE.md` y `AGENTS.md`: una línea con las reglas para desactivar y eliminar vendedores.
  - `specs/README.md`: este spec en la tabla y en sus relaciones.
  - `backend/README.md`: las rutas nuevas.

**No entra en este spec:**

- Pantallas, servicios o modelos del frontend: la ficha, la edición y el campo «Nombre del negocio» en el alta son HU-43; el filtro «Activos | Desactivados» y los botones de desactivar, reactivar y eliminar son HU-44; «Cambiar contraseña» es HU-45.
- Que la barra «Viendo» vuelva a «Yo · bodega» cuando el titular se desactiva (HU-44, frontend).
- Abrir el historial de entregas, retiros o mermas de un vendedor desactivado: esas rutas siguen respondiendo `404` (usan `getActiveSellerName`).
- Mandar la contraseña o un enlace por correo, o pedirle al vendedor que la cambie en su primer inicio de sesión.
- Que el vendedor edite su propio perfil.
- Cambiar los logins de cliente (`logins.ts`) o la gestión de administradores (`admins.ts`).
- Eliminar a un vendedor con historial, o anonimizarlo.

## 3. Reglas de negocio

### Quién

Solo el **administrador** usa estas rutas. Un vendedor recibe `403`; sin sesión, `401`. Un id que no tiene forma de UUID, que no existe o que no es de un vendedor (por ejemplo, un administrador) responde `404`, sin decir cuál de los tres fue.

### Nombre del negocio (`normalizeBusinessName`)

- Es opcional: gimnasio, cafetería, tienda…
- Se recortan los espacios de los extremos. Ausente, `null` o vacío → `null` (sin negocio).
- Más de 80 caracteres → `422` «El nombre del negocio debe tener como máximo 80 caracteres».
- No es único: dos vendedores pueden tener el mismo negocio (por ejemplo, dos sucursales).

### Editar (`PUT /api/sellers/[id]`)

- El cuerpo lleva siempre los cuatro datos, como el formulario completo de HU-43: `fullName`, `businessName`, `phone` y `email`.
  - `fullName`: obligatorio, recortado; vacío → `422`.
  - `businessName`: con las reglas de arriba.
  - `phone`: con `normalizePhone` (10 dígitos; `422` si no).
  - `email`: con `normalizeEmail` (minúsculas, `422` si no es válido).
- Se valida todo antes de tocar Supabase Auth o la base.
- Funciona con vendedores **activos y desactivados**, para corregir datos antes de reactivar.
- El correo es el usuario con el que entra el vendedor:
  - Si el correo nuevo es igual al actual, Auth no se toca.
  - Si cambia, primero se cambia en Auth con `auth.admin.updateUserById(id, { email, email_confirm: true })`, sin mandar correo de confirmación.
  - Si ya lo usa otra cuenta → `409` «Ya existe un acceso con ese correo», y no cambia nada.
  - Si después falla la actualización de `profiles`, se regresa el correo anterior en Auth (compensación, como `createAccount`) y se responde el error.
- Responde `200` con el `SellerView` actualizado.

### Desactivar (`POST /api/sellers/[id]/deactivate`)

- Corre en una transacción con `lockRows` sobre el perfil del vendedor (`select … for update`) y sobre sus filas de `vendor_stock`.
- **Con piezas a su cargo no se desactiva:** si la suma de `vendor_stock.qty` es mayor que 0 → `409` «Retírale sus piezas antes de desactivarlo». Las piezas se regresan con «Retirar producto» (HU-12).
- Si ya está desactivado, responde `200` con su vista, sin error (idempotente).
- Al desactivarlo, su siguiente petición, login o refresh da `401`: `getAuthContext` y `loadActiveProfile` ya leen `active` cada vez.
- Desactivar no borra nada. Sus ventas, cortes y movimientos siguen igual, y el resumen del negocio (HU-22) lo sigue incluyendo.

### Reactivar (`POST /api/sellers/[id]/reactivate`)

- Pone `active = true`. Si ya estaba activo, responde `200` sin error.
- Vuelve a aparecer en «Mis vendedores», «Viendo» y «Dejar», y puede entrar con la contraseña que tenía.

### Eliminar (`DELETE /api/sellers/[id]`)

- Solo para un alta hecha por error, que **nunca tuvo movimientos**.
- Primero se borra la fila de `profiles`.
  - Si una FK `restrict` lo impide (movimientos, `vendor_stock`, ventas…) → `409` «Tiene historial: solo se puede desactivar», y no se borra nada.
  - Si se borró, se elimina el usuario de Supabase Auth con `auth.admin.deleteUser(id)`.
- Este orden evita dejar un perfil sin cuenta. Si falla el paso de Auth, queda una cuenta de Auth sin perfil, que no puede entrar (`loadActiveProfile` da `401`); es el mismo compromiso de `deleteLogin`.
- Funciona con vendedores activos y desactivados.
- Responde `204` sin cuerpo.

### Contraseña temporal (`PUT /api/sellers/[id]/password`)

- Cuerpo `{ password }`, validado con `validatePassword` (mínimo 8 caracteres; `422` si no).
- Se cambia con `auth.admin.updateUserById(id, { password })`.
- Después **se cierran todas sus sesiones** (decisión del usuario) con `revokeSessions(id)`: en cualquier celular donde tenga la app abierta, su siguiente petición da `401` y el refresh falla, así que tiene que volver a entrar.
- Funciona con vendedores activos y desactivados.
- La contraseña nunca se devuelve ni se registra en logs. Responde `204` sin cuerpo.

### Listar y abrir

- `GET /api/sellers` sin `status` (o con `status=active`) responde igual que hoy (HU-09): solo activos.
- `GET /api/sellers?status=inactive` responde solo los desactivados, con la misma forma y orden por nombre.
- Cualquier otro valor de `status` → `422`.
- `GET /api/sellers/[id]` sin `status` sigue respondiendo `404` para un desactivado (la prueba con commit de HU-09 no cambia).
- `GET /api/sellers/[id]?status=any` abre activos y desactivados, con la misma forma. `active` dice cuál es.
- Las tres respuestas suman `businessName`.

## 4. Modelo de datos

Migración nueva: `supabase/migrations/20261116000000_seller_business_name.sql` (forma, no texto final):

```sql
alter table public.profiles add column business_name text;

alter table public.profiles add constraint profiles_business_name_check
  check (
    business_name is null
    or (char_length(business_name) between 1 and 80 and business_name = btrim(business_name))
  );
```

- La columna es nula, así que los perfiles actuales (administradores, clientes, vendedores) no cambian y no hace falta una precondición.
- El check es la red de seguridad: el backend ya recorta y valida antes de guardar.

Seed (`supabase/seed.sql`): `vendedor2` (`a0000000-0000-4000-8000-000000000003`) con `business_name = 'Gimnasio Fuerza Norte'`; los demás quedan con `null`.

Vistas en `backend/src/accounts/sellers.ts`:

```ts
export type SellerView = AccountView & { businessName: string | null }

// «Mis vendedores» (HU-09) + negocio (T-42)
export interface SellerSummary {
  id: string
  fullName: string
  businessName: string | null
  units: number
}

export type SellerDetail = SellerView & { units: number; stock: HolderStockLine[] }

export type SellerStatus = 'active' | 'inactive'

export interface UpdateSellerInput {
  fullName: string
  businessName: string | null
  phone: string
  email: string
}
```

Constantes nuevas en `backend/src/accounts/constants.ts`:

```ts
export const MAX_BUSINESS_NAME = 80
export const SELLER_HAS_UNITS = 'Retírale sus piezas antes de desactivarlo'
export const SELLER_HAS_HISTORY = 'Tiene historial: solo se puede desactivar'
```

`revokeSessions(userId)` en `backend/src/auth/session.ts`:

- Borra las sesiones de Supabase Auth de esa cuenta con `delete from auth.sessions where user_id = $1`, por la conexión de `DATABASE_URL`.
- Sus refresh tokens se borran en cascada.
- supabase-js no tiene una función de administrador que cierre las sesiones de otra cuenta por su id: `auth.admin.signOut` necesita el JWT de esa cuenta.

Rutas y respuestas:

| Método y ruta | Cuerpo | Éxito | Errores propios |
| --- | --- | --- | --- |
| `POST /api/sellers` | + `businessName?` | `201` `SellerView` | los de HU-08 + `422` negocio largo |
| `GET /api/sellers?status=` | — | `200` `SellerSummary[]` | `422` `status` inválido |
| `GET /api/sellers/[id]?status=any` | — | `200` `SellerDetail` | `404` |
| `PUT /api/sellers/[id]` | `fullName`, `businessName`, `phone`, `email` | `200` `SellerView` | `404`, `409` correo, `422` |
| `POST /api/sellers/[id]/deactivate` | — | `200` `SellerView` | `404`, `409` con piezas |
| `POST /api/sellers/[id]/reactivate` | — | `200` `SellerView` | `404` |
| `DELETE /api/sellers/[id]` | — | `204` | `404`, `409` con historial |
| `PUT /api/sellers/[id]/password` | `password` | `204` | `404`, `422` |

En todas: `401` sin sesión y `403` para un vendedor.

## 5. Plan de implementación

1. **Migración y seed.** Escribir `20261116000000_seller_business_name.sql` y poner el negocio de `vendedor2` en `supabase/seed.sql`. Probar con `npm run db:reset`: sin errores, y `select full_name, business_name from profiles` muestra «Gimnasio Fuerza Norte» solo en `vendedor2`.
2. **Schema.** `npm run db:pull` (con `backend/.env` en el bloque LOCAL), aplicar los fixups de `CLAUDE.md` y borrar `src/db/0000_*.sql` y `src/db/meta/`. `npm run type-check` pasa.
3. **Negocio en el alta y las vistas.** Agregar las constantes, `normalizeBusinessName` y `businessName` a `SellerView` y `SellerSummary`, y que `createSeller` y `POST /api/sellers` lo acepten. Las suites con commit `sellers.test.ts` y `sellers-list.test.ts` siguen pasando.
4. **Listar desactivados y abrir con `status=any`.** `listSellers(status)` y `getSeller(id, { includeInactive })`, con el parámetro leído en las dos rutas `GET`.
5. **Editar.** `updateSeller` con la compensación del correo y la ruta `PUT /api/sellers/[id]`.
6. **Desactivar y reactivar.** `deactivateSeller` (transacción con candado y regla de piezas), `reactivateSeller` y sus dos rutas.
7. **Eliminar.** `deleteSeller` (perfil primero, `409` con historial, luego Auth) y la ruta `DELETE`.
8. **Contraseña y sesiones.** `revokeSessions` en `@auth`, `setSellerPassword` y la ruta `PUT /api/sellers/[id]/password`.
9. **Pruebas.** Crear `backend/tests/sellers-manage.test.ts` (§7) y correr la suite completa de `backend/`, con `SUPABASE_SERVICE_ROLE_KEY` y la base local.
10. **Documentación.** `CLAUDE.md`, `AGENTS.md`, `backend/README.md` y `specs/README.md`.
11. **Producción** (a mano, en el SQL Editor de Supabase, nunca con `supabase db push`):
    - Consulta de solo lectura: la columna `profiles.business_name` todavía no existe.
    - Pegar la migración dentro de `begin; … commit;`.
    - Verificar con `select column_name from information_schema.columns where table_name = 'profiles' and column_name = 'business_name'` y con la lista de checks de `profiles`.
    - Hacerlo antes de desplegar el backend que lee la columna.

## 6. Criterios de aceptación

- [ ] `npm run db:reset` termina sin errores y solo `vendedor2` tiene `business_name`.
- [ ] Guardar en la base un `business_name` de 81 caracteres, vacío (`''`) o con espacios en los extremos falla con `profiles_business_name_check`.
- [ ] `POST /api/sellers` con `businessName: '  Café Centro  '` crea al vendedor con `businessName: 'Café Centro'`; sin `businessName` lo crea con `null`.
- [ ] `GET /api/sellers` devuelve solo activos (como en HU-09) y cada fila trae `businessName`.
- [ ] `GET /api/sellers?status=inactive` devuelve solo desactivados; `?status=otro` da `422`.
- [ ] `GET /api/sellers/[id]` de un desactivado sigue dando `404`; con `?status=any` da `200` con `active: false`.
- [ ] `PUT /api/sellers/[id]` cambia nombre, negocio y teléfono; el teléfono «55 1234 5678» se guarda como `5512345678`.
- [ ] Con un correo nuevo, el vendedor entra con ese correo y ya no con el anterior; con el correo de otra cuenta da `409` y no cambia nada (ni en Auth ni en `profiles`).
- [ ] Con un teléfono inválido o el nombre vacío, `PUT` da `422` y no cambia el correo en Auth.
- [ ] Desactivar a un vendedor con piezas da `409` «Retírale sus piezas antes de desactivarlo» y sigue activo.
- [ ] Desactivar a un vendedor sin piezas lo deja con `active: false`; su token anterior da `401` en `GET /api/me/stock` y su login falla.
- [ ] Desactivar a uno ya desactivado o reactivar a uno ya activo responde `200` sin cambiar nada.
- [ ] Reactivarlo le devuelve el acceso con su contraseña.
- [ ] Eliminar a un vendedor sin movimientos da `204` y borra el perfil y la cuenta de Auth.
- [ ] Eliminar a un vendedor con al menos un movimiento da `409` «Tiene historial: solo se puede desactivar» y no borra nada.
- [ ] `PUT /api/sellers/[id]/password` con 7 caracteres da `422`; con una válida da `204`, la anterior deja de funcionar y la nueva sí.
- [ ] Después de cambiar la contraseña, el token y el refresh token que el vendedor tenía antes dan `401`.
- [ ] Todas las rutas nuevas dan `403` a un vendedor, `401` sin sesión y `404` con el id de un administrador o un UUID inexistente.
- [ ] `npm run type-check`, `npm run build` y `npm test` en `backend/` pasan, con `SUPABASE_SERVICE_ROLE_KEY` puesta (sin ella las pruebas de cuentas se saltan) y sin cambiar pruebas con commit.
- [ ] `architecture.test.ts` pasa: `@accounts` usa `@auth` solo por su `index.ts`.
- [ ] `ng build` y `ng test` del frontend siguen pasando (no se toca el frontend).
- [ ] La migración está aplicada en producción y la columna existe.
- [ ] `CLAUDE.md`, `AGENTS.md`, `backend/README.md` y `specs/README.md` están actualizados.

## 7. Pruebas (`backend/tests/sellers-manage.test.ts`)

- Cuentas con el prefijo `test-auth-` de `backend/tests/helpers/users.ts`, limpiadas antes y después, con `describe.skipIf(!hasServiceKey)`.
- **Regla pura `normalizeBusinessName`:** recorta, vacío y `null` dan `null`, 80 caracteres pasan y 81 dan `422`.
- **Las piezas** se le dan al vendedor de prueba con un movimiento `delivery` real (como en `sellers-list.test.ts`) y se quitan con un `return`, nunca escribiendo `vendor_stock`.
- **Eliminar con historial:** un vendedor con un `delivery` y su `return` (piezas en 0) da `409`. Así se comprueba que «sin piezas» no basta para borrar.
- **Sesiones:** se guardan el `token` y el `refreshToken` que devuelve `createTestUser` antes de cambiar la contraseña y se comprueba que los dos dan `401` después.
- **Limpieza:** borrar los movimientos de prueba del más nuevo al más viejo, antes de borrar perfiles (FK `restrict`).

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Borrar `auth.sessions` no invalida el access token vigente si la versión de Supabase Auth no revisa la sesión en `getUser` | El criterio «el token anterior da `401`» lo comprueba en local. Si falla, `getAuthContext` no cambia en este spec: se reporta y se decide aparte, porque el token expira solo en 1 hora |
| Se desactiva a un vendedor justo mientras se le hace una entrega (`createDelivery` revisa `active` antes de su transacción) | Un solo administrador usa la app y la ventana es de milisegundos. Desactivar bloquea sus filas de `vendor_stock`. Si pasara, el vendedor quedaría con piezas y desactivado: se reactiva, se le retiran y se vuelve a desactivar |
| Cambiar el correo en Auth y luego fallar al guardar `profiles` | Compensación: se regresa el correo anterior en Auth antes de responder el error |
| Falla el borrado en Auth después de borrar el perfil | Queda una cuenta de Auth sin perfil que no puede entrar (`401`); el mismo compromiso de `deleteLogin` |
| Desplegar el backend antes de aplicar la migración en producción | Paso 11: la migración va primero, con consulta de solo lectura y verificación |
| Un administrador escribe el id de otro administrador en estas rutas | Todos los casos de uso filtran `role = 'vendedor'`: responde `404` |

## 9. Decisiones

- **Sí:** `?status=any` en `GET /api/sellers/[id]` (decisión del usuario). El detalle sin parámetro sigue dando `404` a un desactivado, así que la prueba con commit de HU-09 no se toca.
- **No:** cambiar el detalle para que abra desactivados. Obligaría a desbloquear `sellers-list` y a revisar cada pantalla que hoy cuenta con ese `404`.
- **No:** una ruta nueva `/profile`. Duplicaría la forma del detalle, que ya trae todo lo que necesita la ficha.
- **Sí:** al cambiar la contraseña se cierran todas las sesiones del vendedor (decisión del usuario). Si la cambia porque perdió el celular o alguien más la sabía, la sesión vieja no debe seguir abierta.
- **Sí:** cerrar sesiones borrando `auth.sessions` por SQL. supabase-js no tiene una función de administrador para cerrar las sesiones de otra cuenta por su id.
- **No:** cerrar sesiones al desactivar. `getAuthContext` ya rechaza cada petición de un perfil desactivado.
- **Sí:** `business_name` de hasta 80 caracteres, con check en la base (decisión del usuario). Es la misma red de seguridad que el teléfono de T-10.
- **No:** negocio único. Un mismo negocio puede tener dos vendedores (sucursales o turnos).
- **Sí:** `PUT` con los cuatro datos (decisión del usuario). Lo manda el formulario completo de HU-43, y validar siempre todo es más simple que combinar campos opcionales. Corrige el `PATCH` que dice `SCRUM-106`.
- **Sí:** el correo se cambia en Auth sin confirmación (`email_confirm: true`), igual que el alta. El administrador es quien lo escribe y la app no manda correos.
- **Sí:** con piezas a su cargo no se desactiva (decisión del usuario del 2026-11-16). El inventario nunca queda en manos de alguien sin acceso.
- **Sí:** eliminar solo si la base lo permite (FK `restrict`), igual que `deleteLogin`. Cualquier entrega, venta o merma lo impide, aunque ya tenga 0 piezas.
- **No:** borrar en cascada o anonimizar a un vendedor con historial. Se perderían ventas y cortes.
- **Sí:** desactivar, reactivar, editar, eliminar y cambiar contraseña funcionan también con desactivados, para poder corregir datos antes de reactivar.
- **Sí:** desactivar y reactivar dos veces no es error (`200`), como `setLoginActive`. Reintentar no rompe nada.
- **Sí:** la contraseña la escribe el administrador, sin correo (decisión del usuario del 2026-11-16).
- **Sí:** T-42 es solo backend, base, seed y pruebas, como T-10 y T-41. Las pantallas van en HU-43, HU-44 y HU-45.

## Lo que **no** entra en este spec

- Ninguna pantalla ni cambio en el frontend (HU-43, HU-44, HU-45).
- Que «Viendo» vuelva a la bodega al desactivar al titular (HU-44).
- El historial de un vendedor desactivado.
- Correos, enlaces para restablecer la contraseña o un cambio obligatorio al primer inicio de sesión.
- Que el vendedor edite su perfil.
- Cambios en logins de cliente o administradores.

Cada uno, si llega, va en su historia o en su propio spec.
