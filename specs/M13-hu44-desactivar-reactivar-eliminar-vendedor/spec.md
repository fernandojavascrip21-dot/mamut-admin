# Spec — HU-44 · Desactivar, reactivar o eliminar a un vendedor

> **Estado:** Borrador
> **Depende de:**
> - M13-t42-base-gestion-vendedores (`specs/M13-t42-base-gestion-vendedores/spec.md`): `POST /api/sellers/[id]/deactivate`, `POST …/reactivate`, `DELETE /api/sellers/[id]`, `GET /api/sellers?status=inactive`, `GET /api/sellers/[id]?status=any` y los mensajes `SELLER_HAS_UNITS` / `SELLER_HAS_HISTORY`. Este spec solo suma al backend el aviso por correo (§3 «Correo al vendedor»).
> - M13-hu43-ficha-editar-vendedor (`specs/M13-hu43-ficha-editar-vendedor/spec.md`): la ficha con su `Tag` de estado, el pop-up «Editar datos» (`edit-seller-page`), `unsavedSellerGuard` y `SellerChangesService`.
> - M2-hu09-ver-mis-vendedores (`specs/M2-hu09-ver-mis-vendedores/spec.md`): «Mis vendedores» (`sellers-page`, `seller-row`) y la ficha (`seller-detail-page`).
> - M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`): `ViewingService` (la lista de «Viendo» y de «Dejar»).
> - M2-hu12-retirar-a-vendedor (`specs/M2-hu12-retirar-a-vendedor/spec.md`): el pop-up «Retirar producto» (`returnModalLink`).
> - M7-t26-estados-pantallas (`specs/M7-t26-estados-pantallas/spec.md`): estados de cargando y error con «Reintentar».
> **Fecha:** 2026-11-17
> **Objetivo:** que el administrador desactive, reactive o elimine a un vendedor desde su ficha, vea a los desactivados en «Mis vendedores» con un filtro «Activos | Desactivados», y que al desactivarlo o reactivarlo el vendedor reciba un aviso por correo, sin perder ventas ni cortes.

Fuentes:

- **Jira:** historia `SCRUM-108 · HU-44`, épica `SCRUM-105 · M13 · Gestión de vendedores (v2)`, requerimientos RF-35 y RF-37. Depende de T-42 (`SCRUM-106`) y HU-43 (`SCRUM-107`). Relacionada con HU-09 (`SCRUM-33`), HU-10 (`SCRUM-34`), HU-12 (`SCRUM-36`) y HU-22 (`SCRUM-60`).
- **Mockups:** no hay pantalla de HU-44 en el canvas ni en Confluence. El filtro sigue el estilo de la ficha (`app-data-grid`) y las acciones viven en el pop-up «Editar datos» de HU-43.
- **Código:**
  - `src/app/features/sellers/pages/sellers-page/`: «Mis vendedores» (`rxResource` con `SellersService.list()`).
  - `src/app/features/sellers/components/seller-row/`: la fila (nombre, negocio y piezas).
  - `src/app/features/sellers/pages/seller-detail-page/`: la ficha; hoy pide `GET /api/sellers/:id` sin `status` y fija «Viendo» con `viewing.select(id)`.
  - `src/app/features/sellers/pages/edit-seller-page/`: el pop-up «Editar datos» (`vendedor/:sellerId` del outlet `ventana`).
  - `src/app/features/sellers/services/sellers.service.ts`, `seller-update.service.ts` (patrón de servicio que traduce errores) y `seller-changes.service.ts`.
  - `src/app/core/viewing/viewing.service.ts`: `reload()` regresa a «Yo · bodega» cuando el id guardado ya no está en la lista de activos. «Dejar» (`create-delivery-page`) usa la misma lista.
  - `backend/src/accounts/sellers.ts` (`deactivateSeller`, `reactivateSeller`) y `backend/app/api/sellers/[id]/{deactivate,reactivate}/route.ts`: las rutas de T-42.
  - `backend/src/receipts/readers/gemini-reader.ts` y `backend/.env.example`: el patrón de un servicio externo opcional con su clave en `.env`.
  - `src/app/core/toast/toast.service.ts`: hoy solo tiene `success` y `error`.
- **Decisiones del usuario** del 2026-11-17 (§9).

## 1. Por qué existe este spec

T-42 dejó el backend listo para dar de baja a un vendedor, regresarlo y borrar un alta hecha por error, pero ninguna pantalla lo usa. Hoy el administrador no puede sacar de «Viendo» y «Dejar» a quien ya no trabaja con él, ni cortarle el acceso a la app. La contraseña es HU-45.

El usuario pidió además que el vendedor se entere por correo, al correo que se le registró. El backend no tiene ningún servicio de correo, y Supabase Auth solo manda sus propios correos de cuenta (no avisos de «activado» o «desactivado»), así que este spec suma un módulo nuevo `notifications` que envía el aviso con **Resend**. El resto es frontend.

Hay una limitación del backend que marca la pantalla: las rutas de entregas, retiros y mermas siguen dando `404` para un desactivado (`getActiveSellerName`, T-42). Por eso la ficha de un desactivado muestra solo su cabecera, sin el grid de stock y movimientos (§9).

## 2. Alcance

**Entra en este spec:**

- **«Mis vendedores»** (`sellers-page`): filtro `p-selectbutton` «Activos | Desactivados» bajo el título, guardado en la URL (`?estado=desactivados`; sin parámetro = activos). La lista de desactivados se pide con `GET /api/sellers?status=inactive`.
- **Fila** (`seller-row`): `input()` nuevo `inactive` (por omisión `false`); en `true` muestra un `Tag` «Desactivado» en lugar de las piezas.
- **Ficha** (`seller-detail-page`):
  - pide el detalle con `GET /api/sellers/:id?status=any`, así abre activos y desactivados;
  - un desactivado muestra la cabecera con el `Tag` «Desactivado», «Reactivar» (principal) y «Editar datos», sin «Dejar» / «Retirar» ni el grid, y con un aviso;
  - «‹ Vendedores» de un desactivado regresa a `/admin/vendedores?estado=desactivados`;
  - un desactivado no se fija en «Viendo» (`viewing.select(null)`).
- **Pop-up «Editar datos»** (`edit-seller-page`):
  - carga con `?status=any`, así edita también a un desactivado;
  - suma, debajo del formulario, la sección de estado (subcomponente visual nuevo `pages/edit-seller-page/ui/seller-status-actions/`): «Desactivar vendedor» o «Reactivar vendedor» según el estado, y «Eliminar vendedor»;
  - confirmaciones con `ConfirmService.ask()` para desactivar y eliminar;
  - alertas dentro del pop-up para `409` (piezas a su cargo, con «Retirar producto»; historial).
- **Servicios:**
  - `SellersService`: `getAny(id)`, `list(status)`, `deactivate(id)`, `reactivate(id)`, `remove(id)`;
  - nuevo `features/sellers/services/seller-status.service.ts` (`SellerStatusService`, sin `providedIn`): traduce las respuestas a un resultado y, en el éxito, recarga «Viendo» (`viewing.reload()`) y avisa a la ficha (`SellerChangesService.notify()`).
- **Modelos y constantes** nuevos (§4).
- **Correo al vendedor (backend):**
  - módulo nuevo `backend/src/notifications/` (`index.ts`, `constants.ts`, `resend.ts`, `seller-status-email.ts`) con alias `@notifications`;
  - el diseño del correo vive en una **plantilla de Resend** («Aviso de estado del vendedor», ya creada en la cuenta del usuario); los textos y las variables que la llenan viven en el repo (§3);
  - `deactivateSeller` y `reactivateSeller` mandan el aviso solo cuando el estado cambió de verdad, y las dos rutas `POST` responden con `emailStatus`;
  - variables `RESEND_API_KEY`, `RESEND_FROM` y `RESEND_TEMPLATE_SELLER_STATUS` en `backend/.env.example`, opcionales;
  - su frontera en `tests/architecture.test.ts` y el alias en `backend/tsconfig.json`.
- **Aviso de fallo (frontend):** `ToastService.warn()` nuevo y, cuando `emailStatus` no es `'sent'`, un aviso «Se desactivó, pero no se pudo avisarle por correo» (o «Se reactivó…»).
- **Pruebas:** `.spec.ts` nuevos para lo nuevo, los `it` desbloqueados de la ficha y del pop-up que piden la URL sin `status` (§5, paso 0), `backend/tests/seller-status-email.test.ts` y `e2e/M13-hu44-desactivar-reactivar-eliminar-vendedor.spec.ts` (§7).
- **Documentación:** `specs/README.md` (tabla y relaciones) y, en `CLAUDE.md` / `AGENTS.md`, la línea del módulo `notifications` y de sus variables (el módulo es una regla nueva del backend).

**No entra en este spec:**

- Otros cambios en el backend o en la base. En particular, abrir los historiales de entregas, retiros y mermas de un desactivado (siguen en `404`).
- Correo al **eliminar**, al editar el correo o al cambiar la contraseña (HU-45), y cualquier aviso al administrador.
- Cola con reintentos o tabla de avisos pendientes: si el correo falla, no se reenvía solo (§9).
- Casilla «Avisarle por correo»: el aviso se manda siempre (§9).
- Mandar la contraseña, un enlace o datos de sus ventas en el correo.
- Verificar el dominio de Resend: es un paso de configuración fuera del código (§8).
- «Cambiar contraseña»: HU-45.
- Saber de antemano si un vendedor tiene historial para esconder «Eliminar» (necesitaría un dato nuevo del backend).
- Buscar dentro de la lista de desactivados, o una tercera opción «Todos» en el filtro.
- Mostrar a los desactivados en cortes, «Resumen del negocio» (HU-22) o «Viendo»: HU-22 ya incluye a los desactivados en «Por titular» y no cambia.
- Avisar al vendedor desactivado con un mensaje propio en su app: su siguiente acción da `401` y vuelve al login como cualquier sesión vencida.
- Desactivar o eliminar varios vendedores a la vez.

## 3. Reglas de negocio y pantallas

### Quién

Solo el **administrador**. Todo vive bajo `/admin`, ya protegido por `roleGuard`.

### «Mis vendedores» (`/admin/vendedores`)

- Bajo el título, un `p-selectbutton` con dos opciones: «Activos» y «Desactivados». Se ve siempre, también con la lista vacía, para llegar a los desactivados aunque no haya activos.
- El valor vive en el parámetro `estado` de la URL: `?estado=desactivados` muestra desactivados; sin parámetro (o con otro valor), activos. Cambiar la opción navega con `queryParams` y `replaceUrl: true`, así «atrás» no recorre los cambios de filtro.
- La lista se pide según el filtro: activos con `list('active')` (`GET /api/sellers`, la misma URL de hoy) y desactivados con `list('inactive')` (`GET /api/sellers?status=inactive`). Cambiar el filtro pasa por «Cargando vendedores…».
- **Activos:** todo igual que hoy (orden por nombre, «Nuevo vendedor», vacío «Aún no tienes vendedores»).
- **Desactivados:**
  - mismas filas con `[inactive]="true"`, en orden por nombre;
  - vacío: «No tienes vendedores desactivados» y «Aquí aparecen los vendedores que desactives.», sin botón;
  - error: el mismo de hoy con «Reintentar».
- «Nuevo vendedor» se ve con los dos filtros.
- Con un vendedor en «Viendo», la lista sigue abriendo su ficha (HU-10): el filtro solo se alcanza con «Yo · bodega», como hoy la lista.

### Fila de un desactivado (`seller-row` con `inactive`)

- Iniciales, nombre y negocio como hoy.
- A la derecha, en lugar de «N piezas», un `Tag` «Desactivado» (`severity="secondary"`).
- El enlace abre `/admin/vendedores/:id` (la ficha pide siempre con `?status=any`).
- `aria-label`: «Ver a Víctor Vendedor, Gimnasio Fuerza Norte, desactivado» (sin negocio: «Ver a Víctor Vendedor, desactivado»).

### Ficha (`/admin/vendedores/:id`)

- El detalle se pide con `getAny(id)` (`?status=any`). Un `404` sigue siendo «No encontramos a este vendedor».
- **Activo:** igual que hoy (HU-43). «Viendo» se fija con `viewing.select(id)`, como hoy.
- **Desactivado:**
  - Cabecera igual que la de un activo (iniciales, nombre, `Tag` «Desactivado», negocio, teléfono, correo, alta).
  - Botones: «Reactivar» (`pButton` principal, donde va «Dejar producto») y «Editar datos» (secondary, abre el pop-up como hoy). No hay «Dejar producto» ni «Retirar producto».
  - En lugar del grid, un aviso en `surface-card`: «Está desactivado» y «No puede entrar a la app ni recibir producto. Sus ventas y cortes se conservan. Reactívalo para dejarle producto o ver sus movimientos.».
  - No se piden entregas, retiros ni mermas (darían `404`).
  - «‹ Vendedores» lleva a `/admin/vendedores?estado=desactivados`.
  - «Viendo» no se fija en él: la ficha llama `viewing.select(null)`, así la barra muestra «Yo · bodega» y nunca a un desactivado.
- **«Reactivar»** (sin confirmación, porque se deshace desactivando):
  - mientras responde: «Reactivando…», deshabilitado, sin segundo envío;
  - `200`: `ToastService.success('«{nombre}» reactivado')` (y, con `emailStatus` `'failed'` o `'skipped'`, `ToastService.warn('Se reactivó, pero no se pudo avisarle por correo')`); `viewing.reload()` y `SellerChangesService.notify()`; la ficha se recarga sin pasar por «cargando» y se ve como activa (con grid, historiales y «Dejar producto»), y se fija en «Viendo»;
  - `404`: aviso «Este vendedor ya no está disponible» y navega a «Mis vendedores»;
  - sin red o `5xx`: aviso «No se pudo reactivar. Revisa tu conexión e inténtalo de nuevo.» y el botón vuelve a estar activo.
- Cuando cambia el estado desde el pop-up, la ficha se recarga con `SellerChangesService` (HU-43). Los historiales se piden solo cuando el vendedor cargado está activo.

### Pop-up «Editar datos» (`(ventana:vendedor/<id>)`)

- Carga con `getAny(id)`: abre activos y desactivados. Los estados de cargando, `404` y error no cambian. Editar los cuatro datos funciona igual con los dos (T-42).
- **Sección de estado** (`seller-status-actions`, presentacional: `input()` `active`, `busy`, `notice`; `output()` `deactivate`, `reactivate`, `remove`, `returnUnits`), debajo de los botones del formulario, separada con `border-t border-line`, título «Estado del vendedor»:
  - **Activo:** «Desactivar vendedor» (`severity="secondary"`, `[outlined]="true"`) con la ayuda «Si ya no trabaja contigo: no podrá entrar a la app, sus ventas y cortes se conservan y le llegará un aviso por correo.».
  - **Desactivado:** «Reactivar vendedor» (`severity="secondary"`) con la ayuda «Vuelve a «Mis vendedores», «Viendo» y «Dejar», entra con su contraseña y le llegará un aviso por correo.».
  - **Los dos:** «Eliminar vendedor» (`severity="danger"`, `[outlined]="true"`) con la ayuda «Solo si lo diste de alta por error y nunca tuvo movimientos.». Se muestra siempre (§9).
  - Mientras guarda el formulario o corre una acción de estado, todos los botones del pop-up quedan deshabilitados; el botón de la acción en curso dice «Desactivando…», «Reactivando…» o «Eliminando…».
- **Desactivar:**
  - Confirmación con `ConfirmService.ask()`: «¿Desactivar a «{nombre}»?», «Ya no podrá entrar a la app ni aparecerá en «Viendo» ni en «Dejar». Sus ventas y cortes se conservan, puedes reactivarlo cuando quieras y le mandaremos un aviso por correo.», «Desactivar» / «Cancelar». Con el formulario con cambios, el mensaje suma «Los cambios sin guardar se pierden.».
  - `200`: `ToastService.success('«{nombre}» desactivado')` (y, con `emailStatus` `'failed'` o `'skipped'`, `ToastService.warn('Se desactivó, pero no se pudo avisarle por correo')`); `viewing.reload()` (si estaba en «Viendo», la barra pasa a «Yo · bodega»; «Dejar» ya no lo ofrece) y `notify()`; el pop-up se cierra sin preguntar por cambios y la ficha queda como desactivada.
  - `409` (piezas a su cargo): alerta `alert-warning` en la sección, con `role="alert"`: «Retírale sus piezas antes de desactivarlo» y un botón «Retirar producto» que navega a `returnModalLink(id)` (cambia este pop-up por el de HU-12, pasando por `unsavedSellerGuard`). No cambia nada.
  - `404`: aviso «Este vendedor ya no está disponible» y se cierra.
  - Sin red o `5xx`: aviso «No se pudo desactivar. Revisa tu conexión e inténtalo de nuevo.»; el pop-up sigue abierto.
- **Reactivar** (desde el pop-up, sin confirmación): mismo resultado que el botón de la ficha; en el `200`, además, el pop-up se cierra sin preguntar.
- **Eliminar:**
  - Confirmación con `ConfirmService.ask()`: «¿Eliminar a «{nombre}»?», «Se borra su acceso para siempre. Solo se puede si nunca tuvo movimientos; si tiene historial, desactívalo.», «Eliminar» / «Cancelar», con el botón de aceptar de peligro. Con cambios sin guardar suma la misma línea que «Desactivar».
  - `204`: `ToastService.success('«{nombre}» eliminado')`; `viewing.reload()` (sin `notify()`, para que la ficha no pida a alguien que ya no existe); en una sola navegación se cierra el pop-up y se va a «Mis vendedores» con el filtro que tenía (activo → activos; desactivado → `?estado=desactivados`), sin preguntar por cambios.
  - `409` (historial): alerta `alert-warning` en la sección: «Tiene historial: solo se puede desactivar». No se borra nada.
  - `404`: aviso «Este vendedor ya no está disponible», se cierra y se va a «Mis vendedores».
  - Sin red o `5xx`: aviso «No se pudo eliminar. Revisa tu conexión e inténtalo de nuevo.».
- Una alerta de `409` se quita al empezar otra acción o al guardar.
- **Salir:** `unsavedSellerGuard` tampoco deja cerrar mientras corre una acción de estado (`saving()` cuenta las dos cosas). Después de un éxito, `hasUnsavedChanges()` da `false`.

### Correo al vendedor (backend, módulo `notifications`)

**Cuándo se manda.** Al desactivar y al reactivar, siempre y solo si el estado cambió de verdad (T-42: desactivar a uno ya desactivado o reactivar a uno ya activo responde `200` sin cambiar nada; ahí **no** se manda nada). Con `409` o `404` tampoco. Al eliminar no hay correo.

**A quién.** Al correo con el que el vendedor entra (`profiles` no lo guarda: sale de Supabase Auth, el mismo que ya lee `sellerView`). Si no tiene correo, no se manda.

**Cuándo sale, respecto al cambio.** Después de confirmar la transacción, nunca dentro de ella: el correo no puede deshacer ni retrasar el cambio. La ruta espera el envío (máximo 5 s de espera) para poder decirle al frontend cómo salió.

**Resultado (`emailStatus`).** Las dos rutas `POST` responden la vista del vendedor de siempre y suman un campo:

| `emailStatus` | Significa |
| --- | --- |
| `'sent'` | Resend aceptó el correo (`2xx`). |
| `'failed'` | Resend respondió error, no contestó en 5 s o no hubo red. |
| `'skipped'` | Falta `RESEND_API_KEY`, `RESEND_FROM` o `RESEND_TEMPLATE_SELLER_STATUS`, o el vendedor no tiene correo. |
| `null` | El estado ya era ese: no cambió nada y no se intentó mandar. |

Un `failed` o `skipped` **nunca** revierte el cambio ni da error HTTP: el estado queda aplicado (§9). El error se registra en el log del servidor con `console.error` y el motivo, **sin** el correo ni el cuerpo del mensaje.

**Plantilla de Resend.** El diseño (encabezado «Mammut Supplements», título, saludo, mensaje, recuadro de nota y pie de «aviso automático») está en la plantilla «Aviso de estado del vendedor», id `1021a868-99cd-4bf6-bc46-a9f3d641e027`. El id **no** va escrito en el código: se lee de `RESEND_TEMPLATE_SELLER_STATUS`, porque la plantilla es de una cuenta de Resend y otro ambiente puede usar otra. La plantilla tiene cuatro variables, escritas con triple llave (`{{{NAME}}}`, que Resend inserta sin escapar):

| Variable | Qué lleva |
| --- | --- |
| `NAME` | Nombre del vendedor, **ya escapado para HTML** por el backend (`&`, `<`, `>`, `"`, `'`). |
| `HEADLINE` | Título del correo; el mismo texto va como asunto. |
| `MESSAGE` | Frase principal. |
| `NOTE` | Frase del recuadro destacado. |

