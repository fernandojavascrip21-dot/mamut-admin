# Spec técnico — HU-08 · Dar de alta un vendedor

> **Estado:** Implementado
> **Depende de:** M2-t10-base-vendedores (`specs/M2-t10-base-vendedores/spec.md`) — `profiles.phone` obligatorio de 10 dígitos y «usuario = correo»; M0-base (`specs/M0-base/spec.md`) — login por correo y rutas por rol; M1-t06-logica-a-servicios (`specs/M1-t06-logica-a-servicios/spec.md`) — patrón de formularios y servicio de guardado por pantalla
> **Fecha:** 2026-10-29
> **Objetivo:** que el administrador dé de alta a un vendedor (nombre, teléfono, correo y contraseña temporal) desde «Vendedores», y que ese vendedor pueda entrar a la app con esos datos.

Fuentes:
- **Jira:** historia `SCRUM-32 · HU-08`, épica `SCRUM-7 · M2 · Vendedores y entregas`.
- **Confluence:** «Requerimientos» (RF-31, RF-02, RNF-04) y «Mockups y flujo de pantallas · MVP v1» (§3, pantalla 15).
- **Canvas de mockups:** artboards `NuevoVendedor` (formulario y «Vendedor dado de alta») y `EstadosNuevoVendedor` (guardando, campos vacíos y usuario repetido).
- **Código:** `backend/src/accounts/` (`createAccount`, `admins.ts`), `backend/app/api/admins/route.ts`, `pages/create-product-page` y `ProductSaveService`.
- **Decisiones del usuario del 2026-10-29** (§8).

## 1. Alcance

**Entra en este spec:**

- **Backend:**
  - Caso de uso `createSeller` en `backend/src/accounts/sellers.ts`, sobre `createAccount`, con rol `'vendedor'` y teléfono normalizado.
  - Ruta `POST /api/sellers` en `backend/app/api/sellers/route.ts`, solo para administradores.
  - `createAccount` acepta `phone`, y `AccountView` lo devuelve.
- **Frontend:**
  - Área nueva `src/app/sellers/` con `services/`, `interfaces/`, `validators/` y `rules/`, más el alias `@sellers/*` en `tsconfig.json`.
  - `/admin/vendedores` deja de ser «Próximamente» y pasa a ser una página mínima (`pages/sellers-page`): título «Vendedores» y botón «Nuevo vendedor». La lista es de HU-09.
  - Pantalla 15 en `/admin/vendedores/nuevo` (`pages/create-seller-page`): formulario, «Guardando…», errores, aviso sin conexión con «Reintentar» y el estado final «Vendedor dado de alta».
  - Aviso flotante (`ToastService`) de éxito y de error, como en productos.
- **Pruebas** de backend y frontend (§7).

**No entra en este spec:**

- La lista «Mis vendedores» con piezas por vendedor (HU-09) y la barra «Viendo» (HU-10). El criterio 2 de Jira se cumple en parte (§6).
- El botón «Dejarle producto» de «Vendedor dado de alta»: llega con HU-11.
- Editar, desactivar o reactivar vendedores, y que el vendedor cambie su contraseña temporal en el primer acceso.
- Un `username` distinto del correo (T-10 §7).
- Preguntar «¿Descartar los cambios?» al salir con datos escritos (decisión del usuario, §8).
- `GET /api/sellers`: lo agrega HU-09, que es la que lo usa.

## 2. Reglas de negocio

- **Solo el administrador** da de alta vendedores. `POST /api/sellers` exige `requireRole(request, 'admin')`: un vendedor recibe `403` y sin sesión es `401`.
- **El «usuario» es el correo** (decisión de T-10). En pantalla, el campo del mockup «Usuario para entrar» se llama **«Correo para entrar»**. Se normaliza con `normalizeEmail` (minúsculas y sin espacios en los extremos); un correo inválido da `422` «El correo no es válido».
- **Nombre** obligatorio: sin espacios en los extremos, y solo espacios cuenta como vacío (`notBlank`).
- **Teléfono** (decisión del usuario): se aceptan espacios, guiones y paréntesis («55 2468 1357», «55-2468-1357», «(55) 2468 1357»). Frontend y backend los quitan y exigen **exactamente 10 dígitos**. Con «+52», letras o más o menos dígitos, el campo muestra «El teléfono debe tener 10 dígitos» y el backend responde `422` con ese mismo texto. Se guarda solo con dígitos (`5524681357`), como pide el check de T-10.
- **Contraseña temporal**: al menos 8 caracteres (`validatePassword`, mismo mínimo que el resto de cuentas). Si es más corta: «La contraseña debe tener al menos 8 caracteres».
- **Correo repetido**: si ya existe cualquier cuenta con ese correo (vendedor, administrador o cliente), `createAccount` responde `409` «Ya existe un acceso con ese correo». La pantalla lo muestra bajo el campo del correo y no crea nada.
- **Cuenta en dos pasos con compensación**: se crea en Supabase Auth y después en `profiles` (`role = 'vendedor'`, `active = true`, `phone`). Si falla el segundo paso, se borra el usuario de Auth (`createAccount`, sin cambios en esa lógica).
- **El vendedor nuevo entra a «Mi stock»** con su correo y la contraseña temporal, por las rutas por rol de M0. No ve costos ni ganancia (RF-02, RNF-04); eso ya lo garantizan las rutas de `/vendedor`.
- **Errores visibles**: se muestran al enviar, no al tocar el campo (patrón «Formularios» de `CLAUDE.md`).

