# Spec técnico — T-44 · Aviso por correo al eliminar a un vendedor

> **Estado:** Aprobado
> **Depende de:** M13-hu44-desactivar-reactivar-eliminar-vendedor (`specs/M13-hu44-desactivar-reactivar-eliminar-vendedor/spec.md`) — módulo `notifications` y `sendEmail`; M13-hu45-contrasena-temporal-vendedor (`specs/M13-hu45-contrasena-temporal-vendedor/spec.md`) — borrado y archivado al eliminar (§10) y plantilla propia por aviso; M13-t42-base-gestion-vendedores (`specs/M13-t42-base-gestion-vendedores/spec.md`) — `DELETE /api/sellers/[id]`; M13-t43-correo-resend-produccion (`specs/M13-t43-correo-resend-produccion/spec.md`) — Resend ya configurado en producción
> **Fecha:** 2026-11-21
> **Objetivo:** que al eliminar a un vendedor (se borre o se archive) reciba un correo de Resend, con una plantilla propia, que le avise que su cuenta ya no existe, sin cambiar la respuesta de la ruta ni poder deshacer la eliminación.

Fuentes:

- **Jira:** tarea `SCRUM-113 · T-44`, épica `SCRUM-105 · M13 · Gestión de vendedores (v2)`.
- **Código:**
  - `backend/src/accounts/sellers.ts`: `deleteSeller` (borra con `purgeSeller` si no hay movimientos; archiva si los hay y no tiene piezas; da `409` con piezas) y `findSeller`.
  - `backend/app/api/sellers/[id]/route.ts`: `DELETE`, responde `204` sin cuerpo.
  - `backend/src/notifications/`: `index.ts` (`sendSellerStatusEmail`, `sendSellerPasswordEmail`), `resend.ts` (`sendEmail`), `constants.ts`, `seller-status-email.ts`, `seller-password-email.ts`, `escape-html.ts`.
  - Pruebas con commit que hoy afirman «eliminar no manda correo»: `backend/tests/seller-status-email.test.ts` y `backend/tests/seller-archive.test.ts` (§5, paso 0).
- **Decisiones del usuario del 2026-11-21:** ver §7.

## 1. Por qué existe este spec

HU-44 dejó fuera el correo al eliminar («Al eliminar no hay correo»): un vendedor eliminado no puede volver a entrar, así que no hacía falta avisarle. El usuario quiere que sí se le avise, para que no se quede sin entender por qué ya no entra.

La plantilla de Resend ya está creada en la cuenta del usuario (id que empieza con `269f9848-…`) y su id vivirá en la variable `RESEND_TEMPLATE_SELLER_DELETE`. Falta el código que la use.

Eliminar tiene dos caminos y el mensaje cambia entre ellos:

- **Sin historial:** se borra de verdad, perfil y cuenta de Auth. No queda rastro de sus datos.
- **Con historial y sin piezas:** se archiva, y su correo de Auth cambia a `archivado-<id>@mammut.invalid`. Sus ventas se conservan.

Por eso el aviso lee el correo y el nombre **antes** de eliminar, y manda **después**, al correo original.

## 2. Alcance

**Entra en este spec:**

- **Backend, módulo `notifications`:**
  - Tipo `SellerDeletedKind` (`'archived' | 'purged'`) y `SellerDeletedVariables` (las mismas cuatro variables de las otras plantillas).
  - Textos en `constants.ts` (§3) y archivo nuevo `seller-deleted-email.ts` con `sellerDeletedEmail(kind, name)`, que devuelve `{ subject, variables }` como `sellerStatusEmail`.
  - `sendSellerDeletedEmail({ to, name, kind })` en `index.ts`, con la misma forma que los otros dos: nunca lanza y devuelve `'sent' | 'failed' | 'skipped'`.
- **Backend, módulo `accounts`:** `deleteSeller` guarda el nombre (de `findSeller`) y el correo original (`archivedEmail`, que ya lee), y manda el aviso al terminar bien cualquiera de los dos caminos.
- **Variable de entorno** `RESEND_TEMPLATE_SELLER_DELETE`, opcional como las otras: sin ella (o sin clave o remitente) el aviso es `'skipped'` y la eliminación funciona igual.
- **Documentación:** `backend/.env.example` y `backend/README.md` (cinco variables), `CLAUDE.md` y `AGENTS.md` (línea de `notifications`), `specs/README.md` (fila y relación).
- **Pruebas:** archivo nuevo `backend/tests/seller-deleted-email.test.ts` y el ajuste de tres `it` con commit (§5, paso 0).

