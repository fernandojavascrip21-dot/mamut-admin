# Spec técnico — T-26 · Estados de cargando, vacío y error en todas las pantallas

> **Estado:** Aprobado
> **Depende de:** M2-hu11-dejar-a-vendedor (`specs/M2-hu11-dejar-a-vendedor/spec.md`) — ventana «Dejar a vendedor»; M2-t16-ventanas-dejar-retirar (`specs/M2-t16-ventanas-dejar-retirar/spec.md`) — el pop-up vive en el outlet `ventana`; M1-hu04-dar-de-alta-producto (`specs/M1-hu04-dar-de-alta-producto/spec.md`) y M1-hu06-editar-producto (`specs/M1-hu06-editar-producto/spec.md`) — `product-form` y la carga de categorías
> **Fecha:** 2026-11-09
> **Nota (2026-11-09):** al implementar, la verificación en el navegador mostró que `['/admin/vendedores/nuevo', { outlets: { ventana: null } }]` deja el pop-up abierto, porque el cierre cae bajo `nuevo` y no bajo `/admin`. Por eso se agregó `leaveModalLink` en `shared/utils/modal-links.ts` y las constantes pasaron a segmentos (`NEW_SELLER_PATH` / `NEW_PRODUCT_PATH`). Con el desbloqueo que dio el usuario se cambiaron las dos aserciones de navegación de `create-delivery-page.component.empty.spec.ts`. También se agregaron pruebas para «cargando sin estado vacío» y para el aviso de categorías junto con el 422.
>
> **Objetivo:** que cada pantalla de la v1 tenga sus estados de cargando, vacío y error con «Reintentar». Para lograrlo se completan los dos huecos que faltan: «Dejar a vendedor» sin vendedores o sin piezas en la bodega, y la falla al cargar las categorías en «Nuevo producto» y «Editar producto».

Fuentes:

- **Jira:**
  - Tarea `SCRUM-68 · T-26`, épica `SCRUM-13 · M7 · Pulido y publicación`.
  - Criterio de terminado de M7: «todas las pantallas tienen sus estados».
- **Código:**
  - Plantillas y `state()` de las 25 rutas de `src/app/core/layout/routes/admin.routes.ts`, `seller.routes.ts` y `features/*/*.routes.ts`.
  - `features/deliveries/pages/create-delivery-page/` y `features/deliveries/models/create-delivery-page.models.ts`.
  - `features/products/components/product-form/`, `create-product-page/` y `edit-product-page/` (`categoriesResource`).
  - `shared/pages/coming-soon-page/`.
- **Decisiones del usuario del 2026-11-09:** ver §10.

## 1. Por qué existe este spec

La revisión del 2026-11-09 encontró que casi todas las pantallas ya tienen cargando y error con «Reintentar»: cada una arma los suyos con `state()` y `@switch`/`@if`. Quedan dos huecos en los que el usuario no recibe ninguna explicación:

1. **«Dejar a vendedor».** Si no hay vendedores activos o ningún producto tiene piezas en la bodega, el formulario se ve con los selectores vacíos y nada explica por qué no se puede dejar.
2. **«Nuevo producto» y «Editar producto».** Si falla `GET` de categorías, el select solo ofrece «Sin categoría» y no hay aviso. El producto se puede guardar sin categoría sin querer.

La revisión también encontró que «Entrada a bodega» (RF-06, Must del MVP) **no existe**: no hay endpoint `purchase` ni pantalla, y `/admin/entrada` muestra «Próximamente». Aun así, HU-07 (`SCRUM-24`) está Finalizada. No es un estado que falte, es una funcionalidad entera. Queda fuera de este spec y se registra como historia aparte (§10).

## 2. Alcance

**Entra en este spec:**

- **Inventario de estados** (§6): la tabla de las 25 pantallas, que se vuelve a comprobar al implementar y se corrige si algo no coincide. Va en este spec y, al terminar, como comentario en `SCRUM-68`.
- **«Dejar a vendedor»** (`create-delivery-page`): dos estados vacíos nuevos que sustituyen al formulario.
  - `no-sellers`: no hay vendedores activos.
  - `no-units`: ningún producto tiene piezas en la bodega.
  - Cada uno tiene su mensaje, un botón de acción y «Cerrar».
- **Categorías en el formulario de producto:**
  - `product-form` recibe `categoriesFailed` y emite `categoriesRetried`. Con la falla, muestra debajo del select el aviso «No pudimos cargar las categorías.» y el botón «Reintentar». El formulario sigue usable.
  - `create-product-page` y `edit-product-page` pasan la falla de su `categoriesResource` y, al reintentar, llaman a `reload()`.
