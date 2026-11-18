# Spec — HU-43 · Ver la ficha de un vendedor y editar sus datos (nombre, negocio, teléfono y correo)

> **Estado:** Implementado
> **Depende de:**
> - M13-t42-base-gestion-vendedores (`specs/M13-t42-base-gestion-vendedores/spec.md`): `PUT /api/sellers/[id]`, `businessName` en el alta y en las vistas, y los mensajes del backend. Este spec no toca el backend.
> - M2-hu08-alta-vendedor (`specs/M2-hu08-alta-vendedor/spec.md`): `create-seller-page`, `SellerSaveService` y los mensajes de campo del alta.
> - M2-hu09-ver-mis-vendedores (`specs/M2-hu09-ver-mis-vendedores/spec.md`): «Mis vendedores» (`seller-row`) y la ficha (`seller-detail-page`).
> - M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`): `ViewingService` y `viewing-bar`.
> - M2-t16-ventanas-dejar-retirar (`specs/M2-t16-ventanas-dejar-retirar/spec.md`): el outlet `ventana` y `modal-panel`.
> - M7-t26-estados-pantallas (`specs/M7-t26-estados-pantallas/spec.md`): estados de cargando y error con «Reintentar».
> **Fecha:** 2026-11-17
> **Objetivo:** que el administrador vea en la ficha de un vendedor todos sus datos (negocio, teléfono, correo, estado y fecha de alta) y los corrija en un pop-up «Editar datos», y que el nombre del negocio se capture en el alta y se vea en «Mis vendedores» y en la barra «Viendo».

Fuentes:

- **Jira:** historia `SCRUM-107 · HU-43`, épica `SCRUM-105 · M13 · Gestión de vendedores (v2)`, requerimiento RF-34. Depende de T-42 (`SCRUM-106`). Relacionada con HU-08 (`SCRUM-32`), HU-09 (`SCRUM-33`) y HU-10 (`SCRUM-34`).
- **Mockups:** no hay pantalla de HU-43 en el canvas ni en Confluence. La ficha amplía la tarjeta de cabecera actual de HU-09 y el pop-up sigue el patrón de «Dejar» / «Retirar» (`modal-panel`).
- **Código:**
  - `src/app/features/sellers/pages/seller-detail-page/`: la ficha actual (cabecera con iniciales, nombre, teléfono y correo; «Dejar» / «Retirar»; stock e historiales).
  - `src/app/features/sellers/pages/create-seller-page/`: el alta de HU-08, con el patrón de formulario de la casa.
  - `src/app/features/sellers/services/seller-save.service.ts`: traduce los errores HTTP del alta y llama a `viewing.reload()`.
  - `src/app/core/viewing/viewing.service.ts` y `src/app/core/layout/viewing-bar/`: la barra «Viendo».
  - `src/app/features/restock/guards/unsaved-restock.guard.ts`: guard de salida de un pop-up con `ConfirmService.ask()`.
  - `src/app/core/layout/routes/admin.routes.ts` y `src/app/shared/utils/modal-links.ts`: rutas y enlaces del outlet `ventana`.
  - `backend/src/accounts/sellers.ts`: `normalizeBusinessName` y `updateSeller` (T-42).
- **Decisiones del usuario** del 2026-11-17 (§9).

## 1. Por qué existe este spec

T-42 dejó listo el backend para editar a un vendedor y guardar el nombre de su negocio, pero ninguna pantalla lo usa. Hoy el administrador no puede corregir un teléfono mal escrito ni el correo con el que entra un vendedor, y no tiene dónde anotar que «Víctor» es el del gimnasio. Este spec agrega solo el frontend de esos casos. Desactivar, reactivar y eliminar son HU-44; la contraseña, HU-45.

## 2. Alcance

**Entra en este spec:**

- **Ficha** (`seller-detail-page`): la tarjeta de cabecera suma el negocio (o «Sin negocio»), un `Tag` de estado («Activo»), la fecha de alta y el botón «Editar datos». El resto de la ficha (stock, «Dejar», «Retirar» e historiales) no cambia.
- **Pop-up «Editar datos»** en el outlet `ventana`, ruta `vendedor/:sellerId` (constante `MODAL_EDIT_SELLER_PATH`):
  - página nueva `features/sellers/pages/edit-seller-page/` (carga al vendedor, guarda y traduce el resultado);
  - componente presentacional nuevo `features/sellers/components/seller-edit-form/` (nombre, negocio, teléfono y correo);
  - servicio nuevo `features/sellers/services/seller-update.service.ts` (traduce errores a un resultado, como `SellerSaveService`);
  - guard nuevo `features/sellers/guards/unsaved-seller.guard.ts` (no se cierra mientras guarda; con cambios pregunta con `ConfirmService.ask()`).
- **Recarga entre pantallas:** servicio nuevo `features/sellers/services/seller-changes.service.ts` (`providedIn: 'root'`, un contador `version`), para que la ficha vuelva a pedir al vendedor cuando el pop-up guarda.
- **Alta** (`create-seller-page`): campo opcional «Nombre del negocio» entre «Nombre» y «Teléfono», en el payload y en el resumen «Vendedor dado de alta».
- **«Mis vendedores»** (`seller-row`): el negocio debajo del nombre, solo cuando lo tiene.
- **Barra «Viendo»:** `ViewingSeller` suma `businessName`; la opción y la selección muestran «Nombre · Negocio» cuando hay negocio, y solo el nombre si no.
- **Modelos y constantes:** `businessName` y `createdAt` en `Seller`, `businessName` en `SellerSummary`, `UpdateSellerInput`, resultados del guardado y mensajes.
- **Pruebas:** `.spec.ts` nuevos para lo nuevo y `e2e/M13-hu43-ficha-editar-vendedor.spec.ts` (§7).
- **Documentación:** `specs/README.md` (tabla y relaciones) y, en `CLAUDE.md` / `AGENTS.md`, la línea de la ventana nueva solo si hace falta para las reglas.

**No entra en este spec:**

- Cambios en el backend o en la base: todo lo necesario lo dejó T-42. **Excepción al implementar:** `backend/src/lib/cors.ts` agrega `PUT` a `Access-Control-Allow-Methods`; sin eso el preflight del navegador bloqueaba el guardado (T-42 no lo tocó).
- Abrir la ficha de un vendedor desactivado (`?status=any`), el filtro «Activos | Desactivados» y los botones desactivar, reactivar y eliminar: HU-44. En HU-43 la ficha sigue pidiendo el detalle sin `status`, así que el `Tag` siempre dice «Activo».
- «Cambiar contraseña»: HU-45.
- Que el vendedor edite su propio perfil o vea su negocio en su app.
- Mostrar el negocio en cortes, ventas, entregas, retiros, mermas o en el selector de «Dejar».
- Buscar o filtrar «Mis vendedores» por negocio.
- Un componente de formulario común para alta y edición (§9).

## 3. Reglas de negocio y pantallas

### Quién

Solo el **administrador**. Todo vive bajo `/admin`, ya protegido por `roleGuard`.

### Ficha (`/admin/vendedores/:id`)

La tarjeta de cabecera (`surface-card`) queda así, a la derecha de las iniciales:

1. Nombre (`h1`, como hoy).
2. Negocio: el `businessName`, o «Sin negocio» en `text-muted` cuando es `null`.
3. Teléfono con el pipe `phone` (como hoy).
4. Correo (como hoy).
5. Una línea con el `Tag` de estado y la fecha de alta: `Tag` «Activo» (`severity="success"`) cuando `active` es `true` y «Desactivado» (`severity="secondary"`) cuando es `false`; después «Alta 12/11/2026» con `DatePipe` y el formato `dd/MM/yyyy`, como los historiales.
6. Botón «Editar datos» (`pButton`, `[text]="true"`), alineado a la derecha al pie de la tarjeta. Es un enlace al pop-up (`editSellerModalLink(id)`), no una navegación primaria.

- El `Tag` «Desactivado» queda listo para HU-44, aunque en HU-43 no se ve: el detalle sin `status` da `404` a un desactivado.
- Los estados de cargando, «No encontramos a este vendedor» y error con «Reintentar» no cambian.
- Cuando el pop-up guarda, la ficha vuelve a pedir al vendedor sin pasar por «cargando» (como cuando cambia el stock), así que no parpadea detrás del pop-up.

### Pop-up «Editar datos» (`edit-seller-page`)

- **Entrada:** el botón «Editar datos» de la ficha. Ruta del outlet: `vendedor/:sellerId` (`(ventana:vendedor/<id>)`). Título del pop-up: «Editar datos».
- **Carga:** pide `GET /api/sellers/:id` (el mismo detalle de la ficha) con `rxResource`.
  - Cargando: «Cargando vendedor…» con `role="status"`.
  - `404`: «No encontramos a este vendedor» y un botón «Cerrar».
  - Otro error: «No pudimos cargar al vendedor», «Revisa tu conexión e inténtalo de nuevo.» y «Reintentar» (`reload()`).
- **Formulario** (`seller-edit-form`, presentacional): recibe el vendedor por `input()` y emite `UpdateSellerInput` por `output()`. Campos, en orden:
  - «Nombre»: obligatorio (`notBlank`). Vacío → «Escribe el nombre del vendedor».
  - «Nombre del negocio»: opcional, `maxlength` lógico de 80. Ayuda: «Opcional: gimnasio, café, tienda…». Más de 80 caracteres → «El nombre del negocio debe tener como máximo 80 caracteres».
  - «Teléfono»: obligatorio, 10 dígitos (`notBlank` + `tenDigitPhone`), con la ayuda «10 dígitos; puedes escribirlo con espacios.». Se precarga con el pipe `phone` aplicado (espacios), y se envía solo con dígitos (`normalizePhone`).
  - «Correo para entrar»: obligatorio, `Validators.email`. Ayuda fija: «Es su usuario para entrar. Si lo cambias, entrará con el nuevo.».
- **Errores de campo:** se ven al enviar, no al tocar (patrón de formularios). Al enviar con errores, `markAllAsTouched()`, se pintan todos y el foco va al primero.
- **Guardar:** botón principal «Guardar cambios» (mientras guarda: «Guardando…», deshabilitado) y botón secundario «Cancelar» que cierra el pop-up (pasa por el guard).
  - Payload (`prepareSavePayload()`): nombre y correo recortados, negocio recortado y `null` si queda vacío, teléfono con `normalizePhone`.
  - Sin segundo envío mientras el primero sigue en curso; el formulario queda deshabilitado mientras guarda.
  - Se envían siempre los cuatro datos (`PUT`), aunque solo uno haya cambiado.
- **Resultado:**
  - `200`: aviso `ToastService.success('Datos de «{nombre}» guardados')` con el nombre nuevo; `SellerChangesService.notify()`; `ViewingService.reload()`; y el pop-up se cierra (`closeModalLink()`), ya sin preguntar por cambios sin guardar.
  - `409`: «Ya existe un acceso con ese correo» bajo el campo correo, con el foco ahí, y en un aviso.
  - `422`: el mensaje del backend bajo su campo si coincide con uno conocido (nombre, negocio, teléfono, correo); si no, solo en el aviso.
  - `404`: aviso «Este vendedor ya no está disponible» y se cierra el pop-up.
  - Sin red o `5xx`: alerta «No se pudo guardar» con «Reintentar», que reenvía exactamente el mismo payload.
- **Salir:** el guard `unsavedSellerGuard` no deja cerrar mientras guarda. Con el formulario `dirty` pregunta con `ConfirmService.ask()` («¿Salir sin guardar?», «Perderás los cambios en los datos del vendedor.», «Salir» / «Seguir editando»). Sin cambios cierra sin preguntar.

### Alta (`/admin/vendedores/nuevo`)

- Campo nuevo «Nombre del negocio» entre «Nombre» y «Teléfono», con las mismas reglas y ayuda que en la edición. Opcional: vacío se envía como `null`.
- El resumen «Vendedor dado de alta» suma la fila «Negocio» solo cuando lo tiene.
- Un `422` con el mensaje de 80 caracteres se pinta bajo «Nombre del negocio».
- El resto del alta no cambia.

### «Mis vendedores» (`seller-row`)

- Debajo del nombre, en una línea `text-sm text-muted` truncada, el negocio. Sin negocio, no hay línea (ni «Sin negocio»).
- El `aria-label` del enlace suma el negocio cuando lo tiene: «Ver a Víctor Vendedor, Gimnasio Fuerza Norte, 12 piezas».
- La lista se vuelve a pedir al entrar (como hoy), así que después de editar ya muestra el dato nuevo.

### Barra «Viendo»

- `ViewingService` guarda `businessName` de `GET /api/sellers` junto con `id` y `fullName`.
- La etiqueta de cada opción es `Nombre · Negocio` cuando hay negocio y solo `Nombre` cuando no. La función que la arma vive en `core/viewing/` (pura, con su prueba).
- Las iniciales siguen saliendo solo del nombre.
- El orden sigue siendo por nombre (`sortByName`).
- Después de editar, `viewing.reload()` trae el nombre y el negocio nuevos sin recargar la página, y la selección vigente se conserva (el vendedor sigue activo).

### 375 px

- La tarjeta de la ficha no se desborda: nombre, negocio y correo hacen salto de línea (`break-words` / `break-all`); el `Tag` y la fecha caben en una línea o bajan juntos.
- El pop-up usa `modal-panel` normal (no `wide`); los campos ocupan todo el ancho y los dos botones quedan apilados o en dos columnas sin desbordar.
- En `seller-row`, el negocio largo se trunca con `…` y no empuja las piezas.
- En «Viendo», «Nombre · Negocio» largo se trunca (`truncate`, como hoy).

## 4. Modelo de datos

No hay cambios en la base ni en el backend: se consumen los de T-42.

`src/app/features/sellers/interfaces/seller.models.ts`:

```ts
export interface Seller {
  id: string;
  fullName: string;
  businessName: string | null; // nuevo (T-42)
  email: string | null;
  phone: string;
  active: boolean;
  createdAt: string; // nuevo: ya venía en AccountView
}

