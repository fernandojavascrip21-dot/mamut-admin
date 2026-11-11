# Spec técnico — HU-32 · Exportar el pedido a PDF y Excel y ver pedidos anteriores (administrador)

> **Estado:** Implementado
> **Depende de:** M9-hu31-lista-de-resurtir (`specs/M9-hu31-lista-de-resurtir/spec.md`): pop-up `resurtir` en el outlet `ventana`, `RestockService`, formulario de renglones, `GET /api/restock/products` con el costo actual y `estimatedTotal`/`customLines` en el pedido. M9-t36-base-resurtir (`specs/M9-t36-base-resurtir/spec.md`): `GET /api/restock/orders?status=closed` (últimos 50) y `GET /api/restock/orders/[id]`, solo administrador. M7-t26-estados-pantallas (`specs/M7-t26-estados-pantallas/spec.md`): estados cargando / vacío / error. M3-t05-reducir-bundle-inicial (`specs/M3-t05-reducir-bundle-inicial/spec.md`): el bundle inicial no crece.
> **Fecha:** 2026-11-11
> **Objetivo:** que el administrador exporte un pedido de resurtir guardado a PDF y a Excel (producto, piezas y fecha, sin costos) y consulte sus pedidos cerrados en solo lectura para usar uno como base del pedido actual.

Fuentes:

- **Jira:** historia `SCRUM-89 · HU-32`, épica `SCRUM-79 · M9 · Resurtir y exportar (v2)`. Requerimiento RF-20. Depende de T-36 (`SCRUM-87`) y HU-31 (`SCRUM-88`). El «Por decidir» de la historia (dónde se genera y si lleva costos) queda resuelto en §10.
- **Confluence:** «Plan v2» (página 5767169) y «Requerimientos» (RF-20). No hay mockup de estas pantallas en Confluence ni en `references/`: se diseñan con los patrones del pop-up de HU-31 y los tokens de la app.
- **Código:**
  - `backend/src/restock/orders.ts` (`listRestockOrders`: filtro `status`, orden por `createdAt` descendente, `LIST_LIMIT` 50; `readOrder` con `lines`, `customLines` y `estimatedTotal`) y `backend/app/api/restock/orders/**`.
  - `src/app/features/restock/` (HU-31): `services/restock.service.ts`, `pages/restock-page/`, `components/restock-form/`, `components/restock-line/`, `rules/restock-lines.rules.ts`, `guards/unsaved-restock.guard.ts`, `interfaces/restock.models.ts`.
  - `src/app/shared/constants/modal.constants.ts` (`MODAL_RESTOCK_PATH`), `src/app/shared/utils/modal-links.ts` (patrón de parámetros matriciales `producto` / `vendedor`), `src/app/core/layout/routes/admin.routes.ts`.
  - `src/app/shared/utils/initials.ts`, `src/app/shared/utils/http-errors.ts`, `src/app/core/confirm/`, `src/app/core/toast/`.
- **Decisiones del usuario del 2026-11-11** (§10).

## 1. Alcance

**Entra en este spec (solo frontend, feature `src/app/features/restock/`):**

- **Exportar** un pedido guardado (cerrado o borrador sin cambios pendientes) con dos botones, «Exportar PDF» y «Exportar Excel», que bajan el archivo generado **en el navegador**.
  - Contenido: producto, piezas, fecha y nota; **sin costos ni total en pesos**.
  - Librerías nuevas `jspdf` + `jspdf-autotable` y `exceljs`, cargadas con `import()` dinámico solo al pulsar el botón.
- **Pedidos anteriores:** ventana `resurtir/pedidos` en el outlet `ventana` con la lista de pedidos **cerrados** (los 50 que da el backend, el más reciente por fecha de cierre arriba). Se entra desde el pop-up de resurtir.
- **Detalle de solo lectura:** ventana `resurtir/pedidos/:id` con renglones, piezas, costo unitario, total estimado y nota, y los botones «Exportar PDF», «Exportar Excel» y «Usar como base».
- **Usar como base:** abre la ventana `resurtir;base=<id>`; el pop-up carga los renglones del pedido base en el formulario, sin guardar. Si ya hay un borrador, se reemplazan sus renglones tras confirmar.
- En el pop-up de HU-31: botón «Pedidos anteriores», los dos botones de exportar (con borrador) y el manejo del parámetro `base`.
- Pruebas nuevas (§9), verificación a 375 px, `specs/README.md` y sincronizar `SCRUM-89`.

