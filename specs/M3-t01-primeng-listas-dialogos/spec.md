# Spec técnico — T-01 · PrimeNG: instalación, tema y primer tramo (listas y diálogos)

> **Estado:** Aprobado
> **Depende de:** M2-t17-primeng-formulario-producto (`specs/M2-t17-primeng-formulario-producto/spec.md`) — ya instaló PrimeNG, `providePrimeNG`, la licencia y el preset base `MAMMUT_THEME`, que este spec amplía; M2-t11-rediseno-visual (`specs/M2-t11-rediseno-visual/spec.md`) — tokens y clases de la base visual; M2-t16-ventanas-dejar-retirar (`specs/M2-t16-ventanas-dejar-retirar/spec.md`) — el pop-up `ventana` donde vive el picker; M2-hu09-ver-mis-vendedores, M2-hu11-dejar-a-vendedor y M2-hu12-retirar-a-vendedor — las listas que se migran.
> **Fecha:** 2026-11-02
> **Objetivo:** adoptar PrimeNG 22 tematizado al diseño de T-11 y migrar el primer tramo: las listas del detalle del vendedor, el picker de productos del pop-up, `confirm-dialog` y el toast.

Fuentes:

- **Pedido del usuario del 2026-11-02:** migración completa a los componentes de PrimeNG, tematizados para que se parezcan al diseño actual (Angular 22). Este spec empieza por tablas/listas y diálogos/pop-ups, y deja registro de lo que falta.
- **Código:** `app.config.ts`, `src/styles.css`, `core/toast`, `shared/components/confirm-dialog`, `shared/components/modal-panel`, `features/sellers/pages/seller-detail-page`, `features/sellers/pages/sellers-page`, `features/deliveries/components/delivery-product-picker`, `features/products`.
- **Versión:** PrimeNG 22.1.x (22.1.4 a hoy) exige `@angular/core ^22.1.0`; el proyecto está en `^22.2.0`, así que entra sin subir Angular.

## 1. Alcance

**Entra en este spec:**

- **Base ya instalada por M2-t17** (`primeng@22.1.4`, `@primeuix/themes@3.1.0`, `providePrimeNG(PRIMENG_CONFIG)`, licencia, capas CSS y modo oscuro desactivado): este spec la reutiliza y no la repite. **No** instala `primeicons`: los iconos de `Toast` y `ConfirmDialog` son SVG internos de `primeng/icons/*`.
- Ampliar el preset `MAMMUT_THEME` (`core/ui/constants/mammut-theme.constants.ts`) con `toast`, `dialog`, `confirmdialog` y `dataview`, y con la severidad `danger` del `button` (hoy solo hay `primary` y `secondary`), todo mapeado a los tokens de T-11.
- Registrar `MessageService` y `ConfirmationService` (no son `providedIn: 'root'`) en `app.config.ts`, y mostrar `<p-toast>` y `<p-confirmdialog>` una sola vez en `app.html`.
- Listas del detalle del vendedor (stock por producto, «Últimas entregas», «Últimos retiros») a `DataView` en modo lista de PrimeNG.
- El picker de productos del pop-up «Dejar» a `Select` de PrimeNG (con filtro).
- `shared/components/confirm-dialog` (componente con `@if` y outputs `confirmed`/`cancelled`, usado en `account-page` y `edit-product-page`) se retira. Lo reemplaza `ConfirmService` (`core/confirm/`), con `ask(options): Promise<boolean>` sobre `ConfirmationService` y `ConfirmDialog` de PrimeNG.
- `core/toast` pasa del componente propio `app-toast` a `Toast` + `MessageService` de PrimeNG, conservando la API pública de hoy de `ToastService` (`success`, `error`, `dismiss`).
- Pruebas de frontend (§8) y la sección «Camino de migración» (§2).

**No entra en este spec:**

- Las tarjetas de «Productos» y de «Mis vendedores»: siguen con Tailwind propio; son contenido de marketing, no listas de dato.
- El pop-up `modal-panel` de T-16: se mantiene, solo cambia el picker que vive dentro de él.
- Formularios e inputs (Precio, Costo, teléfono, búsqueda), navbar y menú, login, shell y los botones `btn-*`: quedan para los siguientes tramos (§2).
- Backend, base de datos o endpoints: no cambian.
- Reglas de negocio, validaciones ni textos de los formularios.
- Componentes PRO de PrimeUI (Scheduler, Charts… segundo modelo de licencia de PrimeNG v22): no se compran ni se usan.