- **Pruebas nuevas en archivos `.spec.ts` nuevos**, junto a los existentes (patrón de `product-form.component.fraction-hint.spec.ts`), sin tocar specs con commit (§8).
- **Documentación:** actualizar `specs/README.md` y sincronizar `SCRUM-68`.

**No entra en este spec:**

- **«Entrada a bodega» (RF-06):**
  - Su backend (`purchase`), su pantalla y cualquier cambio en `/admin/entrada` o en el movimiento rápido «Entrada a bodega». Va en la historia nueva HU-27 de M7.
  - En este spec `/admin/entrada` sigue mostrando «Próximamente».
- **Componente compartido de estados:** no se crea en `shared/components`, ni se migran los bloques que ya existen. Los huecos se llenan con el mismo marcado de las páginas vecinas.
- **Cambiar los textos o el diseño** de los estados que ya existen.
- **Pantallas sin carga de datos:**
  - `/cuenta` solo muestra la sesión.
  - El login y la parte de formulario de «Nuevo producto» y «Nuevo vendedor» no se cargan: sus estados son de guardado (`offline`) y ya existen.
- **Otras tareas de M7:**
  - Revisar a 375 px y áreas táctiles: T-27 (`SCRUM-69`).
  - Tiempos de carga: T-28 (`SCRUM-70`).
- **Cambios de backend.**

## 3. Reglas de negocio

### 3.1 «Dejar a vendedor» sin datos

Los dos estados se evalúan **después** de `loading`, `error` y `not-found`, y antes de `form`. Si se cumplen los dos casos, gana `no-sellers`.

- **`no-sellers`:**
  - Se da cuando la URL no fija vendedor (`vendedor` matricial ausente), la lista de «Viendo» ya cargó (`viewing.listStatus()` no es `loading` ni `error`) y `sellers()` está vacía.
  - Título «Aún no tienes vendedores». Texto «Da de alta a un vendedor para dejarle producto.».
  - Botón principal «Dar de alta vendedor»: cierra el pop-up y lleva a `/admin/vendedores/nuevo`.
  - Botón secundario «Cerrar».
- **`no-units`:**
  - Se da cuando la URL no fija producto, `productsResource` ya cargó y ningún producto de la lista tiene `stock > 0` (lista vacía incluida).
  - Título «No hay piezas en la bodega». Texto «Da de alta un producto con sus piezas para poder dejárselo a un vendedor.».
  - Botón principal «Nuevo producto»: cierra el pop-up y lleva a `/admin/productos/nuevo`.
  - Botón secundario «Cerrar».
  - Cuando exista «Entrada a bodega» (HU-27), esa historia decide si este botón cambia.
- **Si la URL fija el vendedor o el producto** (por ejemplo, «Dejar más a {nombre}» o el botón de la card), la condición correspondiente no se evalúa. Un producto fijo sin piezas sigue con la regla actual: «No hay piezas suficientes» al guardar.
- **Los estados no son de error.** El contenedor usa el estilo neutro de las páginas vecinas (`surface-card` / texto `text-muted`), no `alert-danger`, y lleva `role="status"`.
- **Al guardar con éxito, el estado no se reevalúa:** el pop-up se cierra igual que hoy.

### 3.2 Categorías que no cargan

- **Cuándo:** `categoriesFailed` es `true` cuando `categoriesResource.status() === 'error'`, en «Nuevo producto» y en «Editar producto».
- **Qué se ve:**
  - Debajo del select, el aviso «No pudimos cargar las categorías.» con `role="alert"` y el botón «Reintentar» (`pButton`, `severity="secondary"`, `[text]="true"`, área de 44 px).
  - El select sigue habilitado con «Sin categoría».
  - El aviso no sustituye al error de campo `categoryMissing` (422): si aparecen los dos, se ven los dos.
- **«Reintentar»:**
  - Emite `categoriesRetried` y la página llama a `categoriesResource.reload()`.
  - Mientras recarga, el aviso desaparece porque el estado deja de ser `error`.
  - Si vuelve a fallar, el aviso reaparece.
- **Edición:**
  - Con la falla, el `categoryId` que trajo el producto **se conserva** en el formulario y en el payload, aunque el select no lo pueda mostrar.
  - Guardar no le quita la categoría al producto.
- **No bloquea:** se puede guardar sin categorías cargadas. La categoría es opcional (`''` = «Sin categoría»).