**No entra en este spec:**

- Cambios en el backend, en la base de datos o en `backend/tests/` (el contrato de T-36 + HU-31 alcanza).
- Costos o total en pesos dentro del archivo, ni una opción para incluirlos.
- Generar el archivo en el backend, mandarlo por correo o WhatsApp, o guardarlo en Supabase Storage.
- Exportar lo que hay en pantalla sin guardar, o guardar y exportar en un clic.
- Ver borradores viejos en «Pedidos anteriores», reabrir, editar o borrar un pedido cerrado.
- Paginación o búsqueda más allá de los 50 pedidos que devuelve el backend.
- Proveedor, recibir el pedido contra «Entrada a bodega», o un elemento en el menú superior.
- Exportar cortes, inventario o cualquier otra pantalla.

## 2. Reglas de negocio

- **Quién:** solo el administrador. Las ventanas cuelgan de `/admin` (`roleGuard`); el backend responde `403` a un vendedor.
- **Fechas:** se muestran y se escriben en el archivo en `America/Mexico_City` con `Intl`, nunca con el reloj del dispositivo como zona.

### Exportar

- **Dónde aparece:**
  - En el detalle de un pedido cerrado: siempre habilitado.
  - En el pop-up de resurtir, solo cuando hay **borrador guardado**. Un pedido nuevo nunca guardado no muestra los botones.
  - Con cambios sin guardar (formulario `dirty`) o mientras se guarda, cierra o descarta: los dos botones quedan **deshabilitados** con la ayuda «Guarda el pedido para exportarlo». Siempre se exporta lo guardado (el `RestockOrder` del backend), nunca lo que hay en pantalla.
- **Contenido del archivo** (igual en PDF y Excel; sale de una regla pura a partir del `RestockOrder`):
  - Título «Pedido de resurtir · Mammut Supplements».
  - Fecha: «Cerrado el <closedAt>» en un cerrado, «Borrador guardado el <updatedAt>» en un borrador (formato `11 nov 2026`).
  - Nota del pedido, si tiene.
  - Tabla con dos columnas, «Producto» y «Piezas»: primero los renglones de catálogo y después los escritos a mano, en el orden del backend, cada uno con su nombre tal cual.
  - Al pie: «N productos · M piezas» con `lineCount` y `totalUnits` del backend.
  - **Nunca** costo unitario, subtotal, total estimado, piezas en bodega ni nivel.
- **PDF** (`jspdf` + `jspdf-autotable`): tamaño carta, vertical; la tabla salta de página sola y repite el encabezado.
- **Excel** (`exceljs`, `.xlsx`): una hoja «Pedido» con título, fecha y nota arriba, una fila vacía, el encabezado «Producto» / «Piezas» en negritas, los renglones (piezas como número) y la fila del total. La columna «Producto» con ancho suficiente para el nombre más largo (tope razonable).
- **Nombre del archivo:** `pedido-resurtir-<id>-<AAAA-MM-DD>.pdf` / `.xlsx`, con la fecha de cierre (o de último guardado en un borrador) en `America/Mexico_City`.
- **Mientras se genera:** el botón pulsado muestra estado de espera y los dos quedan deshabilitados; un segundo clic no genera otro archivo.
- **Error al generar** (no carga el chunk de la librería sin conexión, o falla la generación) → toast de error «No pudimos generar el archivo. Inténtalo de nuevo.» y los botones vuelven a habilitarse.

### Pedidos anteriores

