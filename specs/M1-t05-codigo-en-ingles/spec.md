# Spec técnico — T-05 · Renombrar el código del frontend a inglés

> **Estado:** Aprovado
> **Depende de:** M1-t04-angular-moderno (`specs/M1-t04-angular-moderno/spec.md`) — parte del código ya refactorizado por T-04 (rutas lazy, `rxResource`, `viewChild()`)
> **Fecha:** 2026-10-26
> **Objetivo:** que todos los identificadores, archivos y carpetas del frontend queden en inglés, sin cambiar textos visibles, URLs, el valor de rol `'vendedor'` ni el comportamiento.

Fuentes: la regla «Nombres descriptivos en inglés para código, y en español solo en textos visibles para el usuario» de la sección «Buenas prácticas de código» de `CLAUDE.md`/`AGENTS.md` (agregada el 2026-10-26); tarea `SCRUM-26 · T-05` del proyecto Jira `MammutSuplements` (espacio `SCRUM`), épica `SCRUM-6 · M1 · Productos y bodega`; una revisión del código de la rama `spec-M1-hu06-editar-producto` del 2026-10-26; y los tipos de movimiento de `supabase/migrations/20261025000000_mammut_products_and_stock.sql` (para alinear el glosario con el backend).

## 1. Por qué existe este spec

Es el segundo de los tres specs que aplican «Buenas prácticas de código» (ver `M1-t04` §1). El orden original era Angular → SOLID → inglés; esta sesión lo cambió (decisión del usuario) a **Angular → inglés → SOLID**: así T-06 crea sus servicios y componentes nuevos directamente en inglés, sobre nombres ya limpios, en vez de mezclar idiomas entre los dos specs.

El backend ya está en inglés; el frontend casi todo en español (unos 40 archivos tocados). Este spec es un refactor **mecánico**: renombra, no mueve lógica ni reparte responsabilidades.

## 2. Alcance

**Entra en este spec:**

- Renombrar carpetas y archivos de `src/app` según la tabla de §4 (con `git mv`, para conservar el historial).
- Renombrar clases, interfaces, tipos, funciones, constantes, signals, métodos, parámetros, variables locales, valores de los tipos-unión de estado internos y referencias de plantilla (`#nombre` → `#name`) según §4 y el glosario de §3.
- Selectores de componentes renombrados a juego (`app-nuevo-producto-page` → `app-product-form-page`).
- Ajustar los specs de prueba (`*.spec.ts`) a los nombres nuevos, sin borrar ni relajar casos.
- Agregar el glosario de §3 a `CLAUDE.md`/`AGENTS.md`, y reemplazar los ejemplos con nombres en español de esos archivos (`productos/`, `normalizar-texto.ts`, `nuevo-producto-page`…) por los nuevos.
- Aclarar en `CLAUDE.md`/`AGENTS.md` que los comentarios y las descripciones de las pruebas (`describe`/`it`) siguen en español.
- Una tabla «nombre viejo → nombre nuevo» (§4) que el índice `specs/README.md` enlaza, porque los specs anteriores siguen citando los nombres viejos.

**No entra en este spec:**

- **Textos visibles**: etiquetas, mensajes, `aria-label`, `title`, placeholders y los `data.title` de las rutas siguen en español.
- **URLs**: `/admin/productos`, `/admin/productos/nuevo`, `/admin/productos/:id/editar`, `/vendedor/mi-stock`, etc. no cambian.
- **Datos y contratos**: el valor `'vendedor'` en `AuthContext['role']`, `profiles.role`, `data.roles` y `ROLE_HOME`; los nombres de campos de la API (`price`, `unitCost`…, ya en inglés).
- **Comentarios y descripciones de pruebas**: siguen en español (decisión del usuario).
- **Specs anteriores**: no se reescriben; son el registro de lo que se decidió (decisión del usuario).
- **Backend**: ya está en inglés.
- **Mover lógica a servicios, partir el formulario en dos páginas, Reactive Forms, diálogo compartido** — T-06.

## 3. Glosario (español → inglés)

Alineado con los nombres que ya usa el backend (`stock_movements.type`, columnas de `products`). Se agrega tal cual a `CLAUDE.md`/`AGENTS.md`.