## 2. Camino de migración (seguimiento)

La migración completa a PrimeNG no cabe en un spec. Esta lista es el registro vivo: cada tramo se marca al implementarse y los siguientes specs agregan el suyo.

| # | Tramo | Estado | Spec |
| --- | --- | --- | --- |
| 1 | Instalación, `providePrimeNG` y preset `MAMMUT_THEME` | ✅ Hecho (la base); este spec solo amplía el preset | M2-t17 |
| 2 | Listas del detalle del vendedor (stock, entregas, retiros) | ❌ Pendiente | T-01 (este) |
| 3 | Picker de productos del pop-up «Dejar» | ❌ Pendiente | T-01 (este) |
| 4 | Diálogos de confirmación (`ConfirmDialog`) | ❌ Pendiente | T-01 (este) |
| 5 | Toast (`Toast` + `MessageService`) | ❌ Pendiente | T-01 (este) |
| 6 | Formularios: inputs (precio/costo con `money.ts`, teléfono, buscador) | ❌ Pendiente | Spec propio |
| 7 | Navbar, menú lateral y barra «Viendo» | ❌ Pendiente | Spec propio |
| 8 | Tarjetas de «Productos» y «Mis vendedores» y shells (`admin-shell`/`seller-shell`) | ❌ Pendiente | Spec propio |
| 9 | Pop-up `ventana` a `Dialog` (solo si tramo 8 deja el pop-up propio insostenible) | ❌ Pendiente | Spec propio |

Actualizar la casilla de Estado de un tramo aquí (y en `specs/README.md`) es parte del paso de cierre de cada spec.

## 3. Reglas de comportamiento

- **Aspecto:** cualquier pieza de PrimeNG que aparezca en pantalla debe verse como el resto de la app: colores, tipografía (`font-display`, `Inter`), radios, sombras y estados (`disabled`, error, hover) del tema de T-11. No se debe distinguir de los componentes propios sin abrir el inspector.
- **Listas del detalle:** el stock por producto, las últimas entregas y los últimos retiros se renderizan con el componente de lista de PrimeNG; el contenido visual de cada fila (nombre, piezas, montos como texto, iniciales) es el mismo de hoy. Sin conexión ni `error` muestran el aviso con «Reintentar» de hoy, sin cambios.
- **Recarga en caliente:** al cambiar `StockChangesService.version`, el detalle recarga sin mostrar «cargando», como lo dejó T-16.
- **Picker:** elegir producto, filtrar por nombre (sin mayúsculas ni acentos, reutilizando `normalizeText`) y fijar «otro producto» desde los resúmenes se comportan exactamente como hoy.
- **Confirmación:** los dos usos actuales («Cerrar sesión» en `account-page` y «Descartar» en `edit-product-page`) conservan pregunta, textos, botones y tono `danger`. `ConfirmService.ask()` resuelve `true` solo al aceptar y `false` en **toda** otra salida (botón de cancelar, Escape, X, clic en el fondo si el diálogo lo permite): la promesa nunca queda colgada. Si se abre una confirmación con otra visible, la anterior se resuelve en `false`. El foco inicial va en «cancelar» (la acción segura, como hoy) con `defaultFocus: 'reject'`.
- **Toast:** mismos textos y duraciones de hoy (éxito 4 s, error 6 s) y el mismo comportamiento de uno a la vez (el nuevo reemplaza al anterior). Aparece arriba a la derecha en escritorio y ocupa el ancho en móvil. Va por encima del pop-up `ventana` sin tocar Tailwind: PrimeNG asigna su propio `z-index` inline (≥ 1000, configurable con `zIndex` si hiciera falta), muy por encima de los `z-10/20/40` de la app. La API de `ToastService` no cambia: `success`, `error` y `dismiss`. La señal `current` y el tono `info` eran detalles internos del componente propio y se retiran.
- **SSR:** con `outputMode: "server"`, el arranque con `providePrimeNG` no rompe la construcción ni la entrega CSR del fallback de `app.routes.server.ts`.
- **Accesibilidad:** lo que PrimeNG trae de fábrica (foco, `aria`, teclado) sustituye al de `confirm-dialog`; no se duplica.

## 4. Modelo de datos

