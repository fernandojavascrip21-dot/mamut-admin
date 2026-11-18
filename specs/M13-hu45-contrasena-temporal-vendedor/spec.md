# Spec — HU-45 · Ponerle una contraseña temporal a un vendedor

> **Estado:** Aprobado
> **Depende de:**
> - M13-t42-base-gestion-vendedores (`specs/M13-t42-base-gestion-vendedores/spec.md`): `PUT /api/sellers/[id]/password` (`setSellerPassword`, `validatePassword`, `revokeSessions`). Este spec cambia su respuesta de `204` a `200` con `emailStatus` (§3).
> - M13-hu43-ficha-editar-vendedor (`specs/M13-hu43-ficha-editar-vendedor/spec.md`): la ficha con sus botones y el patrón del pop-up «Editar datos» (`edit-seller-page` + `seller-edit-form`).
> - M13-hu44-desactivar-reactivar-eliminar-vendedor (`specs/M13-hu44-desactivar-reactivar-eliminar-vendedor/spec.md`): el módulo `notifications` (Resend, `EmailStatus`), `ToastService.warn()`, `SellersService.getAny()` y la ficha de un desactivado.
> - M7-t26-estados-pantallas (`specs/M7-t26-estados-pantallas/spec.md`): estados de cargando y error con «Reintentar».
> **Fecha:** 2026-11-18
> **Objetivo:** que el administrador le ponga una contraseña temporal a un vendedor activo desde su ficha, y que el vendedor reciba un correo que le avisa del cambio sin incluir la contraseña.

Fuentes:

- **Jira:** historia `SCRUM-109 · HU-45`, épica `SCRUM-105 · M13 · Gestión de vendedores (v2)`, requerimiento RF-36. Depende de T-42 (`SCRUM-106`), HU-43 (`SCRUM-107`) y HU-44 (`SCRUM-108`). Relacionada con HU-08 (`SCRUM-32`), HU-03 (`SCRUM-17`) y `SCRUM-110` (Resend en producción).
- **Mockups:** no hay pantalla de HU-45 en el canvas ni en Confluence. El pop-up sigue el patrón de «Editar datos» (HU-43).
- **Código:**
  - `backend/src/accounts/sellers.ts` (`setSellerPassword`) y `backend/app/api/sellers/[id]/password/route.ts`: hoy responden `204` sin cuerpo.
  - `backend/src/notifications/` (`index.ts`, `constants.ts`, `resend.ts`, `seller-status-email.ts`): el aviso de HU-44.
  - `src/app/features/sellers/pages/seller-detail-page/`: la ficha con «Editar datos», «Dejar» y «Retirar».
  - `src/app/features/sellers/pages/edit-seller-page/` y `components/seller-edit-form/`: el patrón de pop-up con página y formulario presentacional.
  - `src/app/features/sellers/services/seller-update.service.ts` y `seller-status.service.ts`: el patrón de servicio que traduce errores HTTP a un resultado.
  - `src/app/shared/constants/modal.constants.ts`, `src/app/shared/utils/modal-links.ts` y `src/app/core/layout/routes/admin.routes.ts`: el outlet `ventana`.
  - `src/app/features/sellers/constants/create-seller-page.constants.ts`: `MIN_PASSWORD = 8`.
- **Decisiones del usuario** del 2026-11-18 (§9).

## 1. Por qué existe este spec

T-42 dejó en el backend el cambio de contraseña, que además cierra todas las sesiones del vendedor. Pero ninguna pantalla lo usa. Hoy, si un vendedor olvida su contraseña, el administrador no puede ayudarle sin entrar a Supabase.

El usuario pidió además que el vendedor se entere por correo, como en HU-44. Así, un cambio que el vendedor no pidió no pasa sin aviso. La contraseña **no** va en el correo: el administrador se la da en persona.

## 2. Alcance

**Entra en este spec:**

