# Spec técnico — T-16 · «Dejar» y «Retirar» en pop-up

> **Estado:** Aprovado
> **Depende de:** M2-hu11-dejar-a-vendedor (`specs/M2-hu11-dejar-a-vendedor/spec.md`) — formulario y guardado de una entrega; M2-hu12-retirar-a-vendedor (`specs/M2-hu12-retirar-a-vendedor/spec.md`) — formulario y guardado de un retiro; M2-t11-rediseno-visual (`specs/M2-t11-rediseno-visual/spec.md`) — clases de diseño
> **Fecha:** 2026-10-31
> **Objetivo:** que «Dejar producto» y «Retirar producto» abran su formulario en un pop-up sobre la página actual, sin llevar al administrador a otra pantalla.

Fuentes:
- **Pedido del usuario del 2026-10-31**, con captura del detalle de un vendedor: los botones no deben redirigir a una pantalla nueva.
- **Código:** `core/layout/admin-shell`, `core/layout/routes/admin.routes.ts`, `shared/components/confirm-dialog`, `features/deliveries`, `features/sellers` y `features/products`.
- **Decisiones del usuario del 2026-10-31** (§8).

## 1. Alcance

**Entra en este spec:**

- Un segundo outlet con nombre, `ventana`, en `admin-shell`, con los dos formularios montados en `admin.routes.ts`.
- `shared/components/modal-panel`: el marco del pop-up.
- `core/stock-changes`: avisar que el inventario cambió, para que la página de atrás se refresque.
- Los botones del detalle del vendedor, la tarjeta de «Productos» y los resúmenes abren el pop-up.
- Se retiran las pantallas completas `/admin/entregas/nueva` y `/admin/vendedores/:id/retirar`.
- Pruebas de frontend (§7).

**No entra en este spec:**

- Backend, base de datos o endpoints: no cambian.
- Reglas de negocio, validaciones o textos de los formularios, salvo el «Cancelar» y el título.
- Mostrar el resumen dentro del pop-up: las pantallas de resumen siguen en su URL.
- Llevar a pop-up otros formularios (alta y edición de producto, alta de vendedor).
- Avisar de cambios de inventario entre pestañas o entre usuarios.
- Ninguna acción de «Dejar» o «Retirar» en lugares nuevos.

## 2. Reglas de comportamiento

- **Abrir:** «Dejar producto» y «Retirar producto» del detalle, «Dejar a vendedor» de la tarjeta, y «Dejar otro producto» y «Retirar otro producto» de los resúmenes abren el pop-up. La página de atrás no se destruye ni pierde su scroll.
- **Confirmar con éxito:** el pop-up se cierra, sale el toast de hoy («Le dejaste N piezas a Luis», «Le retiraste N piezas a Luis») y la página de atrás se refresca. **No se navega al resumen.**
- **Resúmenes:** siguen en `/admin/entregas/:requestId` y `/admin/vendedores/:id/retiros/:requestId`, y se abren desde «Últimas entregas» y «Últimos retiros».
- **Cerrar sin guardar:** con «Cancelar», la X y `Escape`. **Un clic en el fondo no cierra**, para no perder lo escrito. No hay aviso de cambios sin guardar.
- **Mientras guarda:** no se puede cerrar por ningún medio.
- **Errores:** los de campo, el aviso sin conexión con «Reintentar» y los avisos fijos quedan dentro del pop-up, como hoy. «Reintentar» reenvía el mismo `requestId`. Abrir el pop-up de nuevo genera otro.
- **Recarga y navegación:** recargar con el pop-up abierto lo mantiene abierto. «Atrás» del navegador lo cierra.
- **Refresco:** la página de atrás conserva su contenido mientras recarga, sin spinner ni parpadeo.
  - Detalle del vendedor: stock, «Últimas entregas» y «Últimos retiros».
  - «Productos»: la lista con sus piezas.