Este spec no agrega datos persistentes ni cambia contratos de la API. Solo cambia código de frontend:

```ts
// core/ui/constants/mammut-theme.constants.ts (ya existe, de M2-t17): se AMPLÍA, no se crea otro
//  preset. Suma los subpresets toast, dialog, confirmdialog y dataview, y la severidad `danger`
//  del button, todos con var(--color-*), var(--radius-*) y var(--shadow-*) de styles.css.
//  El modo oscuro, la licencia y las capas (`theme, base, primeng, components, utilities`)
//  no se tocan: ya están en PRIMENG_CONFIG y styles.css.

// src/app/app.config.ts — se añade a los providers existentes:
providers: [MessageService, ConfirmationService]
// src/app/app.html — una sola vez, junto al router-outlet:
// <p-toast position="top-right" [breakpoints]="{ '639px': { width: 'auto', left: '1rem', right: '1rem' } }" />
// <p-confirmdialog />

// core/toast/toast.service.ts — API pública: success(message), error(message), dismiss().
//  Delega en MessageService: clear() antes de add() (uno a uno), `life` desde
//  TOAST_DURATION_MS y severity 'success' | 'error'. Se retiran `current` y components/toast/.
// core/toast/constants/toast.constants.ts — TOAST_DURATION_MS ({ success: 4000, error: 6000 })
//  tipado con ToastTone, que vive en core/toast/toast.models.ts (solo 'success' | 'error').

// core/confirm/ (nuevo, un archivo por responsabilidad)
//  confirm.models.ts     → ConfirmOptions { title, message, confirmLabel, cancelLabel, tone }
//  confirm.constants.ts  → ConfirmTone → severidad del botón y estilos
//  confirm.service.ts    → ask(options: ConfirmOptions): Promise<boolean>
// shared/components/confirm-dialog/ se retira; account-page y edit-product-page llaman a ask().
```

- Las listas del detalle usan `DataView` en modo lista, sin paginador y con `emptyMessage` para el caso sin filas. `OrderList` queda descartado: sirve para reordenar, no para mostrar. El template de fila reusa las clases `surface-*` de T-11.
- El picker usa `Select` con `filter`. `Select` **no** admite una función de filtro propia (solo `filterBy`, `filterMatchMode` y `filterValue`). Para filtrar sin mayúsculas ni acentos: cada opción lleva un campo `searchText = normalizeText(name)`, `filterBy="searchText"`, y la plantilla `#filter` del `Select` pasa el texto escrito por `normalizeText()` antes de llamar a `filterOptions.filter()`. Si esa plantilla no resuelve acentos tecleados con tilde en 22.1.4, el plan B es filtrar las `options` con un `computed` a partir de `onFilter`.
- Los servicios (`StockChangesService`, `ViewingService`, `ModalSavingGuard`, `modal-links.ts`) no cambian.

## 5. Plan de implementación