export interface CreateSellerInput {
  fullName: string;
  businessName: string | null; // nuevo
  phone: string;
  email: string;
  password: string;
}

export interface SellerSummary {
  id: string;
  fullName: string;
  businessName: string | null; // nuevo
  units: number;
}

// Cuerpo de PUT /api/sellers/:id (T-42): siempre los cuatro datos.
export interface UpdateSellerInput {
  fullName: string;
  businessName: string | null;
  phone: string;
  email: string;
}

export type UpdateSellerFailure = 'duplicate-email' | 'invalid' | 'not-found' | 'offline';

export type UpdateSellerResult =
  { ok: true; seller: Seller } | { ok: false; reason: UpdateSellerFailure; message?: string };
```

`src/app/core/viewing/interfaces/viewing.models.ts`:

```ts
export interface ViewingSeller {
  id: string;
  fullName: string;
  businessName: string | null; // nuevo
}
```

Modelos y constantes de página y componentes nuevos:

- `features/sellers/models/edit-seller-page.models.ts`: `EditSellerState = 'loading' | 'not-found' | 'error' | 'form' | 'saving' | 'offline'` y `EditSellerLeaveTarget` (`saving()`, `hasUnsavedChanges()`), para el guard.
- `features/sellers/components/seller-edit-form/seller-edit-form.models.ts`: `SellerEditField = 'fullName' | 'businessName' | 'phone' | 'email'`.
- `features/sellers/components/seller-edit-form/seller-edit-form.constants.ts`: mensajes de campo y ayudas.
- `features/sellers/constants/edit-seller-page.constants.ts`: título, textos de carga y error, `UNSAVED_SELLER_CONFIRMATION` y el aviso de `404`.
- `features/sellers/constants/sellers.constants.ts`: `MAX_BUSINESS_NAME = 80` (mismo valor que el backend), `BUSINESS_NAME_TOO_LONG` y `DUPLICATE_EMAIL` si se comparte entre alta y edición.
- `features/sellers/models/create-seller-page.models.ts`: `SellerField` suma `'businessName'`.
- `shared/constants/modal.constants.ts`: `MODAL_EDIT_SELLER_PATH = 'vendedor'`.
- `shared/utils/modal-links.ts`: `editSellerModalLink(sellerId: string): unknown[]`.

Servicios:

- `SellersService.update(id, input): Observable<Seller>` → `PUT /api/sellers/:id`.
- `SellerUpdateService` (sin `providedIn`, provisto por `edit-seller-page`): llama a `update`, hace `viewing.reload()` y `sellerChanges.notify()` en el éxito, y traduce `409` / `422` / `404` / el resto a `UpdateSellerResult`.
- `SellerChangesService` (`providedIn: 'root'`): `version` (signal de solo lectura) y `notify()`. La ficha la observa como observa `StockChangesService`.

## 5. Plan de implementación

1. **Modelos y servicio HTTP.** Sumar `businessName` y `createdAt` a los modelos, `UpdateSellerInput` y los resultados; `SellersService.update`. `ng build` pasa.
2. **Alta con negocio.** Campo «Nombre del negocio» en `create-seller-page` (formulario, payload, mensaje de 80, resumen). Las pruebas con commit de `create-seller-page` siguen pasando; las nuevas van en un `it` aparte del mismo archivo solo si el usuario lo desbloquea, si no en un archivo nuevo `create-seller-page.business.spec.ts`.
3. **«Mis vendedores».** Negocio debajo del nombre en `seller-row` y en su `aria-label`.
4. **Barra «Viendo».** `ViewingSeller.businessName`, función pura de etiqueta en `core/viewing/` y su uso en `viewing-bar`.
5. **Ficha.** `SellerChangesService`; tarjeta de cabecera con negocio, `Tag`, fecha de alta y «Editar datos»; recarga silenciosa al cambiar `version`.
6. **Formulario de edición.** `ng generate component features/sellers/components/seller-edit-form`, con su spec: carga desde `input()`, validación al enviar, payload y `output()`.
7. **Pop-up.** `ng generate component features/sellers/pages/edit-seller-page`, `SellerUpdateService`, `unsavedSellerGuard`, `MODAL_EDIT_SELLER_PATH`, `editSellerModalLink` y la ruta en `admin.routes.ts` (outlet `ventana`, `canDeactivate: [unsavedSellerGuard]`, `data.title` «Editar datos»).
8. **End-to-end.** `e2e/M13-hu43-ficha-editar-vendedor.spec.ts` (§7) y la suite completa de Playwright contra la base local.
9. **Documentación.** `specs/README.md` (estado y relaciones) y `CLAUDE.md` / `AGENTS.md` solo si una regla cambia.

## 6. Criterios de aceptación

Criterios de Jira (`SCRUM-107`):

- [x] **1.** La ficha muestra nombre, negocio (o «Sin negocio»), teléfono con el pipe `phone`, correo, `Tag` «Activo», «Alta dd/MM/yyyy» y sus piezas; las secciones de stock e historiales de HU-09, HU-11, HU-12 y HU-26 siguen igual.
- [x] **2.** «Editar datos» abre el pop-up `(ventana:vendedor/<id>)` con nombre (obligatorio), negocio (opcional), teléfono (10 dígitos) y correo precargados; los errores de campo se ven solo al enviar.
- [x] **3.** Con el correo de otra cuenta, el pop-up muestra «Ya existe un acceso con ese correo» bajo el campo correo; mientras guarda, el botón dice «Guardando…», está deshabilitado y un segundo clic no manda otra petición.
- [x] **4.** Al guardar, aparece «Datos de «{nombre}» guardados», el pop-up se cierra y la ficha, «Mis vendedores» y la barra «Viendo» muestran el dato nuevo sin recargar la página.
- [x] **5.** El alta de vendedor tiene el campo opcional «Nombre del negocio»; con «  Café Centro  » se crea con «Café Centro» y vacío se crea sin negocio.
- [x] **6.** «Mis vendedores» muestra el negocio debajo del nombre solo cuando lo tiene.
- [x] **7.** El pop-up tiene cargando, «No encontramos a este vendedor» y error con «Reintentar»; ficha, pop-up, alta, «Mis vendedores» y «Viendo» se ven sin desbordarse a 375 px.

Criterios propios:

- [x] «Viendo» muestra «Víctor Vendedor · Gimnasio Fuerza Norte» para un vendedor con negocio y solo el nombre para uno sin negocio.
- [x] Un teléfono escrito «55 1234 5678» se envía como `5512345678`; un negocio de solo espacios se envía como `null`.
- [x] Un negocio de 81 caracteres muestra «El nombre del negocio debe tener como máximo 80 caracteres» bajo su campo, al enviar, sin llamar al backend.
- [x] Cerrar el pop-up con cambios pregunta «¿Salir sin guardar?»; «Seguir editando» conserva lo escrito y «Salir» lo cierra. Sin cambios cierra sin preguntar. Mientras guarda no se cierra.
- [x] Sin red, el pop-up muestra «No se pudo guardar» con «Reintentar», que reenvía el mismo payload.
- [x] Después de cambiar el correo, el vendedor entra con el correo nuevo (e2e).
- [x] `ng build`, `npm run check:architecture` y `ng test` pasan sin cambiar pruebas con commit (o solo las que el usuario desbloqueó con `./desbloquear`).
- [x] `npm run test:e2e` pasa completo contra la base local.
- [x] `specs/README.md` está actualizado.

## 7. Plan de pruebas

Unitarias (Vitest, `ng test`), en archivos nuevos:

- `seller-edit-form.component.spec.ts`: precarga desde `input()` (teléfono con espacios), errores solo al enviar, foco en el primer error, payload recortado (negocio vacío → `null`, teléfono solo dígitos), `output()` no se emite con el formulario inválido, mensaje de 81 caracteres.
- `edit-seller-page.component.spec.ts`: cargando, `404`, error con «Reintentar», guardado exitoso (toast, `notify`, cierre), `409` bajo el correo, `422` bajo su campo, sin red con «Reintentar» del mismo payload, sin doble envío.
- `seller-update.service.spec.ts`: la traducción de `200` / `409` / `422` / `404` / `0` y que solo el éxito llama a `viewing.reload()` y `notify()`.
- `unsaved-seller.guard.spec.ts`: guardando → `false`; sin cambios → `true`; con cambios → `ConfirmService.ask()`.
- `seller-changes.service.spec.ts`: `notify()` sube `version`.
- Función de etiqueta de «Viendo»: con y sin negocio.
- `modal-links` y `admin.routes`: archivos nuevos `modal-links.edit-seller.spec.ts` y `admin.routes.edit-seller.spec.ts` (ruta en el outlet `ventana`, con el guard).
- Ficha, `seller-row`, alta y `viewing-bar`: los casos nuevos van en archivos nuevos (`*.business.spec.ts`) para no tocar los congelados.

End-to-end (`e2e/M13-hu43-ficha-editar-vendedor.spec.ts`, proyectos `escritorio` y `movil`):

- Alta de un vendedor `test-e2e-` con negocio; aparece en «Mis vendedores» con el negocio debajo y en «Viendo» como «Nombre · Negocio».
- Abrir su ficha, «Editar datos», cambiar teléfono, negocio y correo, guardar; la ficha y «Viendo» muestran lo nuevo.
- Correo de `vendedor1@mammut.local` → «Ya existe un acceso con ese correo».
- Cerrar con cambios → pregunta; «Seguir editando» conserva lo escrito.
- Iniciar sesión con el correo nuevo funciona.
- Limpieza: el vendedor de prueba se borra al final (`DELETE /api/sellers/:id`, no tiene movimientos).

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Pruebas con commit de `seller-detail-page`, `seller-row`, `create-seller-page` o `viewing-bar` dependen del texto o del orden exacto que cambia aquí | Los cambios solo agregan líneas y no reordenan lo que existe. Si un `it` congelado falla, se detiene y se pide el `./desbloquear <componente>` exacto (Protocolo) |
| `viewing.service.spec.ts` compara `sellers()` con `toEqual` y objetos sin `businessName` | `toEqual` ignora las propiedades `undefined`; si aun así falla, se detiene y se pide `./desbloquear viewing.service` |
| El administrador edita el correo y el vendedor no se entera de su nuevo usuario | Ayuda fija bajo el campo: «Si lo cambias, entrará con el nuevo». Se le avisa en persona, como la contraseña temporal |
| Guardar y cerrar el pop-up a la vez (la respuesta llega a una pantalla cerrada) | El guard no deja cerrar mientras guarda, como en «Lista de resurtir» |
| La ficha recarga y parpadea detrás del pop-up | Se recarga con `reload()` de `rxResource` sin pasar por «cargando» (mismo patrón que `StockChangesService`) |
| En producción, el backend de T-42 o su migración aún no están desplegados | HU-43 se despliega después de T-42 (columna `profiles.business_name` aplicada a mano) |

## 9. Decisiones

- **Sí:** «Editar datos» es un pop-up en el outlet `ventana` (decisión del usuario del 2026-11-17). La ficha queda detrás y se refresca al guardar, como «Dejar» / «Retirar». Cierra el primer «Por decidir» de `SCRUM-107`.
- **No:** pantalla `/admin/vendedores/:id/editar`. Sacaría al administrador de la ficha para cambiar un dato.
- **Sí:** «Viendo» muestra «Nombre · Negocio» cuando hay negocio (decisión del usuario del 2026-11-17). Distingue a dos vendedores con nombres parecidos. Cierra el segundo «Por decidir» de `SCRUM-107`.
- **Sí:** componente nuevo `seller-edit-form` solo para la edición; el alta solo suma su campo (decisión del usuario). No se reorganiza `create-seller-page`, cuyas pruebas tienen commit.
- **No:** un `seller-form` común para alta y edición. Menos duplicado, pero obliga a reescribir el alta y desbloquear sus pruebas.
- **Sí:** HU-43 no abre desactivados; la ficha sigue pidiendo el detalle sin `status` (decisión del usuario). Abrirlos trae decisiones sobre historiales en `404` y «Dejar» que son de HU-44. El `Tag` ya sabe pintar «Desactivado».
- **Sí:** tarjeta de cabecera ampliada con «Editar datos» como botón fantasma dentro de ella (decisión del usuario). No hay mockup; mantiene la ficha corta a 375 px.
- **Sí:** guard con `ConfirmService.ask()` al cerrar con cambios (decisión del usuario), mismo patrón que `unsavedRestockGuard`.
- **Sí:** ayuda fija bajo el correo en vez de confirmar al guardar (decisión del usuario). Un paso extra en cada guardado no aporta si el texto ya lo dice.
- **Sí:** al guardar, toast y cerrar el pop-up (decisión del usuario). La ficha ya muestra el resultado.
- **No:** resumen «antes / después» dentro del pop-up.
- **Sí:** `SellerChangesService` en la feature para avisar a la ficha. Pop-up y ficha son de la misma feature; no se reusa `StockChangesService`, que significa «cambió el stock».
- **Sí:** `PUT` con los cuatro datos aunque cambie uno, como lo define T-42.
- **Sí:** «Sin negocio» se escribe en la ficha, pero no en «Mis vendedores» ni en «Viendo», donde una línea vacía no aporta.
- **Sí:** fecha de alta con `DatePipe` y `dd/MM/yyyy`, el mismo formato que los historiales de la ficha.

## Lo que **no** entra en este spec

- Backend o migraciones (todo es de T-42).
- Ficha de un vendedor desactivado, filtro «Activos | Desactivados», desactivar, reactivar y eliminar (HU-44).
- Cambiar la contraseña (HU-45).
- Que el vendedor edite su perfil o vea su negocio.
- El negocio en cortes, ventas, entregas, retiros, mermas o en el selector de «Dejar».
- Buscar o filtrar vendedores por negocio.
- Un formulario común para alta y edición.

Cada uno, si llega, va en su historia o en su propio spec.