**No entra en este spec:**

- **Cambiar la respuesta de `DELETE`:** sigue `204` sin cuerpo. El administrador no ve si el correo salió; el resultado solo queda en el log del backend (sin el correo ni el mensaje). Un `emailStatus` en la respuesta y un aviso en pantalla, como en desactivar, irían en otra historia.
- **Frontend:** no cambia nada, ni el servicio ni la ficha.
- **Diseño del correo:** el HTML de la plantilla vive en Resend, no en el repo. Ya está creado.
- **Cargar la variable en Vercel y redesplegar:** es el paso manual de §5 (paso 6), igual que en T-43.
- **Avisos nuevos:** al editar el correo del vendedor, al darlo de alta o al administrador.
- **Reintentos, cola o confirmación de entrega.**
- **El caso 409:** si el vendedor tiene piezas, no se elimina y no se avisa.

## 3. Modelo de datos

Este spec no introduce tablas, columnas ni migraciones. Solo suma configuración, tipos y textos.

**Variable de entorno** (opcional, solo del servidor):

| Variable | Valor |
| --- | --- |
| `RESEND_TEMPLATE_SELLER_DELETE` | id de la plantilla publicada «eliminación» de la cuenta de Resend (empieza con `269f9848-`). Nunca va escrito en el código ni en el repo. |

**Tipos** (`notifications/constants.ts`, con el resto de los tipos de avisos):

```ts
export type SellerDeletedKind = 'archived' | 'purged'
// Las mismas cuatro variables de la plantilla: NAME, HEADLINE, MESSAGE y NOTE.
export type SellerDeletedVariables = SellerStatusVariables
```

**Textos** (`SELLER_DELETED_TEXTS`, un objeto en `constants.ts`; `seller-deleted-email.ts` solo los combina con el nombre):

| | Texto |
| --- | --- |
| `HEADLINE` y asunto | Tu cuenta de Mammut fue eliminada |
| `MESSAGE` | Tu usuario en Mammut fue eliminado y ya no podrás entrar a la app. |
| `NOTE` si se **archivó** (tenía historial) | Tu historial de ventas se conserva. |
| `NOTE` si se **borró** (sin historial) | Ya no hay datos tuyos en la app. |
| `NAME` | Nombre del vendedor, **escapado para HTML** con `escapeHtml` (la plantilla usa triple llave `{{{NAME}}}`). |

Reglas:

- La plantilla ya trae el encabezado, el saludo «Hola {nombre},» y el pie «Si crees que es un error, habla con tu administrador.»; el backend no los repite.
- Sin contraseñas, enlaces, cifras ni el nombre del administrador.
- El asunto se manda también en la petición, como en los otros avisos, para no depender de la plantilla.

## 4. Cómo funciona

**Cuándo se manda.** Solo cuando `deleteSeller` termina bien:

- **Camino «borrado»** (sin movimientos): después de que `purgeSeller` borra el perfil y la cuenta de Auth.
- **Camino «archivado»** (con historial y sin piezas): después de que el perfil queda archivado **y** Auth libera el correo. Si Auth falla y `deleteSeller` deshace el archivado (compensación), **no** se manda nada.
- Se manda siempre, aunque el vendedor ya estuviera desactivado: desactivar y eliminar son cosas distintas para quien recibe el aviso.
- Con `409` (piezas) o `404` (no existe o ya archivado) no se manda nada.

**A quién y con qué nombre.** Al correo con el que entraba. `deleteSeller` ya lo lee de Auth antes de tocar nada (`archivedEmail`) y el nombre sale de `findSeller`. En el camino «archivado» el correo de Auth cambia después a `archivado-<id>@mammut.invalid`, así que el aviso usa el valor leído antes, nunca el de después. Si el vendedor no tiene correo (cadena vacía), no hay a quién escribir y el aviso es `'skipped'`.

**Cuándo sale, respecto al cambio.** Después de confirmar la eliminación, fuera de la transacción, y la ruta lo espera (máximo 5 s de espera, el de `sendEmail`): en un servidor sin estado, un envío sin esperar puede cortarse al responder. El resultado (`'sent' | 'failed' | 'skipped'`) no cambia la respuesta: sigue `204`. Un fallo se registra con `console.error` y el motivo, sin el correo ni el cuerpo, como ya hace `sendEmail`.

## 5. Plan de implementación