- **Ficha** (`seller-detail-page`): botón secundario «Cambiar contraseña», solo para un vendedor activo. Abre el pop-up.
- **Pop-up «Cambiar contraseña»** en el outlet `ventana`:
  - ruta `(ventana:vendedor/:sellerId/contrasena)`;
  - página nueva `features/sellers/pages/seller-password-page/`, que carga al vendedor con `getAny` y guarda;
  - formulario presentacional nuevo `features/sellers/components/seller-password-form/` con «Contraseña temporal» y «Confirmar contraseña» (`p-password` con ojo, sin medidor).
- **Validación:** mínimo 8 caracteres y las dos iguales. Un validador de grupo nuevo en `features/sellers/validators/seller-password.validators.ts`.
- **Servicios:**
  - `SellersService.setPassword(id, input)`;
  - nuevo `features/sellers/services/seller-password.service.ts` (`SellerPasswordService`, sin `providedIn`), que traduce la respuesta a un resultado.
- **Avisos:** un toast de éxito, o `warn` cuando `emailStatus` no es `'sent'`.
- **Backend:**
  - `setSellerPassword` devuelve `{ emailStatus }` y manda el aviso después de cerrar las sesiones;
  - la ruta `PUT` responde `200` con `{ emailStatus }`;
  - `notifications` suma `sendSellerPasswordEmail` con su **plantilla propia** de Resend, leída de la variable nueva `RESEND_TEMPLATE_SELLER_PASSWORD`;
  - `escapeHtml` pasa a un archivo del módulo que comparten los dos avisos.
- **Pruebas:**
  - `.spec.ts` nuevos para lo nuevo;
  - en `backend/tests/sellers-manage.test.ts` (desbloqueado), solo los `it` que esperan `204`;
  - `backend/tests/seller-password-email.test.ts` y `e2e/M13-hu45-contrasena-temporal-vendedor.spec.ts` (§7).
- **Documentación:**
  - `specs/README.md`: la fila nueva y las relaciones;
  - en `CLAUDE.md` y `AGENTS.md`, la línea del módulo `notifications` suma `sendSellerPasswordEmail` y `RESEND_TEMPLATE_SELLER_PASSWORD`;
  - `backend/.env.example`.

**No entra en este spec:**

- Mandar la contraseña o un enlace en el correo.
- Obligar al vendedor a cambiarla en su primer inicio de sesión: es otro spec.
- Un botón «Generar contraseña».
- Cambiar la contraseña de un desactivado desde la pantalla. El backend lo sigue permitiendo (T-42).
- Que el vendedor cambie su propia contraseña, o un «Olvidé mi contraseña» en el login.
- Cambiar la contraseña de un administrador.
- Reintentar el correo si falla, o una cola de avisos.
- Verificar el dominio de Resend: es `SCRUM-110`.
- Cambios en la base de datos.

## 3. Reglas de negocio y pantallas

### Quién

Solo el administrador. La ruta ya exige `requireRole(request, 'admin')`: un vendedor recibe `403` y una petición sin sesión, `401`. La ficha vive en `/admin/vendedores/:id`, así que un vendedor nunca la descarga.

### Ficha (`/admin/vendedores/:id`)

- Un **activo** muestra «Cambiar contraseña» (`pButton severity="secondary"`, clase de prueba `change-password`). Va junto a «Editar datos».
  - En el teléfono, «Dejar» y «Retirar» siguen en la primera fila. «Editar datos» y «Cambiar contraseña» comparten la segunda fila, mitad y mitad.
  - Desde `md`, todo queda en una sola fila: «Editar datos», «Cambiar contraseña», «Retirar» y «Dejar».
- Un **desactivado** no muestra «Cambiar contraseña». Su vista (HU-44) no cambia: «Editar datos» sigue a todo el ancho.
- El enlace es `sellerPasswordModalLink(sellerId)`.

### Pop-up «Cambiar contraseña» (`(ventana:vendedor/<id>/contrasena)`)