## 3. Endpoint

`POST /api/sellers`, solo para administradores.

```json
// Petición
{ "fullName": "Carla Méndez", "phone": "55 2468 1357", "email": "carla@mammut.mx", "password": "temporal123" }

// 201
{ "id": "uuid", "clientId": null, "fullName": "Carla Méndez", "email": "carla@mammut.mx",
  "phone": "5524681357", "active": true, "createdAt": "2026-10-29T…" }
```

| Caso | Status | `error.message` |
| --- | --- | --- |
| Falta un campo o no es texto | 422 | El de `requireString` |
| Teléfono que no da 10 dígitos | 422 | El teléfono debe tener 10 dígitos |
| Correo inválido | 422 | El correo no es válido |
| Contraseña corta | 422 | La contraseña debe tener al menos 8 caracteres |
| Correo ya usado | 409 | Ya existe un acceso con ese correo |
| Sin sesión / no es administrador | 401 / 403 | Los de `requireRole` |

## 4. Modelo de datos

No hay migración: `profiles.phone` y sus checks ya existen (T-10).

**Backend:**

```ts
// backend/src/accounts/accounts.ts
export interface AccountView { /* …campos actuales… */ phone: string | null }
export async function createAccount(
  input: { email: string; password: string; fullName: string },
  profile: { role: …; clientId: number | null; active: boolean; phone?: string | null },
): Promise<AccountView>

// backend/src/accounts/sellers.ts
export type SellerView = AccountView
export function normalizePhone(raw: string): string   // quita [\s\-()]; 422 si no quedan 10 dígitos
export function createSeller(input: { email: string; password: string; fullName: string; phone: string }): Promise<SellerView>
```

**Frontend (`src/app/sellers/`):**

```ts
// interfaces/seller.models.ts
export interface Seller { id: string; fullName: string; email: string | null; phone: string; active: boolean }
export interface CreateSellerInput { fullName: string; phone: string; email: string; password: string }
export type CreateSellerFailure = 'duplicate-email' | 'invalid' | 'offline';
export type CreateSellerResult = { ok: true; seller: Seller } | { ok: false; reason: CreateSellerFailure; message?: string };

// services/sellers.service.ts      → POST ${API_BASE_URL}/api/sellers
// services/seller-save.service.ts  → create(input): Observable<CreateSellerResult>
//   (traduce 409/422/sin red con httpStatus/isOffline; se provee en la página, como ProductSaveService)
// rules/seller.rules.ts            → normalizePhone(raw): string (pura, mismo contrato que el backend)
// validators/seller-form.validators.ts → tenDigitPhone(): ValidatorFn (usa normalizePhone)
```

- **`pages/create-seller-page/create-seller-page.models.ts`:** `type CreateSellerState = 'form' | 'saving' | 'offline' | 'created'`.
- **`tsconfig.json`:** agrega `"@sellers/*": ["./src/app/sellers/*"]`.

## 5. Plan de implementación