- **Barra «Viendo»:** el fondo la cubre, así que no se puede cambiar de vendedor con el pop-up abierto.
- **Accesibilidad:** `role="dialog"` y `aria-modal`, foco al abrir dentro del pop-up, `Tab` atrapado, y al cerrar el foco vuelve al botón que lo abrió si sigue en la página.
- **Tamaño:** a pantalla completa hasta `sm` y centrado desde `sm`, con `max-w-xl`. El contenido hace scroll dentro del pop-up. Sin scroll horizontal a 375 px (RNF-03).
- **Toast:** se ve por encima del pop-up.

## 3. Rutas

`core/layout/routes/admin.routes.ts` agrega dos hijos de `/admin` en el outlet `ventana`, con `loadComponent`:

| Ruta auxiliar | Componente | Parámetros |
| --- | --- | --- |
| `dejar` | `CreateDeliveryPageComponent` | Matriciales y opcionales: `vendedor`, `producto` |
| `retirar/:sellerId` | `ReturnUnitsPageComponent` | `sellerId` |

URLs resultantes:

```
/admin/vendedores/ID(ventana:dejar;vendedor=ID)
/admin/vendedores/ID(ventana:retirar/ID)
/admin/productos(ventana:dejar;producto=3)
```

- Son parámetros matriciales y no query params porque pertenecen al outlet: desaparecen solos al cerrar.
- El parámetro `volver` deja de aplicar a la ventana. El resumen de una entrega lo conserva, porque «Últimas entregas» lo usa para su botón «Listo».
- Se quitan la ruta `nueva` de `deliveries.routes.ts` y `:id/retirar` de `sellers.routes.ts`. Ninguna se publicó fuera de la app.
- **Por qué un outlet:** `features/sellers` y `features/products` abren un formulario de `features/deliveries`, y una feature no puede importar a otra. `core/layout/routes/` es la única capa que puede montar features, y cada feature sigue enlazando solo a una URL.

## 4. Modelo de datos

Este spec no agrega datos persistentes ni cambia contratos de la API.

```ts
// shared/constants/modal.constants.ts
export const MODAL_OUTLET = 'ventana';

// shared/utils/modal-links.ts (puras; se usan con routerLink y router.navigate)
deliveryModalLink(params: { sellerId?: string; productId?: number }): unknown[]
returnModalLink(sellerId: string): unknown[]
closeModalLink(): unknown[]   // { outlets: { ventana: null } }

// shared/components/modal-panel
readonly title = input.required<string>();
readonly closable = input(true);   // false mientras guarda: sin X ni Escape
readonly closed = output<void>();

// core/stock-changes/stock-changes.service.ts (providedIn: 'root')
readonly version: Signal<number>;
notify(): void;
```

- Los enlaces viven en `shared/utils` y no en una constante por feature, para que las tres features armen la URL igual. Reemplazan a `DELIVERY_NEW_URL` de `sellers.constants.ts`, `products.constants.ts` y `deliveries.constants.ts`.
- `delivery-form` y `return-form` cambian `cancelUrl` (`input`) por `cancelled` (`output`), y su «Cancelar» pasa de enlace a botón.
- `create-delivery-page` y `return-units-page`:
  - Se envuelven en `app-modal-panel`, cuyo `title` reemplaza a su `h1`.
  - Leen `vendedor`, `producto` y `sellerId` de `paramMap`.
  - Se quedan en `pages/`: siguen siendo contenedores ligados a una ruta.
- `return-units-page` deja de suscribirse a `viewing.picked`, porque el fondo cubre la barra.
- Se quita lo que quede sin uso (`returnTarget`, `cancelUrl` y las reglas de `delivery.rules.ts` que dejen de tener quién las llame).

## 5. Plan de implementación

