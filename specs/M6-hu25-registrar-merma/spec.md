# Spec técnico — HU-25 · Registrar la merma de un vendedor o de la bodega (administrador)

> **Estado:** Implementado
> **Depende de:** M6-t25-base-merma-simple (`specs/M6-t25-base-merma-simple/spec.md`) — `POST /api/shrinkages`, módulo `@shrinkage`, motivos y respuesta `Shrinkage`; M2-hu13-stock-general (`specs/M2-hu13-stock-general/spec.md`) — movimientos rápidos de «Stock general»; M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`) — «Viendo»; M2-t16-ventanas-dejar-retirar (`specs/M2-t16-ventanas-dejar-retirar/spec.md`) — pop-ups en el outlet `ventana`; M5-hu23-fraccionar-entero-bolsitas (`specs/M5-hu23-fraccionar-entero-bolsitas/spec.md`) — resultado dentro del pop-up y endpoint de opciones
> **Fecha:** 2026-11-08
> **Objetivo:** que el administrador abra desde «Stock general» el pop-up «Registrar merma» del vendedor en «Viendo» o de la bodega, elija producto, piezas y motivo, confirme una sola vez y vea en el mismo pop-up el stock del titular antes → después.

Fuentes:

- **Jira:** historia `SCRUM-66 · HU-25`, épica `SCRUM-12 · M6 · Merma simple`. Requerimientos RF-15, RNF-03. Depende de T-25 (`SCRUM-65`), HU-10 y HU-13.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1», pantalla 07 simplificada: producto, piezas y motivo; sin nota, sin reporte semanal (RF-16) ni confirmación del vendedor. Baja el stock del titular y el total. El canvas de mockups no se pudo abrir desde esta sesión (no está compartido con la cuenta) y `references/` no tiene la pantalla: se diseña con la página de Confluence, los patrones de «Retirar» y «Fraccionar» y los tokens de la app.
- **Código:** `backend/src/shrinkage/` (`createShrinkage`, `SHRINKAGE_REASONS`), `backend/src/stock/holdings.ts` (`stockOfHolder`); `src/app/core/layout/routes/admin.routes.ts` (rutas del outlet `ventana`), `src/app/shared/constants/modal.constants.ts`, `src/app/shared/utils/modal-links.ts`, `src/app/features/stock/constants/stock-page.constants.ts` (`YO_QUICK_ACTIONS`), `src/app/features/stock/pages/stock-page/stock-page.component.ts` (`quickActions`), `src/app/features/stock/components/stock-quick-actions/`, `src/app/features/fraction/` (pop-up con resultado, `FractionService`), `src/app/features/sellers/pages/return-units-page/` (pop-up sobre un vendedor), `src/app/core/stock-changes/stock-changes.service.ts`, `src/app/shared/utils/uuid.ts` (`newUuid`).
- **Decisiones del usuario del 2026-11-08** (§10).

## 1. Alcance

**Entra en este spec:**

- **Backend, en `backend/src/shrinkage/`:**
  - Caso de uso de solo lectura `listShrinkageOptions(sellerId, actor)` y su ruta `backend/app/api/shrinkages/options/route.ts` (`GET`, solo administrador).
  - Tipos nuevos `ShrinkageOptions`, `ShrinkageOption` y `ShrinkageReasonOption` en `types.ts`, exportados desde `index.ts`.
- **Frontend, feature nueva `src/app/features/shrinkage/`:**
  - Pop-up `shrinkage-page` en el outlet `ventana` (ruta `merma`, parámetro matricial opcional `vendedor`).
  - Formulario reactivo presentacional `shrinkage-form`: producto, piezas y motivo.
  - Resultado `shrinkage-result` dentro del pop-up: producto, piezas, motivo y stock del titular antes → después, con «Registrar otra» y «Cerrar».
  - `ShrinkageService` (`getOptions()`, `create()`), modelos, validadores, reglas y constantes de la feature.
- **Core y shared:** la ruta del pop-up en `admin.routes.ts`, `MODAL_SHRINKAGE_PATH` en `modal.constants.ts` y `shrinkageModalLink()` en `modal-links.ts`.
- **Entradas en «Stock general»:** movimiento rápido «Registrar merma» con «Yo · bodega» y «Registrar su merma» con un vendedor en «Viendo», con un ícono nuevo `shrinkage` en `stock-quick-actions`.
- **Pruebas nuevas** (§9) y las aserciones de «Stock general» que cambian (§9, requiere desbloqueo). Verificación manual a 375 px.
- Actualizar `specs/README.md` y sincronizar `SCRUM-66`.

**No entra en este spec:**

- La merma en el historial del vendedor o de la bodega y en «Mi stock» (HU-26, `SCRUM-67`).
- Entradas desde el detalle del vendedor en «Mis vendedores» o desde la card de «Productos».
- Cambiar de titular dentro del pop-up.
- Anular una merma, varios productos a la vez, nota libre, costo de la merma.
- Una URL propia del resultado: `GET /api/shrinkages/[requestId]` existe pero esta historia no lo usa.
- Cambios en `POST /api/shrinkages`, en la migración de T-25 o en `supabase/seed.sql`.

## 2. Reglas de negocio

- **Quién:** solo el administrador. La ruta del pop-up cuelga de `/admin`, que ya protege `roleGuard`; el endpoint nuevo exige rol administrador en el caso de uso (`403` si no), como `createShrinkage`.
- **Titular, fijo por el enlace:**
  - Con un vendedor en «Viendo», «Stock general» ofrece «Registrar su merma» y el enlace lleva `vendedor=<id>`. El pop-up dice «De <nombre>».
  - Con «Yo · bodega», ofrece «Registrar merma» sin parámetro: el titular es la bodega y el pop-up dice «De la bodega».
  - No hay selector de titular. Si el pop-up abre con un vendedor, lo elige en «Viendo» (como «Retirar»).
  - `vendedor` de un vendedor desactivado, de otro perfil o inexistente → el endpoint responde `404` y el pop-up muestra «No encontramos a este vendedor» con «Cerrar».
- **Qué se lista (`GET /api/shrinkages/options`):**
  - Con vendedor: sus productos con piezas > 0 (`stockOfHolder`), también desactivados.
  - Con bodega: los productos con `products.stock > 0`, también desactivados (T-25 permite mermarlos).
  - Ordenados por nombre, con su foto y sus piezas del titular.
  - Sin productos: estado vacío «<Nombre> no tiene piezas» / «La bodega no tiene piezas», con «Cerrar».
- **Campo «Producto»** (`p-select` con buscador): obligatorio. Al elegir uno se ve «Tiene N piezas».
- **Campo «Piezas»** (`pInputText`, `inputmode="numeric"`): entero de 1 a las piezas que tiene el titular de ese producto. Vacío, decimal, `0` o más que las disponibles → error de campo **al enviar** («Escribe cuántas piezas» / «Debe ser un número entero mayor a 0» / «Solo tiene N piezas»).
- **Campo «Motivo»** (`p-select`): obligatorio, sin valor elegido al abrir. Las opciones y sus etiquetas vienen del backend (`reasons`, en el orden de `SHRINKAGE_REASONS`): «Se perdió», «Dañado», «Caducó», «Otro».
- **Confirmación** (formulario válido): `ConfirmService.ask()` con «¿Dar de baja N piezas de <producto> de <titular> por «<motivo>»? No se puede deshacer.», botón «Dar de baja» (danger) y «Cancelar». Al cancelar no se manda nada.
- **Envío:**
  - Inválido → `markAllAsTouched()`, no se pregunta ni se manda nada.
  - Un `requestId` (`newUuid()`) por intento: se conserva si el envío falla por red o error del servidor, para que reintentar no registre dos mermas; se renueva con «Registrar otra».
  - Sin segundo envío mientras el primero está en curso: «Registrar merma» queda deshabilitado con estado de espera, y el pop-up no se cierra (`modalSavingGuard`).
- **Errores del `POST` (no se guarda nada; el formulario conserva lo escrito):**
  - `409` «No hay piezas suficientes» → error del campo piezas con el mensaje del backend y se recargan las opciones.
  - `409` `SHRINKAGE_MISMATCH`, `404` o `422` → aviso `alert-danger` con el mensaje del backend sobre el botón; con `404` se recargan las opciones.
  - Sin conexión o `500` → aviso «No pudimos registrar la merma. Inténtalo de nuevo.» con «Reintentar», que reenvía lo mismo con el mismo `requestId`.
  - Solo `http-errors.ts` lee `HttpErrorResponse`; el servicio traduce a un motivo y la página decide qué pintar.
- **Resultado** (`201`, o `200` con `replayed: true`):
  - Toast «Merma registrada».
  - Producto (foto y nombre), «N piezas», motivo (`reasonLabel`) y «Stock de <titular>: antes → después» con `stock.before`/`stock.after` del backend (leídos de los movimientos, así que también valen con `replayed`).
  - `StockChangesService.notify()`: «Stock general» de atrás vuelve a pedir su stock.
  - «Registrar otra» limpia el formulario, renueva el `requestId` y recarga las opciones; «Cerrar» cierra el pop-up.
- **Carga de opciones:** `rxResource`. Cargando → esqueleto; error → «No pudimos cargar los productos» con «Reintentar» (`reload()`).

## 3. Endpoint

`GET /api/shrinkages/options` (nuevo, solo administrador):

- `?sellerId=<uuid>` → opciones del vendedor; sin `sellerId` → opciones de la bodega.
- `200 ShrinkageOptions`.
- `401` sin sesión; `403` con un vendedor; `404` si `sellerId` no es de un vendedor activo; `422` si `sellerId` no es UUID.
- La ruta estática `options` convive con `app/api/shrinkages/[requestId]/route.ts`: Next resuelve primero el segmento estático.
- Solo lee; no escribe nada.

`POST /api/shrinkages` (T-25) no cambia. El frontend manda `{ requestId, holderProfileId, productId, qty, reason }`.

## 4. Modelo de datos

No hay migración ni tablas nuevas.

Backend (`backend/src/shrinkage/types.ts`):

```ts
export interface ShrinkageOption {
  productId: number
  name: string
  image: string | null
  units: number            // piezas del titular
}