- **Entrada:** botón de texto «Pedidos anteriores» en el encabezado del pop-up de resurtir (visible en todos sus estados salvo cargando). Con cambios sin guardar, salir pasa por `unsavedRestockGuard` («¿Salir sin guardar?») como cualquier salida del pop-up.
- **Carga:** `GET /api/restock/orders?status=closed` con `rxResource`.
- **Orden:** por `closedAt` descendente (empate por `id` descendente), con una regla pura; el backend los entrega por `createdAt`.
- **Cada pedido** (renglón que es un enlace al detalle): «Cerrado el <closedAt>», «N productos · M piezas», «Total estimado $X» (`estimatedTotal` del backend, pipe `currency`) y la nota recortada a una línea, si tiene.
- **Navegación:** «Volver al pedido» abre la ventana `resurtir`; cerrar el pop-up (X o fuera) vuelve a «Stock general» como en HU-31.
- **Estados:**
  - Cargando → `Skeleton` de 3 renglones.
  - Error → «No pudimos cargar los pedidos anteriores» con «Reintentar» (`reload()`).
  - Vacío → «Todavía no hay pedidos cerrados» con «Cuando cierres un pedido aparecerá aquí.» y «Volver al pedido».

### Detalle de un pedido

- **Carga:** `GET /api/restock/orders/[id]` con `rxResource`.
- **Si el pedido es un borrador**, la ventana abre `resurtir` (el borrador se edita ahí, no se ve en solo lectura).
- **Encabezado:** «Pedido del <createdAt>» y «Cerrado el <closedAt>».
- **Renglones en solo lectura** (tabla con scroll como en HU-31): foto o iniciales, nombre, etiqueta «Escrito a mano» si aplica, «Piezas» y «Costo unitario» (`unitCost` guardado en el renglón; «Sin costo» en uno escrito sin costo). Sin subtotales por renglón: el frontend no multiplica dinero aquí.
- **Pie fijo:** «N productos · M piezas», «Total estimado» con el `estimatedTotal` del backend, «Exportar PDF», «Exportar Excel» y «Usar como base» (primario). Más «Volver a pedidos anteriores».
- **Nota** del pedido, si tiene, encima de la tabla.
- **Estados:**
  - Cargando → `Skeleton`.
  - `404` → «Este pedido ya no existe» con «Volver a pedidos anteriores».
  - Otro error → «No pudimos cargar el pedido» con «Reintentar».

### Usar como base

- «Usar como base» navega a la ventana `resurtir;base=<id>` (parámetro matricial `base`, como `producto` y `vendedor` en `modal-links.ts`).
- **El pop-up de resurtir**, con `base` en la ruta, carga además del contenido de HU-31 el detalle del pedido base (`GET /api/restock/orders/[id]`). Lo consume **una sola vez**: quita el parámetro de la URL (`replaceUrl`) antes de marcar el formulario como cambiado, para que un `reload()` posterior (después de cerrar o descartar) no lo vuelva a aplicar.
- **Qué se copia de cada renglón:**
  - De catálogo, si el producto está en `GET /api/restock/products`: las mismas piezas y el **costo de fábrica actual** del producto (no el guardado en el pedido viejo).
  - De catálogo que ya no se puede pedir (desactivado o bolsita): se omite, y el pop-up muestra el aviso `alert-warning` «N productos del pedido base ya no se pueden pedir y no se agregaron.» hasta el siguiente guardado.
  - Escrito a mano: nombre, piezas y su costo guardado (vacío si no tenía).
  - La **nota no se copia**: es de aquel pedido.
- **Sin borrador:** el pop-up queda como pedido nuevo con los renglones del base (en lugar de las sugerencias), con un `requestId` nuevo, y el encabezado «Pedido nuevo · basado en el pedido del <closedAt>». El formulario queda `dirty`: salir sin guardar pregunta.
- **Con borrador:** antes de tocar nada, `ConfirmService.ask()` «¿Reemplazar los productos de tu borrador con los de este pedido? Se guardan cuando pulses «Guardar pedido».», botón «Reemplazar» y «Cancelar».
  - «Reemplazar» → los renglones del formulario se cambian por los del base (la nota del borrador se conserva), el formulario queda `dirty` y se guarda con el `PUT` de HU-31.
  - «Cancelar» → el borrador queda como estaba y se quita el parámetro `base`.
- **El pedido base no existe (`404`) o es un borrador** → toast «No encontramos ese pedido» y el pop-up carga normal (sugerencias o borrador). Otro error al cargar el base → el estado de error del pop-up con «Reintentar».
- Todas las demás reglas de HU-31 (validación, guardar, cerrar, total estimado, «Agregar sugeridos (N)») siguen igual sobre los renglones copiados.