| Negocio (español, visible) | Código (inglés) | Referencia en backend |
| --- | --- | --- |
| producto / productos | `product` / `products` | `products` |
| categoría | `category` | `categories` |
| vendedor | `seller` | rol `'vendedor'` (el valor no cambia) |
| administrador | `admin` | rol `'admin'` |
| bodega | `warehouse` | `holderProfileId = null` |
| piezas | `units` (en `stock`, `qty`) | `products.stock`, `stock_movements.qty` |
| costo de fábrica | `unitCost` | `products.unit_cost` |
| precio de venta | `price` | `products.price` |
| alta (de producto) | `create` | — |
| edición | `edit` / `update` | — |
| entrada a bodega | `purchase` | tipo `purchase` |
| dejar a vendedor | `delivery` | tipo `delivery` |
| retirar (del vendedor) | `return` | tipo `return` |
| venta directa | `directSale` | tipo `direct_sale` |
| merma | `shrinkage` | tipo `shrinkage` |
| fraccionar / se fracciona | `fraction` / `fractionable` | tipos `fraction_out`/`fraction_in`, `products.fractionable` |
| porción | `portionSize` | `products.portion_size` |
| bolsita | `portionProduct` (producto con `parentProductId`) | `products.parent_product_id` |
| corte | `cashCut` | `cuts` |
| carrito | `cart` | — |
| búsqueda | `search` / `searchQuery` | — |
| foto | `photo` (el archivo) / `image` (la URL guardada) | `products.image`, bucket `product-photos` |
| cambios sin guardar | `unsavedChanges` | — |

## 4. Tabla de nombres (viejo → nuevo)

**Carpetas y archivos** (`src/app/`):

| Antes | Después |
| --- | --- |
| `productos/` | `products/` |
| `productos/services/productos.service.ts` | `products/services/products.service.ts` |
| `productos/services/producto-fotos.service.ts` | `products/services/product-photos.service.ts` |
| `productos/interfaces/producto.models.ts` | `products/interfaces/product.models.ts` |
| `productos/guards/cambios-sin-guardar.guard.ts` | `products/guards/unsaved-changes.guard.ts` |
| `pages/nuevo-producto-page/` | `pages/product-form-page/` |
| `pages/productos-page/` | `pages/products-page/` |
| `pages/productos-page/ui/producto-card/` | `pages/products-page/ui/product-card/` |
| `pages/productos-page/ui/producto-card-skeleton/` | `pages/products-page/ui/product-card-skeleton/` |
| `pages/vendedor-page/` (+ `vendedor.routes.ts` de T-04) | `pages/seller-page/` (+ `seller.routes.ts`) |
| `shared/normalizar-texto.ts` | `shared/normalize-text.ts` |

(`auth/`, `shared/initials.ts`, `shared/api-base-url.ts`, `shared/components/top-nav/`, `login-page`, `account-page`, `admin-page`, `coming-soon-page` ya están en inglés.)

**Tipos, clases y funciones exportadas:**

| Antes | Después |
| --- | --- |
| `ProductosService` | `ProductsService` |
| `ProductoFotosService` | `ProductPhotosService` |
| `Categoria` | `Category` |
| `Producto` | `Product` |
| `ProductoResumen` | `ProductSummary` |
| `NuevoProductoInput` | `CreateProductInput` |
| `EditarProductoInput` | `UpdateProductInput` |
| `ConCambiosSinGuardar` | `HasUnsavedChanges` |
| `cambiosSinGuardarGuard` | `unsavedChangesGuard` |
| `NuevoProductoPageComponent` | `ProductFormPageComponent` |
| `ProductosPageComponent` | `ProductsPageComponent` |
| `ProductoCardComponent` / `ProductoCardSkeletonComponent` | `ProductCardComponent` / `ProductCardSkeletonComponent` |
| `VendedorPageComponent` | `SellerPageComponent` |
| `VENDEDOR_ROUTES` (T-04) | `SELLER_ROUTES` |
| `normalizarTexto` | `normalizeText` |

**Métodos de servicio:**