export interface ShrinkageReasonOption {
  code: ShrinkageReason
  label: string
}

export interface ShrinkageOptions {
  holder: { id: string; fullName: string } | null   // null = bodega
  products: ShrinkageOption[]
  reasons: ShrinkageReasonOption[]
}
```

Frontend (`src/app/features/shrinkage/interfaces/shrinkage.models.ts`, con `import type`):

```ts
export interface ShrinkageOptions { /* mismo contrato que el backend */ }

export interface Shrinkage {          // respuesta de POST /api/shrinkages (T-25 §4)
  requestId: string
  createdAt: string
  qty: number
  reason: string
  reasonLabel: string
  holder: { id: string; fullName: string } | null
  product: { id: number; name: string; image: string | null }
  stock: { before: number; after: number }
}

export interface CreateShrinkagePayload {
  requestId: string
  holderProfileId: string | null
  productId: number
  qty: number
  reason: string
}

export type ShrinkageFailureReason = 'no-units' | 'conflict' | 'not-found' | 'offline'

export type ShrinkageResult =
  | { ok: true; shrinkage: Shrinkage; replayed: boolean }
  | { ok: false; reason: ShrinkageFailureReason; message: string | null }
```

Forma del formulario (`components/shrinkage-form/shrinkage-form.models.ts`): `{ productId: number | null; qty: string; reason: string }` (`qty` es texto mientras se escribe; el payload lo convierte).

Rutas y enlaces:

```ts
// shared/constants/modal.constants.ts
export const MODAL_SHRINKAGE_PATH = 'merma';