1. **Verificación de la base.** No se instala nada: `primeng@22.1.4`, `@primeuix/themes@3.1.0` y `providePrimeNG(PRIMENG_CONFIG)` ya están (M2-t17). Se confirma que `ng build` y `ng test` pasan y que la clave de licencia se prepara (`npm run ui:prepare`). Se registran `MessageService` y `ConfirmationService` en `app.config.ts`. **Prueba:** build y tests pasan sin cambios visibles.
2. **Tema.** Se amplía `MAMMUT_THEME` con `toast`, `dialog`, `confirmdialog`, `dataview` y la severidad `danger` del `button` (Aura, sobre los tokens `--color-danger*` de T-11). Los ajustes que el preset no expone van en una sección única de `styles.css`, sin CSS por componente. **Prueba:** un `Select`, un `Dialog` y un toast de prueba (borrados antes de commitear) se comparan con `field-*`/`surface-*`/`alert-*` de T-11.
3. **Toast.** `ToastService` delega en `MessageService` (`clear()` y luego `add()` con `life` por tono). Se añade `<p-toast>` a `app.html` en lugar de `<app-toast />`; se retiran `components/toast/` y la señal `current`, y `ToastTone` pasa a `core/toast/toast.models.ts` (solo `success` y `error`; se quita `info` del archivo nuevo y del preset). **Prueba:** `toast.service.spec.ts` se reescribe contra `MessageService`; los specs de las cinco páginas que toasan pasan sin cambiar su llamada.
4. **Confirmaciones.** Se crea `core/confirm/` con `ConfirmService.ask()` y se añade `<p-confirmdialog>` a `app.html`. `account-page` pasa de `confirmingLogout` + `@if` a `await ask()`, y `edit-product-page` implementa `confirmDiscard()` con `ask()`, sin tocar su firma `Promise<boolean>` ni el guard. Se retira `shared/components/confirm-dialog/`. **Antes de escribir el servicio** se comprueba en 22.1.4 qué callbacks dispara cada salida (aceptar, cancelar, Escape, X, fondo) y se fija el comportamiento que cumple la regla de §3: la promesa siempre se resuelve.
5. **Listas del detalle del vendedor.** Stock por producto, «Últimas entregas» y «Últimos retiros» se renderizan con `DataView` en modo lista, fila a fila igual a hoy. Se comprueba a pantalla completa y a 375 px, y que la recarga en caliente de T-16 sigue funcionando. Los selectores de `seller-detail-page.component.spec.ts` se reescriben en el mismo commit.
6. **Picker.** `delivery-product-picker` pasa a `Select` con filtro: opciones con `searchText` normalizado, plantilla `#filter` que normaliza lo escrito, y plan B con `onFilter` (ver §4). Se prueba dentro del pop-up: Tab, Escape y el cierre del panel del `Select` con Escape no deben cerrar el `modal-panel` ni robar su foco.
7. **Cierre.** `ng build`, `ng test --watch=false` y `npm run check:architecture` pasan. Se comprueba el tamaño del bundle. Se actualizan `specs/README.md` (`M3-t01`, dependencia de `M2-t17` y relaciones), el cuadro «Camino de migración» (§2) y `CLAUDE.md`/`AGENTS.md` en sincronía: la sección «PrimeNG (piloto de producto, T-17)» deja de decir que solo se usa en el formulario de producto, y se retiran `shared/components/confirm-dialog` y `app-toast` de las descripciones de `shared/` y `core/toast`.

Cada paso queda commiteable y la app funcional — la migración nunca se queda a medias en el navegador.

## 6. Criterios de aceptación

- [ ] `MAMMUT_THEME` incluye `toast`, `dialog`, `confirmdialog`, `dataview` y el botón `danger`; `MessageService` y `ConfirmationService` están registrados; no se añadió `primeicons`.
- [ ] `ng build` de producción pasa, incluida la entrega SSR.
- [ ] Un componente PrimeNG visto en pantalla no se distingue a simple vista de los elementos propios de T-11 (colores, tipografía, radios, sombras).
- [ ] El modo oscuro de PrimeNG está desactivado y el tema usa los tokens de T-11, no su paleta por defecto.
- [ ] El stock por producto del detalle del vendedor se muestra con el componente de lista de PrimeNG, con el mismo contenido por fila de hoy.
- [ ] «Últimas entregas» y «Últimos retiros» salen con el componente de lista de PrimeNG.
- [ ] Tras guardar en el pop-up (con `StockChangesService`), el detalle refresca sin spinner ni parpadeo, como lo dejó T-16.
- [ ] Sin conexión en el detalle, el aviso con «Reintentar» sigue funcionando igual.
- [ ] El picker del pop-up «Dejar» es un `Select` de PrimeNG; buscar «bcaa» encuentra «BCAA 2lb» y buscar sin acentos funciona.
- [ ] Desde un resumen, «Dejar otro producto» abre el pop-up con ese producto ya elegido en el `Select`.
- [ ] Ninguna pantalla muestra ya el `confirm-dialog` propio; «Cerrar sesión» y «Descartar» piden confirmación con `ConfirmDialog` de PrimeNG, con los mismos textos, botones y tono `danger`, foco inicial en «cancelar», y `ask()` resuelve `false` con Escape, X y cancelar.
- [ ] Abrir la confirmación de descartar desde la ventana `ventana` abierta funciona: el diálogo queda por encima y, al cerrarse, el foco regresa a donde estaba.
- [ ] El toast es `p-toast` de PrimeNG, se ve por encima del pop-up y de los diálogos, con los mismos textos y duraciones (éxito 4 s, error 6 s); `ToastService` conserva `success`, `error` y `dismiss`.
- [ ] `CLAUDE.md` y `AGENTS.md` quedan actualizados y en sincronía con el nuevo alcance de PrimeNG.
- [ ] A 375 px, el detalle del vendedor con sus tres listas y el pop-up con su `Select` no hacen scroll horizontal.
- [ ] El pop-up `modal-panel` de T-16 sigue abriendo sus dos formularios igual que hoy (foco, Tab atrapado, Escape, guard de guardado).
- [ ] Las tarjetas de «Productos», «Mis vendedores», el navbar y los formularios conservan su aspecto actual (no se tocaron en este tramo).
- [ ] Sin cambios en `backend/`. `ng test` y `npm run check:architecture` pasan.