**Servicio.** `sendEmail({ to, subject, templateId, variables })` en `backend/src/notifications/resend.ts`: un `fetch` a `https://api.resend.com/emails` con `Authorization: Bearer <RESEND_API_KEY>`, `from` de `RESEND_FROM`, `to`, `subject` y `template: { id, variables }` (sin `html` ni `text`: con plantilla no van juntos), `AbortSignal.timeout(5000)` y sin dependencias nuevas. El asunto se manda también en la petición para no depender de que Resend sustituya variables en el asunto de la plantilla. Devuelve `'sent' | 'failed' | 'skipped'` y nunca lanza. Al implementar se confirma la forma exacta de `template` contra la documentación vigente de Resend.

**Textos** (`notifications/constants.ts`, un objeto por estado; las funciones de `seller-status-email.ts` solo los combinan con el nombre y devuelven `{ subject, variables }`):

| | Desactivado | Reactivado |
| --- | --- | --- |
| `HEADLINE` y asunto | Tu acceso a Mammut fue desactivado | Tu acceso a Mammut fue reactivado |
| `MESSAGE` | Tu usuario en Mammut fue desactivado y ya no podrás entrar a la app. | Tu usuario en Mammut fue reactivado. Ya puedes entrar a la app. |
| `NOTE` | Tu historial de ventas se conserva. | Entra con tu correo y tu contraseña de siempre. |