- Va dentro de `app-modal-panel` con el título «Cambiar contraseña». Debajo del título se ve el nombre del vendedor («Para Ana López»).
- Al abrir, carga al vendedor con `SellersService.getAny(id)` (`rxResource`):
  - **cargando:** el spinner y «Cargando vendedor…», igual que «Editar datos»;
  - **error de red o `5xx`:** «No pudimos cargar al vendedor» con «Reintentar» (`reload()`);
  - **`404`:** «Este vendedor ya no existe» con «Cerrar»;
  - **desactivado** (`active: false`, por ejemplo con un enlace viejo): «Está desactivado. Reactívalo para cambiarle la contraseña.» con «Cerrar». No hay formulario.
- **Formulario** (`seller-password-form`):
  - «Contraseña temporal» y «Confirmar contraseña», cada uno con `p-password`, `[toggleMask]="true"`, `[feedback]="false"`, `inputId` propio y `autocomplete="new-password"`;
  - pista bajo el primer campo: «Mínimo 8 caracteres. Dísela en persona al vendedor.»;
  - «Cancelar» (`secondary`) y «Cambiar contraseña» (principal; mientras guarda, «Cambiando…» y deshabilitado).
- **Errores de campo**, que se ven al enviar y no al tocar:
  - contraseña vacía: «Escribe la contraseña temporal»;
  - menos de 8 caracteres: «Usa al menos 8 caracteres»;
  - confirmación vacía: «Confirma la contraseña»;
  - distintas: «Las contraseñas no coinciden», que se ve en el campo de confirmación.
- **Envío:**
  - si el formulario es inválido, `markAllAsTouched()` y no se envía;
  - el payload es `{ password }`, sin la confirmación;
  - no hay segundo envío mientras corre el primero, y mientras guarda el pop-up no se cierra (`[closable]="!saving()"` y `modalSavingGuard`).
- **Resultado:**
  - **`200`, `emailStatus: 'sent'`:** toast de éxito «Se cambió la contraseña de Ana López. Compártesela en persona.» y el pop-up se cierra;
  - **`200`, `'failed'` o `'skipped'`:** `ToastService.warn()` con «Se cambió la contraseña, pero no se pudo avisarle por correo» y el pop-up se cierra. La contraseña quedó cambiada;
  - **`422`:** el error del backend se pone en «Contraseña temporal» («Usa al menos 8 caracteres»). Con la validación del frontend esto no debería pasar;
  - **`404`:** alerta «Este vendedor ya no existe» con «Cerrar»;
  - **sin red o `5xx`:** alerta «No se pudo cambiar la contraseña» con «Reintentar», que reenvía lo escrito. El formulario conserva sus valores.
- **Cerrar con algo escrito** («Cancelar», la X o «Atrás») cierra sin preguntar y descarta lo escrito (§9).
- **La contraseña nunca:**
  - se muestra fuera de los dos campos;
  - va en la URL, en un toast, en `localStorage` o `sessionStorage`, ni en un `signal` fuera del formulario;
  - se registra en consola.

  Al cerrar el pop-up, el componente se destruye con su formulario.

### Backend: `PUT /api/sellers/[id]/password`

- El cuerpo `{ password }`, la validación (`422` con menos de 8) y el `404` no cambian.
- El orden es:
  1. `auth.admin.updateUserById(id, { password })`;
  2. `revokeSessions(id)`;
  3. el aviso por correo.
- El correo sale después de los dos primeros pasos, nunca antes. Si falla, el cambio y el cierre de sesiones ya quedaron aplicados.
- El correo va a la dirección que devuelve `updateUserById` (`data.user.email`), sin otra llamada a Auth. El nombre es `profiles.full_name`, que ya lee `findSeller`.
- Responde `200` con `{ "emailStatus": "sent" | "failed" | "skipped" }`. Nunca es `null`: la contraseña siempre cambia.
- La contraseña nunca se devuelve, nunca se registra y nunca se pasa al módulo `notifications`.
- Un desactivado sigue aceptado por el backend (prueba con commit «funciona con un vendedor desactivado») y también recibe el aviso. El frontend no ofrece esa acción.

### Correo al vendedor (módulo `notifications`)