0. **Antes, el usuario desbloquea tres `it` con commit** (modo «cambio de comportamiento»): hoy afirman que eliminar no manda correo y contradicen este spec. El comando `./desbloquear <área>` exacto lo da `/spec-impl` al toparse con ellos; el usuario lo corre. Solo se tocan:
   - `backend/tests/seller-status-email.test.ts`, `it('eliminar no manda correo')`: pasa a comprobar que manda uno con la plantilla de eliminación (camino «borrado»).
   - `backend/tests/seller-archive.test.ts`, `it('no manda ningún correo por Resend')`: pasa a comprobar que manda uno (camino «archivado»).
   - `backend/tests/seller-archive.test.ts`, `it('sin movimientos se borra por completo…')`: su última afirmación, `resendCalls` vacío, pasa a un correo.
   - En esos dos archivos, `RESEND_TEMPLATE_SELLER_DELETE` se suma a la lista de variables que cada prueba fija y restaura, para que no dependa de lo que haya en `backend/.env`.
   - No se debilita ni se borra ninguna otra afirmación.
1. **Pruebas nuevas en rojo.** `backend/tests/seller-deleted-email.test.ts` y los tres `it` ajustados (§6). Sustituyen `fetch` (`vi.stubGlobal`), como las demás: nunca sale un correo real.
2. **Textos y tipos.** `SellerDeletedKind`, `SellerDeletedVariables` y `SELLER_DELETED_TEXTS` en `notifications/constants.ts`; `notifications/seller-deleted-email.ts` con `sellerDeletedEmail`.
3. **Servicio.** `sendSellerDeletedEmail` en `notifications/index.ts`, que lee `RESEND_TEMPLATE_SELLER_DELETE` y devuelve `'skipped'` sin correo.
4. **`deleteSeller`.** Guarda el nombre de `findSeller`, y manda el aviso al terminar el camino «borrado» y el camino «archivado» (§4). La firma y la respuesta de la ruta no cambian.
5. **Documentación.** `backend/.env.example` (la quinta variable y su comentario), `backend/README.md` (punto 6 de «Despliegue»: cinco variables), `CLAUDE.md` y `AGENTS.md` (la línea de `notifications` suma el aviso de eliminación y la variable), `specs/README.md`.
6. **Despliegue, a mano** (después del merge, igual que en T-43): cargar `RESEND_TEMPLATE_SELLER_DELETE` en el proyecto del backend, solo en **Production**; redesplegar sin caché de build; **promover** el despliegue.
7. **Verificación manual** con un vendedor de prueba con tu correo, antes y después de darle historial (§6).

## 6. Criterios de aceptación

- [ ] Eliminar a un vendedor sin movimientos, con las tres variables de Resend y `RESEND_TEMPLATE_SELLER_DELETE`, manda **una** petición a Resend con `template.id` igual a esa variable, `to` igual a su correo, asunto «Tu cuenta de Mammut fue eliminada» y las variables `NAME`, `HEADLINE`, `MESSAGE` y `NOTE` («Ya no hay datos tuyos en la app.»); la ruta responde `204`.
- [ ] Eliminar a uno con historial y sin piezas (se archiva) manda **una** petición con `NOTE` «Tu historial de ventas se conserva.»; la ruta responde `204`.
- [ ] En el archivado, `to` es el correo **original**, no `archivado-<id>@mammut.invalid`.
- [ ] Un vendedor llamado `Ana <b>&</b> "Co"` recibe `NAME` como `Ana &lt;b&gt;&amp;&lt;/b&gt; &quot;Co&quot;`, sin doble escape.
- [ ] Se manda también si el vendedor ya estaba desactivado.
- [ ] Con piezas a su cargo (`409`) y con un id inexistente o ya archivado (`404`) no se manda nada.
- [ ] Si Auth falla al liberar el correo y el archivado se deshace, no se manda nada.
- [ ] El aviso sale después de confirmar la eliminación: nunca queda un vendedor sin eliminar tras mandarle el correo.
- [ ] Con Resend respondiendo error o sin red, la eliminación queda aplicada y la ruta responde `204`; en el log hay el motivo y no el correo ni el cuerpo.
- [ ] Sin `RESEND_API_KEY`, `RESEND_FROM` o `RESEND_TEMPLATE_SELLER_DELETE`, la eliminación funciona, la ruta responde `204` y no se hace ninguna petición a Resend.
- [ ] Un vendedor sin correo no recibe petición a Resend y se elimina igual.
- [ ] El id de la plantilla no está escrito en el código ni en el repo; solo se lee de `RESEND_TEMPLATE_SELLER_DELETE`.
- [ ] El frontend no cambia, y `DELETE /api/sellers/[id]` sigue respondiendo `204` sin cuerpo.
- [ ] Solo cambian los tres `it` del paso 0 y la lista de variables de entorno de esos dos archivos; no se debilita ni se borra ninguna otra prueba con commit.
- [ ] `npm test` del backend con el bloque LOCAL y `SUPABASE_SERVICE_ROLE_KEY` queda en verde, junto con `npm run type-check` y `architecture.test.ts`.
- [ ] En producción, con la variable cargada y el despliegue promovido, eliminar un vendedor de prueba con tu correo hace llegar el correo en los dos caminos.
- [ ] `backend/.env.example`, `backend/README.md`, `CLAUDE.md`, `AGENTS.md` y `specs/README.md` describen la quinta variable y el aviso, sin valores reales.