## 4. Modelo de datos

No hay datos ni endpoints nuevos. Cambian tipos, entradas y constantes del frontend:

```ts
// features/deliveries/models/create-delivery-page.models.ts
export type CreateDeliveryState =
  | 'loading' | 'error' | 'not-found' | 'no-sellers' | 'no-units' | 'form' | 'saving' | 'offline';

// features/products/components/product-form/product-form.component.ts (entradas nuevas)
readonly categoriesFailed = input(false);   // GET de categorías falló: aviso con «Reintentar»
readonly categoriesRetried = output<void>();
```

Constantes nuevas:

- `features/deliveries/constants/create-delivery-page.constants.ts`:
  - `CREATE_DELIVERY_EMPTY_TEXTS`, con título, texto y botón de `no-sellers` y `no-units`.
  - `NEW_SELLER_PATH = ['vendedores', 'nuevo']`.
  - `NEW_PRODUCT_PATH = ['productos', 'nuevo']`. Se repite aquí porque la feature `stock` tiene la suya y una feature no importa a otra.
- `shared/utils/modal-links.ts`: `leaveModalLink(primary)` devuelve `['/admin', { outlets: { primary, ventana: null } }]`. Va junto a `closeModalLink()`.
- `features/products/components/product-form/product-form.constants.ts`:
  - `CATEGORIES_FAILED_MESSAGE = 'No pudimos cargar las categorías.'`.
  - `CATEGORIES_RETRY_LABEL = 'Reintentar'`.

## 5. Interfaz

- **«Dejar a vendedor», estados vacíos:**
  - Centrados dentro de `app-modal-panel`, en el lugar del formulario.
  - Llevan el título en negritas, el texto `text-sm text-muted` y dos botones apilados en móvil: primario «Dar de alta vendedor» / «Nuevo producto» y `secondary` «Cerrar».
  - Usa tokens de `styles.css`, sin hex.
  - Ambos botones primarios navegan con una sola llamada que cierra el outlet `ventana` y cambia la ruta primaria. No se encadenan dos `navigate`.
  - La llamada es `leaveModalLink(...)`. El cierre y la ruta primaria van juntos en el grupo `/admin`, que es donde cuelga `ventana`.
- **Formulario de producto:** el aviso va dentro del mismo `div` del campo «Categoría», debajo del select y antes de `category-error`. Lleva el texto `text-[13px] text-danger` y el botón «Reintentar» en la misma línea si cabe; si no, debajo.

## 6. Inventario de estados (2026-11-09)

C = cargando, V = vacío, E = error con «Reintentar». n/a = la pantalla no carga una lista que pueda venir vacía. «T-26» = lo completa este spec.

| Ruta | Página | C | V | E |
|---|---|---|---|---|
| `/login` | `login-page` | ✅ | n/a | ✅ |
| `/cuenta` | `account-page` | n/a | n/a | n/a |
| `/admin/stock` (y `?vista=mermas` / `fraccionados`) | `stock-page` | ✅ | ✅ | ✅ |
| `/admin/entrada` | `coming-soon-page` | — | — | — (HU-27) |
| `/admin/productos` | `products-page` | ✅ | ✅ | ✅ |
| `/admin/productos/nuevo` | `create-product-page` | n/a | n/a | T-26 (categorías) |
| `/admin/productos/:id/editar` | `edit-product-page` | ✅ | n/a | ✅ + T-26 (categorías) |
| `/admin/carrito` | `admin-cart-page` → `cart-view` | ✅ | ✅ | ✅ |
| `/admin/venta/:requestId` | `admin-sale-summary-page` → `sale-summary-view` | ✅ | n/a | ✅ |
| `/admin/corte` | `admin-cash-cut-page` | ✅ | ✅ | ✅ |
| `/admin/entregas/:requestId` | `delivery-summary-page` | ✅ | n/a | ✅ |
| ventana `dejar` | `create-delivery-page` | ✅ | T-26 | ✅ |
| ventana `retirar/:sellerId` | `return-units-page` | ✅ | ✅ | ✅ |
| ventana `editar/:sellerId/:productId` | `edit-holding-page` | ✅ | ✅ | ✅ |
| ventana `fraccionar` | `fraction-page` | ✅ | ✅ | ✅ |
| ventana `merma` | `shrinkage-page` | ✅ | ✅ | ✅ |
| `/admin/vendedores` | `sellers-page` | ✅ | ✅ | ✅ |
| `/admin/vendedores/nuevo` | `create-seller-page` | n/a | n/a | n/a (solo guardado) |
| `/admin/vendedores/:id` | `seller-detail-page` | ✅ | ✅ | ✅ |
| `/admin/vendedores/:id/retiros/:requestId` | `return-summary-page` | ✅ | n/a | ✅ |
| `/vendedor/mi-stock` | `my-stock-page` | ✅ | ✅ | ✅ |
| `/vendedor/vender` | `sell-page` | ✅ | ✅ | ✅ |
| `/vendedor/carrito` | `cart-page` → `cart-view` | ✅ | ✅ | ✅ |
| `/vendedor/venta/:requestId` | `sale-summary-page` | ✅ | n/a | ✅ |
| `/vendedor/mi-corte` | `seller-cash-cut-page` | ✅ | ✅ | ✅ |