| Antes | Después |
| --- | --- |
| `listCategorias()` | `listCategories()` |
| `listProductos()` | `listProducts()` |
| `crear()` | `create()` |
| `obtener()` | `getById()` |
| `actualizar()` | `update()` |
| `ProductoFotosService.subir()` | `ProductPhotosService.upload()` |
| `tieneCambiosSinGuardar()` / `confirmarDescartar()` | `hasUnsavedChanges()` / `confirmDiscard()` |

**Miembros de componentes** (los que T-04 no haya cambiado ya; misma regla para cualquier otro identificador en español que aparezca):

| Componente | Antes → Después |
| --- | --- |
| `product-form-page` | `modo` (`'alta' \| 'edicion'`) → `mode` (`'create' \| 'edit'`); estados `'cargando' \| 'no-disponible' \| 'error-carga' \| 'registrado'` → `'loading-product' \| 'not-found' \| 'load-error' \| 'created'`; `categorias` → `categories`; `productoCreado` → `createdProduct`; `precio`/`costo` → `price`/`unitCost`; `fotoElegida` → `selectedPhoto`; `fotoPreview` → `photoPreview`; `quitarFoto` → `removePhoto`; `imagenRota` → `imageBroken`; `precioMenorAlCosto` → `priceBelowCost`; `precioErrorVisible` → `showPriceError`; `imagenVisible` → `visibleImage`; `inicial` → `initial`; `cargarProducto` → `loadProduct`; `onPrecioInput`/`onCostoInput` → `onPriceInput`/`onUnitCostInput`; `onFotoElegida` → `onPhotoSelected`; `quitarFotoActual` → `removeCurrentPhoto`; `nuevoProducto` → `startNewProduct`; `guardarAlta`/`guardarEdicion` → `saveCreate`/`saveEdit`; `cerrarDialogo(descartar)` → `closeDialog(discard)`; refs `#nombre #categoria #costo #precio #piezas #porcion #foto` → `#name #category #unitCost #price #units #portionSize #photo` |
| `products-page` | `ProductosState` → `ProductsState`; `busqueda` → `searchQuery`; `visibles` → `visibleItems`; `limpiarBusqueda` → `clearSearch`; `cargar` → `load` |
| `product-card` | `producto` (input) → `product`; `mostrarFoto` → `showPhoto`; `inicial` → `initial`; `agotado` → `outOfStock`; `precio` → `price`; `onErrorFoto` → `onPhotoError`; `imagenRota` → `imageBroken` |
| `login-page` | `usuarioError`/`contrasenaError` → `emailError`/`passwordError`; parámetros `usuario`/`contrasena` → `email`/`password`; refs `#usuario #contrasena` → `#email #password` |

## 5. Plan de implementación

Cada paso deja `ng build` y `npm test` en verde, y se hace con `git mv` + reemplazo de identificadores (no reescribiendo archivos a mano).

1. `shared/normalize-text.ts` (archivo, función y spec) y sus usos.
2. Carpeta `products/` completa: archivos, servicios, interfaces, guard y métodos (§4), y todos sus usos en páginas y specs.
3. `products-page` y su `ui/` (`product-card`, `product-card-skeleton`): carpetas, clases, selectores, miembros.
4. `product-form-page`: carpeta, clase, selector, miembros, estados y refs de plantilla.
5. `seller-page` y `seller.routes.ts`; actualizar `app.routes.ts`. Verificar que `data.roles: ['vendedor']`, la URL `/vendedor` y `ROLE_HOME` siguen intactos.
6. `login-page`: miembros, parámetros y refs.
7. Barrido final: `grep` de palabras en español en identificadores de `src/app` (ver criterio 1 de §6); corregir lo que quede con el glosario.
8. `CLAUDE.md`/`AGENTS.md`: glosario de §3, ejemplos con nombres nuevos, aclaración de comentarios y descripciones de pruebas en español. `specs/README.md`: enlace a la tabla de §4.
9. Verificación: `ng build`, `npm test` y el recorrido manual de §7.

## 6. Criterios de aceptación