## 7. Plan de pruebas

- **`core/toast/toast.service.spec.ts`:** misma API de hoy; `success` y `error` producen en `MessageService` el mensaje con la severidad, el texto y la duración esperados (4 s y 6 s); un aviso nuevo limpia el anterior; `dismiss()` lo limpia.
- **`core/confirm/confirm.service.spec.ts`:** `ask()` pide la pregunta con los textos y el tono recibidos; resuelve `true` al aceptar y `false` al cancelar, con Escape y con la X; una segunda llamada con la primera abierta resuelve la primera en `false`. (Las pruebas del viejo `confirm-dialog` — foco, Tab atrapado, fondo — se retiran con él; esos comportamientos son ahora los de PrimeNG, salvo el foco inicial en «cancelar», que se prueba aquí.)
- **`account-page` y `edit-product-page`:** «Cerrar sesión» solo cierra sesión si se acepta; «Descartar» sigue devolviendo `Promise<boolean>` al `unsavedChangesGuard`.
- **`seller-detail-page`:** con datos, las tres listas se renderizan; error y desconexión muestran el aviso de hoy con «Reintentar» que pide los datos otra vez; cambiar `StockChangesService.version` recarga sin mostrar «cargando».
- **`delivery-product-picker`:** filtrar por nombre normalizado (sin acentos), elegir producto emite el valor y «otro producto» preasigna el que llega por `vendedor`/`producto`.
- **Pantallas que tosan (`create-delivery-page`, `return-units-page`, `create-product-page`, `edit-product-page`, `create-seller-page`):** el flujo de guardado sigue terminando en toast y en refresco de la página de atrás.
- **`ng test --watch=false` completo + `ng build` de producción** antes de cerrar el spec. Sin cambios en `backend/`.

## 8. Decisiones