## 7. Decisiones

- **Sí:** una plantilla propia para eliminar, con las mismas cuatro variables que las otras (`NAME`, `HEADLINE`, `MESSAGE`, `NOTE`). Cada aviso tiene su plantilla, como ya hacen estado y contraseña.
- **Sí:** el nombre de la variable es `RESEND_TEMPLATE_SELLER_DELETE`, el que eligió el usuario al crear la plantilla.
- **Sí:** dos textos de `NOTE`, uno para cada camino. «Tu historial de ventas se conserva» solo es cierto si se archivó; si se borró, no hay historial.
- **No:** un solo `NOTE` genérico. No le diría al vendedor lo que pasó con sus ventas.
- **Sí:** el aviso se manda siempre al eliminar, incluso si ya estaba desactivado. Es el comportamiento más simple y no depende del estado previo.
- **No:** mandar solo si estaba activo. Evita un correo repetido, pero añade una rama más que probar.
- **Sí:** `DELETE` sigue respondiendo `204` sin cuerpo y el resultado solo va al log.
- **No:** `200` con `{ emailStatus }` y aviso en pantalla, como al desactivar. Obligaría a desbloquear más pruebas con commit y a cambiar el servicio y la ficha del frontend; queda para otra historia si hace falta.
- **Sí:** esperar el envío dentro de la petición, con el tope de 5 s de `sendEmail`. Sin esperar, un envío pendiente puede perderse al terminar la función.
- **Sí:** leer el correo y el nombre antes de eliminar y mandar al final. Después ya no existen (borrado) o el correo cambió (archivado).
- **Sí:** el id de la plantilla viaja solo por variable de entorno, igual que en HU-44 y HU-45; en el repo solo aparece abreviado.
- **No:** tocar el frontend, el diseño HTML del correo (vive en Resend) ni los demás avisos.
- **Sí:** ajustar tres `it` con commit en modo «cambio de comportamiento», con desbloqueo del usuario y sin debilitar nada más. Se descarta dejarlos tal cual: pasarían solo mientras la variable no esté definida, y las pruebas leen `backend/.env`, así que se romperían en cualquier máquina que la tenga.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Las pruebas leen `backend/.env`: con la variable definida ahí, los tres `it` de «eliminar no manda correo» fallarían aunque el código sea correcto | Se ajustan con desbloqueo del usuario y cada prueba fija y restaura la variable en vez de depender del `.env`. |
| La plantilla vuelve a quedar en borrador al editarla en Resend, o es de otra cuenta | Resend responde `4xx`, el aviso sale `'failed'` y la eliminación sigue aplicada. Cada cambio en el editor se vuelve a publicar. |
| El correo cae en spam (dominio nuevo `.site`, ver T-43) | Es la misma reputación de los otros avisos; no se resuelve aquí. |
| El administrador no se entera de que el correo no salió (la ruta sigue en `204`) | Queda en el log del backend (`Resend rechazó el aviso de eliminación (HTTP …)`). Si hace falta verlo en pantalla, va en otra historia con `emailStatus`. |
| Eliminar tarda hasta 5 s más si Resend no contesta | Es el mismo tope de los otros avisos y la eliminación ya está confirmada cuando espera. |
| Un vendedor sin correo en Auth se elimina sin aviso | Es el caso `'skipped'`, el mismo que en los otros avisos. |

## Lo que **no** entra en este spec

- Cambiar la respuesta de `DELETE` o mostrar el resultado del correo en pantalla.
- Cambios en el frontend.
- El HTML de la plantilla, que vive en Resend.
- Avisos al editar el correo, al dar de alta o al administrador.
- Reintentos, cola o confirmación de entrega.

Cada uno, si llega, va en su propio spec.