- La plantilla ya trae el saludo «Hola {nombre},» y el pie «Si crees que es un error, habla con tu administrador.»; el backend no los repite.
- Sin contraseñas, sin enlaces, sin cifras de ventas, sin el nombre del administrador.
- El remitente (`From`) y el texto de vista previa quedan sin fijar en la plantilla: el primero lo manda el backend con `RESEND_FROM`.

**Local y pruebas.** Sin las tres variables de entorno, todo funciona y `emailStatus` es `'skipped'`. Las pruebas nunca mandan un correo real: las de envío reemplazan `fetch` (`vi.stubGlobal`) y comprueban la petición.

### Sesión del vendedor desactivado

- El backend ya lo resuelve (T-42): su siguiente petición, login o refresh da `401`. El `authInterceptor` lo manda al login como con cualquier sesión vencida. El frontend del vendedor no cambia.
- Al reactivarlo entra con su misma contraseña.

### 375 px

- El `p-selectbutton` ocupa el ancho de la pantalla con las dos opciones del mismo tamaño y no desborda.
- En la fila de un desactivado, el `Tag` no empuja el nombre: el nombre hace salto de línea y el negocio se trunca, como hoy.
- En la ficha de un desactivado, «Reactivar» y «Editar datos» quedan como hoy «Dejar» y «Editar datos» (dos filas a todo el ancho en teléfono).
- En el pop-up, la sección de estado apila sus botones a todo el ancho, cada uno con su ayuda debajo; las alertas hacen salto de línea.