## 3. Contrato con el backend

No cambia nada del backend. Se usan:

| Llamada | Uso | ¿Cambia? |
| --- | --- | --- |
| `GET /api/restock/orders?status=closed` → `{ orders: RestockOrderSummary[] }` | Lista de pedidos anteriores (máx. 50) | No |
| `GET /api/restock/orders/[id]` → `{ order: RestockOrder }` | Detalle, exportar desde el detalle y pedido base | No |
| `GET /api/restock/products` → `{ products: RestockProduct[] }` | Costo actual y productos pedibles al usar como base (ya lo carga el pop-up) | No |
| `POST` / `PUT` / `close` / `DELETE` de HU-31 | Guardar el pedido armado desde un base | No |

`RestockService` gana `listClosed(): Observable<RestockOrderSummary[]>` y `getOrder(id): Observable<RestockOrderLookup>`, que traduce el `404` a `{ found: false }` y deja pasar los demás errores al `rxResource`. Solo `http-errors.ts` lee `HttpErrorResponse`.

## 4. Modelo de datos

No hay tablas, columnas ni migraciones nuevas. Tipos nuevos del frontend (con `import type`):

`interfaces/restock.models.ts` (se agrega):

```ts
export type RestockOrderLookup = { found: true; order: RestockOrder } | { found: false };
export type RestockExportFormat = 'pdf' | 'xlsx';
```

`interfaces/restock-export.models.ts` (nuevo):

```ts
// Lo que se escribe en el archivo: nunca lleva costos.
export interface RestockExportRow { name: string; qty: number }

export interface RestockExportDocument {
  title: string;        // «Pedido de resurtir · Mammut Supplements»
  dateLabel: string;    // «Cerrado el 11 nov 2026» / «Borrador guardado el 11 nov 2026»
  note: string | null;
  rows: RestockExportRow[];
  totalLabel: string;   // «3 productos · 42 piezas»
  fileName: string;     // sin extensión: «pedido-resurtir-12-2026-11-11»
}
```

`models/restock-history-page.models.ts` y `models/restock-order-page.models.ts`: la vista de cada pedido de la lista (`{ id, closedLabel, countsLabel, estimatedTotal, note }`) y la del detalle, calculadas por reglas puras.

Base del pedido (`interfaces/restock.models.ts`, se agrega):

```ts
// Renglones listos para el formulario a partir de un pedido viejo y de los productos pedibles hoy.
export interface RestockBaseLines {
  lines: Array<
    | { kind: 'catalog'; productId: number; qty: number; unitCost: string }
    | { kind: 'custom'; name: string; qty: number; unitCost: string | null }
  >;
  skipped: number;      // renglones de catálogo que ya no se pueden pedir
  baseClosedAt: string;
}
```

Reglas puras nuevas (con pruebas):

- `rules/restock-export.rules.ts`: `buildExportDocument(order: RestockOrder): RestockExportDocument`.
- `rules/restock-history.rules.ts`: orden por `closedAt` y vista de cada pedido.
- `rules/restock-base.rules.ts`: `baseLinesFrom(order: RestockOrder, products: RestockProduct[]): RestockBaseLines`.
- La fecha en `America/Mexico_City` (etiqueta y `AAAA-MM-DD` del nombre de archivo) en una función pura de la feature con `Intl`.

Servicio nuevo `services/restock-export.service.ts`: `download(doc: RestockExportDocument, format): Promise<void>`. Hace el `import()` de la librería, genera el archivo y lo baja con un `Blob` y un enlace temporal. No declara tipos ni constantes en su archivo.

Constantes:

- `constants/modal.constants.ts` de `shared`: `MODAL_RESTOCK_HISTORY_PATH = 'resurtir/pedidos'` y el parámetro `base`; `modal-links.ts` gana `restockHistoryModalLink()`, `restockOrderModalLink(id)` y el enlace de resurtir acepta `{ baseId?: number }` (aditivo).
- `constants/restock-export.constants.ts`: título, etiquetas de fecha, encabezados de columna, nombre de la hoja, prefijo del archivo, ancho de columna, mensaje de error.
- `constants/restock-history-page.constants.ts` y `constants/restock-order-page.constants.ts`: los textos de §2.
- Textos nuevos del pop-up de HU-31 en `constants/restock-page.constants.ts`.

