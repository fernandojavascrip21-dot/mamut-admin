# Spec — HU-42 · Cargar la remisión del proveedor al inventario y dar de alta productos nuevos

> **Estado:** Aprobado
> **Depende de:**
> - M9-t41-base-recepcion-remision (`specs/M9-t41-base-recepcion-remision/spec.md`): todo el backend de la remisión (`/api/receipts/*`, módulo `@receipts`). Este spec lo consume y solo le suma una lectura.
> - M2-t16-ventanas-dejar-retirar (`specs/M2-t16-ventanas-dejar-retirar/spec.md`): el outlet `ventana` y `modal-panel`.
> - M9-hu31-lista-de-resurtir (`specs/M9-hu31-lista-de-resurtir/spec.md`): de ahí salen el pop-up de tabla (`wide`), la barra inferior fija y el guard de cambios sin guardar.
> - M2-hu13-stock-general (`specs/M2-hu13-stock-general/spec.md`): los movimientos rápidos con «Yo · bodega».
> - M7-t26-estados-pantallas (`specs/M7-t26-estados-pantallas/spec.md`): estados de cargando, vacío y error.
> - M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`): costo y precio como texto, sin redondeo.
> **Fecha:** 2026-11-12
> **Objetivo:** que el administrador suba la remisión del proveedor en un pop-up, corrija los renglones propuestos y confirme una sola vez la entrada a bodega, y que resuelva en una página de pendientes los productos nuevos (darlos de alta o descartarlos) y los cambios de costo (aceptarlos o rechazarlos).

Fuentes:

- **Jira:** historia `SCRUM-104 · HU-42`, épica `SCRUM-79 · M9 · Resurtir y exportar (v2)`. Requerimientos RF-32 y RF-33. Bloqueada por T-41 (`SCRUM-103`, Finalizada). Relacionada con HU-32 (`SCRUM-89`) y HU-35 (`SCRUM-94`).
- **Mockups:** no hay mockup de HU-42 en Confluence (solo los de la v1). La pantalla sigue el patrón visual de «Lista de resurtir» (HU-31) y «Entrada a bodega» (HU-27), con el flujo de diseño de `CLAUDE.md` (paso 3).
- **Código:**
  - `backend/src/receipts/types.ts`: las formas de `ReceiptPreview`, `Receipt`, `PendingReceiptLines` y los resultados de cada acción.
  - `backend/src/receipts/constants.ts`: mensajes (`AI_NOT_CONFIGURED`, `AI_READ_FAILED`…) y límites (`MAX_LINES`, `MAX_FILE_BYTES`).
  - `src/app/features/purchases/pages/purchase-page/`: pop-up de una entrada con `requestId` y resultado.
  - `src/app/features/restock/`: pop-up de tabla, `unsavedRestockGuard` y `restock-form`.
  - `src/app/features/stock/constants/stock-page.constants.ts`: `YO_QUICK_ACTIONS`.
  - `src/app/shared/utils/modal-links.ts` y `shared/constants/modal.constants.ts`.
- **Decisiones del usuario del 2026-11-12** (§9). Cierran los dos «Por decidir» de `SCRUM-104`.

## 1. Por qué existe este spec

T-41 dejó listo el backend: lee la remisión, propone el producto de cada renglón, registra las entradas al confirmar y guarda como pendientes los productos nuevos y los cambios de costo. Falta la pantalla. HU-42 la agrega en dos lugares:

- **Pop-up «Cargar remisión»:** subir el archivo, revisar y corregir la vista previa y confirmar.
- **Página «Pendientes de remisiones»:** resolver lo que quedó pendiente, con un filtro «Productos nuevos | Cambios de costo».

## 2. Alcance

**Entra en este spec:**

- **Backend (una lectura nueva en `@receipts`):**
  - `listReceiptProducts(actor)` en `backend/src/receipts/catalog.ts`, exportado en `index.ts`. Usa `productsForMatching()` de `@products` y devuelve solo los activos (bolsitas incluidas, igual que el emparejamiento de T-41), ordenados por nombre.
  - Ruta `backend/app/api/receipts/products/route.ts` (`GET`), solo administrador.
  - Pruebas en un archivo nuevo, `backend/tests/receipts-products.test.ts`.
- **Frontend, feature nueva `src/app/features/receipts/`** (esqueleto completo antes de agregar archivos):
  - `pages/receipt-upload-page/`: el pop-up «Cargar remisión».
  - `pages/receipt-pending-page/`: la página de pendientes.
  - `components/`: `receipt-file-picker`, `receipt-preview-form`, `receipt-preview-line`, `receipt-skipped-list`, `receipt-result`, `pending-new-product-card`, `pending-cost-change-card` y `new-product-dialog`.
  - `services/receipts.service.ts`, `guards/unsaved-receipt.guard.ts`, `rules/receipt-preview.rules.ts`, `validators/receipt-line.validators.ts`, `interfaces/receipt.models.ts`, `models/`, `constants/` y `receipts.routes.ts`.
- **Cambios en `core` y `shared`:**
  - `shared/constants/modal.constants.ts`: `MODAL_RECEIPT_PATH = 'remision'`.
  - `shared/utils/modal-links.ts`: `receiptModalLink()`.
  - `core/layout/routes/admin.routes.ts`: la ventana `remision` y la página `remisiones` (`loadChildren`).
- **Cambios en `features/stock`:**
  - «Cargar remisión» como 8.º movimiento rápido de `YO_QUICK_ACTIONS`, con ícono nuevo `receipt` en `stock-quick-actions`.
  - Requiere desbloquear `stock-page` (§7).
- **Pruebas** del frontend en archivos `.spec.ts` nuevos, y el 7 → 8 de los `it` desbloqueados.
- **Jira y el índice** (`specs/README.md`).

**No entra en este spec:**

- Ningún cambio en los casos de uso ni en las rutas existentes de T-41 (vista previa, confirmar, pendientes y sus cuatro acciones).
- Rescatar o completar a mano un renglón «no leído», o agregar renglones que no vienen en el archivo (se capturan aparte con «Entrada a bodega»).
- Foto, fraccionado o bolsita en el alta de un producto nuevo: se agregan después en «Editar producto».
- Ligar la remisión a un pedido de resurtir (T-41 lo dejó fuera) o entrar desde el pop-up de resurtir.
- Un aviso o tarjeta de pendientes en «Stock general» o en el menú lateral.
- Historial de remisiones confirmadas (`GET /api/receipts/[requestId]` solo se usa como respaldo, §3).
- Cambiar el precio de venta desde un cambio de costo: el pendiente manda a «Editar producto».
- Validar en el navegador el tamaño o el tipo del archivo más allá del `accept` del `<input>`: lo decide el backend.
- Guardar la vista previa entre sesiones (`localStorage` o borrador).
- Cambios en «Entrada a bodega» (HU-27), en `@purchases` o en `@restock`.

## 3. Reglas de negocio y pantallas

### Quién

Solo el **administrador**. El botón vive en los movimientos rápidos de «Stock general» con «Yo · bodega» (con un vendedor en «Viendo» no aparece, como «Resurtir»). Las rutas están bajo `/admin`, detrás de `roleGuard`.

### Entrada

- Movimiento rápido «Cargar remisión» (ícono `receipt`), después de «Entrada a bodega»: `receiptModalLink()` → `/admin/(…//ventana:remision)`.
- El pop-up tiene siempre el enlace «Pendientes de remisiones», que cierra la ventana y lleva a `/admin/remisiones/pendientes` (`leaveModalLink`).

### Pop-up «Cargar remisión» (`receipt-upload-page`)

`modal-panel` con `wide` y título «Cargar remisión». Estados (`ReceiptUploadState`):

| Estado | Qué se ve |
| --- | --- |
| `pick` | `receipt-file-picker`: texto «Sube la remisión en Excel (.xlsx), PDF o imagen (JPG o PNG).», botón «Elegir archivo» (`pButton` sobre un `<input type="file" accept=".xlsx,.pdf,.jpg,.jpeg,.png">` oculto) y el enlace a pendientes. |
| `reading` | `Skeleton` con «Leyendo la remisión…» y «Un PDF o una imagen puede tardar hasta un minuto.». No se puede cerrar (`closable = false`). |
| `readError` | Mensaje del backend (`422` del archivo, `500` con `AI_NOT_CONFIGURED` o `AI_READ_FAILED`; sin red, «No pudimos leer la remisión. Revisa tu conexión.») y botón «Elegir otro archivo» (vuelve a `pick`). |
| `empty` | Vista previa con `lines: []`: «No encontré productos en la remisión», la lista de no leídos si hay, y «Elegir otro archivo». |
| `review` | `receipt-preview-form` (abajo) con la barra inferior fija. |
| `confirming` | El formulario deshabilitado y «Confirmando…» en el botón. No se puede cerrar. |
| `done` | `receipt-result` (abajo). |

- La lectura usa `POST /api/receipts/preview` con `FormData` (campo `file`). En paralelo, al entrar a `review`, se carga el catálogo con `GET /api/receipts/products` (`rxResource`); si falla, el selector de producto muestra «No pudimos cargar los productos» con «Reintentar» y el resto del formulario sigue (los renglones conservan el producto propuesto).
- Errores con `http-errors.ts`, nunca leyendo `HttpErrorResponse` en el componente.

### Revisar y corregir (`receipt-preview-form`, presentacional)

Recibe por `input()` la vista previa, el catálogo y `disabled`; emite por `output()` el payload de confirmar. Sigue el patrón «Formularios» de `CLAUDE.md`:

- `FormArray` `lines`, un `FormGroup` por renglón propuesto: `productId: string` (`''` = «Producto nuevo»), `qty: string`, `unitCost: string` (`''` = sin costo). `readName` y `position` viajan aparte (no se editan).
- **Por renglón (`receipt-preview-line`):**
  - El nombre leído (`readName` tal cual) y, debajo, la etiqueta del emparejamiento: «Reconocido» (`alias` o `name`), «Elegido por ti» (el administrador cambió el producto) o «Producto nuevo» (sin producto).
  - **Producto:** `p-select` con filtro sobre el catálogo (foto, nombre) más la opción «Producto nuevo». Con «Producto nuevo» se muestra «Nombre sugerido: <suggestedName>» y «Quedará en pendientes para darlo de alta».
  - **Piezas:** `pInputText` `inputmode="numeric"`; entero de 1 a `MAX_QTY` (`receipt-line.validators.ts`), error al confirmar.
  - **Costo leído:** `pInputText` `type="text" inputmode="decimal"`, editable; vacío = sin costo; hasta 4 decimales y de `0` a `999999.9999` con `decimalPlaces`/`compareMoney`, error al confirmar, nunca se redondea.
  - **Bodega:** con producto, «+N · Bodega X → Y». Sin producto, nada.
  - **Costo distinto:** con producto y costo, si `compareMoney(unitCost, 4, product.unitCost, 4) !== 0`, aviso «Costo distinto: $actual → $leído · quedará en pendientes» (`warning-*`). Regla en vivo, como «precio menor que el costo».
  - Botón «Quitar» (`[text]="true"`, ícono): `removeAt` y `markAsDirty()`. Sin confirmación; con 0 renglones el botón de confirmar se deshabilita y se ve «Quitaste todos los renglones».
- **Recalcular (`rules/receipt-preview.rules.ts`, funciones puras):**
  - `stockBefore(productId)`: el `before` de `preview.stock` si viene; si no (producto elegido a mano), las `units` del catálogo.
  - `stockAfter(productId)` = `before` + la suma de las piezas válidas de **todos** los renglones de ese producto. Son piezas (enteros), no dinero.
  - `costChanged(line, catalogProduct)` con `compareMoney`.
  - `buildConfirmPayload(...)`: `{ requestId, source, fileName, lines: [{ readName, qty, unitCost, productId }] }` en el orden del formulario; `productId` `null` con «Producto nuevo», `unitCost` `null` si vacío.
  - El backend vuelve a decidir todo al confirmar; la pantalla solo anticipa.
- **No leídos (`receipt-skipped-list`):** plegados, «No leídos (N)», cada uno con su texto y la `label` del backend. Solo lectura. No aparece si `skipped` está vacío.
- **Barra inferior fija:** «N renglones · M piezas · K productos nuevos · C cambios de costo» y el botón «Confirmar entrada» (primario). Inválido → `markAllAsTouched()` y no se envía.

### Confirmar

- Un solo envío: `POST /api/receipts` con el `requestId` del intento (`newUuid()`), sin segundo envío mientras el primero corre. No pide confirmación con `ConfirmService` (sumar piezas no es destructivo, como HU-27).
- El `requestId` se conserva si el envío falla, para que reintentar no registre dos veces. Se renueva solo con «Cargar otra remisión».
- Respuestas:
  - `201` o `200 replayed` → `done`, `StockChangesService` avisa del cambio de stock, toast «Entrada registrada».
  - `409 PRODUCT_INACTIVE` o `404`: mensaje del backend arriba del formulario («Un producto se desactivó; elige otro o márcalo como producto nuevo») y se queda en `review`.
  - `409` «Esta remisión ya se registró con otros datos.» (el primer intento sí se registró y luego se editó): mensaje del backend y botón «Ver lo registrado», que pide `GET /api/receipts/[requestId]` y pasa a `done` con esa remisión.
  - `422`: mensaje del backend arriba del formulario.
  - Sin red: «No pudimos confirmar la entrada. Inténtalo de nuevo.», se queda en `review` con el mismo `requestId`.

### Resultado (`receipt-result`)

Con el `Receipt` de la respuesta:

- «N entradas registradas»: por cada renglón `received`, el producto, «+qty» y la bodega después (de `units`), con el antes que tenía la pantalla.
- «K productos nuevos y C cambios de costo quedaron pendientes» (si hay) con el botón «Ver pendientes (K + C)» → `/admin/remisiones/pendientes` cerrando la ventana.
- Botones «Cargar otra remisión» (vuelve a `pick` con un `requestId` nuevo) y «Cerrar».

### Salir del pop-up

- `canDeactivate: [unsavedReceiptGuard]`:
  - en `reading` o `confirming` → no se sale;
  - en `review` → `ConfirmService.ask()` «¿Descartar la remisión? No se registró nada.» («Descartar» / «Seguir revisando»);
  - en cualquier otro estado → sale.
- La X, Escape y «Cerrar» navegan con `closeModalLink()`; el guard decide.

### Página «Pendientes de remisiones» (`receipt-pending-page`)

Ruta `/admin/remisiones/pendientes` (`/admin/remisiones` redirige ahí). Título `page-title` «Pendientes de remisiones».

- Carga `GET /api/receipts/pending` con `rxResource`.
- Selector `p-selectbutton` (como el de «Stock general»): «Productos nuevos (N)» | «Cambios de costo (C)». Empieza en «Productos nuevos»; si esa lista está vacía y la otra no, empieza en «Cambios de costo». No se recuerda.
- Estados:
  - cargando: `Skeleton` de tarjetas;
  - error: «No pudimos cargar los pendientes» con «Reintentar» (`reload()`);
  - vacío de un apartado: «No hay productos nuevos pendientes» / «No hay cambios de costo pendientes», con «Cargar remisión» (abre la ventana).
- Debajo del título, «Cargar remisión» (`pButton` `secondary`) abre la ventana.
- Al resolver un pendiente, su tarjeta sale de la lista y el contador baja, sin recargar todo. Si el backend responde `409` «Este pendiente ya se resolvió.» o `404`, toast con el mensaje y se recarga la lista.

**`pending-new-product-card`** (presentacional): nombre sugerido, «N piezas», «Costo leído $X» o «Sin costo leído», «Remisión del <fecha>» (`createdAt` con el pipe `date` en `America/Mexico_City`). Botones:

- «Dar de alta» (primario) → abre `new-product-dialog`.
- «Descartar» (`danger` + `[outlined]`) → `ConfirmService.ask()` «¿Descartar <nombre>? Sus N piezas no entrarán a bodega.» → `POST /api/receipts/lines/[id]/discard` → toast «Producto descartado».

**`new-product-dialog`** (presentacional, `modal-panel` normal dentro de la página, título «Dar de alta producto»):

- Formulario reactivo: `name` (prellenado con `suggestedName`, obligatorio, hasta 200), `price` (texto, 2 decimales, obligatorio), `categoryId` (`p-select`, `''` = «Sin categoría», opciones de `GET /api/categories` vía `ReceiptsService`), `unitCost` (texto, 4 decimales, prellenado con el costo leído; obligatorio si no hay costo leído).
- Regla en vivo «El precio es menor que el costo» (como el formulario de producto).
- Texto fijo: «Entrarán N piezas a bodega. La foto se agrega después en Editar producto.»
- La página manda `POST /api/receipts/lines/[id]/product` con `{ name, price, categoryId, unitCost? }` (`unitCost` solo si cambió respecto al leído o no había). Un solo envío; el diálogo no se cierra mientras guarda.
- `201` → cierra, toast «<nombre> dado de alta · Bodega 0 → N», `StockChangesService` avisa. `409 DUPLICATE_NAME` → error en el campo nombre; `422` (precio menor que el costo, costo faltante, categoría) → error del campo o arriba del formulario.

**`pending-cost-change-card`** (presentacional): foto y nombre del producto (con «Desactivado» si `active` es `false`), «N piezas recibidas», y los tres costos: «Actual $currentUnitCost», «Al recibir $previousUnitCost» (solo si difiere del actual) y «Nuevo $newUnitCost». Botones:

- «Aceptar costo nuevo» (primario, deshabilitado si el producto está desactivado) → `ConfirmService.ask()` «¿Cambiar el costo de fábrica de <nombre> a $nuevo? El precio de venta no cambia.» → `POST …/cost/accept` → toast «Costo actualizado».
  - `422 COST_ABOVE_PRICE` → toast con el mensaje del backend y enlace «Editar producto» (`/admin/productos/:id/editar`) en la tarjeta.
  - `409 PRODUCT_INACTIVE` → toast con el mensaje y recarga.
- «Rechazar» (`secondary`) → `POST …/cost/reject` sin confirmación (no cambia nada del producto) → toast «Costo rechazado».

### 375 px

- Pop-up: cada renglón se apila (nombre y etiqueta, producto, piezas y costo en una fila de dos, bodega y aviso debajo); la barra inferior queda fija con el resumen en dos líneas.
- Página: una tarjeta por fila; los botones de la tarjeta ocupan el ancho.

### `GET /api/receipts/products` (backend nuevo)

- Solo administrador (`requireAdmin`); un vendedor recibe `403`.
- Responde `200` con `{ products: ReceiptCatalogItem[] }`: `{ id, name, image, unitCost, units }` de cada producto **activo** (bolsitas incluidas), ordenados por nombre sin acentos ni mayúsculas. `units` es `products.stock` (bodega). `unitCost` es texto de 4 decimales.
- No escribe nada.

## 4. Modelo de datos

Este spec no agrega tablas ni migraciones. Reusa las de T-41.

Backend, en `backend/src/receipts/types.ts` (exportado en `index.ts`):

```ts
// Producto que el administrador puede elegir al corregir una vista previa (HU-42).
export interface ReceiptCatalogItem {
  id: number
  name: string
  image: string | null
  unitCost: string // costo de fábrica actual, «123.4500»
  units: number // piezas en bodega
}
```

Frontend, `src/app/features/receipts/interfaces/receipt.models.ts`: copia de las formas del backend que usa la pantalla (`ReceiptSource`, `MatchKind`, `PreviewLine`, `ReceiptPreview`, `ConfirmReceiptPayload`, `ReceiptLine`, `Receipt`, `PendingNewProduct`, `PendingCostChange`, `PendingReceiptLines`, `ReceiptCatalogItem`, `CreateProductFromLinePayload`, `ReceiptCategory`), todo con `import type`.

Frontend, `models/receipt-upload-page.models.ts`:

```ts
export type ReceiptUploadState = 'pick' | 'reading' | 'readError' | 'empty' | 'review' | 'confirming' | 'done'

// Lo que el guard necesita del pop-up.
export interface ReceiptLeaveTarget {
  busy(): boolean // reading o confirming
  hasUnsavedChanges(): boolean // review
}
```

Frontend, `components/receipt-preview-form/receipt-preview-form.models.ts`:

```ts
// Forma de un renglón en el formulario: todo texto, como los demás formularios de la app.
export interface ReceiptLineFormValue {
  productId: string // '' = «Producto nuevo»
  qty: string
  unitCost: string // '' = sin costo
}
```

`ReceiptsService` (`services/receipts.service.ts`), cliente de `${API_BASE_URL}/api/receipts`:

| Método | Petición |
| --- | --- |
| `preview(file: File)` | `POST /preview` (`FormData`, campo `file`) |
| `getProducts()` | `GET /products` |
| `confirm(payload)` | `POST /` |
| `get(requestId)` | `GET /:requestId` |
| `getPending()` | `GET /pending` |
| `createProduct(lineId, payload)` | `POST /lines/:id/product` |
| `discard(lineId)` | `POST /lines/:id/discard` |
| `acceptCost(lineId)` | `POST /lines/:id/cost/accept` |
| `rejectCost(lineId)` | `POST /lines/:id/cost/reject` |
| `getCategories()` | `GET ${API_BASE_URL}/api/categories` |

Rutas:

```ts
// admin.routes.ts — ventana
{ path: MODAL_RECEIPT_PATH, outlet: MODAL_OUTLET, canDeactivate: [unsavedReceiptGuard],
  loadComponent: () => import('@features/receipts/pages/receipt-upload-page/…'), data: { title: 'Cargar remisión' } }
// admin.routes.ts — página
{ path: 'remisiones', loadChildren: () => import('@features/receipts/receipts.routes').then((m) => m.RECEIPT_ROUTES) }
// receipts.routes.ts
[{ path: '', pathMatch: 'full', redirectTo: 'pendientes' },
 { path: 'pendientes', loadComponent: () => import('./pages/receipt-pending-page/…'), title: 'Pendientes de remisiones' }]
```

## 5. Plan de implementación

1. **Backend: catálogo para corregir.**
   - `ReceiptCatalogItem` en `types.ts`, `listReceiptProducts` en `catalog.ts` y su export en `index.ts`.
   - Ruta `backend/app/api/receipts/products/route.ts` (`GET`).
   - `backend/tests/receipts-products.test.ts` (§7). `npm run type-check`, `npm run build` y `npx vitest run tests/receipts-products.test.ts tests/receipts.test.ts` pasan.
2. **Esqueleto de la feature.** Crear las carpetas de `features/receipts/` (§2), `interfaces/receipt.models.ts`, `constants/` y `ReceiptsService` con su `.spec.ts`. `ng build` y `check:architecture` pasan.
3. **Diseño.** Antes de las pantallas, usar **ui-ux-pro-max** y luego **frontend-design** con los tokens de `styles.css` y el patrón de «Lista de resurtir»; sin colores del mockup ni hex.
4. **Reglas y validadores.** `rules/receipt-preview.rules.ts` y `validators/receipt-line.validators.ts`, con sus pruebas puras.
5. **Pop-up, parte 1: subir y leer.**
   - `MODAL_RECEIPT_PATH`, `receiptModalLink()`, la ruta de la ventana y `unsavedReceiptGuard`.
   - `receipt-upload-page` con los estados `pick`, `reading`, `readError` y `empty`; `receipt-file-picker` y `receipt-skipped-list`.
   - Componentes con `ng generate component`.
6. **Pop-up, parte 2: revisar y confirmar.** `receipt-preview-form` y `receipt-preview-line` (formulario, recalcular, quitar, barra fija), el envío con `requestId` y sus errores, y `receipt-result`.
7. **Movimiento rápido.** El usuario corre `./desbloquear stock-page` en la rama. Agregar «Cargar remisión» a `YO_QUICK_ACTIONS` (después de «Entrada a bodega») y el ícono `receipt` a `StockQuickActionIcon` y a la plantilla de `stock-quick-actions`; cambiar solo el 7 → 8 de los `it` desbloqueados (§7).
8. **Página de pendientes.** `receipts.routes.ts`, la ruta `remisiones` en `admin.routes.ts`, `receipt-pending-page`, `pending-new-product-card`, `pending-cost-change-card` y `new-product-dialog`.
9. **Cierre.** `npm run build`, `npm run check:architecture`, `ng test --watch=false` y, en `backend/`, `npm test` con `SUPABASE_SERVICE_ROLE_KEY` (revisar antes el bloque activo de `backend/.env`). Revisión manual a 375 px y en computadora con el seed y un Excel con el formato del proveedor.
10. **Índice y Jira.** Actualizar `specs/README.md` (estado y relaciones). En `SCRUM-104`, comentar el paso del plan y ✅/❌/⏳ por criterio, y moverla En curso → In review → Finalizada según avance (Finalizada solo con todo verificado y revisado por el usuario).

## 6. Criterios de aceptación

**Backend**

- [ ] `GET /api/receipts/products` devuelve solo productos activos (un desactivado no aparece; una bolsita activa sí), con `unitCost` de 4 decimales y `units` igual a `products.stock`, ordenados por nombre.
- [ ] Un vendedor recibe `403` en `GET /api/receipts/products`.
- [ ] `npm run type-check`, `npm run build`, `npm test` y `tests/architecture.test.ts` pasan, sin cambios en tests con commit del backend.

**Entrada y lectura (criterio 1 y 5 de `SCRUM-104`)**

- [ ] Con «Yo · bodega», «Stock general» muestra 8 movimientos rápidos y «Cargar remisión» va después de «Entrada a bodega»; abre la ventana `remision`. Con un vendedor en «Viendo» no aparece.
- [ ] Elegir un archivo manda `POST /api/receipts/preview` con el campo `file` y muestra «Leyendo la remisión…»; mientras lee, el pop-up no se puede cerrar.
- [ ] Un `422` o `500` del backend muestra su mensaje y «Elegir otro archivo» vuelve al estado inicial.
- [ ] Una vista previa con `lines: []` muestra «No encontré productos en la remisión».
- [ ] Cada renglón muestra el nombre leído, la etiqueta («Reconocido» / «Producto nuevo»), piezas, costo y, con producto, «+N · Bodega X → Y». Dos renglones del mismo producto suman en el «después».
- [ ] Los no leídos aparecen plegados en «No leídos (N)» con su motivo, y no se pueden editar.
- [ ] Un renglón con costo distinto al del producto muestra el aviso «Costo distinto… quedará en pendientes»; `12.5` contra `12.5000` no lo muestra.

**Corregir antes de confirmar (criterio 4)**

- [ ] Cambiar el producto de un renglón a otro del catálogo cambia la etiqueta a «Elegido por ti» y recalcula la bodega antes → después de los dos productos afectados y el aviso de costo.
- [ ] Elegir «Producto nuevo» quita la bodega del renglón y muestra el nombre sugerido.
- [ ] Cambiar las piezas recalcula el «después» en vivo. Piezas `0`, `2.5`, `abc` o vacías dan error al confirmar y no se envía nada.
- [ ] Un costo con 5 decimales da error al confirmar y nunca se redondea; un costo vacío se envía como `null`.
- [ ] «Quitar» saca el renglón del envío; sin renglones, «Confirmar entrada» queda deshabilitado.
- [ ] Si falla la carga del catálogo, el selector muestra «Reintentar» y los renglones conservan su producto propuesto.

**Confirmar (criterio 2)**

- [ ] «Confirmar entrada» manda un solo `POST /api/receipts` con `requestId`, `source`, `fileName` y los renglones finales en orden (`productId` `null` en «Producto nuevo»). Un doble clic no manda dos.
- [ ] Sin confirmar no se llama a `POST /api/receipts` (salir o «Elegir otro archivo» no registra nada).
- [ ] Si el envío falla por red, reintentar usa el mismo `requestId`; «Cargar otra remisión» usa uno nuevo.
- [ ] Un `409 PRODUCT_INACTIVE` o un `422` muestra el mensaje y deja el formulario como estaba.
- [ ] Un `409` «ya se registró con otros datos» ofrece «Ver lo registrado», que muestra el resultado con `GET /api/receipts/[requestId]`.
- [ ] El resultado muestra las entradas con la bodega después y, si hay pendientes, «Ver pendientes (N)», que cierra la ventana y abre `/admin/remisiones/pendientes`.
- [ ] Tras confirmar, «Stock general» refleja las piezas nuevas sin recargar (`StockChangesService`).
- [ ] Cerrar el pop-up en revisión pregunta «¿Descartar la remisión?»; «Seguir revisando» deja el pop-up y sus cambios.

**Productos nuevos (criterio 3)**

- [ ] `/admin/remisiones/pendientes` muestra «Productos nuevos (N)» y «Cambios de costo (C)» con sus tarjetas; `/admin/remisiones` redirige ahí. El enlace del pop-up lleva a esta página.
- [ ] «Dar de alta» abre el diálogo con el nombre sugerido (editable) y el costo leído prellenado; sin costo leído, el costo es obligatorio.
- [ ] Guardar manda `POST /api/receipts/lines/[id]/product` con nombre, precio y categoría; la tarjeta sale, el contador baja y el toast dice «Bodega 0 → N».
- [ ] Un nombre duplicado (`409`) marca el campo nombre; un precio menor que el costo se avisa en vivo y el `422` del backend se muestra.
- [ ] «Descartar» pide confirmación y, al aceptar, la tarjeta sale sin mover inventario.

**Cambios de costo**

- [ ] Cada tarjeta muestra el costo actual, el de cuando se recibió (si difiere) y el nuevo.
- [ ] «Aceptar costo nuevo» pide confirmación y, al aceptar, la tarjeta sale. Con `422 COST_ABOVE_PRICE` se muestra el mensaje y el enlace «Editar producto».
- [ ] Con el producto desactivado, «Aceptar costo nuevo» está deshabilitado y «Rechazar» funciona.
- [ ] Un pendiente ya resuelto (`409`) muestra el mensaje y recarga la lista.

**Estados y 375 px (criterio 5)**

- [ ] La página tiene estados de cargando, error con «Reintentar» y vacío por apartado.
- [ ] A 375 px el pop-up y la página no tienen scroll horizontal y la barra de confirmar queda visible.

**Generales**

- [ ] `npm run build`, `npm run check:architecture` y `ng test --watch=false` pasan; los únicos tests con commit cambiados son los `it` de `stock-page` desbloqueados (7 → 8).
- [ ] Ningún archivo de clase declara tipos ni constantes; los componentes se generaron con `ng generate component`; sin hex, sin `any`, sin `console.log`.

## 7. Plan de pruebas

**Backend — `backend/tests/receipts-products.test.ts` (nuevo)**

- Datos `test-rcp-` + `Date.now()` con `createProduct`: uno activo, uno desactivado y una bolsita activa (o el patrón de `fractions.test.ts`); un vendedor `test-auth-`.
- Casos: solo activos, bolsita incluida, forma y orden, `units` igual a `products.stock`, `403` del vendedor.
- Limpieza como `receipts.test.ts`; se salta sin `SUPABASE_SERVICE_ROLE_KEY`.

**Frontend (archivos nuevos)**

- `receipts.service.spec.ts`: cada método con `HttpTestingController` (URL, verbo, cuerpo; `FormData` con `file`).
- `receipt-preview.rules.spec.ts`: `stockBefore`/`stockAfter` con dos renglones del mismo producto y con un producto elegido a mano; `costChanged` (`12.5` vs `12.5000`); `buildConfirmPayload` (`''` → `null`, orden).
- `receipt-line.validators.spec.ts`: piezas y costo válidos e inválidos.
- `receipt-upload-page.component.spec.ts`: estados `reading`/`readError`/`empty`/`review`/`done`, un solo envío, `requestId` conservado tras error y renovado con «Cargar otra», `409` de otros datos con «Ver lo registrado».
- `receipt-preview-form.component.spec.ts` y `receipt-preview-line.component.spec.ts`: cambiar producto, «Producto nuevo», piezas, costo, quitar, errores al enviar y payload emitido.
- `unsaved-receipt.guard.spec.ts`: ocupado → `false`; revisión → pregunta; otros → `true`.
- `receipt-pending-page.component.spec.ts`: selector y contadores, estados, alta, descartar, aceptar (incluye `COST_ABOVE_PRICE`), rechazar y `409`.
- `new-product-dialog.component.spec.ts`, `pending-new-product-card.component.spec.ts`, `pending-cost-change-card.component.spec.ts`, `receipt-result.component.spec.ts`, `receipt-skipped-list.component.spec.ts`, `receipt-file-picker.component.spec.ts`.
- `admin.routes.receipt.spec.ts`: la ventana `remision` con su guard y título, y `remisiones` → `pendientes`.
- `stock-page.constants.receipt.spec.ts`: «Cargar remisión» en `YO_QUICK_ACTIONS` después de «Entrada a bodega», con `receiptModalLink()` e ícono `receipt`.

**Tests con commit que cambian (requieren `./desbloquear stock-page`, que corre el usuario)**

- `stock-page.component.history-link.spec.ts` · «sigue habiendo siete movimientos rápidos…»: `toHaveLength(7)` → `8` (y el texto del `it`).
- `stock-page.component.history-view.spec.ts` · los dos `it` con `lines('a.quick-action')).toHaveLength(7)` (líneas ~196 y ~404): `7` → `8`. Los `toHaveLength(3)` de la vista de vendedor no cambian.
- `stock-page.component.shrinkage-link.spec.ts` · el `it` con `toHaveLength(7)`: `7` → `8`.
- Ninguna otra aserción de esos archivos se toca. Si otro test con commit falla (por ejemplo, de `stock-quick-actions`), se detiene y se reporta con el comando `./desbloquear` exacto.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Leer un PDF o una imagen tarda hasta 60 s y el administrador cierra o recarga. | Estado `reading` con texto que avisa del tiempo; no se puede cerrar el pop-up. Si recarga, no se registró nada (la vista previa no escribe). |
| Una vista previa de ~30 renglones editables es pesada a 375 px dentro de un pop-up. | `wide` (alto casi completo), renglones apilados, barra inferior fija y no leídos plegados. Revisión manual a 375 px en el paso 9. |
| La pantalla anticipa «antes → después» y «costo distinto» y el backend decide otra cosa (el stock cambió entre la vista previa y la confirmación). | La pantalla solo anticipa; el resultado usa `units` de la respuesta. El costo distinto lo vuelve a decidir el backend. |
| El primer intento de confirmar sí se registró (respuesta perdida) y el administrador edita y reintenta. | El backend responde `409` «otros datos» y la pantalla ofrece «Ver lo registrado» con `GET /api/receipts/[requestId]`. |
| Agregar el 8.º botón rompe tests con commit de `stock-page`. | Se desbloquea `stock-page` antes del paso 7 y solo cambia el 7 → 8. |
| El catálogo crece y el `p-select` con filtro se vuelve lento. | Hoy son decenas de productos. Si crece, se cambia a búsqueda en el backend en otro spec. |
| Aceptar un costo mayor que el precio. | El backend responde `COST_ABOVE_PRICE` y la tarjeta enlaza a «Editar producto». |
| Sin `GEMINI_API_KEY` en el backend desplegado, PDF e imagen fallan. | El mensaje `AI_NOT_CONFIGURED` se muestra tal cual; Excel sigue funcionando. |

## 9. Decisiones

**Entrada y forma (cierran los «Por decidir» de `SCRUM-104`)**

- **Sí:** se entra con un movimiento rápido propio, «Cargar remisión», en «Stock general» con «Yo · bodega» (decisión del usuario).
  - **No:** solo dentro de «Entrada a bodega», ni desde el pop-up de resurtir (el backend no liga remisión con pedido).
- **Sí:** «Cargar remisión» es un pop-up en el outlet `ventana` (`remision`), como «Entrada a bodega» y «Resurtir» (decisión del usuario).
  - **No:** página completa.
- **Sí:** los pendientes viven en una página propia, `/admin/remisiones/pendientes`, con el filtro «Productos nuevos | Cambios de costo» (decisión del usuario).
  - **No:** una sección de «Productos» ni una vista de «Stock general».
- **Sí:** el aviso de pendientes son solo enlaces: «Ver pendientes (N)» en el resultado y «Pendientes de remisiones» fijo en el pop-up (recomendación aceptada por el usuario).
  - **No:** tarjeta de pendientes en «Stock general».
- **Sí:** 8.º movimiento rápido aunque rompa los tests con commit que cuentan 7, con `./desbloquear stock-page` (decisión del usuario).

**Vista previa**

- **Sí:** antes de confirmar se puede cambiar el producto, las piezas y el costo leído, y quitar renglones (decisión del usuario).
- **Sí:** los no leídos se ven plegados y de solo lectura; no se rescatan ni se agregan renglones a mano (recomendación aceptada por el usuario).
- **Sí:** endpoint nuevo `GET /api/receipts/products` en `@receipts`, con costo y piezas en bodega, para el selector de producto (decisión del usuario).
  - **No:** reusar `GET /api/restock/products`, de otro módulo y con otro filtro.
- **Sí:** la pantalla recalcula en vivo la bodega antes → después (enteros) y el aviso de costo distinto (`compareMoney`); el backend decide igual al confirmar.
- **Sí:** al salir con una vista previa sin confirmar se pregunta con `ConfirmService` (recomendación aceptada por el usuario).
  - **No:** cerrar sin preguntar.
- **Sí:** «Confirmar entrada» no pide un segundo «¿Seguro?»: sumar piezas no es destructivo, como HU-27.
- **Sí:** el tamaño y el tipo del archivo los valida solo el backend; el navegador usa `accept`.

**Pendientes**

- **Sí:** HU-42 resuelve los dos apartados: productos nuevos (alta o descartar) y cambios de costo (aceptar o rechazar) (decisión del usuario).
- **Sí:** el alta es un pop-up con formulario corto (nombre sugerido editable, precio, categoría y costo), sin foto ni fraccionado (decisión del usuario).
  - **No:** formulario en línea en la tarjeta, ni reusar «Nuevo producto» de HU-04 (otra feature y otro caso de uso del backend).
- **Sí:** descartar y aceptar piden confirmación; rechazar no, porque no cambia el producto.

**Confirmar**

- **Sí:** el resultado se ve en el pop-up, con «Ver pendientes» y «Cargar otra remisión» (decisión del usuario).
  - **No:** cerrar y saltar directo a pendientes.

## Lo que **no** entra en este spec

- Cambios en los casos de uso y rutas existentes de T-41, en HU-27 (`@purchases`) o en `@restock`.
- Rescatar no leídos, agregar renglones a mano o guardar la vista previa.
- Foto, fraccionado o bolsita en el alta de un pendiente; cambiar el precio desde un cambio de costo.
- Ligar a pedidos de resurtir, historial de remisiones, aviso de pendientes en «Stock general» o en el menú.