## 4. Modelo de datos

No hay cambios en la base ni migraciones. Las rutas son las de T-42; solo las dos `POST` suman `emailStatus` a su respuesta.

| Ruta | Respuesta | Errores |
| --- | --- | --- |
| `GET /api/sellers?status=inactive` | `200` `SellerSummary[]` | — |
| `GET /api/sellers/:id?status=any` | `200` `SellerDetail` | `404` |
| `POST /api/sellers/:id/deactivate` | `200` `Seller` + `emailStatus` | `404`, `409` con piezas |
| `POST /api/sellers/:id/reactivate` | `200` `Seller` + `emailStatus` | `404` |
| `DELETE /api/sellers/:id` | `204` | `404`, `409` con historial |

**Backend** (`backend/src/notifications/`, módulo nuevo con `index.ts` que exporta solo `sendSellerStatusEmail` y el tipo `EmailStatus`):

```ts
export type EmailStatus = 'sent' | 'failed' | 'skipped'

// constants.ts
export const RESEND_URL = 'https://api.resend.com/emails'
export const EMAIL_TIMEOUT_MS = 5000
// Variables de la plantilla de Resend «Aviso de estado del vendedor» (NAME, HEADLINE, MESSAGE, NOTE).
export interface SellerStatusVariables { NAME: string; HEADLINE: string; MESSAGE: string; NOTE: string }
// Un texto por estado: SELLER_STATUS_TEXTS.deactivated | .reactivated (tabla de §3).
```

- `accounts/sellers.ts`: `SellerStatusChange = SellerView & { emailStatus: EmailStatus | null }`. `deactivateSeller` y `reactivateSeller` devuelven ese tipo (`null` cuando no hubo cambio); la transacción dice si cambió y el correo se manda después, fuera de ella.
- `accounts` importa `@notifications`; `notifications` no importa ningún otro módulo (recibe el nombre y el correo como argumentos).
- `.env.example`: `RESEND_API_KEY=`, `RESEND_FROM=` (por ejemplo `Mammut <avisos@tu-dominio.com>`) y `RESEND_TEMPLATE_SELLER_STATUS=` (el id de la plantilla publicada), comentadas y opcionales, con la nota de que sin las tres el correo no se manda.
- `tests/architecture.test.ts`: `@notifications` entra en `ALIASES` y `notifications` queda sin dependencias de otros módulos; `backend/tsconfig.json`: el alias.