Dependencias nuevas en `package.json`: `jspdf`, `jspdf-autotable`, `exceljs` (versiones fijas). `exceljs` se importa desde su build de navegador (`exceljs/dist/exceljs.min.js`); si el builder avisa de CommonJS, se agrega a `allowedCommonJsDependencies` en `angular.json`.

## 5. Interfaz

- **Pop-up de resurtir (HU-31):**
  - Encabezado: botón de texto «Pedidos anteriores» junto al subtítulo.
  - Con borrador: «Exportar PDF» y «Exportar Excel» (secundarios, `outlined`) al final del cuerpo, junto a «Descartar borrador»; deshabilitados con la ayuda «Guarda el pedido para exportarlo» si hay cambios.
  - Aviso de renglones omitidos del base (`alert-warning`) encima de la tabla.
- **Pedidos anteriores** (`modal-panel`, mismo ancho y alto que HU-31, título «Pedidos anteriores»): lista con scroll de renglones `surface-*`, cada uno un enlace con el texto de §2; «Volver al pedido» arriba.
- **Detalle** (`modal-panel`, título «Pedido de resurtir»): encabezado con fechas, nota, tabla de solo lectura con encabezados fijos (Producto · Piezas · Costo unitario) y barra inferior fija con «N productos · M piezas», «Total estimado», los dos botones de exportar y «Usar como base». A 375 px el total va arriba y los tres botones apilados de 44 px.
- Componentes presentacionales nuevos (`ng generate component`): `restock-export-buttons` (dos botones; `input()` de deshabilitado, ayuda y formato en curso; `output()` del formato), `restock-history-item` y `restock-order-detail` (tabla de solo lectura).
- Páginas nuevas: `restock-history-page` y `restock-order-page` en `pages/`.
- Tokens y utilidades de `styles.css`, PrimeNG (`pButton`, `Tag`, `Skeleton`). Sin hex ni CSS por componente. A 375 px sin zoom ni desplazamiento horizontal.
- Antes de maquetar: **ui-ux-pro-max** y después **frontend-design** (pantallas nuevas, `CLAUDE.md`).

## 6. Plan de implementación

1. **Servicio y reglas.** `listClosed()` y `getOrder()` en `RestockService`, los tipos de §4 y las reglas `restock-history`, `restock-export` y `restock-base` con la función de fechas, con pruebas. `ng build` pasa.
2. **Exportar.** Instalar `jspdf`, `jspdf-autotable` y `exceljs`; `RestockExportService` con `import()` dinámico y pruebas (librerías simuladas). `ng build` no lista las librerías en «Initial chunk files».
3. **Rutas.** Constantes y enlaces en `shared` (con pruebas nuevas), y las ventanas `resurtir/pedidos` y `resurtir/pedidos/:id` en `admin.routes.ts`. Páginas vacías con `ng generate component`.
4. **Diseño.** ui-ux-pro-max y frontend-design con los tokens de la app.
5. **Pedidos anteriores.** `restock-history-page` + `restock-history-item` con estados.
6. **Detalle.** `restock-order-page` + `restock-order-detail` + `restock-export-buttons`, con estados, exportar y «Usar como base»; redirección si es borrador.
7. **Pop-up de HU-31.** «Pedidos anteriores», exportar con borrador (deshabilitado con cambios) y el parámetro `base` (cargar, confirmar si hay borrador, copiar, aviso de omitidos, quitar el parámetro). Si alguna prueba con commit de `restock-page` o `restock-form` falla, **parar** y pedir `./desbloquear <componente>` (§9).
8. **Verificación.** `ng build`, `npm run check:architecture`, `ng test`, y a mano a 375 px con el backend local: cerrar un pedido, verlo en la lista, abrir el detalle, exportar PDF y Excel (abrirlos en el teléfono y en Excel), usar como base con y sin borrador, y exportar un borrador.
9. **Índice y Jira.** Actualizar `specs/README.md`; comentar en `SCRUM-89` el avance (paso y ✅/❌/⏳ por criterio) con las decisiones de §10 en lugar del «Por decidir», moviéndola En curso → In review.