1. **Backend · cuentas.** Agregar `phone` a `createAccount` y `AccountView`. Revisar que `admins.test.ts`, `clients.test.ts` y `logins.test.ts` sigan pasando, porque ahora la vista incluye `phone: null`. `npm run type-check` y `npm test` pasan.
2. **Backend · alta.** Crear `backend/src/accounts/sellers.ts` (`normalizePhone`, `createSeller`) y `backend/app/api/sellers/route.ts` (`POST`, ruta delgada como `admins/route.ts`). Agregar `backend/tests/sellers.test.ts` (§7) y pasar las pruebas.
3. **Frontend · área `sellers`.** Crear la carpeta completa con `interfaces/`, `services/`, `rules/` y `validators/`, y el alias `@sellers/*`. Implementar `normalizePhone`, `tenDigitPhone`, `SellersService` y `SellerSaveService`, cada uno con su spec. `ng test` pasa.
4. **Frontend · página mínima.** `ng generate component pages/sellers-page`: título «Vendedores» y botón «Nuevo vendedor» hacia `/admin/vendedores/nuevo`. Cambiar la ruta `vendedores` de `admin.routes.ts` y agregar `vendedores/nuevo`, ambas lazy. `ng build` compila.
5. **Frontend · pantalla 15.** Antes, el flujo de diseño de `CLAUDE.md`: ui-ux-pro-max y frontend-design, traducidos a los tokens de `styles.css` sin copiar colores del mockup. Después, `ng generate component pages/create-seller-page`, con el patrón «Formularios»:
   - `createEmptyForm()`, `prepareSavePayload()` y `markAllAsTouched()`.
   - No se manda un segundo envío mientras el primero sigue en curso.
   - Estados `form`/`saving`/`offline`/`created`, «Reintentar» y aviso flotante.
   - «Vendedor dado de alta» con resumen (nombre, correo, teléfono) y los botones «Ver mis vendedores» y «Dar de alta otro vendedor».
