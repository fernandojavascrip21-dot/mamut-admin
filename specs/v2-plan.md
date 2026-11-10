# Plan v2

Estado: Borrador · 2026-11-10 · Fuente: Confluence «MVP» y «Requerimientos» (sección «Lo que no entra (v1)») y Jira `SCRUM`.

La v1 (M0–M6) está implementada. M7 sigue abierto: `SCRUM-75` (Vercel) y `SCRUM-76` (aceptación en producción). Este documento ordena lo diferido a la v2; no es un spec de implementación. Cada milestone se baja a specs (`/spec`) cuando se apruebe su backlog en Jira.

## Milestones

| Milestone | RF | Contenido | Talla (tentativa) |
| --- | --- | --- | --- |
| M8 · Crédito | RF-13 | Ventas a crédito: quién debe, teléfono, abonos y saldo. «Lo primero de la v2» según el MVP. | L |
| M9 · Resurtir | RF-19, RF-20 | Lista de resurtir editable (parte del `stockLevel` del backend), exportar a PDF y Excel, pedidos anteriores con fecha. | M |
| M10 · Venta avanzada e inventario | RF-12, RF-18, RF-05 | Precio especial en una venta con ganancia sobre ese precio; productos más vendidos; importar el inventario del Excel de `references/`. | L |
| M11 · Merma con confirmación | RF-15 (parte), RF-16 | El vendedor reporta su merma, el administrador la confirma; reporte de la semana. Extiende la merma simple de M6. | M |
| M12 · Cliente | RF-22 a RF-25, RF-04, `SCRUM-15` | Catálogo público con stock, uso y beneficios; botón de WhatsApp; avisos de ofertas; total comprado; filtros por categoría y fraccionado. | L |

Orden: M7 (cerrar v1) → M8 → M9 → M10 → M11 → M12. M9 y M11 no dependen de M8 y pueden intercambiarse.

## Puntos de partida en el código

- **Crédito:** el esquema ya tiene `debtors` (ligada a `client_id`, única por `client_id + phone`) y la columna `debtor_id` en `sales`/`direct_sales`, del dominio viejo. Un vendedor **no** es un `client`, así que hay que decidir si el deudor cuelga de `clients` o se rediseña (migración nueva, aplicada a mano en producción).
- **Merma con confirmación:** hoy `shrinkage` es una sola fila de `stock_movements` sin estado. La confirmación necesita un estado propio (solicitud) que genere el movimiento solo al confirmar; los movimientos nunca se actualizan.
- **Cliente:** `profiles.role` ya permite `'client'`; un rol nuevo **extiende**, no reemplaza. `clients`/`consignment_items` siguen reservadas para otro caso (distribuidor mayorista).
- **Precio especial:** cada venta ya guarda precio y costo del momento; el precio especial se suma sin romper los cortes (HU-19 a HU-22).
- **Importar Excel:** los inventarios entran solo como movimientos `initial`/`purchase` vía `insertMovements`.

## Decisiones por resolver

1. ¿Se cierra M7 (`SCRUM-75`, `SCRUM-76`) antes de empezar M8?
2. Crédito: ¿el deudor es un cliente final registrado o solo nombre y teléfono capturados en la venta? ¿Un vendedor puede vender a crédito o solo el administrador?
3. Cliente: ¿catálogo anónimo o con login (rol `client`)? ¿«Total de compras» exige login?
4. Excel: ¿una carga única o repetible? ¿Qué hoja y columnas de `references/Excel_Calculos_Gananciass` son la fuente?
5. Pendientes heredados de la v1: proveedor en la entrada a bodega, «Enviar corte al administrador».
6. Piezas de «baja existencia» para la lista de resurtir: se toma `LOW_STOCK_THRESHOLD` del backend; confirmar si el resurtir usa otro mínimo por producto.

## Criterio de terminado de la v2

Por milestone, como en la v1: la épica de Jira pasa a Finalizada cuando cada historia cumple sus criterios, las pruebas pasan (CI en verde) y el administrador lo validó en producción desde el celular (375 px).

## Backlog en Jira (creado 2026-11-10)

| Épica | Tareas y historias |
| --- | --- |
| `SCRUM-78` M8 · Crédito | T-35 `SCRUM-83`, HU-28 `SCRUM-84`, HU-29 `SCRUM-85`, HU-30 `SCRUM-86` |
| `SCRUM-79` M9 · Resurtir | T-36 `SCRUM-87`, HU-31 `SCRUM-88`, HU-32 `SCRUM-89` |
| `SCRUM-80` M10 · Venta avanzada e inventario | T-37 `SCRUM-90`, HU-33 `SCRUM-91`, HU-34 `SCRUM-92`, T-38 `SCRUM-93`, HU-35 `SCRUM-94` |
| `SCRUM-81` M11 · Merma con confirmación | T-39 `SCRUM-95`, HU-36 `SCRUM-96`, HU-37 `SCRUM-97` |
| `SCRUM-82` M12 · Cliente | `SCRUM-15`, T-40 `SCRUM-98`, HU-38 `SCRUM-99`, HU-39 `SCRUM-100`, HU-40 `SCRUM-101`, HU-41 `SCRUM-102` |

Todo con etiqueta `v2`. Cada tarea base (T-35…T-40) va antes de sus historias; se bajan a specs con `/spec`.