## 7. Criterios de aceptación

- [ ] Desde el detalle de un pedido cerrado, «Exportar PDF» baja `pedido-resurtir-<id>-<fecha>.pdf` y «Exportar Excel» baja `pedido-resurtir-<id>-<fecha>.xlsx`, con título, fecha de cierre, nota, producto y piezas de cada renglón (de catálogo y escritos a mano) y «N productos · M piezas» (criterio 1 de `SCRUM-89`).
- [ ] Ninguno de los dos archivos contiene costo unitario, subtotal, total estimado ni piezas en bodega (criterio 3).
- [ ] El `.xlsx` abre en Excel con la columna «Piezas» como número; el PDF con más renglones de los que caben en una página sigue en la siguiente con el encabezado repetido.
- [ ] En el pop-up con borrador guardado aparecen los dos botones de exportar y exportan lo guardado; con cambios sin guardar están deshabilitados con «Guarda el pedido para exportarlo»; un pedido nuevo sin guardar no los muestra.
- [ ] Mientras se genera un archivo los botones están deshabilitados; si la librería no carga, sale «No pudimos generar el archivo. Inténtalo de nuevo.» y los botones se habilitan de nuevo.
- [ ] `ng build` no incluye `jspdf`, `jspdf-autotable` ni `exceljs` en los chunks iniciales.
- [ ] «Pedidos anteriores» lista solo pedidos cerrados, el de cierre más reciente arriba, con fecha de cierre, productos, piezas, total estimado y nota (criterio 2).
- [ ] El detalle muestra los renglones en solo lectura con piezas y costo unitario, el total estimado del backend y la nota; no tiene ningún campo editable (criterio 2).
- [ ] «Usar como base» sin borrador abre el pop-up como pedido nuevo con las piezas del base, el costo actual de cada producto de catálogo y el costo guardado de los escritos a mano, sin la nota; salir sin guardar pregunta; guardar crea un pedido nuevo y no cambia el cerrado (criterio 2).
- [ ] «Usar como base» con borrador pide confirmación: «Reemplazar» cambia los renglones y conserva la nota del borrador, y «Guardar pedido» manda un `PUT` del mismo borrador; «Cancelar» deja el borrador igual.
- [ ] Un renglón de catálogo del base con un producto desactivado o bolsita no se copia y se avisa «N productos del pedido base ya no se pueden pedir y no se agregaron.».
- [ ] Después de usar un base y cerrar o descartar, el `reload()` del pop-up no vuelve a aplicar el base.
- [ ] Un detalle o un base con `id` inexistente da «Este pedido ya no existe» (detalle) o el toast «No encontramos ese pedido» (base); un `id` de borrador en el detalle abre el pop-up de resurtir.
- [ ] Lista y detalle muestran cargando, vacío («Todavía no hay pedidos cerrados») y error con «Reintentar»; a 375 px se usan sin zoom ni desplazamiento horizontal (criterio 4).
- [ ] Exportar, ver pedidos o usar uno como base no manda ninguna petición de escritura al backend (solo «Guardar pedido» o «Cerrar pedido» lo hacen).
- [ ] `ng build`, `npm run check:architecture` y `ng test` pasan; ninguna prueba con commit cambia (o, si cambia, con `./desbloquear` aprobado por el usuario).

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `exceljs` y `jspdf` son pesadas y podrían entrar al bundle inicial | Solo se importan con `import()` dentro de `RestockExportService`; criterio de aceptación sobre los chunks iniciales de `ng build`. |
| `exceljs` usa módulos de Node o CommonJS y rompe el build o el SSR | Se importa desde `exceljs/dist/exceljs.min.js` (build de navegador) y solo se ejecuta al pulsar un botón, nunca en el servidor; `allowedCommonJsDependencies` si el builder avisa. |
| Descargas bloqueadas en navegadores móviles | Un archivo por clic, iniciado por el gesto del usuario (por eso dos botones y no uno que baje los dos). |
| Fuentes del PDF sin acentos o «ñ» | Se prueba a mano con nombres con acentos y «ñ»; la fuente estándar de jsPDF cubre Latin-1, que incluye los caracteres del español. |
| El parámetro `base` se vuelve a aplicar tras un `reload()` o al volver con el navegador | Se consume una vez y se quita con `replaceUrl` antes de marcar el formulario como cambiado; criterio de aceptación específico. |
| Quitar el parámetro dispara `unsavedRestockGuard` | Se quita antes de que el formulario quede `dirty`, así el guard no pregunta. |
| La lista solo trae 50 pedidos, ordenados por `createdAt` en el backend | Se reordena por `closedAt` en el frontend; la paginación queda fuera de alcance. |
| Tocar el pop-up de HU-31 rompe pruebas con commit de `restock-page` o `restock-form` | Los cambios son aditivos; si una falla, se para y se pide `./desbloquear restock-page` (o `restock-form`) con la explicación. |
| El administrador cree que exportar un borrador manda lo que ve | Los botones se deshabilitan con cambios sin guardar y lo dicen. |