- [ ] Ningún nombre de archivo o carpeta en `src/app` está en español (`find src/app` contra la columna «Antes» de §4 no devuelve nada).
- [ ] `grep -rnE "productos|producto[A-Z(]|Producto|Categoria|normalizar|vendedor-page|Vendedor[A-Z]|CambiosSin|tieneCambios|confirmarDescartar|precio[A-Z]|costo[A-Z]|foto[A-Z]|busqueda|#(nombre|precio|costo|piezas|porcion|foto|usuario|contrasena)\b" src/app --include=*.ts --include=*.html` solo encuentra textos visibles, comentarios, URLs o descripciones de pruebas, nunca identificadores.
- [ ] Las URLs, los textos visibles y el valor de rol `'vendedor'` son idénticos a antes (`git diff` de las plantillas solo cambia identificadores y refs, no texto).
- [ ] `CLAUDE.md` y `AGENTS.md` incluyen el glosario de §3, ya no usan nombres en español como ejemplo de código, y dicen que comentarios y descripciones de pruebas siguen en español.
- [ ] `specs/README.md` enlaza la tabla de §4 para leer los specs anteriores.
- [ ] Los archivos movidos conservan su historial (`git log --follow` sobre `products/services/products.service.ts` muestra los commits de `productos.service.ts`).
- [ ] `ng build` y `npm test` (raíz) pasan sin borrar ni relajar ninguna prueba.
- [ ] El recorrido manual de §7 se comporta igual que antes.

## 7. Plan de pruebas

**Automático:** `npm test`. Las pruebas son la red de seguridad del refactor: solo cambian los nombres que importan o consultan, no lo que verifican.

**Manual (con `ng serve` + `npm run dev` del backend):** login como admin y como vendedor (cada uno llega a su home y la URL sigue siendo `/admin/stock` y `/vendedor/mi-stock`); «Productos» con búsqueda; alta con foto; editar y «¿Descartar los cambios?»; cerrar sesión.

## 8. Decisiones tomadas y descartadas

- **Sí:** cambiar el orden a Angular (T-04) → inglés (T-05) → SOLID (T-06). Razón (decisión del usuario): SOLID crea archivos nuevos que ya deben nacer en inglés; renombrar primero evita la mezcla.
- **Sí:** `seller` para «vendedor» en el código. Razón (decisión del usuario): `vendor` en inglés suele significar proveedor y se confunde con el fabricante; `salesperson` es largo.
- **Sí:** el valor `'vendedor'` y las URLs se quedan. Razón (decisión del usuario): son datos (base, contrato con el backend) y texto que el usuario ve en la barra, no identificadores.
- **Sí:** los comentarios y las descripciones de pruebas siguen en español. Razón (decisión del usuario): explican reglas del negocio al equipo; la regla solo habla de nombres, y traducirlos duplicaría el diff sin cambiar nada.
- **Sí:** no reescribir los specs anteriores; documentar el mapeo en §4 y enlazarlo desde el índice. Razón (decisión del usuario): los specs son registro histórico.
- **Sí:** `product-form-page` para la página que hoy hace alta y edición. Razón (decisión técnica de esta sesión): describe lo que es hoy; T-06 la parte en `create-product-page` y `edit-product-page`.
- **Sí:** glosario alineado con los tipos de `stock_movements` y columnas de `products`. Razón (decisión técnica de esta sesión): el frontend y el backend usan la misma palabra para lo mismo (`delivery`, `return`, `purchase`, `shrinkage`…), aunque hoy solo `initial` exista en el frontend.
- **Sí:** `git mv` en vez de borrar y crear. Razón (decisión técnica de esta sesión): conserva el historial de cada archivo.
- **Sí:** tarea Jira `SCRUM-26 · T-05`. Razón (decisión del usuario): una tarea por spec.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un reemplazo de texto toca un mensaje visible o una URL que contiene la misma palabra (p. ej. «productos» en `/admin/productos` o en «Aún no tienes productos») | Renombrar por identificador (símbolo de TypeScript o ref de plantilla), no con reemplazo global; el criterio 3 revisa el `git diff` de las plantillas |
| Renombrar `'vendedor'` por error en `data.roles`, `ROLE_HOME` o `AuthContext` rompe el acceso del vendedor | El paso 5 lo verifica explícitamente y el recorrido manual entra como vendedor |
| Conflictos con trabajo en paralelo (otra rama tocando los mismos archivos) | Hacerlo en una rama corta justo después de T-04, sin otras historias abiertas sobre el frontend |
| Los specs anteriores quedan con nombres que ya no existen | Tabla de §4 enlazada desde `specs/README.md` |