`src/app/features/sellers/interfaces/seller.models.ts` (suma):

```ts
// Filtro de GET /api/sellers (T-42): sin parámetro = activos.
export type SellerListStatus = 'active' | 'inactive';

export type SellerStatusFailure = 'has-units' | 'has-history' | 'not-found' | 'offline';

// Cómo salió el aviso por correo de las dos rutas POST; null = el estado ya era ese y no se intentó.
export type EmailStatus = 'sent' | 'failed' | 'skipped';

// Resultado de desactivar / reactivar (con el vendedor y cómo salió el correo) o eliminar (seller: null).
export type SellerStatusResult =
  { ok: true; seller: Seller | null; emailStatus: EmailStatus | null } | { ok: false; reason: SellerStatusFailure };
```

Modelos y constantes de pantallas:

- `features/sellers/models/sellers-page.models.ts`: `SellersFilter = 'active' | 'inactive'`.
- `features/sellers/constants/sellers.constants.ts`: `SELLERS_FILTER_PARAM = 'estado'`, `SELLERS_INACTIVE_PARAM_VALUE = 'desactivados'`, `SELLER_HAS_UNITS` y `SELLER_HAS_HISTORY` (mismos textos que el backend), `SELLER_GONE_NOTICE` si se mueve desde `edit-seller-page.constants.ts`.
- `features/sellers/constants/sellers-page.constants.ts` (nuevo): opciones del filtro y textos del vacío de desactivados.
- `features/sellers/constants/seller-detail-page.constants.ts`: textos del aviso de desactivado y de «Reactivar».
- `features/sellers/constants/edit-seller-page.constants.ts`: confirmaciones de desactivar y eliminar, la línea de cambios sin guardar, avisos de éxito y de sin red.
- `features/sellers/models/edit-seller-page.models.ts`: `EditSellerStatusAction = 'deactivate' | 'reactivate' | 'remove'` y el estado de la acción en curso.
- `pages/edit-seller-page/ui/seller-status-actions/seller-status-actions.constants.ts` y `.models.ts`: títulos, ayudas y la forma de `notice` (`{ message: string; showReturn: boolean } | null`).

Servicios:

- `ToastService`: `warn(message)` nuevo (severidad de advertencia, igual que `success` y `error`).
- `SellersService` (suma):
  - `getAny(id): Observable<SellerDetail>` → `GET /api/sellers/:id?status=any`. `get(id)` no cambia.
  - `list(status: SellerListStatus = 'active')`: `'active'` sigue pidiendo `GET /api/sellers` sin parámetro (la URL de hoy); `'inactive'` suma `?status=inactive`.
  - `deactivate(id)` y `reactivate(id): Observable<Seller & { emailStatus: EmailStatus | null }>`, `remove(id): Observable<void>`.
- `SellerStatusService` (sin `providedIn`; lo proveen `seller-detail-page` y `edit-seller-page`): `deactivate`, `reactivate` y `remove` devuelven `Observable<SellerStatusResult>`. Traduce `409` a `has-units` o `has-history` según la acción, `404` a `not-found` y el resto a `offline`. En el éxito llama `viewing.reload()`; en desactivar y reactivar también `sellerChanges.notify()`.

## 5. Plan de implementación

0. **Desbloqueos (antes de empezar).** Pasar la ficha y el pop-up a `?status=any` cambia la URL que piden varios `it` con commit (`expectOne` con `/api/sellers/<id>` sin parámetro). El usuario corre:
   - `./desbloquear seller-detail-page`
   - `./desbloquear edit-seller-page`

   En esos archivos solo se cambia la URL esperada del detalle; ninguna otra aserción. Si `sellers-page.component.spec.ts` o `seller-row.component.spec.ts` fallan por el filtro o el `input()` nuevo, se detiene y se pide su `./desbloquear` (Protocolo).
1. **Backend: módulo `notifications`.** `backend/src/notifications/` (`constants.ts`, `resend.ts`, `seller-status-email.ts`, `index.ts`), alias `@notifications`, frontera en `architecture.test.ts`, variables en `.env.example` y `backend/tests/seller-status-email.test.ts` (variables de los dos correos, escape del nombre, `skipped` sin alguna de las tres variables, `sent`, `failed` por `4xx`, por `5xx` y por tiempo agotado, con `fetch` reemplazado). `npm run type-check` y `architecture.test.ts` pasan. Antes de dar el paso por bueno, se confirma contra la documentación de Resend la forma de `template` en el envío y si `{{{ }}}` inserta el valor sin escapar.
2. **Backend: aviso al cambiar de estado.** `deactivateSeller` y `reactivateSeller` mandan el aviso fuera de la transacción solo si cambió el estado y devuelven `emailStatus`; las dos rutas lo responden. Pruebas nuevas en `backend/tests/seller-status-email.test.ts` con la base real: con cambio manda uno, repetir la acción no manda otro, `409` y `404` no mandan, un fallo del correo deja el estado aplicado. Si un `it` con commit de `sellers-manage` falla por el campo nuevo, se detiene y se pide `./desbloquear sellers-manage`.
3. **Modelos y servicios HTTP.** Tipos de §4, `ToastService.warn`, `SellersService.getAny`, `list(status)`, `deactivate`, `reactivate`, `remove`, y `SellerStatusService` (con el aviso de fallo) con su spec. `ng build` pasa.
4. **Fila de desactivado.** `inactive` en `seller-row` con `Tag` y `aria-label`; spec en archivo nuevo `seller-row.component.inactive.spec.ts`.
5. **Filtro en «Mis vendedores».** `p-selectbutton`, parámetro `estado`, lista según el filtro, vacío de desactivados; spec en archivo nuevo `sellers-page.component.filter.spec.ts`.
6. **Ficha.** `getAny`, vista de desactivado (cabecera, «Reactivar», aviso, sin historiales, «‹ Vendedores» con filtro, `viewing.select(null)`), «Reactivar» con `SellerStatusService`; spec en archivo nuevo `seller-detail-page.component.status.spec.ts` y la URL en los desbloqueados.
7. **Pop-up.** `getAny`; `ng generate component features/sellers/pages/edit-seller-page/ui/seller-status-actions` con su spec; confirmaciones, resultados, alertas de `409`, «Retirar producto», navegación al eliminar y `saving()` con las acciones de estado; spec en archivo nuevo `edit-seller-page.component.status.spec.ts` y la URL en los desbloqueados.
8. **End-to-end.** `e2e/M13-hu44-desactivar-reactivar-eliminar-vendedor.spec.ts` (§7) y la suite completa de Playwright contra la base local.
9. **Documentación.** `specs/README.md` (estado y relaciones) y la línea del módulo `notifications` en `CLAUDE.md` y `AGENTS.md` (se mantienen iguales).