Además, `admin-shell` pinta el error de la lista de «Viendo» con `(retry)="viewing.reload()"`.

## 7. Plan de implementación

Cada paso deja la app compilando y con las pruebas en verde.

1. **Revisar el inventario.** Abrir cada pantalla de §6 con la base local (`npm run dev:all`) y comprobar sus estados:
   - Cargando, con la red en «Slow 3G».
   - Vacío, con datos borrados o un vendedor sin nada.
   - Error, con el backend apagado.

   Corregir la tabla de §6 si algo no coincide. Si aparece un hueco nuevo, se avisa al usuario antes de ampliar el alcance.
2. **«Dejar a vendedor», datos y pruebas.** Agregar `no-sellers` y `no-units` a `CreateDeliveryState`, las constantes de §4 y la regla en el `computed` `state` de `create-delivery-page`. Escribir `create-delivery-page.component.empty.spec.ts`.
3. **«Dejar a vendedor», plantilla.** Agregar los dos bloques a la plantilla (§5) y los métodos `goToNewSeller()` y `goToNewProduct()`, que cierran el outlet y navegan en una sola llamada.
4. **`product-form`.** Agregar la entrada `categoriesFailed`, la salida `categoriesRetried`, las constantes y el aviso en la plantilla. Escribir `product-form.component.categories-error.spec.ts`.
5. **Páginas de producto.** En `create-product-page` y `edit-product-page`: un `computed` `categoriesFailed` desde `categoriesResource.status()`, el método `retryCategories()` con `reload()` y el paso de ambos al formulario. Escribir `create-product-page.component.categories-error.spec.ts` y `edit-product-page.component.categories-error.spec.ts`.
6. **Verificación.** Correr `ng build`, `npm test` y `npm run check:architecture`. Revisar a mano los dos huecos a 375 px.
7. **Cierre.**
   - En `specs/README.md`, la fila de T-26 pasa a «Implementado».
   - Comentario en `SCRUM-68` con el inventario final (§6) y ✅/❌ por criterio. La tarea se mueve En curso → In review.

## 8. Plan de pruebas

Todas van en archivos `.spec.ts` **nuevos**, para no modificar specs con commit (no hace falta `./desbloquear`). Si al implementar una prueba con commit falla por el cambio, se detiene el trabajo y se avisa con la regla de «Modos de protección de tests».

- **`create-delivery-page.component.empty.spec.ts`:**
  - **Sin vendedores:** con lista de «Viendo» vacía y productos con piezas, se ve «Aún no tienes vendedores», no se ve `app-delivery-form`, y «Dar de alta vendedor» navega a `/admin/vendedores/nuevo` cerrando el outlet.
  - **Sin piezas:** con vendedores y todos los productos en `stock: 0` (y con lista vacía), se ve «No hay piezas en la bodega» y «Nuevo producto» navega a `/admin/productos/nuevo`.
  - **Los dos casos a la vez:** gana «Aún no tienes vendedores».
  - **Vendedor fijo** (`vendedor` matricial) **y lista de «Viendo» vacía:** sigue en `not-found`, como hoy.
  - **Producto fijo:** con lista sin piezas, no aparece `no-units`; se ve el formulario.
  - **«Cerrar»** en ambos estados cierra el pop-up.
- **`product-form.component.categories-error.spec.ts`:**
  - Con `categoriesFailed = true`, se ve «No pudimos cargar las categorías.» y «Reintentar»; con `false`, no.
  - Clic en «Reintentar» emite `categoriesRetried`.
  - En modo `edit`, con `categoriesFailed` y un `initialValue` con `categoryId: 3`, el payload enviado conserva `categoryId: 3`.