## 9. Plan de pruebas

- **Frontend (nuevas):**
  - `restock.service.history.spec.ts`: `listClosed()` pide `?status=closed`; `getOrder()` devuelve `{ found: false }` con `404` y deja pasar otros errores.
  - `restock-export.rules.spec.ts`: documento de un cerrado y de un borrador (etiqueta de fecha), renglones de catálogo y escritos en orden, nota `null`, total con `lineCount`/`totalUnits`, nombre de archivo con la fecha en `America/Mexico_City` (un cierre a las 23:30 del 11 en México da `2026-11-11` aunque en UTC ya sea 12), y que el documento no tiene ningún costo.
  - `restock-history.rules.spec.ts`: orden por `closedAt` con empate por `id`, vista de cada pedido.
  - `restock-base.rules.spec.ts`: costo actual en catálogo, costo guardado en escritos (también `null`), omitidos contados, nota fuera.
  - `restock-export.service.spec.ts`: con las librerías simuladas, PDF y Excel con el contenido del documento y el nombre del archivo; error al importar se propaga como rechazo.
  - `restock-export-buttons.component.spec.ts`, `restock-history-item.component.spec.ts`, `restock-order-detail.component.spec.ts`.
  - `restock-history-page.component.spec.ts`: estados, orden, enlace al detalle, «Volver al pedido».
  - `restock-order-page.component.spec.ts`: estados (también `404`), solo lectura, exportar (espera, error con toast), «Usar como base» navega con `base`, borrador redirige.
  - `restock-page.component.base.spec.ts`: base sin borrador, con borrador (Reemplazar / Cancelar), omitidos, base `404`, parámetro consumido una vez, `reload()` sin reaplicar.
  - `restock-page.component.export.spec.ts`: botones con borrador, deshabilitados con cambios, ausentes sin borrador, «Pedidos anteriores».
  - `modal-links.restock-history.spec.ts` y `admin.routes.restock-history.spec.ts`: enlaces y ventanas nuevas.
- **Con commit:** no se espera que cambie ninguna. Si `restock-page.component.spec.ts`, `restock-form.component.spec.ts` o `modal-links.restock.spec.ts` fallan por estos cambios, se para y se pide `./desbloquear <componente>`.
- **Backend:** sin cambios ni pruebas nuevas.

## 10. Decisiones