- **Sí:** PrimeNG 22.1.x con Angular local (hoy `^22.2.0`). Es la línea que da soporte a Angular 22 desde 22.1.0; no se necesita subir Angular.
- **Sí:** migración por tramos con este spec como tramo 1, y el cuadro de seguimiento en §2. «Migración completa» en un solo spec sería demasiado grande y dejaría la app a medias semanas en el navegador.
- **Sí:** `ConfirmService` en `core/confirm/` con `ask(): Promise<boolean>`. Las dos confirmaciones de hoy ya se resuelven con una promesa (`confirmDiscard()`) o con una señal local (`confirmingLogout`); un servicio con promesa las unifica sin tocar las firmas de las páginas.
- **Sí:** `DataView` en modo lista para las tres listas; **No** `OrderList` (es para reordenar).
- **No:** instalar `primeicons`. Los iconos de `Toast` y `ConfirmDialog` son SVG internos de PrimeNG; mantiene la regla vigente de CLAUDE.md.
- **No:** `ToastService.info()`. No existe hoy, y el tono `info` del archivo `toast.models.ts` sin seguir se retira junto con su estilo en el preset.
- **Sí:** ampliar el preset `MAMMUT_THEME` existente (de M2-t17) y no crear `mammut-preset` aparte; el modo `styled` y la ausencia de modo oscuro ya vienen de ahí.
- **Sí:** preset propio (`MAMMUT_THEME`) sobre el estilo de T-11, en modo `styled` y sin modo oscuro (decisión del usuario: «tematizar para que se parezca al diseño actual»). El sistema visual de T-11 se conserva; PrimeNG debe adherirse, no traer el suyo.
- **No:** modo `unstyled` de PrimeNG (escribir todo el CSS a mano por componente) ni un tema oficial en crudo (Nova/Aura/Lara sin tocar): el uno es caro de mantener, el otro rompería la identidad de T-11.
- **Sí:** primer tramo = listas del detalle del vendedor + picker + `ConfirmDialog` + `Toast` (decisión del usuario: «tablas/listas y diálogos/pop-ups»). Formularios, navbar y tarjetas quedan para tramos siguientes y tienen su propio spec.
- **No:** mover el pop-up `ventana` de T-16 a `Dialog` de PrimeNG en este tramo. Con foco, Tab atrapado, guard de guardado, SSR y recarga por URL, el panel propio funciona de sobra; si el tramo 8 (shells) lo hace insostenible, va en su propio spec como tramo 9.
- **No:** migrar las tarjetas de «Productos»/«Mis vendedores» a un componente de dato de PrimeNG. Son contenido de marketing con sus class `surface-*` de T-11, no tablas; un `DataView` ahí metería estilos rígidos que el diseño actual no tiene.
- **No:** usar los componentes PRO de PrimeUI (Scheduler, Charts…). Segunda licencia comercial de PrimeNG v22 → nada de ese lado sin una decisión del usuario.
- **Sí:** el CSS para superar al preset (cuando exista) va en `styles.css` a la altura de los demás utilities, no en `.css` por componente — coherente con la regla vigente de Tailwind-only.
- **Sí:** mantener la API pública de `ToastService` y del envoltorio de confirmación. El tramo es visual; si la API cambia se romperían métodos llamados desde features (y las reglas de SOLID que dejó T-06).

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El preset no cubre un componente y sale con colores del tema por defecto | El paso 2 de implementación compara visualmente paso a paso; el resto del faltante se arregla con overrides en `styles.css`, no con var mágicas |
| PrimeNG pelea con Tailwind v4 (orden de capas CSS) | paso 1: `@layer tailwind, primeng` en `styles.css`, `cssLayer` de PrimeNG |
| Los overlays de PrimeNG (`Toast`, `Select`, `ConfirmDialog`) no se rigen por las clases `z-*` de Tailwind: usan `z-index` inline propio | Se verifica en pantalla el orden `top-nav` (z-10/z-20) < pop-up (z-40) < overlays de PrimeNG (≥ 1000); si algún caso falla se ajusta `zIndex` en `PRIMENG_CONFIG`, no con `z-*` de Tailwind |
| El picker con filtro dentro del pop-up de T-16 intercepta los eventos del panel (Tab atrapado, Escape) | El paso 6 lo prueba con el panel; si roba el foco se ajusta el envoltorio del panel, no la migración |
| `ask()` no resuelve con alguna salida del diálogo (Escape, X, fondo) y la promesa queda colgada | El paso 4 mapea cada salida a un callback de 22.1.4 antes de escribir el servicio; la prueba de `confirm.service.spec.ts` cubre todas |
| El `Select` no admite filtro propio y los acentos tecleados no coinciden | Campo `searchText` + plantilla `#filter` con `normalizeText`; plan B con `onFilter` (ver §4) |
| Falta la severidad `danger` del botón y los diálogos salen con el botón por defecto | Se añade al preset en el paso 2 con `--color-danger*`; criterio de aceptación visual |
| SSR se rompe en el arranque con los nuevos providers | El paso 1 lo comprueba con `ng build` y el fallback CSR de `app.routes.server.ts` quedó intacto desde T-16 |
| Tamaño del bundle al meter PrimeNG entero | Solo componentes en uso → el SSR de Angular tree-shakea; se comprueba el tamaño en el paso 7 |
| Licencia dual de PrimeNG v22 (Community/Commercial) se aclara después y algo del uso diario pasa a PRO | Este tramo toca solo los componentes Community (`Select`, `Dialog`, `Toast`, `ConfirmDialog`, `DataView`); los PRO están fuera de alcance con decisión en §8 |
| Las pruebas de las listas iniciadas en HU-09/HU-11/HU-12 dependen del DOM propio de hoy | El paso 5 reescribe los selectores relevantes a la vez, en el mismo commit, contra el ejemplo oficial de PrimeNG |

## Lo que **no** entra en este spec

- Formularios e inputs de PrimeNG (tramo 6).
- Navbar, menú lateral y barra «Viendo» (tramo 7).
- Tarjetas de «Productos»/«Mis vendedores» y shells (tramo 8).
- El pop-up `ventana` a `Dialog` (tramo 9, solo si hace falta).
- Backend y base de datos, reglas de negocio y textos de formularios.
- Componentes PRO de PrimeUI.

Cada uno, si llega, va en su propio spec, y su avance se marca en el cuadro «Camino de migración» (§2).