- **`create-product-page` / `edit-product-page` `.categories-error.spec.ts`:**
  - Si `GET` de categorías responde 500, el aviso aparece.
  - «Reintentar» repite la petición; si responde 200, el aviso desaparece y el select muestra las categorías.

## 9. Criterios de aceptación

- [ ] La tabla de §6 está revisada contra la app y no tiene ❌.
- [ ] Sin vendedores activos, «Dejar a vendedor» muestra «Aún no tienes vendedores» y «Dar de alta vendedor» lleva a `/admin/vendedores/nuevo` con el pop-up cerrado.
- [ ] Sin piezas en la bodega, «Dejar a vendedor» muestra «No hay piezas en la bodega» y «Nuevo producto» lleva a `/admin/productos/nuevo` con el pop-up cerrado.
- [ ] Con vendedor o producto fijados en la URL, los estados vacíos de ese dato no aparecen.
- [ ] Si falla la carga de categorías, «Nuevo producto» y «Editar producto» muestran «No pudimos cargar las categorías.» con «Reintentar», y el formulario sigue usable.
- [ ] «Reintentar» repite `GET` de categorías y, si responde, el aviso desaparece.
- [ ] Guardar una edición con las categorías caídas no le quita la categoría al producto.
- [ ] `ng build`, `npm test` y `npm run check:architecture` pasan, sin modificar specs con commit.
- [ ] Los dos huecos se ven bien a 375 px.
- [ ] `specs/README.md` y `SCRUM-68` quedan actualizados con el inventario.

## 10. Decisiones

- **Sí:** «Entrada a bodega» va en un spec aparte. Razón (usuario, 2026-11-09): es una funcionalidad nueva (backend `purchase` y pantalla), no un estado.
  - En Jira se crea **HU-27** (`SCRUM-77`) bajo `SCRUM-13`, enlazada a `SCRUM-24`.
  - En `SCRUM-24` queda un comentario que explica que se cerró sin implementar. No se reabre M1.
  - `/admin/entrada` sigue con «Próximamente» hasta HU-27.
- **No:** ocultar «Entrada a bodega» mientras tanto. Lo resuelve HU-27 dentro de M7.
- **No:** componente compartido de estados (`shared/components/state-message`). Razón (usuario): son dos huecos; seguir el patrón de las páginas vecinas evita reescribir 13 bloques y desbloquear sus pruebas. Si en el futuro se quiere unificar, va en un spec de refactorización.
- **Sí:** estados vacíos de «Dejar» con mensaje y botón de acción (usuario). El administrador sabe qué hacer sin cerrar y buscar. El botón de piezas lleva a «Nuevo producto» porque hoy es la única forma de meter piezas a la bodega (movimiento `initial`).
- **No:** mensaje dentro del `p-select` (`emptyMessage`). Deja visible un formulario que no se puede completar.
- **Sí:** aviso de categorías con «Reintentar», sin bloquear el formulario (usuario). La categoría es opcional, así que bloquear todo por ella es exagerado, y dejarlo sin aviso causa productos sin categoría por accidente.
- **Sí:** el inventario va en el spec y en un comentario de `SCRUM-68` (usuario).
- **Sí:** pruebas en archivos `.spec.ts` nuevos. Razón: es el patrón que ya existe (`product-form.component.fraction-hint.spec.ts`) y respeta la protección de tests sin pedir desbloqueos.

## 11. Riesgos

| Riesgo | Mitigación |
|---|---|
| En edición con categorías caídas, `p-select` limpia el `categoryId` porque no está en las opciones | Prueba de §8 que fija el payload. Si `p-select` lo limpia, se mantiene el valor en el control sin pasar por el select (por ejemplo, la opción actual se agrega a `categoryOptions` con su id). |
| Navegar del pop-up a otra página deja el outlet `ventana` abierto o pasa por `modalSavingGuard` | Una sola navegación con `leaveModalLink` (`outlets: { primary, ventana: null }` en el grupo `/admin`). El guard solo bloquea mientras guarda, y en los estados vacíos nunca se está guardando. |
| La revisión del paso 1 encuentra más huecos de los previstos | Se avisa al usuario antes de ampliar. Si son muchos, van a otra tarea. |

## Lo que **no** entra en este spec

- «Entrada a bodega» (RF-06): HU-27 (`SCRUM-77`).
- Componente compartido de estados y migración de los bloques existentes.
- Cambios de textos o diseño en los estados que ya existen.
- Revisión completa a 375 px (T-27) y tiempos (T-28).
- Cambios de backend.