## 6. Criterios de aceptación

Criterios de Jira (`SCRUM-108`):

- [ ] **1.** En el pop-up «Editar datos» de un activo, «Desactivar vendedor» pide confirmación con `ConfirmService.ask()`. Con piezas a su cargo no se desactiva: aparece «Retírale sus piezas antes de desactivarlo» con «Retirar producto», que abre el pop-up de HU-12.
- [ ] **2.** Desactivado, deja de aparecer en «Mis vendedores» (Activos), en «Viendo» y en «Dejar»; si estaba en «Viendo», la barra pasa a «Yo · bodega»; ya no puede iniciar sesión y una sesión abierta vuelve al login en su siguiente acción; sus ventas y cortes siguen en «Corte» y «Resumen del negocio».
- [ ] **3.** «Mis vendedores» tiene el filtro «Activos | Desactivados»; la ficha de un desactivado se abre y tiene «Reactivar».
- [ ] **4.** «Reactivar» lo devuelve a «Mis vendedores» (Activos), «Viendo» y «Dejar», y entra con su contraseña.
- [ ] **5.** «Eliminar vendedor» pide confirmación de peligro; sin movimientos lo borra y vuelve a «Mis vendedores»; con historial muestra «Tiene historial: solo se puede desactivar» y no borra nada.
- [ ] **6.** Filtro, ficha de desactivado y pop-up tienen sus estados de cargando y error, y se ven sin desbordarse a 375 px.

Criterios del correo (petición del usuario del 2026-11-17):

- [ ] Al desactivar a un vendedor con correo y con Resend configurado, le llega «Tu acceso a Mammut fue desactivado» a su correo registrado; al reactivarlo, «Tu acceso a Mammut fue reactivado». Los correos no llevan contraseña, enlaces ni cifras.
- [ ] Desactivar a uno ya desactivado o reactivar a uno ya activo no manda ningún correo (`emailStatus: null`); con `409` o `404` tampoco; eliminar no manda correo.
- [ ] Si Resend falla, no contesta en 5 s o no hay clave configurada, el vendedor queda desactivado o reactivado igual, la ruta responde `200` con `emailStatus` `'failed'` o `'skipped'` y el administrador ve «Se desactivó, pero no se pudo avisarle por correo» (o «Se reactivó…»).
- [ ] Sin `RESEND_API_KEY`, `RESEND_FROM` o `RESEND_TEMPLATE_SELLER_STATUS`, el backend arranca, las pruebas pasan y no sale ninguna petición a Resend; ninguna prueba manda un correo real.
- [ ] La petición a Resend lleva `template.id` tomado de `RESEND_TEMPLATE_SELLER_STATUS` y las variables `NAME`, `HEADLINE`, `MESSAGE` y `NOTE`, sin `html` ni `text`; el id de la plantilla no está escrito en el código.
- [ ] Un vendedor llamado `Ana <b>&</b> "Co"` recibe el correo con el nombre escrito tal cual, sin HTML interpretado ni doble escape (se comprueba a mano con una cuenta real, con la plantilla publicada).
- [ ] El log del servidor al fallar un correo no incluye el correo del vendedor ni el contenido del mensaje.

Criterios propios:

- [ ] `?estado=desactivados` en la URL abre «Mis vendedores» con «Desactivados» elegido; recargar la página lo conserva y «‹ Vendedores» desde la ficha de un desactivado regresa ahí.
- [ ] Una fila de desactivado muestra el `Tag` «Desactivado» en lugar de las piezas; el vacío dice «No tienes vendedores desactivados».
- [ ] La ficha de un desactivado no pide entregas, retiros ni mermas, no muestra «Dejar» / «Retirar» ni el grid, y muestra el aviso «Está desactivado».
- [ ] Abrir la ficha de un desactivado deja «Viendo» en «Yo · bodega».
- [ ] Desactivar con cambios sin guardar en el formulario avisa en la confirmación que se pierden; tras el éxito el pop-up se cierra sin preguntar «¿Salir sin guardar?».
- [ ] Mientras corre una acción de estado, el pop-up no se cierra y ningún botón manda otra petición.
- [ ] Sin red, desactivar, reactivar y eliminar muestran su aviso y no cambian la pantalla.
- [ ] `ng build`, `npm run check:architecture` y `ng test` pasan, cambiando en pruebas con commit solo la URL del detalle en los archivos desbloqueados.
- [ ] En `backend/`: `npm run type-check`, `npm run build` y `npm test` pasan contra la base local (con `SUPABASE_SERVICE_ROLE_KEY` definida, sin pruebas omitidas) y `architecture.test.ts` cubre `@notifications`.
- [ ] `npm run test:e2e` pasa completo contra la base local.
- [ ] `specs/README.md` está actualizado.

## 7. Plan de pruebas

Backend (Vitest contra la base local, `backend/tests/seller-status-email.test.ts`, archivo nuevo; `fetch` reemplazado con `vi.stubGlobal`, nunca sale un correo real):

- Variables: `seller-status-email` devuelve el asunto y las cuatro variables de desactivado y de reactivado con la tabla de §3; un nombre con `<script>` y `&` va escapado en `NAME`; ningún texto lleva contraseña ni enlaces.
- `sendEmail`: sin `RESEND_API_KEY`, `RESEND_FROM` o `RESEND_TEMPLATE_SELLER_STATUS` → `'skipped'` y cero llamadas a `fetch`; `2xx` → `'sent'` con la URL, el `Authorization: Bearer`, `from`, `to`, `subject` y `template: { id, variables }` esperados, y sin `html` ni `text`; `4xx`, `5xx` y un `fetch` que lanza o no contesta → `'failed'` sin lanzar.
- `deactivateSeller` / `reactivateSeller` con la base real: un cambio manda un solo correo al correo de la cuenta y responde `emailStatus: 'sent'`; repetir la acción responde `null` y no llama a `fetch`; `409` con piezas y `404` no llaman a `fetch`; un vendedor sin correo da `'skipped'`; con `fetch` fallando el estado queda cambiado en `profiles`.
- Rutas `POST`: `200` con `emailStatus`, `403` a un vendedor y `401` sin sesión.
- El `console.error` de un fallo no contiene el correo ni el texto del mensaje.

Unitarias del frontend (Vitest, `ng test`), en archivos nuevos:

- `toast.service.warn.spec.ts`: `warn()` muestra un aviso con severidad de advertencia.
- `sellers.service.status.spec.ts`: URLs de `getAny`, `list('active')` (sin parámetro), `list('inactive')`, `deactivate`, `reactivate` y `remove`.
- `seller-status.service.spec.ts`: `200` / `204` / `409` (según la acción) / `404` / `0`; solo el éxito llama `viewing.reload()`; `notify()` en desactivar y reactivar, no en eliminar; el resultado trae `emailStatus`.
- `seller-row.component.inactive.spec.ts`: `Tag` en lugar de piezas y `aria-label`.
- `sellers-page.component.filter.spec.ts`: sin parámetro pide activos; `?estado=desactivados` pide inactivos; cambiar el filtro navega con `replaceUrl`; vacío de desactivados.
- `seller-detail-page.component.status.spec.ts`: pide con `?status=any`; vista de desactivado sin historiales; «‹ Vendedores» con filtro; `viewing.select(null)`; «Reactivar» (éxito con toast y recarga, aviso de «no se pudo avisarle por correo» con `'failed'` y `'skipped'` y ninguno con `'sent'` o `null`, `404`, sin red, sin doble envío).
- `seller-status-actions.component.spec.ts`: botones según `active`, textos de espera con `busy`, alerta con y sin «Retirar producto», emisiones.
- `edit-seller-page.component.status.spec.ts`: carga con `?status=any`; confirmaciones (con la línea de cambios sin guardar); éxito de desactivar, reactivar y eliminar (toast, aviso de correo fallido, cierre, navegación al eliminar); `409` de piezas con «Retirar producto»; `409` de historial; `404`; sin red; `saving()` durante una acción.

End-to-end (`e2e/M13-hu44-desactivar-reactivar-eliminar-vendedor.spec.ts`, proyectos `escritorio` y `movil`):

- Alta de un vendedor `test-e2e-` sin movimientos; elegirlo en «Viendo».
- Ficha → «Editar datos» → «Desactivar vendedor» → confirmar: la ficha muestra «Desactivado» y «Reactivar»; «Viendo» vuelve a «Yo · bodega» y no lo ofrece; no está en Activos y sí en Desactivados; iniciar sesión con su cuenta falla.
- Con su sesión abierta en otro contexto del navegador antes de desactivarlo, su siguiente acción lo manda al login.
- «Reactivar» desde la ficha: vuelve a Activos y a «Viendo»; entra con su contraseña.
- «Eliminar vendedor» → confirmar: vuelve a «Mis vendedores» y no aparece en ningún filtro (esto también es la limpieza).
- Con `vendedor1@mammut.local` (seed: 6 piezas y entregas): «Desactivar vendedor» muestra «Retírale sus piezas antes de desactivarlo» y «Retirar producto» abre el pop-up de retiro; «Eliminar vendedor» muestra «Tiene historial: solo se puede desactivar». Sigue activo y sin cambios.
- Correo: en local no hay clave de Resend, así que al desactivar y reactivar al vendedor `test-e2e-` el administrador ve «Se desactivó, pero no se pudo avisarle por correo» y «Se reactivó, pero no se pudo avisarle por correo». El envío real se comprueba a mano (§8), nunca en la suite.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Pruebas con commit de la ficha y del pop-up esperan `/api/sellers/<id>` sin `status` | Paso 0: el usuario corre `./desbloquear seller-detail-page` y `./desbloquear edit-seller-page`; solo cambia la URL esperada |
| Pruebas con commit de `sellers-page` o `seller-row` fallan por el filtro o el `input()` nuevo | `list('active')` mantiene la URL de hoy e `inactive` es `false` por omisión. Si aun así falla, se detiene y se pide el `./desbloquear` exacto |
| La ficha se recarga tras desactivar y pide historiales que darían `404` | Los historiales solo se piden con el vendedor activo; la recarga de un desactivado no los pide |
| Eliminar avisa a la ficha y esta pide a un vendedor que ya no existe | Eliminar no llama `notify()`; la navegación a «Mis vendedores» saca a la ficha |
| El access token del vendedor desactivado sigue vigente hasta una hora | El backend lee `profiles.active` en cada petición (T-42), así que su siguiente acción ya da `401`; el e2e lo comprueba |
| Datos de e2e con movimientos no se pueden borrar | Los casos de `409` usan a `vendedor1` del seed sin cambiarlo; el vendedor `test-e2e-` nunca tiene movimientos y se elimina al final |
| En producción, T-42 aún no está desplegado | HU-44 se despliega después de T-42 |
| Pruebas con commit de `sellers-manage` comparan la respuesta de los `POST` con `toEqual` y el campo `emailStatus` las rompe | Hoy usa `toMatchObject` en lo revisado, que ignora campos extra. Si aun así falla, se detiene y se pide `./desbloquear sellers-manage`; el campo no se esconde |
| Resend solo entrega a cualquier correo con un dominio verificado; sin él solo manda al correo de la cuenta de Resend | Paso de configuración fuera del código: crear la cuenta, verificar el dominio (DNS: SPF y DKIM) y definir `RESEND_API_KEY` y `RESEND_FROM` en el servidor. Mientras no esté, todo funciona y el aviso sale como «no se pudo avisarle» |
| La plantilla de Resend vuelve a quedar en borrador tras editarla, o es de otra cuenta, y Resend rechaza el envío | La plantilla se publicó el 2026-11-18 (cinco avisos del editor, ninguno bloqueante: `From` sin fijar y las cuatro variables sin valor de respaldo, porque el backend manda siempre los cuatro valores y el `from`). Cada cambio posterior en el editor se vuelve a publicar. Su id va en `RESEND_TEMPLATE_SELLER_STATUS`. Si no está publicada, el envío falla con `4xx` y sale `'failed'` («no se pudo avisarle»), sin afectar el cambio de estado |
| El diseño del correo queda fuera del repositorio: un cambio en el editor de Resend no pasa por revisión ni se puede revertir con git | Los textos y las variables sí están en el repo (`constants.ts`). Si cambian los nombres de las variables de la plantilla, se cambia el repo en el mismo momento; el spec fija sus cuatro nombres (§3) |
| `{{{ }}}` inserta sin escapar y un nombre con HTML se interpretaría en el correo | El backend escapa `NAME` antes de enviarlo y su prueba lo comprueba. Si Resend ya escapara, saldría doble escapado: la verificación manual del nombre `Ana <b>&</b> "Co"` lo detecta, y se cambia el escape o el tipo de llave |
| El correo cae en spam o rebota y el administrador cree que el vendedor se enteró | «Se mandó» solo significa que Resend lo aceptó. El aviso de fallo cubre errores de envío, no de entrega; el administrador debe avisar en persona a quien no responda, igual que con la contraseña |
| Resend lento o caído atrasa la respuesta de desactivar | El envío espera máximo 5 s (`AbortSignal.timeout`) y va fuera de la transacción: el cambio ya está confirmado y no bloquea filas |
| El correo del vendedor es un dato personal que viaja a un tercero (Resend) | Solo se envía a Resend el correo del propio vendedor y su nombre, sin cifras ni contraseñas; la clave vive en `.env`/entorno y nunca en el repositorio ni en el log |
| El administrador cambia a «Desactivado» a quien no debe enterarse por correo | Decisión del usuario: siempre se avisa (§9). La confirmación de «Desactivar» ya lo dice |