- **Plantilla propia** en Resend, id `da0d5fef-f243-4025-877e-dbc377e7e853`. El id **no** va en el código: se lee de `RESEND_TEMPLATE_SELLER_PASSWORD`, opcional como las otras tres variables.
  - Si falta, o falta `RESEND_API_KEY` o `RESEND_FROM`, el resultado es `'skipped'` y no sale ninguna petición.
  - Lo resuelve el `sendEmail` actual, que ya devuelve `'skipped'` cuando el `templateId` está vacío.
- **Variables:** `NAME`, `HEADLINE`, `MESSAGE` y `NOTE`, con el mismo contrato que HU-44.
  - `NAME` va escapado para HTML por el backend.
  - `HEADLINE` también es el asunto.
  - En el paso 1 se confirma en la cuenta de Resend que la plantilla nueva usa esas cuatro variables. Si usa otras, se detiene y se pregunta.
- **Textos**, en `notifications/constants.ts` como `SELLER_PASSWORD_TEXTS`:

| Variable | Texto |
| --- | --- |
| `HEADLINE` y asunto | Tu contraseña de Mammut fue cambiada |
| `MESSAGE` | Tu administrador te asignó una contraseña temporal. Pídesela a tu administrador para entrar a la app. |
| `NOTE` | Por seguridad, no incluimos tu contraseña en este correo. |

- El correo no lleva la contraseña, enlaces ni el nombre del administrador.
- **Función pública:** `sendSellerPasswordEmail({ to, name }): Promise<EmailStatus>` en `index.ts`. Nunca lanza, y sin `to` devuelve `'skipped'`. Su texto lo arma `seller-password-email.ts` (`sellerPasswordEmail(name)`), que devuelve `{ subject, variables }`.
- **`escapeHtml`** sale de `seller-status-email.ts` a `notifications/escape-html.ts`, que usan los dos avisos. El comportamiento no cambia.
- **En local y en las pruebas:** sin las variables, `emailStatus` es `'skipped'`. Las pruebas de envío reemplazan `fetch` (`vi.stubGlobal`) y nunca mandan un correo real.

### Sesiones del vendedor

Esto no cambia (T-42): al cambiar la contraseña se cierran todas sus sesiones. En su siguiente acción en cualquier celular, el `authInterceptor` lo lleva al login, donde entra con la contraseña nueva. La anterior da `401`.

### 375 px

- El pop-up ocupa el ancho de `modal-panel`, con los campos a todo el ancho y los botones a la altura de toque de la app (`h-11` o más).
- El ojo de `p-password` queda dentro del campo, sin desbordarse.
- En la ficha, la segunda fila de botones no se desborda con «Cambiar contraseña».

## 4. Modelo de datos

Este spec no cambia la base de datos.

Backend:

```ts
// backend/src/accounts/sellers.ts
export async function setSellerPassword(id: string, password: string): Promise<{ emailStatus: EmailStatus }>

// backend/src/notifications/index.ts
export async function sendSellerPasswordEmail(input: { to: string | null; name: string }): Promise<EmailStatus>

// backend/src/notifications/constants.ts
export const SELLER_PASSWORD_TEXTS = { headline: '…', message: '…', note: '…' } as const
```

Frontend, en `features/sellers/interfaces/seller.models.ts`:

```ts
export interface SetSellerPasswordInput { password: string }
export interface SellerPasswordResponse { emailStatus: EmailStatus }
export type SellerPasswordFailure = 'invalid' | 'not-found' | 'offline';
export type SellerPasswordResult =
  { ok: true; emailStatus: EmailStatus } | { ok: false; reason: SellerPasswordFailure; message?: string };
```