// shared/utils/modal-links.ts — como fractionModalLink: el vendedor va como parámetro matricial.
export function shrinkageModalLink(params: { sellerId?: string } = {}): unknown[]
```

`StockQuickActionIcon` agrega `'shrinkage'`.

## 5. Interfaz

- **Pop-up** (`modal-panel`, título «Registrar merma»), sobre la página actual, igual que «Retirar» y «Fraccionar». Subtítulo «De <nombre>» o «De la bodega».
- **Formulario:** Producto → «Tiene N piezas» → Piezas → Motivo → aviso de error (si hay) → «Cancelar» (secundario) y «Registrar merma» (danger).
- **Resultado:** foto y nombre del producto, «N piezas · <motivo>», bloque «Stock de <titular>» con «antes → después», y los botones «Registrar otra» (secundario) y «Cerrar» (primario).
- Tokens y utilidades de `styles.css` (`field-*`, `surface-*`, `alert-*`), controles de PrimeNG (`p-select`, `pInputText`, `pButton`, `Skeleton`). Sin hex ni CSS por componente.
- Antes de maquetar: **ui-ux-pro-max** para estilo y reglas de UX, y **frontend-design** para el acabado (pantalla nueva, `CLAUDE.md`).
- A 375 px se usa sin zoom ni desplazamiento horizontal (RNF-03).

## 6. Plan de implementación

1. **Endpoint de opciones.** `listShrinkageOptions` en `backend/src/shrinkage/shrinkage.ts` (vendedor: `getActiveSellerName` + `stockOfHolder`; bodega: productos con `stock > 0`; `reasons` desde `SHRINKAGE_REASONS`), tipos en `types.ts`, exportes en `index.ts` y la ruta `app/api/shrinkages/options/route.ts`. Pruebas en `backend/tests/shrinkage-options.test.ts`. `npm run type-check` y `npm test` pasan.
2. **Esqueleto de la feature.** Crear `src/app/features/shrinkage/` (`components/`, `pages/`, `services/`, `interfaces/`, `models/`, `constants/`, `validators/`, `rules/`), `interfaces/shrinkage.models.ts` y `ShrinkageService` con sus pruebas.
3. **Ruta y enlace.** `MODAL_SHRINKAGE_PATH`, `shrinkageModalLink()` y la ruta en `admin.routes.ts` (outlet `ventana`, `canDeactivate: [modalSavingGuard]`, `data.title` «Registrar merma»). Pop-up con `ng generate component` y estados cargando / error / vacío / no encontrado.
4. **Diseño.** Pasar por ui-ux-pro-max y frontend-design con los tokens de la app.
5. **Formulario.** `shrinkage-form` (`ng generate component`) con el patrón de `product-form`: `createEmptyForm()`, validadores en `validators/`, «Tiene N piezas», errores al enviar, `output()` con el valor válido.
6. **Envío y resultado.** En la página: confirmación con `ConfirmService.ask()`, `requestId`, un solo envío, errores (§2), `shrinkage-result` (`ng generate component`), toast y `StockChangesService.notify()`.
7. **Entradas.** Ícono `shrinkage` en `stock-quick-actions` y los movimientos rápidos en `stock-page` (`YO_QUICK_ACTIONS` y la vista de vendedor). **Antes de este paso el usuario corre `./desbloquear stock-page`**; se actualizan solo las aserciones de §9.
8. **Verificación.** `ng build`, `npm run check:architecture`, `ng test` de las pruebas afectadas, y a mano a 375 px con el backend local: merma de un vendedor y de la bodega.
9. **Índice y Jira.** Actualizar `specs/README.md` y comentar el avance en `SCRUM-66` (paso del plan y ✅/❌/⏳ por criterio), moviéndola En curso → In review.

## 7. Criterios de aceptación

- [ ] Con Luis en «Viendo», «Stock general» muestra «Registrar su merma», que abre el pop-up «Registrar merma» con «De Luis» y sin selector de titular (criterio 1 de `SCRUM-66`).
- [ ] Con «Yo · bodega», «Stock general» muestra «Registrar merma», que abre el pop-up con «De la bodega» (criterio 2).
- [ ] El selector de producto lista solo los productos con piezas del titular, con «Tiene N piezas» al elegir uno; sin productos se ve el estado vacío.
- [ ] Elegir producto, escribir piezas y elegir motivo, confirmar en el diálogo y registrar muestra en el pop-up el producto, las piezas, el motivo y «Stock de <titular>: antes → después» con los saldos del backend; sale el toast «Merma registrada» y «Stock general» de atrás se actualiza (criterio 3).
- [ ] Piezas mayores que las del titular dan el error «Solo tiene N piezas» al enviar y no se manda nada; un `409` del backend se pinta como error del campo piezas y se recargan las opciones (criterio 4).
- [ ] Sin producto, sin piezas o sin motivo, «Registrar merma» muestra los errores de campo y no abre la confirmación; los errores no aparecen al solo tocar los campos (criterio 5).
- [ ] Cancelar la confirmación no manda nada.
- [ ] Mientras se registra, el botón está deshabilitado, un segundo clic no manda otra petición y el pop-up no se cierra (criterio 6).
- [ ] Sin conexión: aviso con «Reintentar», que reenvía con el mismo `requestId`; «Registrar otra» usa un `requestId` nuevo.
- [ ] Cargando, error al cargar (con «Reintentar») y vendedor no encontrado muestran su estado; a 375 px el pop-up se usa sin zoom (criterio 7).
- [ ] `GET /api/shrinkages/options` devuelve titular, productos con piezas (también desactivados) y los cuatro motivos; `403` con vendedor, `404` con un vendedor desactivado o inexistente, `422` con un `sellerId` que no es UUID.
- [ ] `ng build`, `npm run check:architecture`, `ng test` y `npm test` del backend pasan; solo cambian las aserciones de «Stock general» de §9.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| HU-25 se despliega sin T-25 | T-25 ya está en producción (migración aplicada el 2026-11-08). Esta rama sale de `feat/base-merma-simple`; T-25 se fusiona primero. |
| Una merma equivocada no se puede anular desde la app | Confirmación con `ConfirmService` que dice que no se puede deshacer. |
| Las piezas cambian entre cargar y registrar (otra venta o retiro) | El backend responde `409`; se pinta en el campo piezas y se recargan las opciones. |
| Agregar movimientos rápidos rompe aserciones con commit de «Stock general» | El usuario corre `./desbloquear stock-page` antes del paso 7; solo cambian las aserciones listadas en §9. |
| Sin mockup accesible, la pantalla puede no parecerse al canvas | Se sigue la página de Confluence y el patrón de «Retirar»/«Fraccionar»; el usuario revisa a 375 px antes de In review. |

## 9. Plan de pruebas

- **Backend, `backend/tests/shrinkage-options.test.ts`** (nuevo, contra la base real, saltado sin `SUPABASE_SERVICE_ROLE_KEY`): opciones del vendedor (solo piezas > 0, producto desactivado incluido), de la bodega (`stock > 0`, desactivados incluidos, sin los de 0), `reasons` en orden, `403`, `404` con vendedor desactivado o un administrador. Datos `test-shro-` y `test-auth-`, limpieza como en `shrinkage.test.ts`.
- **Frontend (nuevas):**
  - `shrinkage.service.spec.ts`: `getOptions()` con y sin `sellerId`; `create()` traduce `201`/`200`, `409` piezas, `409` conflicto, `404` y sin conexión.
  - `shrinkage-form.component.spec.ts`: errores al enviar (no al tocar), tope de piezas, «Tiene N piezas», `output()` con el valor.
  - `shrinkage-result.component.spec.ts`: producto, piezas, motivo y antes → después; titular bodega.
  - `shrinkage-page.component.spec.ts`: estados, confirmación (aceptar/cancelar), un solo envío, `requestId` que se conserva y se renueva, toast y `notify()`, `409` en el campo piezas.
  - `modal-links` de `shrinkageModalLink()` en un archivo de prueba nuevo.
- **Con commit, requieren `./desbloquear stock-page`** (cambio de comportamiento pedido por esta historia):
  - `stock-page.component.spec.ts:148`: la lista de «Yo» pasa a incluir «Registrar merma».
  - `stock-page.component.spec.ts:387` y `:404`: la vista de vendedor agrega «Registrar su merma».
  - `stock-page.component.history-link.spec.ts:74`: el total de movimientos rápidos de «Yo» pasa de 5 a 6.
  - Ninguna otra aserción se toca.

## 10. Decisiones

- **Sí:** pop-up en el outlet `ventana` (ruta `merma`), feature nueva `features/shrinkage/` (decisión del usuario). Igual que «Dejar», «Retirar» y «Fraccionar».
- **No:** página propia `/admin/merma`.
- **Sí:** el resultado se ve dentro del pop-up, con «Registrar otra» y «Cerrar» (decisión del usuario), como «Fraccionar». Cumple el criterio 3 de Jira (antes → después).
- **No:** cerrar con un toast como «Retirar».
- **Sí:** confirmación con `ConfirmService.ask()` antes de registrar (decisión del usuario). La v1 no tiene cómo anular una merma.
- **Sí:** endpoint nuevo `GET /api/shrinkages/options` con titular, productos y motivos (decisión del usuario). Un contrato para los dos titulares, como `GET /api/fractions/options` de HU-23.
- **No:** reusar `GET /api/sellers/:id` y `GET /api/stock` desde la feature. Dos formas de datos y la bodega no lista desactivados.
- **Sí:** las etiquetas de los motivos vienen del backend (decisión del usuario). El frontend no repite los textos.
- **Sí:** solo se entra desde «Stock general» (decisión del usuario), como dice el mockup.
- **No:** entrada en el detalle del vendedor ni en la card de «Productos».
- **Sí:** el titular queda fijo por el enlace (decisión del usuario), como pide el criterio 1. Abrir con un vendedor lo elige en «Viendo».
- **No:** selector de titular dentro del pop-up.
- **Sí:** el motivo se elige con un `p-select` (decisión del usuario), sin valor de entrada.
- **No:** cuatro botones visibles (`p-selectbutton`).
- **Sí:** el tope de piezas se valida al enviar, con el mensaje «Solo tiene N piezas». Lo dice Jira y es la regla de `CLAUDE.md` (errores al enviar).
- **Sí:** el botón «Registrar merma» es `danger`: da de baja piezas para siempre.

## Lo que **no** entra en este spec

- La merma en el historial y en «Mi stock» (HU-26).
- Entradas fuera de «Stock general» y selector de titular.
- Anular una merma, varios productos, nota libre, costo de la merma.
- Cambios en `POST /api/shrinkages`, en la migración de T-25 o en el seed.