1. **Outlet.** Agregar `MODAL_OUTLET`, `modal-links.ts` con su spec, el outlet en `admin-shell` y las dos rutas auxiliares. Confirmar en el navegador que abrir `['/admin', { outlets: … }]` desde `/admin/vendedores/ID` conserva la ruta primaria, y que el SSR responde esa URL. Si la ruta primaria se pierde, se navega relativo a la ruta `admin`. Las pantallas viejas siguen funcionando.
2. **Marco.** `ng generate component shared/components/modal-panel` con su spec, siguiendo el manejo de foco de `confirm-dialog`. Comprobar el orden contra el toast y `top-nav`.
3. **Aviso de cambios.** `core/stock-changes/stock-changes.service.ts` con su spec. `seller-detail-page` y `products-page` recargan al cambiar `version` (no al crearse) y dejan de tratar `reloading` como «cargando». Se ajustan sus pruebas.
4. **Formulario de retiro.** `return-units-page` y `return-form` pasan al pop-up: marco, `cancelled`, `notify()` y cerrar al guardar. Se ajustan sus pruebas.
5. **Formulario de entrega.** Lo mismo con `create-delivery-page` y `delivery-form`. Se ajustan sus pruebas.
6. **Entradas.** Apuntar al outlet `seller-detail-page`, `product-card`, `delivery-summary` y `return-summary-page`. Quitar las rutas `nueva` y `:id/retirar`, y el código sin uso. `ng build`, `ng test` y `npm run check:architecture` pasan.
7. **Verificación manual** contra la base local (§6, último bloque).
8. **Cierre.** Actualizar `specs/README.md`, `CLAUDE.md` y `AGENTS.md` (`modal-panel`, `stock-changes` y el outlet `ventana` en «Frontend conventions»).

## 6. Criterios de aceptación

- [ ] Desde el detalle de un vendedor, «Dejar producto» y «Retirar producto» abren el pop-up, y el detalle sigue visible detrás con el mismo scroll.
- [ ] «Dejar a vendedor» de una tarjeta de «Productos» abre el pop-up con ese producto fijo, y con el vendedor fijo si hay uno en «Viendo».
- [ ] Al confirmar un retiro o una entrega, el pop-up se cierra, sale el toast y no se navega a otra pantalla.
- [ ] Tras confirmar, el detalle muestra el stock y el historial nuevos sin recargar el navegador ni mostrar el spinner.
- [ ] Tras confirmar desde «Productos», la tarjeta muestra las piezas nuevas sin recargar el navegador.
- [ ] «Cancelar», la X y `Escape` cierran sin registrar nada; un clic en el fondo no cierra.
- [ ] Mientras guarda, ni la X ni `Escape` cierran el pop-up.
- [ ] Sin conexión, el aviso con «Reintentar» sale dentro del pop-up y reenvía el mismo `requestId`.
- [ ] Los errores de campo y el `409` por piezas siguen saliendo en el campo, dentro del pop-up.
- [ ] Al abrir, el foco entra en el pop-up; `Tab` no sale de él; al cerrar, el foco vuelve al botón que lo abrió.
- [ ] Recargar con el pop-up abierto lo mantiene abierto, y «Atrás» lo cierra.
- [ ] Al cerrar, la URL ya no tiene `ventana` ni sus parámetros.
- [ ] Los enlaces de «Últimas entregas» y «Últimos retiros» abren sus resúmenes, y «Dejar otro producto» y «Retirar otro producto» abren el pop-up.
- [ ] `/admin/entregas/nueva` y `/admin/vendedores/:id/retirar` ya no abren un formulario.
- [ ] El toast se ve por encima del pop-up.
- [ ] A 375 px no hay scroll horizontal, y el formulario de «Dejar» se desplaza dentro del pop-up.
- [ ] Un vendedor no descarga estas rutas: siguen dentro de `ADMIN_ROUTES`.
- [ ] Sin cambios en `backend/`. `ng build`, `ng test` y `npm run check:architecture` pasan.

**Verificación manual,** contra la base local: repetir en el navegador los criterios anteriores con Víctor, desde su detalle y desde «Productos». El registro de una entrega y de un retiro se comprueba con sus movimientos en Studio. No hay errores en la consola.

## 7. Plan de pruebas

- **`shared/utils/modal-links.spec.ts`:** comandos con y sin vendedor o producto, y el cierre.
- **`shared/components/modal-panel/…spec.ts`:** título, proyección, foco inicial, `Tab` atrapado en ambos sentidos, `Escape`, X, `closable = false`, foco de regreso y que un clic en el fondo no emite `closed`.
- **`core/stock-changes/…spec.ts`:** `notify()` sube `version`.
- **`return-units-page` y `create-delivery-page`:** parámetros por `paramMap`; al guardar: toast, `notify()` y navegación de cierre, sin navegar al resumen; «Cancelar» cierra; sin conexión y `409` dejan el pop-up abierto.
- **`return-form` y `delivery-form`:** «Cancelar» es un botón que emite `cancelled`.
- **`seller-detail-page` y `products-page`:** cambiar `version` pide los datos otra vez sin mostrar «cargando»; al crearse no se piden dos veces.
- **`seller-detail-page`, `product-card`, `delivery-summary` y `return-summary-page`:** los enlaces apuntan al outlet.