- `models/seller-password-page.models.ts`: `SellerPasswordPageState = 'loading' | 'error' | 'not-found' | 'inactive' | 'ready'`. El estado `ready` lleva además los avisos de guardado (`offline`, `not-found`) en un `signal` aparte, como en `edit-seller-page`.
- `components/seller-password-form/seller-password-form.models.ts`: la forma del formulario `{ password: string; confirmation: string }` y el `output()` `save` con `SetSellerPasswordInput`.
- **Constantes:**
  - `constants/seller-password-page.constants.ts`: textos del pop-up y de los toasts;
  - `seller-password-form.constants.ts`: etiquetas, pista y mensajes de campo;
  - el texto «Cambiar contraseña» de la ficha va en `seller-detail-page.constants.ts`;
  - `MIN_PASSWORD` pasa de `create-seller-page.constants.ts` a `constants/sellers.constants.ts`. `create-seller-page.constants.ts` lo vuelve a exportar desde ahí, así que lo que ya lo importa sigue igual.
- **Outlet:**
  - `MODAL_SELLER_PASSWORD_PATH = 'contrasena'` en `shared/constants/modal.constants.ts`;
  - `sellerPasswordModalLink(sellerId)` en `shared/utils/modal-links.ts`, que da `['/admin', { outlets: { ventana: ['vendedor', sellerId, 'contrasena'] } }]`.

## 5. Plan de implementación

0. **Desbloqueo (antes de empezar).** Hay tres `it` con commit en `backend/tests/sellers-manage.test.ts` que esperan `204`: «con una válida da 204…», «el token y el refresh token anteriores dan 401» y «funciona con un vendedor desactivado». Uno además espera el cuerpo vacío. El usuario corre `./desbloquear sellers-manage`. En esos tres `it` solo se cambia `204` por `200` y el cuerpo vacío por `{ emailStatus }`. Las demás aserciones no se tocan. Si falla un `it` congelado de la ficha (por ejemplo, por las clases de «Editar datos»), se detiene y se pide `./desbloquear seller-detail-page`.
1. **Backend: aviso de contraseña.**
   - `notifications/escape-html.ts`, `seller-password-email.ts`, `SELLER_PASSWORD_TEXTS` y `sendSellerPasswordEmail` en `index.ts`;
   - `# RESEND_TEMPLATE_SELLER_PASSWORD=` en `backend/.env.example`;
   - `backend/tests/seller-password-email.test.ts` con el texto, el escape, `skipped`, `sent` y `failed`.
   - `npm run type-check` y `architecture.test.ts` pasan, y `seller-status-email.test.ts` sigue verde.
   - Se confirman las variables de la plantilla `da0d5fef-…` en Resend.
2. **Backend: ruta.** `setSellerPassword` manda el aviso y devuelve `{ emailStatus }`, y la ruta responde `200`. Al mismo archivo de prueba se suman las pruebas con la base real. Se cambian los tres `it` desbloqueados.
3. **Frontend: modelos, constantes y servicios.**
   - los tipos de §4, `MIN_PASSWORD` en `sellers.constants.ts`, `MODAL_SELLER_PASSWORD_PATH` y `sellerPasswordModalLink`;
   - `SellersService.setPassword` y `SellerPasswordService`, con sus specs nuevos.
   - `ng build` pasa.
4. **Validador.** `passwordsMatchValidator` en `seller-password.validators.ts`, con su spec.
5. **Formulario.** `ng generate component features/sellers/components/seller-password-form`, con `p-password` importado de `primeng/password`, sus mensajes y su spec.
6. **Pop-up.**
   - `ng generate component features/sellers/pages/seller-password-page`;
   - la ruta en `admin.routes.ts` con `modalSavingGuard` y `data: { title: 'Cambiar contraseña' }`;
   - los estados de carga, el envío y los toasts;
   - el spec de la página y un spec nuevo de la ruta (`admin.routes.seller-password.spec.ts`).
7. **Ficha.** El botón «Cambiar contraseña» solo para activos, con su enlace. Spec en el archivo nuevo `seller-detail-page.component.password.spec.ts`.
8. **End-to-end.** `e2e/M13-hu45-contrasena-temporal-vendedor.spec.ts` (§7) y la suite completa de Playwright contra la base local.
9. **Documentación.** `specs/README.md` y la línea de `notifications` en `CLAUDE.md` y `AGENTS.md`, que se mantienen iguales.

