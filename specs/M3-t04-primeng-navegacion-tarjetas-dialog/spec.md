# Spec técnico — T-04 · PrimeNG: navegación, tarjetas y pop-up `ventana`

> **Estado:** Implementado
> **Depende de:** M3-t03-primeng-inputs-formularios (`specs/M3-t03-primeng-inputs-formularios/spec.md`): patrón de `p-select` (pass-through, `motionOptions`, `appendTo="body"`, tope de ancho) y retiro de utilidades al terminar. M3-t02-primeng-botones (`specs/M3-t02-primeng-botones/spec.md`): `pButton` y la sección «PrimeNG: botones». M3-t01-primeng-listas-dialogos (`specs/M3-t01-primeng-listas-dialogos/spec.md`): cuadro «Camino de migración» (tramos 7, 8 y 9) y el preset `MAMMUT_THEME`. M2-t16-ventanas-dejar-retirar (`specs/M2-t16-ventanas-dejar-retirar/spec.md`): reglas del pop-up `ventana` (foco, Escape, fondo, guardado). M2-t15-rediseno-navbar (`specs/M2-t15-rediseno-navbar/spec.md`): diseño de la barra lateral, la rejilla de celdas en celular y la barra «Viendo».
> **Fecha:** 2026-11-02
> **Objetivo:** cerrar la migración a PrimeNG con los tres tramos que faltan (menú y barra «Viendo», tarjetas de «Productos» y «Mis vendedores», y pop-up `ventana` como `Dialog`) sin cambiar rutas, textos ni reglas de negocio.

Fuentes:

- **Cuadro «Camino de migración» de M3-t01 (§2):** tramo 7 «Navbar, menú lateral y barra Viendo», tramo 8 «Tarjetas de Productos y Mis vendedores y shells», tramo 9 «Pop-up `ventana` a `Dialog`». El cuadro condicionaba el 9 a que el tramo 8 dejara el pop-up propio insostenible; el usuario decidió hacerlo completo en este spec.
- **Inventario del 2026-11-02:** `core/layout/top-nav` (menú, carrito, cuenta, ocultar/mostrar barra), `core/layout/viewing-bar` (el último `<select>` nativo), `admin-shell` y `seller-shell`, `shared/components/modal-panel` (usado por `create-delivery-page` y `return-units-page`), `features/products/components/product-card` y `product-card-skeleton`, `features/sellers/components/seller-row` y `seller-row-skeleton`.
- **Utilidades:** `surface-card` se usa en 20 plantillas y `surface-interactive` en las líneas de historial del detalle del vendedor (fuera de este alcance), así que se conservan. `skeleton-block` solo la usan los dos esqueletos que se migran: se retira.
- **Decisiones del usuario (2026-11-02):** un solo spec con los tres tramos; `Menu` con plantilla propia; `p-select` oscuro sin filtro en «Viendo»; los shells conservan su estructura y se migra lo que contienen; `p-dialog` dentro de `app-modal-panel`; `Card` + `Tag` + `Skeleton` en las tarjetas; retirar las utilidades que queden sin uso; los iconos SVG propios se conservan; tarea nueva en Jira.
- **PrimeNG:** [Menu](https://primeng.dev/menu) (`model`, plantilla `#item`), [Select](https://primeng.dev/select), [Card](https://primeng.dev/card), [Tag](https://primeng.dev/tag), [Skeleton](https://primeng.dev/skeleton), [Dialog](https://primeng.dev/dialog) (`modal`, `closable`, `closeOnEscape`, `dismissableMask`, `blockScroll`, `focusTrap`, `breakpoints`).

## 1. Alcance

**Entra en este spec:**

- **Tramo 7, menú:** el menú de `top-nav` pasa a `p-menu` con plantilla `#item` propia. Se conservan `routerLink`, `aria-current`, la animación «se llena como stock» de la opción activa, los iconos de `nav-icon`, la rejilla de celdas en celular y la lista vertical de la barra lateral en escritorio. Sirve a los dos shells.
- **Tramo 7, botones de la barra:** ocultar barra, mostrar barra (botón flotante) y carrito pasan a `pButton` con los mismos `aria-label`, `aria-controls` y `aria-expanded`.
- **Tramo 7, barra «Viendo»:** el `<select>` de `viewing-bar` pasa a `p-select` sin filtro, con «Yo · bodega» como primera opción, las iniciales del vendedor elegido en la plantilla `#selectedItem` y un tema oscuro definido en `styles.css`. Se conservan el estado de carga (deshabilitado y `aria-busy`) y el botón «Reintentar».
- **Tramo 8, tarjetas de «Productos»:** `product-card` usa `p-card` como marco y `p-tag` para «Agotado» y «Fraccionado»; `product-card-skeleton` usa `p-skeleton`. Las dos acciones hermanas (editar y «Dejar a vendedor») no cambian.
- **Tramo 8, tarjetas de «Mis vendedores»:** `seller-row` usa `p-card` como marco, con toda la tarjeta como enlace; `seller-row-skeleton` usa `p-skeleton`.
- **Tramo 8, shells:** `admin-shell` y `seller-shell` conservan su estructura (Tailwind, `<main>`, outlets); solo cambia lo que contienen.
- **Tramo 9, pop-up `ventana`:** `app-modal-panel` conserva su API (`title`, `closable`, `closed`) y por dentro usa `p-dialog`. Las páginas de «Dejar» y «Retirar» no cambian.
- Preset `MAMMUT_THEME`: subpresets `aura/menu`, `aura/card`, `aura/tag` y `aura/skeleton`, con referencias a las variables CSS de `styles.css`.
- Retirar `@utility skeleton-block`.
- Actualizar `CLAUDE.md`, `AGENTS.md`, `specs/README.md` y el cuadro de M3-t01 (tramos 7, 8 y 9).
- Pruebas de frontend (§6).

**No entra en este spec:**

- Rutas, URLs, outlets, guards (`modalSavingGuard`), `StockChangesService` y el contenido de los formularios de «Dejar» y «Retirar».
- `Drawer`, `Menubar`, `PanelMenu` o un layout nuevo para los shells; la barra lateral plegable sigue con su mecanismo (`SidebarService`).
- `primeicons` o cualquier otra librería de iconos.
- El enlace de cuenta con las iniciales del usuario (ver §8).
- Las líneas del detalle del vendedor (`seller-stock-line`, `delivery-history-line`, `return-history-line`), ya migradas a `DataView` en M3-t01, y las utilidades `surface-card` y `surface-interactive`.
- Otras tarjetas o superficies (`account-page`, `coming-soon-page`, resúmenes de entrega y retiro, formularios).
- Textos, reglas de negocio, backend y base de datos.

## 2. Inventario de lo que se migra

| Plantilla | Hoy | Pasa a |
| --- | --- | --- |
| `core/layout/top-nav` | `@for` de `<a routerLink>` con `routerLinkActive` | `p-menu` con `#item` propio (mismo `<a>`) |
| `core/layout/top-nav` | `<button>` ocultar barra, `<button>` flotante mostrar barra, `<a>` carrito | `pButton` |
| `core/layout/viewing-bar` | `<select id="viewing-select">` | `p-select` oscuro sin filtro |
| `features/products/components/product-card` | `div.surface-card`, distintivos con `<span>` | `p-card`, `p-tag` |
| `features/products/components/product-card-skeleton` | `div.surface-card` + `skeleton-block` | `p-card` + `p-skeleton` |
| `features/sellers/components/seller-row` | `<a class="surface-interactive">` | `<a>` que envuelve un `p-card` |
| `features/sellers/components/seller-row-skeleton` | `div.surface-card` + `skeleton-block` | `p-card` + `p-skeleton` |
| `shared/components/modal-panel` | marco propio con `role="dialog"`, Tab atrapado y fondo | `p-dialog` |

## 3. Reglas de comportamiento

- **Aspecto:** cada pantalla migrada se ve igual que hoy (colores, tamaños, espaciado y animaciones), en escritorio y a 375 px. Lo que el preset no exponga va en una sección «PrimeNG: navegación y tarjetas» de `styles.css`, nunca en un CSS por componente.
- **Menú:** la opción activa lleva `aria-current="page"` y la animación «se llena como stock» (`animate-stock-grow`). En celular sigue siendo una rejilla de celdas con divisores; en escritorio, una lista vertical en la barra lateral. Los enlaces conservan `routerLink`. El `<nav>` con su `aria-label` («Menú del administrador» / «Menú del vendedor») sigue envolviendo el menú.
- **Teclado en el menú:** `p-menu` usa una sola parada de Tab y flechas entre opciones (comportamiento estándar de PrimeNG). Enter abre la opción enfocada.
- **Barra lateral plegable:** ocultar y mostrar siguen funcionando igual, con `aria-expanded` correcto y el foco en el botón visible; la preferencia la sigue guardando `SidebarService`.
- **Barra «Viendo»:** «Yo · bodega» es la primera opción (valor de bodega); elegir un vendedor llama a `selectionChange` como hoy y el borde se pinta de acento. Con un vendedor elegido, sus iniciales aparecen a la izquierda del nombre. Mientras carga, el control está deshabilitado y con `aria-busy="true"`; si falla, aparece «Reintentar». La lista se monta en `body` y no desborda a 375 px. La etiqueta se asocia con `inputId="viewing-select"` y `ariaLabelledBy`.
- **Tarjetas de «Productos»:** el enlace de edición cubre la foto, el nombre, el stock y el precio, y conserva su `aria-label` («Editar …»). «Dejar a vendedor» sigue siendo una acción hermana con su `aria-label`. «Agotado» y «Fraccionado» son `p-tag` con los mismos colores de hoy.
- **Tarjetas de «Mis vendedores»:** toda la tarjeta es un enlace al detalle con su `aria-label` («Ver a …, N piezas»); se conservan la elevación al pasar el mouse, la pulsación y el foco visible, y se respetan `prefers-reduced-motion`.
- **Esqueletos:** `p-skeleton` con las mismas formas y tamaños de hoy, `aria-hidden="true"` y sin animación con `prefers-reduced-motion`.
- **Pop-up `ventana`:** `p-dialog` modal con el título de hoy (`page-title`) y la X de cerrar.
  - Escape y la X cierran solo si `closable()` es `true`; mientras guarda no hay X y Escape no cierra.
  - Pulsar el fondo **no** cierra (`dismissableMask` en `false`), para no perder lo escrito.
  - El scroll de la página se bloquea mientras está abierto (`blockScroll`).
  - Al abrir, el foco entra en el diálogo; Tab queda atrapado dentro; al cerrar, el foco regresa al elemento que lo abrió.
  - En celular ocupa toda la pantalla; desde `sm`, centrado con ancho máximo `xl`. El contenido hace scroll dentro.
  - La lista de un `p-select` dentro del pop-up («Dejar», «Retirar») queda encima del diálogo.
- **Movimiento:** las transiciones respetan `prefers-reduced-motion` (`--mammut-ui-transition-duration` y `motionOptions` con `safe: true`).

## 4. Modelo de datos

No agrega datos persistentes ni cambia contratos de la API. Solo cambia código de frontend:

```ts
// core/layout/top-nav/top-nav.models.ts: el menú de PrimeNG lleva el icono propio en `data`
import type { MenuItem } from 'primeng/api';

export interface NavMenuEntry extends MenuItem {
  routerLink: string;
  data: { icon: NavIconName }; // el nombre del SVG de nav-icon
}
```

```ts
// core/ui/constants/mammut-theme.constants.ts: subpresets nuevos, referenciando variables CSS
components: {
  // …los actuales
  menu: AuraMenu,
  card: AuraCard,
  tag: AuraTag,       // solo las severidades que usan «Agotado» y «Fraccionado»
  skeleton: AuraSkeleton,
}
```

```ts
// core/layout/viewing-bar/viewing-bar.component.ts: opciones del p-select
// [{ id: WAREHOUSE_VALUE, label: 'Yo · bodega' }, ...sellers.map(s => ({ id: s.id, label: s.fullName }))]
// La forma del tipo va en viewing-bar.models.ts y las constantes en viewing-bar.constants.ts.
```

- `MENU` de `admin-shell.constants.ts` y `seller-shell.constants.ts` se transforma a `NavMenuEntry[]` en `top-nav` (función pura en `top-nav` o en sus constantes). Los shells no cambian sus constantes de entrada.
- Cada componente importa sus controles uno a uno (`primeng/menu`, `primeng/select`, `primeng/card`, `primeng/tag`, `primeng/skeleton`, `primeng/dialog`, `primeng/button`).
- Las constantes nuevas (opciones de movimiento, pass-through, estilo del panel, `breakpoints` del diálogo) van en el `.constants.ts` del componente, no en la clase.

## 5. Plan de implementación

1. **Preset.** Se añaden a `MAMMUT_THEME` los subpresets `aura/menu`, `aura/card`, `aura/tag` y `aura/skeleton`, con referencias a las variables de `styles.css`. **Prueba:** `ng build`; la suite pasa sin cambios.
2. **Barra «Viendo».** `viewing-bar` pasa a `p-select` oscuro sin filtro, con las iniciales en `#selectedItem` y la sección de estilos en `styles.css`. Se reescriben las pruebas que hoy cambian el `<select>`. **Prueba:** spec de `viewing-bar` y de `admin-shell`; elegir un vendedor y volver a «Yo · bodega»; carga y «Reintentar».
3. **Menú y botones de la barra.** `top-nav` pasa el menú a `p-menu` con `#item` propio y los botones de ocultar, mostrar y carrito a `pButton`. **Prueba:** specs de `top-nav`, `admin-shell` y `seller-shell` (opción activa con `aria-current`, plegar y desplegar); revisión en navegador a escritorio y a 375 px, incluida la animación de la opción activa y la navegación con teclado.
4. **Tarjetas de «Productos».** `product-card` a `p-card` + `p-tag`; `product-card-skeleton` a `p-card` + `p-skeleton`. **Prueba:** specs de `product-card`, `product-card-skeleton` y `products-page`; revisión en navegador con un producto agotado y uno fraccionado.
5. **Tarjetas de «Mis vendedores».** `seller-row` a `<a>` + `p-card`; `seller-row-skeleton` a `p-card` + `p-skeleton`. Se retira `@utility skeleton-block` (`grep` sin resultados). **Prueba:** specs de `seller-row`, `seller-row-skeleton` y `sellers-page`.
6. **Pop-up `ventana`.** `app-modal-panel` usa `p-dialog` por dentro con la misma API. Se quitan el Tab atrapado propio y su `FOCUSABLE_SELECTOR` si `focusTrap` los cubre; se conserva el regreso del foco al cerrar. **Prueba:** spec de `modal-panel` (Escape, X, `closable` en `false`, fondo que no cierra, foco al abrir y al cerrar, scroll bloqueado), `modal-links.spec.ts` y los specs de `create-delivery-page` y `return-units-page`; revisión en navegador de «Dejar» y «Retirar» a escritorio y a 375 px, con la lista de su `p-select` encima del diálogo.
7. **Cierre.** `ng build`, `ng test --watch=false` y `npm run check:architecture` pasan; se mide el bundle inicial. Se actualizan `CLAUDE.md`/`AGENTS.md` (controles de PrimeNG en uso; «el resto de la interfaz sigue con controles nativos» deja de aplicar a navbar, shells, tarjetas y `modal-panel`; el párrafo de «Ventanas de inventario» describe el `p-dialog`), `specs/README.md` y el cuadro de M3-t01 (tramos 7, 8 y 9).

Cada paso queda commiteable y la app funcional.

## 6. Plan de pruebas

- **Specs existentes:** las de `top-nav`, `viewing-bar`, `admin-shell`, `seller-shell`, `product-card`, `product-card-skeleton`, `products-page`, `seller-row`, `seller-row-skeleton`, `sellers-page`, `modal-panel`, `modal-links`, `create-delivery-page` y `return-units-page` pasan; solo se reescriben las que dependen del DOM nativo (el `<select>` de «Viendo», los `<a>` del menú, el `role="dialog"` propio).
- **Pruebas nuevas:**
  - «Viendo»: elegir un vendedor emite su `id`; con uno elegido se ven sus iniciales; mientras carga el control está deshabilitado.
  - Menú: la opción de la ruta activa tiene `aria-current="page"`.
  - Pop-up: con `closable` en `false`, Escape no emite `closed`; un clic en el fondo no emite `closed`; al destruirse, el foco vuelve al elemento que lo abrió.
- **Revisión visual:** en navegador, a escritorio y a 375 px (iframe del mismo origen, como en M3-t03): barra lateral desplegada y plegada, menú del administrador y del vendedor, «Viendo» en bodega, con vendedor, cargando y con error, «Productos» con tarjetas cargando, agotadas y fraccionadas, «Mis vendedores», y «Dejar» y «Retirar» abiertos (reposo, guardando, con la lista del selector abierta).
- **`ng test --watch=false` completo, `ng build` de producción y `npm run check:architecture`** antes de cerrar el spec. Sin cambios en `backend/`.

## 7. Criterios de aceptación

- [ ] El menú de los dos shells es un `p-menu`; la opción activa tiene `aria-current="page"` y la animación de stock, en celular (rejilla) y en escritorio (barra lateral).
- [ ] Ocultar barra, mostrar barra y carrito son `pButton` y conservan `aria-label`, `aria-controls` y `aria-expanded`.
- [ ] «Viendo» es un `p-select` sin filtro con «Yo · bodega» primero, las iniciales del vendedor elegido, deshabilitado mientras carga y «Reintentar» si falla; `grep -rn '<select' src/app` no devuelve resultados.
- [ ] `product-card` y `seller-row` usan `p-card`; «Agotado» y «Fraccionado» son `p-tag`; los dos esqueletos usan `p-skeleton`.
- [ ] Las tarjetas conservan sus enlaces, sus `aria-label` y la acción «Dejar a vendedor».
- [ ] `app-modal-panel` usa `p-dialog` y conserva su API; las páginas de «Dejar» y «Retirar» no cambian.
- [ ] En el pop-up: Escape y la X cierran solo si se puede, el fondo no cierra, el scroll se bloquea, Tab queda dentro y al cerrar el foco vuelve al botón que lo abrió.
- [ ] La lista de un `p-select` dentro del pop-up queda encima del diálogo.
- [ ] `@utility skeleton-block` no existe y `grep -rn 'skeleton-block' src` no devuelve resultados; `surface-card` y `surface-interactive` siguen definidas.
- [ ] A 375 px ninguna pantalla migrada hace scroll horizontal, y la lista de «Viendo» no desborda.
- [ ] Cada pantalla migrada se ve igual que antes en escritorio y a 375 px (colores, tamaños, animaciones) y respeta `prefers-reduced-motion`.
- [ ] No se añaden `primeicons`, `Drawer`, `Menubar` ni CSS por componente; los controles se importan uno a uno.
- [ ] `CLAUDE.md`, `AGENTS.md`, `specs/README.md` y el cuadro de M3-t01 quedan actualizados y en sincronía.
- [ ] Sin cambios en `backend/`. `ng build`, `ng test` y `npm run check:architecture` pasan.

## 8. Decisiones

- **Sí:** los tres tramos en un solo spec (decisión del usuario), aunque toca `core/layout`, `shared/components` y dos features. Se mitiga con pasos independientes, cada uno commiteable.
- **Sí:** tramo 9 completo, sin la condición del cuadro de M3-t01 (decisión del usuario): `p-dialog` unifica el pop-up con `ConfirmDialog` y quita el foco atrapado propio.
- **Sí:** `p-menu` con plantilla `#item` propia (decisión del usuario). Conserva el diseño de M2-t15 y la animación de stock; acepta el teclado de PrimeNG (una parada de Tab y flechas).
- **Sí:** `p-select` oscuro sin filtro en «Viendo» (decisión del usuario); la lista de vendedores es corta.
- **Sí:** los shells conservan su estructura y se migra su contenido (decisión del usuario). PrimeNG no tiene un componente de layout.
- **Sí:** `p-dialog` dentro de `app-modal-panel` (decisión del usuario). Las páginas no cambian y la configuración vive en un solo sitio.
- **Sí:** `Card` + `Tag` + `Skeleton` en las tarjetas (decisión del usuario).
- **Sí:** retirar solo las utilidades que queden sin uso (decisión del usuario): `skeleton-block`. `surface-card` y `surface-interactive` siguen en uso fuera de este alcance.
- **Sí:** iconos SVG propios de `nav-icon` (decisión del usuario); la regla de no añadir `primeicons` se mantiene.
- **Sí:** tarea nueva en Jira para este spec (decisión del usuario).
- **No (propuesta a confirmar al revisar):** el enlace de cuenta con las iniciales sigue como enlace con estilos propios; es un avatar, no un botón, y `Avatar` de PrimeNG no aporta nada al diseño actual.
- **No:** `Drawer` para el menú en celular o para la barra lateral; cambiaría la UX de M2-t15.
- **No:** `p-dialog` directo en cada página; duplicaría configuración y pruebas.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `p-menu` mete `role="menu"` y sus estilos, y rompe la rejilla de celdas o la lista de la barra lateral | Pass-through en `list`/`item` para la rejilla y la lista; revisión a 375 px y en escritorio en el paso 3 |
| La animación de stock o `aria-current` se pierden al delegar los enlaces al menú | El `#item` propio pinta el mismo `<a>` con `routerLinkActive`; prueba explícita de `aria-current` |
| El `p-select` de «Viendo» se ve claro sobre la barra oscura | Sección de estilos en `styles.css` limitada a `viewing-bar` con las variables de marca; revisión visual |
| `p-card` añade padding y bordes que cambian el tamaño de las tarjetas | Tokens del subpreset y pass-through `body`/`content`; comparación con capturas de antes en el paso 4 |
| `p-dialog` no atrapa el foco cuando un `p-select` quita el botón enfocado (caso que `modal-panel` cubre con `onOutsideKeydown`) | Se conserva ese manejo si `focusTrap` no lo cubre; prueba explícita en el paso 6 |
| La lista de un `p-select` queda debajo de la máscara del diálogo | `appendTo="body"` y el manejo de `z-index` de PrimeNG; revisión de «Dejar» y «Retirar» con la lista abierta |
| El regreso del foco al cerrar el diálogo deja de funcionar | Se conserva la lógica de `modal-panel` (`returnFocusTo`); prueba explícita |
| Cerrar mientras guarda | `closable` controla `closable` y `closeOnEscape`; `modalSavingGuard` sigue bloqueando la navegación |
| El bundle inicial crece con los subpresets nuevos | Se mide en el paso 7; los controles se importan uno a uno y los shells son perezosos |

## Lo que **no** entra en este spec

- Rutas, guards, servicios, formularios de «Dejar» y «Retirar», textos y reglas de negocio.
- `Drawer`, `Menubar`, `PanelMenu`, `Avatar`, `primeicons`.
- Líneas del detalle del vendedor, `account-page`, `coming-soon-page`, resúmenes y las utilidades `surface-card`/`surface-interactive`.
- Backend y base de datos.

Con este spec se cierra el cuadro «Camino de migración» de M3-t01; cualquier ajuste posterior va en su propio spec.
