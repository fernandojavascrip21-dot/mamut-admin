# Índice de specs

Un spec por carpeta: `M<milestone>-<tipo><número>-<slug>/spec.md`, donde el tipo es `hu` (historia de usuario), `t` (tarea técnica) o nada (spec de milestone completo). Se escriben con `/spec` y se implementan con `/spec-impl`.

**Mantener al día:** al crear un spec, cambiar su estado o descubrir que uno afecta a otro, actualizar esta tabla y la sección de relaciones en el mismo cambio.

Estados: `Borrador` → `Aprobado` → `Implementado` (o `Obsoleto`).

## Specs

| Spec | Tipo | Jira | Estado | Fecha | Depende de | Objetivo |
| --- | --- | --- | --- | --- | --- | --- |
| [`M0-base`](M0-base/spec.md) | Milestone | `SCRUM-5` (épica M0) | Implementado | 2026-10-23 | — | Login con correo y contraseña, menú según el rol y sesión guardada en el navegador. |
| [`M0-hu03-rutas-por-rol`](M0-hu03-rutas-por-rol/spec.md) | Historia | `SCRUM-17` · HU-03 | Implementado | 2026-10-24 | `M0-base` | Con sesión activa, reabrir la app o `/login` lleva directo a la home del rol. |
| [`M1-t03-tablas-productos-stock`](M1-t03-tablas-productos-stock/spec.md) | Tarea | `SCRUM-20` · T-03 | Implementado | 2026-10-24 | `M0-base` | Tablas de productos y movimientos de stock en Supabase, con su migración. |
| [`M1-hu04-dar-de-alta-producto`](M1-hu04-dar-de-alta-producto/spec.md) | Historia | `SCRUM-21` · HU-04 | Implementado | 2026-10-25 | `M1-t03` | Alta de producto con foto opcional y su primer movimiento de stock. |
| [`M1-hu05-ver-y-buscar-productos`](M1-hu05-ver-y-buscar-productos/spec.md) | Historia | `SCRUM-22` · HU-05 | Implementado | 2026-10-25 | `M1-t03`, `M1-hu04` | Tarjetas de productos y búsqueda por nombre sin mayúsculas ni acentos. |
| [`M1-hu06-editar-producto`](M1-hu06-editar-producto/spec.md) | Historia | `SCRUM-23` · HU-06 | Implementado | 2026-10-26 | `M1-hu04`, `M1-hu05` | Editar los datos de un producto en el formulario del alta, sin tocar las piezas. |
| [`M1-t04-angular-moderno`](M1-t04-angular-moderno/spec.md) | Tarea | `SCRUM-25` · T-04 | Borrador | 2026-10-26 | `M1-hu06` | Aplicar las reglas de Angular moderno y TypeScript estricto en todo el frontend. |
| [`M1-t05-codigo-en-ingles`](M1-t05-codigo-en-ingles/spec.md) | Tarea | `SCRUM-26` · T-05 | Aprobado | 2026-10-26 | `M1-t04` | Renombrar identificadores, archivos y carpetas del frontend a inglés, sin tocar textos ni URLs. |
| [`M1-t06-logica-a-servicios`](M1-t06-logica-a-servicios/spec.md) | Tarea | `SCRUM-27` · T-06 | Aprobado | 2026-10-26 | `M1-t05`, `M1-t04` | Dejar los componentes solo para presentar y emitir eventos; la lógica de negocio pasa a servicios (SOLID). |
| [`M1-t07-stock-por-movimientos`](M1-t07-stock-por-movimientos/spec.md) | Tarea | `SCRUM-28` · T-07 | Implementado | 2026-10-26 | `M1-t03`, `M1-hu04` | Que un trigger mantenga los saldos de stock a partir de los movimientos y la base rechace escribirlos a mano. |
| [`M1-t08-dinero-sin-flotantes`](M1-t08-dinero-sin-flotantes/spec.md) | Tarea | `SCRUM-29` · T-08 | Aprobado | 2026-10-26 | `M1-t06`, `M1-t05` | Precio y costo como texto decimal, calculados en unidades enteras y sin redondeo silencioso; convención para M3. |
| [`M2-t10-base-vendedores`](M2-t10-base-vendedores/spec.md) | Tarea | `SCRUM-31` · T-10 | Implementado | 2026-10-29 | `M1-t03`, `M1-t07`, `M1-t08` | Teléfono obligatorio de 10 dígitos para vendedores y precio/costo por vendedor `> 0`, validados en la base. |
| [`M2-hu08-alta-vendedor`](M2-hu08-alta-vendedor/spec.md) | Historia | `SCRUM-32` · HU-08 | Implementado | 2026-10-29 | `M2-t10`, `M0-base`, `M1-t06` | Alta de vendedor (nombre, teléfono, correo y contraseña temporal) en `/admin/vendedores/nuevo`, y que pueda entrar a «Mi stock». |

## Relaciones que «Depende de» no muestra