## 6. Criterios de aceptación

Criterios de Jira (`SCRUM-109`):

- [ ] **1.** En la ficha de un activo, «Cambiar contraseña» abre un pop-up con «Contraseña temporal» (mínimo 8 caracteres) y «Confirmar contraseña». Los errores aparecen al enviar, no al escribir.
- [ ] **2.** Al guardar, un toast avisa que la contraseña cambió y pide compartirla. La contraseña no aparece en la ficha, en el toast, en la URL ni en el almacenamiento del navegador (`localStorage` y `sessionStorage` vacíos de ella).
- [ ] **3.** El vendedor entra con la contraseña nueva y la anterior da error de inicio de sesión.
- [ ] **4.** Mientras guarda, el botón dice «Cambiando…» y un segundo clic no manda otra petición. La carga y el guardado sin red muestran su aviso con «Reintentar». El pop-up y la ficha se ven sin desbordarse a 375 px.
- [ ] **5.** Con Resend configurado, el vendedor recibe en su correo registrado «Tu contraseña de Mammut fue cambiada». El correo no trae la contraseña ni enlaces.
- [ ] **6.** Si el correo falla o no está configurado, la contraseña queda cambiada y el administrador ve «Se cambió la contraseña, pero no se pudo avisarle por correo».

Criterios propios:

- [ ] La ficha de un desactivado no muestra «Cambiar contraseña». Abrir `(ventana:vendedor/<id>/contrasena)` de un desactivado muestra «Está desactivado…» sin formulario.
- [ ] Las contraseñas distintas muestran «Las contraseñas no coinciden» y no mandan petición. Con 7 caracteres se ve «Usa al menos 8 caracteres».
- [ ] El ojo muestra y oculta cada campo por separado.
- [ ] `PUT /api/sellers/[id]/password` responde `200` con `{ emailStatus }` y nunca con la contraseña. Responde `422` con 7 caracteres, `404` si el vendedor no existe, `403` a un vendedor y `401` sin sesión.
- [ ] Después del cambio, el token y el refresh token anteriores del vendedor dan `401`. Esto ya venía de T-42 y sigue igual.
- [ ] La petición a Resend lleva `template.id` tomado de `RESEND_TEMPLATE_SELLER_PASSWORD` y las variables `NAME`, `HEADLINE`, `MESSAGE` y `NOTE`. Ningún valor contiene la contraseña, y el id de la plantilla no está escrito en el código.
- [ ] Sin `RESEND_TEMPLATE_SELLER_PASSWORD`, la ruta responde `'skipped'` sin llamar a Resend. El aviso de estado de HU-44 sigue mandándose con su propia plantilla.
- [ ] El log del servidor al fallar el correo no incluye el correo, el mensaje ni la contraseña.
- [ ] `ng build`, `npm run check:architecture` y `ng test` pasan.
- [ ] En `backend/`: `npm run type-check`, `npm run build` y `npm test` pasan contra la base local, con `SUPABASE_SERVICE_ROLE_KEY` definida y sin pruebas omitidas. En `sellers-manage.test.ts` solo cambiaron los tres `it` del paso 0.
- [ ] `npm run test:e2e` pasa completo contra la base local.
- [ ] `specs/README.md`, `CLAUDE.md`, `AGENTS.md` y `backend/.env.example` están actualizados.

## 7. Plan de pruebas

**Backend** (Vitest; `backend/tests/seller-password-email.test.ts` es un archivo nuevo; `fetch` se reemplaza con `vi.stubGlobal` y lo que no es de Resend pasa al `fetch` verdadero):

- `sellerPasswordEmail` devuelve el asunto y las cuatro variables de la tabla de §3. Un nombre con `<script>` y `&` va escapado en `NAME`. Ningún texto lleva enlaces.
- `sendSellerPasswordEmail`:
  - sin `RESEND_TEMPLATE_SELLER_PASSWORD` (con las otras dos puestas) da `'skipped'` y no llama a `fetch`;
  - con `2xx` da `'sent'`, con `template.id` de esa variable;
  - con `4xx`, `5xx` o un `fetch` que lanza da `'failed'`, sin lanzar.