## 8. Decisiones

- **Sí:** cerrar, avisar y refrescar al confirmar (decisión del usuario). **Revierte para este flujo** la decisión de HU-11 y HU-12 de terminar en el resumen.
- **No:** mostrar el resumen dentro del pop-up. Agrega un paso más a una operación que el usuario quiere rápida.
- **Sí:** también «Dejar a vendedor» de «Productos» (decisión del usuario). Un solo comportamiento y una sola forma de llegar al formulario.
- **Sí:** spec aparte en su propia rama (decisión del usuario), con HU-12 cerrada antes.
- **Sí:** ruta auxiliar con outlet `ventana`. Respeta las fronteras entre features, sobrevive a una recarga y «Atrás» cierra.
- **No:** un modal compartido con un servicio en `core/` que cree el componente. `core` no puede importar features, así que haría falta registrar cada formulario por inyección, y se perdería la recarga. Es la alternativa que HU-11 §9 ya descartó.
- **No:** mover los formularios a `shared/`. Dependen de servicios de datos, y `shared` es sin estado.
- **No:** unir `deliveries` y `sellers` en una feature. Es un cambio grande que no pide este pedido, y no resolvería «Productos».
- **Sí:** `StockChangesService` en `core/`, en vez de que el pop-up conozca a la página de atrás. Es un aviso sin datos, y sirve a ventas y mermas si lo necesitan.
- **Sí:** matriciales en vez de query params. Pertenecen al outlet y desaparecen al cerrar.
- **Sí:** enlaces en `shared/utils/modal-links.ts`, en vez de la constante por feature que propuso el plan. Evita repetir la forma del comando de outlet en tres features.
- **No:** cerrar con un clic en el fondo. Se perdería lo escrito en un formulario largo.
- **No:** guarda de cambios sin guardar. Igual que HU-11 y HU-12: «Cancelar» está a la vista y el clic accidental en el fondo no cierra.
- **Sí:** un `reload` deja de contar como «cargando» en el detalle y en «Productos», para que no parpadeen detrás del pop-up.
- **Sí:** `modal-panel` nuevo en vez de ampliar `confirm-dialog`. Ese es un `alertdialog` de dos botones fijos, y mezclarlos complica los dos.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `routerLink` absoluto con `outlets` pierde la ruta primaria desde una página anidada | El paso 1 lo confirma antes de tocar lo demás; la alternativa es navegar relativo a la ruta `admin` |
| El SSR falla o parpadea al recargar una URL con el outlet | El paso 1 prueba esa recarga; el marco no toca `document` hasta `afterNextRender` |
| Toast y pop-up comparten `z-50` y el toast queda debajo | El paso 2 fija el orden y el criterio lo comprueba |
| El foco no regresa porque la carga diferida ocurre después del clic | El panel guarda `activeElement` al crearse, y se comprueba en el navegador; si no hay botón, el foco queda en la página |
| Recargar el detalle reinicia sus historiales o duplica peticiones | El efecto ignora el primer valor de `version`, y una prueba cuenta las peticiones |
| Enlaces o pruebas viejas apuntan a `/admin/entregas/nueva` | El paso 6 los busca y los cambia; la ruta `entregas/:requestId` respondería «no encontrada» con `nueva` |
| Se mezcla con HU-12 si esa rama aún no se fusiona | La rama nueva sale de `spec-M2-hu12-retirar-a-vendedor`, y se fusiona después de ella |

## Lo que **no** entra en este spec

- Cambios en el backend o en reglas de negocio.
- El resumen dentro del pop-up.
- Pop-ups para otros formularios.
- Avisos de inventario entre pestañas o usuarios.

Cada uno, si llega, va en su propio spec.