- **`M0-base` → `M0-hu03`:** HU-03 cierra el único criterio de esa historia que M0 dejó pendiente (redirigir a la home del rol con sesión activa).
- **`M0-base` → `M1-t03`:** T-03 reusa `profiles.role = 'vendedor'` y responde la pregunta abierta de M0 §8 (vendedor vs. `client`).
- **`M1-t03` → `M1-hu04`, `M1-hu05`, `M1-hu06`:** las tres usan `products` y `stock_movements` tal como los dejó T-03; también HU-07 (fraccionar) cuando exista.
- **`M1-hu04` ↔ `M1-hu05`:** HU-05 reemplazó la lista mínima de `/admin/productos` que dejó HU-04 y amplió `GET /api/products`.
- **`M1-hu04` ↔ `M1-hu06`:** HU-06 reusa el formulario de HU-04 en modo edición y **cambió el criterio 6 de HU-04**: precio menor que el costo ya no se puede guardar «de todas formas», ni en el alta ni en la edición.
- **`M1-hu05` ↔ `M1-hu06`:** la tarjeta de HU-05 (`producto-card`) es la entrada a la edición.
- **`M1-t04` → `M1-t05` → `M1-t06`:** los tres aplican «Buenas prácticas de código» de `CLAUDE.md`, en ese orden: Angular moderno, nombres en inglés y SOLID. El orden original ponía SOLID antes que inglés; se cambió para que SOLID cree sus archivos ya en inglés.
- **`M1-t05` y los specs anteriores:** los specs escritos antes de T-05 citan nombres en español (`ProductosService`, `nuevo-producto-page`…). Para traducirlos, ver la [tabla de nombres viejo → nuevo](M1-t05-codigo-en-ingles/spec.md#4-tabla-de-nombres-viejo--nuevo).
- **`M1-t06` ↔ `M1-hu06`:** T-06 **revierte** la decisión de HU-06 de «una sola página con modo»: el formulario pasa a ser el componente `product-form`, usado por dos páginas (`create-product-page` y `edit-product-page`). Las reglas de negocio de HU-04/05/06 no cambian, solo de lugar. `pages/product-form-page` ya no existe: donde los specs de HU-04/HU-06 lo citan, leer `create-product-page`/`edit-product-page` + `products/components/product-form` + `ProductSaveService`. T-06 también fija el patrón «Formularios» de `CLAUDE.md`, que deben seguir todos los formularios reactivos nuevos (p. ej. HU-07 y Entrada a bodega).
- **`M1-t07` ↔ `M1-t03`:** T-07 **revierte** la decisión de T-03 de que el código recalcule la caché de stock: ahora la mantiene un trigger de Postgres y la base prohíbe escribir `products.stock`/`vendor_stock.qty`. Va **antes de HU-07** y de «Entrada a bodega». También arregla `tests/products-id.test.ts` (de HU-06), que escribía `stock` a mano y dejaba productos de prueba activos, y cambia `supabase/seed.sql` para que los productos nazcan en 0 y su stock entre por el movimiento `initial`. `createProduct` (HU-04) ahora inserta el movimiento con `insertMovements` y relee el producto.
- **`M1-t08` ↔ `M1-hu04`, `M1-hu06`:** T-08 cambia cómo se validan y comparan precio y costo del alta y la edición (decimales máximos, texto en la API), sin cambiar sus reglas. Los inputs de precio y costo pasan de `type="number"` a texto con `inputmode="decimal"`, para leer lo que escribe el usuario sin perder decimales. Deja la convención de dinero que deben seguir ventas y cortes (M3).
- **`M1-t03`, `M1-t07`, `M1-t08` → `M2-t10`:** T-10 agrega `profiles.phone` y valida `vendor_stock.unit_price`/`unit_cost_with_shipping` (tablas de T-03, escalas de T-08) sin tocar `qty`, que sigue siendo del trigger de T-07. Cambia `supabase/seed.sql` y `createTestUser` (los vendedores necesitan teléfono). Decide que el «usuario» de RF-31 es el correo. Va antes de HU-08 a HU-13 (`SCRUM-32` a `SCRUM-37`).
- **`M2-t10` → `M2-hu08`:** HU-08 usa `profiles.phone` y «usuario = correo» de T-10. En pantalla, el campo «Usuario para entrar» del mockup se llama «Correo para entrar». Agrega `phone` a `createAccount`/`AccountView`, crea el área `sellers/` (alias `@sellers/*`) y cambia `/admin/vendedores` de «Próximamente» a una página mínima que HU-09 llenará con la lista. El criterio 2 de Jira («aparece en Mis vendedores y en Viendo») se verifica en HU-09 y HU-10.
- **Estructura de `pages/` (2026-10-30) y specs anteriores:** los modelos, constantes y tablas de rutas de las páginas salieron de la carpeta de cada página a `pages/models/`, `pages/constants/` y `pages/routes/`. Donde un spec anterior cite, p. ej., `pages/login-page/login-page.models.ts`, `pages/create-seller-page/create-seller-page.constants.ts` o `pages/admin-page/admin.routes.ts`, leer `pages/models/login-page.models.ts`, `pages/constants/create-seller-page.constants.ts` y `pages/routes/admin.routes.ts`.
- **Orden de ejecución sugerido:** `M1-t07` puede ir en cuanto se fusione HU-06 (solo backend y base). `M1-t04` → `M1-t05` → `M1-t06` → `M1-t08` van en ese orden sobre el frontend.

## Por área

- **Autenticación y roles:** `M0-base`, `M0-hu03`.
- **Productos y bodega (M1):** `M1-t03`, `M1-hu04`, `M1-hu05`, `M1-hu06`, `M1-t07`.
- **Vendedores y entregas (M2):** `M2-t10`, `M2-hu08`.
- **Calidad y refactor:** `M1-t04`, `M1-t05`, `M1-t06`, `M1-t08`.