- Con la base real:
  - `PUT` válido responde `200` con `emailStatus: 'sent'`, manda un solo correo a la dirección de la cuenta y la contraseña no aparece en el cuerpo de la petición a Resend;
  - con `fetch` fallando responde `'failed'`, la contraseña nueva entra y la anterior no;
  - `422` y `404` no llaman a `fetch`.
- `escape-html` mantiene el escape de HU-44 (`seller-status-email.test.ts` sin cambios y en verde).

**Unitarias del frontend** (Vitest, `ng test`), en archivos nuevos:

- `sellers.service.password.spec.ts`: `PUT /api/sellers/<id>/password` con `{ password }`.
- `seller-password.service.spec.ts`:
  - `200` da `ok` con `emailStatus`;
  - `422` da `invalid` con el mensaje;
  - `404` da `not-found`;
  - `0` y `500` dan `offline`.
- `seller-password.validators.spec.ts`: iguales es válido, distintas da `mismatch` en la confirmación y vacías no da `mismatch`.
- `seller-password-form.component.spec.ts`:
  - los errores aparecen solo al enviar;
  - los cuatro mensajes;
  - el formulario inválido no emite;
  - el válido emite `{ password }` sin la confirmación;
  - con `saving` el botón dice «Cambiando…» y está deshabilitado;
  - `autocomplete="new-password"` y el ojo en los dos campos.
- `seller-password-page.component.spec.ts`:
  - carga con `?status=any` y sus estados de cargando, error con «Reintentar», `404` y desactivado;
  - el éxito con `'sent'` muestra el toast de éxito y cierra;
  - con `'failed'` y `'skipped'` muestra `warn` y cierra;
  - `422` lleva el error al campo;
  - sin red, «Reintentar» reenvía;
  - no hay doble envío;
  - nada de la contraseña llega a `localStorage` ni `sessionStorage`.
- `admin.routes.seller-password.spec.ts`: la ruta vive en el outlet `ventana` con `modalSavingGuard`.
- `seller-detail-page.component.password.spec.ts`: un activo tiene el botón con el enlace al pop-up y un desactivado no lo tiene.

**End-to-end** (`e2e/M13-hu45-contrasena-temporal-vendedor.spec.ts`, proyectos `escritorio` y `movil`):

- Se da de alta un vendedor `test-e2e-` y se abre su ficha.
- Con su sesión abierta en otro contexto del navegador, se pulsa «Cambiar contraseña» y luego:
  - enviar vacío muestra los errores;
  - distintas muestra «Las contraseñas no coinciden»;
  - una válida y su confirmación cierran el pop-up con «Se cambió la contraseña, pero no se pudo avisarle por correo» (en local no hay Resend).
- La siguiente acción del vendedor en el otro contexto lo lleva al login. La contraseña vieja falla y la nueva entra.
- Después de desactivarlo, su ficha no muestra «Cambiar contraseña».
- Limpieza: se elimina el vendedor, que no tiene movimientos.
- El correo real se comprueba a mano con una cuenta de Resend y la plantilla publicada, nunca en la suite.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los tres `it` con commit de `sellers-manage.test.ts` esperan `204` | Paso 0: `./desbloquear sellers-manage`. Solo cambian el status y el cuerpo |
| La plantilla `da0d5fef-…` usa variables distintas de `NAME`/`HEADLINE`/`MESSAGE`/`NOTE` | Se confirma en el paso 1. Si no coinciden, se detiene y se pregunta antes de seguir |
| `backend/.env` con las variables de Resend puestas haría que `sellers-manage.test.ts` mandara correos reales al cambiar contraseñas | Antes de `npm test` se revisa el bloque activo de `backend/.env` (memoria del proyecto) y se corre sin `RESEND_*`. Las pruebas de envío siempre reemplazan `fetch` |
| El navegador ofrece guardar la contraseña temporal en su gestor | `autocomplete="new-password"` en los dos campos. El gestor del navegador queda fuera del control de la app, así que el criterio 2 se mide en `localStorage` y `sessionStorage` |
| La contraseña viaja a Resend por error | `sendSellerPasswordEmail` no recibe la contraseña en su firma, y una prueba comprueba que no aparece en el cuerpo de la petición |
| El vendedor recibe el aviso pero el administrador no le da la contraseña | El texto del correo le dice que se la pida, y el toast le recuerda al administrador que la comparta |
| `p-password` es un control de PrimeNG que la app no usaba | Se importa de `primeng/password` solo en el formulario. Si el preset `MAMMUT_THEME` no lo pinta bien, se suma su subpreset de Aura en `mammut-theme.constants.ts` sin hex |