6. **Verificación manual** contra la base local. Dar de alta a «Luis» y entrar con su correo y su contraseña temporal: llega a «Mi stock». Probar el correo repetido y el teléfono con espacios.
7. **Cierre.** Actualizar `specs/README.md` y comentar el avance en `SCRUM-32` en cada paso, con el patrón de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-32`:

- [x] **1.** En «Vendedores», el botón «Nuevo vendedor» abre un formulario con nombre, teléfono, correo para entrar y contraseña temporal.
- [x] **2 (parcial).** Al guardar con los cuatro campos válidos, se ve «Vendedor dado de alta» con su resumen y un aviso flotante. El vendedor queda en `profiles` con `role = 'vendedor'`, `active = true` y el teléfono solo con dígitos. *Que aparezca en «Mis vendedores» y en «Viendo» con 0 piezas se verifica en HU-09 y HU-10.*
- [x] **3.** Con un campo vacío, solo espacios, un teléfono que no da 10 dígitos o una contraseña de menos de 8 caracteres, cada campo se marca con su mensaje y no se llama al backend.
- [x] **4.** Con un correo ya usado, se ve «Ya existe un acceso con ese correo» bajo el campo del correo, el backend responde `409` y no se crea nada, ni en Auth ni en `profiles`.
- [x] **5.** El vendedor recién creado inicia sesión con su correo y su contraseña temporal y llega a «Mi stock», sin costos ni ganancia.
- [x] **6.** Sin conexión, se ve el aviso con «Reintentar» y lo escrito no se pierde. «Reintentar» reenvía lo mismo, y un segundo clic mientras guarda no crea dos cuentas.

Además:

- [x] `POST /api/sellers` responde `403` a un vendedor y `401` sin sesión.
- [x] «55 2468 1357», «55-2468-1357» y «(55) 2468 1357» se guardan como `5524681357`. «+525524681357» y «552468135» dan `422`.
- [x] «Dar de alta otro vendedor» vuelve al formulario vacío.
- [x] Backend: `npm run type-check` y `npm test` pasan, con `SUPABASE_SERVICE_ROLE_KEY` puesta. Frontend: `ng build` y `ng test` pasan.

**Verificación manual (2026-10-29, base local):**
- Alta de «Luis Prueba» con «55 2468 1357»: llegó a «Vendedor dado de alta» con el aviso flotante, y en `profiles` quedó como `vendedor`, activo y con `5524681357`.
- El mismo correo otra vez: error bajo el correo, foco ahí y aviso rojo.
- Inicio de sesión con su correo y contraseña temporal: llega a `/vendedor/mi-stock`, sin costos.
- La primera prueba dio 500 porque el `next dev` en marcha conservaba un `schema.ts` sin `phone`: Drizzle ignora el campo, la base lo rechaza por el check de T-10 y la compensación borra la cuenta. Al reiniciar `npm run dev` funcionó. Ver §9.

## 7. Plan de pruebas

- **`backend/tests/sellers.test.ts`** (contra la base local; las cuentas llevan el prefijo `test-auth-` y se limpian antes y después):
  - Alta correcta: `201`, teléfono normalizado, perfil `vendedor` activo.
  - Las tres formas de teléfono válidas, y las inválidas dan `422`.
  - Correo repetido da `409`, y no queda un usuario de Auth huérfano.
  - Un vendedor recibe `403`; sin token, `401`.
  - El vendedor creado inicia sesión con `/api/auth/login` y su rol es `vendedor`.
- **`sellers/rules/seller.rules.spec.ts`:** `normalizePhone` con los mismos casos que el backend.
- **`sellers/services/seller-save.service.spec.ts`:** `409` → `duplicate-email`, `422` → `invalid` (con el mensaje), status 0 → `offline`, éxito → `ok`.
- **`pages/create-seller-page/create-seller-page.component.spec.ts`:**
  - Sin datos no llama al servicio.
  - Errores de campo.
  - «Guardando…» y que no haya doble envío.
  - Correo duplicado bajo el campo.
  - «Reintentar» reenvía el mismo valor.
  - Resumen y aviso de éxito.
  - «Dar de alta otro».
- **`pages/sellers-page/sellers-page.component.spec.ts`:** el botón lleva a `/admin/vendedores/nuevo`.

## 8. Decisiones

- **Sí:** «Correo para entrar» en vez de «Usuario para entrar», por la decisión de T-10. El mockup se queda como está; el spec documenta la diferencia.
- **Sí:** página mínima en `/admin/vendedores` con el botón, y el alta en `/admin/vendedores/nuevo` (decisión del usuario). Es el mismo camino que siguió HU-04 con Productos. HU-09 llena esa página con la lista.
- **No:** dejar «Próximamente» y entrar al alta solo por URL. El criterio 1 pide llegar desde «Vendedores».
- **Sí:** en «Vendedor dado de alta», los botones «Ver mis vendedores» y «Dar de alta otro vendedor», más el aviso flotante (decisión del usuario).
- **No:** «Dejarle producto» antes de HU-11. Llevaría a una pantalla que todavía no existe.
- **Sí:** teléfono con espacios, guiones o paréntesis, normalizado en los dos lados (decisión del usuario). Así funciona pegar un teléfono copiado.
- **No:** un input que solo acepta 10 números. Falla al pegar «55 2468 1357».
- **Sí:** el backend también normaliza y valida. La base solo acepta dígitos (T-10), y un cliente que se salte el frontend debe recibir `422`, no un error interno por el check.
- **No:** «¿Descartar los cambios?» al salir (decisión del usuario). Son 4 campos y el alta de producto tampoco pregunta.
- **Sí:** reusar el mensaje de `createAccount`, «Ya existe un acceso con ese correo», en vez de «Ya existe un vendedor con ese usuario» (Jira). El correo puede pertenecer a un administrador, y el mensaje actual es exacto.
- **Sí:** un pipe compartido `phone` (`shared/pipes/phone.pipe.ts`) para mostrar cualquier teléfono ya registrado, siempre como «55 2468 1357» (pedido del usuario al cerrar HU-08). Es solo presentación: la API y la base guardan los 10 dígitos, y el campo respeta lo que se escribe. Reemplaza a `formatPhone` de `sellers/rules`, que pasó a `shared/phone.ts`; las constantes del teléfono pasaron a `shared/constants/phone.constants.ts`.
- **Sí:** formulario dentro de la página (como `login-page`), sin componente presentacional aparte. Solo lo usa una pantalla; si después hace falta editar vendedores, se separa entonces.
- **Sí:** `SellerSaveService` por página, como `ProductSaveService`. La página no lee `HttpErrorResponse` (regla de `shared/http-errors.ts`).
- **No:** generar la contraseña temporal automáticamente ni pedir cambiarla en el primer acceso. No lo pide la historia; queda en «Por decidir» de Jira.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Agregar `phone` a `AccountView` rompe pruebas que comparan la vista completa | Paso 1: correr toda la suite de backend antes de seguir; ajustar solo las comparaciones exactas |
| El administrador da una contraseña temporal débil (8 caracteres) | Mismo mínimo que el resto de cuentas; endurecerlo o forzar el cambio en el primer acceso va en otra historia |
| La regla del teléfono en frontend y backend se desalinea | `normalizePhone` tiene el mismo contrato y los mismos casos de prueba en los dos lados, como `money.ts` |
| `next dev` sigue con un `schema.ts` viejo después de cambiar de rama o de fusionar una migración: los campos nuevos se ignoran sin error | Reiniciar `npm run dev` después de traer cambios de `schema.ts` (pasó en la verificación de HU-08) |
| Criterio 2 de Jira cerrado sin ver la lista | Queda marcado como parcial, con su verificación pendiente en HU-09 y HU-10 |

## Lo que **no** entra en este spec

- Lista «Mis vendedores» (HU-09) y barra «Viendo» (HU-10).
- «Dejarle producto» (HU-11).
- Editar, desactivar o reactivar vendedores, y el cambio de contraseña en el primer acceso.
- `GET /api/sellers`.
- Diálogo de cambios sin guardar.

Cada uno, si llega, va en su propio spec o en su historia.