## 9. Decisiones

- **Sí:** «Desactivar» y «Eliminar» viven dentro del pop-up «Editar datos» (decisión del usuario del 2026-11-17). La ficha queda sin acciones de peligro a la mano y la cabecera no se aprieta a 375 px.
- **No:** una sección al pie de la ficha, botones en la cabecera o un menú «⋯».
- **Sí:** «Eliminar» se muestra siempre, en activos y desactivados; el backend decide con `409` (decisión del usuario). Cierra el «Por decidir» de `SCRUM-108`.
- **No:** mostrarlo solo en desactivados (un alta por error pediría dos pasos) ni sumar un `hasHistory` al backend.
- **Sí:** la ficha de un desactivado muestra solo la cabecera, «Reactivar», «Editar datos» y un aviso (decisión del usuario). Sus historiales dan `404` y no se abren.
- **No:** abrir las rutas de historial a desactivados en el backend.
- **Sí:** «Reactivar» es el botón principal de la cabecera de un desactivado, y en el pop-up toma el lugar de «Desactivar» (decisión del usuario).
- **Sí:** reactivar no pide confirmación; desactivar y eliminar sí. Reactivar se deshace desactivando.
- **Sí:** tras desactivar, el pop-up se cierra y queda la ficha como desactivada (decisión del usuario). El administrador ve el resultado y puede reactivar si se equivocó.
- **Sí:** con piezas, alerta dentro del pop-up con «Retirar producto», que cambia este pop-up por el de HU-12 (decisión del usuario).
- **Sí:** filtro `p-selectbutton` con el valor en la URL (`?estado=desactivados`) (decisión del usuario). «‹ Vendedores» desde un desactivado regresa a su lista y recargar la conserva.
- **No:** filtro solo en un signal ni pestañas `p-tabs`.
- **Sí:** la fila de un desactivado muestra el `Tag` «Desactivado» en lugar de «0 piezas» (decisión del usuario).
- **Sí:** la ficha y el pop-up piden siempre con `?status=any` (`getAny`), aunque eso obliga a desbloquear la URL en sus pruebas. Así la ficha se recarga igual al cambiar de estado y el enlace de la fila no necesita saber el estado.
- **No:** pedir sin `status` y reintentar con `?status=any` tras un `404` (dos peticiones), ni marcar el estado en la URL de la ficha (se rompe al desactivar desde el pop-up).
- **Sí:** un desactivado nunca queda en «Viendo»: su ficha llama `viewing.select(null)`. La barra solo lista activos.
- **Sí:** `SellerStatusService` aparte de `SellerUpdateService`: uno edita datos y el otro cambia el estado; los dos traducen errores con el mismo patrón.
- **Sí:** al eliminar se vuelve a «Mis vendedores» con el filtro del estado que tenía.
- **Sí:** aviso por correo al desactivar y reactivar, con **Resend** (decisión del usuario del 2026-11-17). Un `fetch` a su API sin dependencias nuevas, con clave en `.env`.
- **No:** `nodemailer` con SMTP, ni el correo de Supabase Auth (no manda avisos propios).
- **Sí:** el diseño del correo vive en una plantilla de Resend, una sola para los dos estados, con las variables `NAME`, `HEADLINE`, `MESSAGE` y `NOTE` (decisión del usuario del 2026-11-18). El usuario ya la creó en su cuenta.
- **No:** armar el HTML en el repo (`html` y `text` en la petición). Se descartó para que el administrador pueda cambiar el diseño sin desplegar, a cambio de que el diseño quede fuera de git.
- **Sí:** los textos de cada estado se quedan en el repo (`constants.ts`), no en la plantilla: así el mensaje de «desactivado» o «reactivado» se revisa y se prueba con el código.
- **Sí:** el id de la plantilla viene de `RESEND_TEMPLATE_SELLER_STATUS`, no del código.
- **No:** dos plantillas, una por estado: el diseño es el mismo y solo cambian cuatro textos.
- **Sí:** si el correo falla, el cambio de estado se aplica igual y el administrador recibe un aviso de que no se pudo avisar (decisión del usuario). Un proveedor caído no debe impedir dar de baja a alguien.
- **No:** revertir el cambio si el correo falla, ni cola con reintentos (otra tabla, otro proceso y otro spec).
- **Sí:** el correo se manda siempre, sin casilla (decisión del usuario). La confirmación de «Desactivar» y las ayudas del pop-up ya dicen que le llegará un aviso.
- **Sí:** todo dentro de HU-44, sin spec técnico aparte (decisión del usuario). HU-44 deja de ser «solo frontend».
- **Sí:** solo se manda cuando el estado cambió de verdad; repetir la acción responde `emailStatus: null` y no escribe de nuevo al vendedor. Evita avisos duplicados por un doble clic o un reintento.
- **Sí:** el correo sale después de confirmar la transacción y la ruta lo espera con tope de 5 s, para devolver `emailStatus` en la misma respuesta. Enviarlo sin esperar ocultaría el fallo al administrador.
- **No:** correo al eliminar: la cuenta deja de existir y, sin historial, el alta fue un error del administrador.
- **Sí:** módulo propio `notifications` (con `index.ts` y alias, como los demás) que no depende de ningún otro módulo; así HU-45 (contraseña) o cualquier aviso futuro lo reutiliza.
- **Sí:** `ToastService.warn()` nuevo: un aviso de «no se pudo avisar» no es ni éxito ni error de la acción.

## Lo que **no** entra en este spec

- Migraciones, y backend fuera de `notifications` y de los dos `POST` de estado; incluido abrir historiales de desactivados.
- Correo al eliminar, al editar el correo o al cambiar la contraseña (HU-45), y avisos al administrador.
- Cola de correos con reintentos y casilla «Avisarle por correo».
- Verificar el dominio en Resend (configuración fuera del código).
- Cambiar la contraseña (HU-45).
- Esconder «Eliminar» según el historial.
- Buscar entre desactivados o un filtro «Todos».
- Un aviso propio en la app del vendedor desactivado.
- Acciones sobre varios vendedores a la vez.

Cada uno, si llega, va en su historia o en su propio spec.