## 9. Decisiones

- **Sí:** el formulario es un pop-up propio en el outlet `ventana` (`vendedor/:sellerId/contrasena`), con un botón en la ficha. **No** va como una sección de «Editar datos», que mezclaría dos envíos en un formulario (decisión del usuario).
- **Sí:** la ruta responde `200` con `{ emailStatus }`, el mismo patrón que los `POST` de HU-44, y se desbloquea `sellers-manage`. **No** se usa una cabecera `X-Email-Status`, que no existe en el repo y obligaría a exponerla en CORS. **No** se crea una ruta nueva que repita la que ya existe (decisión del usuario).
- **Sí:** solo se ofrece para activos. Un correo que dice «pídele tu contraseña» no sirve si no puede entrar (decisión del usuario). **No** se cambia el backend: sigue aceptando a un desactivado (T-42).
- **No:** el botón «Generar contraseña». La escribe el administrador; si hace falta, va en otro spec (decisión del usuario).
- **Sí:** el aviso usa una **plantilla propia** de Resend (`da0d5fef-f243-4025-877e-dbc377e7e853`) con su variable `RESEND_TEMPLATE_SELLER_PASSWORD` (decisión del usuario). **No** se reusa «Aviso de estado del vendedor».
- **No:** la contraseña no va en el correo. El usuario lo consideró y lo descartó; se mantiene el criterio 5 de `SCRUM-109`.
- **No:** el cambio obligatorio en el primer inicio de sesión. Si algún día la contraseña va por correo, es otro spec.
- **Sí:** el ojo en cada campo (`p-password` con `toggleMask`, sin medidor) para no equivocarse en el celular (decisión del usuario).
- **Sí:** al guardar se cierra con un toast, y con `warn` si el correo no salió (decisión del usuario).
- **Sí:** se siguen cerrando todas las sesiones del vendedor. Ya lo decidió el usuario en T-42, y así se cierra el «Por decidir» de `SCRUM-109`.
- **Sí:** el correo sale después de cambiar la contraseña y cerrar las sesiones. Un fallo nunca revierte el cambio (patrón de HU-44).
- **Sí:** `modalSavingGuard` en lugar de un guard de cambios sin guardar. Cerrar con algo escrito no pregunta, porque guardar una contraseña a medias no tiene valor y no conviene retenerla.
- **Sí:** la dirección del correo sale de la respuesta de `updateUserById`, sin pedirle otra vez la cuenta a Auth.
- **Sí:** `escapeHtml` pasa a un archivo compartido del módulo, en lugar de copiarse.
- **Sí:** `MIN_PASSWORD` se mueve a `sellers.constants.ts` con una reexportación, para que el alta y el pop-up usen el mismo mínimo sin romper imports.

## Lo que **no** entra en este spec

- La contraseña o un enlace dentro del correo.
- El cambio obligatorio de contraseña en el primer inicio de sesión.
- «Generar contraseña».
- Cambiar la contraseña de un desactivado o de un administrador desde la pantalla.
- Que el vendedor cambie su contraseña o use «Olvidé mi contraseña».
- Reintentos o una cola de correos.
- Verificar el dominio de Resend (`SCRUM-110`).
- Cambios en la base de datos.

Cada uno, si llega, va en su propio spec.