- **Sí:** el archivo se genera **en el frontend** con `import()` dinámico (decisión del usuario): los datos ya están en el pedido, no hay endpoint nuevo y el bundle inicial no crece.
- **No:** endpoint de exportación en el backend (más dependencias en Next y pruebas de binarios).
- **Sí:** el archivo va **sin costos** (decisión del usuario): es lo que se manda al proveedor y no expone el costo de fábrica. Resuelve el «Por decidir» de `SCRUM-89`.
- **No:** costos siempre, ni casilla «Incluir costos».
- **Sí:** se exportan cerrados y el borrador **guardado**; con cambios sin guardar, deshabilitado con ayuda (decisiones del usuario).
- **No:** exportar lo que hay en pantalla, ni guardar y exportar en un clic.
- **Sí:** dos botones, «Exportar PDF» y «Exportar Excel» (decisión del usuario).
- **No:** un menú «Exportar», ni un botón que baje los dos (los navegadores móviles bloquean la segunda descarga).
- **Sí:** `.xlsx` con `exceljs` y PDF con `jspdf` + `jspdf-autotable` (decisión del usuario).
- **No:** `.csv` (acentos y separadores fallan en Excel de Windows), ni `pdfmake` / `write-excel-file`.
- **Sí:** pedidos anteriores y detalle **dentro del pop-up**, como ventanas `resurtir/pedidos` y `resurtir/pedidos/:id` del outlet `ventana` (decisión del usuario).
- **No:** página propia `/admin/resurtir/pedidos`.
- **Sí:** la lista muestra **solo cerrados** (decisión del usuario); el borrador vigente se edita en el pop-up.
- **Sí:** el detalle en pantalla muestra costo unitario y total estimado del backend (decisión del usuario); solo el archivo va sin costos. Sin subtotales por renglón para no hacer cuentas de dinero en el frontend.
- **Sí:** «Usar como base» con borrador **reemplaza** sus renglones tras confirmar (decisión del usuario); sin borrador, pedido nuevo sin guardar.
- **No:** sumar al borrador, ni bloquear el botón.
- **Sí:** se copian piezas, el **costo actual** en los de catálogo y el guardado en los escritos a mano; los no pedibles se omiten con aviso (decisión del usuario).
- **Sí:** la nota del base **no se copia** y la del borrador se conserva al reemplazar (propuesta del spec, a revisar por el usuario): la nota describe un pedido concreto.
- **Sí:** el base viaja como parámetro matricial `base` y se consume una vez, igual que `producto` / `vendedor` en otras ventanas.
- **Sí:** la lista se reordena por `closedAt` en el frontend en vez de cambiar `listRestockOrders` (sin tocar backend ni `restock.test.ts`).

### Decisiones tomadas al implementar (2026-11-11, aprobadas por el usuario tras la revisión)

- **Enlaces partidos en segmentos:** `restockHistoryModalLink()` y `restockOrderModalLink(id)` devuelven `['resurtir', 'pedidos']` / `['resurtir', 'pedidos', id]` dentro de `outlets`, no el texto `'resurtir/pedidos'`: Angular no parte un texto dentro del arreglo de un outlet y la navegación fallaba. Se cambiaron las dos aserciones de `modal-links.restock-history.spec.ts` con `./desbloquear modal-links.restock-history`.
- **Detalle sin `rxResource`:** `restock-order-page` carga con un `Subject` dentro de `toSignal`, y «Reintentar» lo vuelve a emitir. Con `rxResource.reload()` la petición arrancaba durante la detección de cambios y `whenStable` no terminaba. Es una excepción a la regla de `CLAUDE.md`, explicada en un comentario del componente.
- **Id inválido en el detalle:** un `id` que no es entero positivo no llama al backend y muestra «Este pedido ya no existe».
- **Aviso de omitidos en singular:** con un solo renglón omitido dice «1 producto del pedido base ya no se puede pedir y no se agregó.»; con más, el plural de §2.
- **Guardar con pedido base:** después del guardado el formulario solo se marca como sin cambios, sin volver a cargar los renglones con la respuesta del backend (a diferencia de HU-31), para no revertir lo que el usuario editó sobre el base.
- **Tipos de `exceljs`:** el build de navegador no trae tipos; se declara el módulo en `src/types/exceljs-browser.d.ts`.
- **Avisos de CommonJS:** vienen de dependencias transitivas de `jspdf` (`canvg` → `core-js`) en el chunk diferido; no rompen el build ni tocan el bundle inicial, así que no se agregan a `allowedCommonJsDependencies`.

## Lo que **no** entra en este spec

- Cambios en el backend, la base de datos o sus pruebas.
- Costos en el archivo, generación en el servidor, envío por correo o WhatsApp.
- Exportar sin guardar, borradores viejos en la lista, reabrir o editar un cerrado.
- Paginación o búsqueda de pedidos, proveedor, recibir contra «Entrada a bodega», menú superior.
- Exportar otras pantallas.
