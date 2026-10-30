# Spec técnico — T-12 · Rediseño visual de Productos

> **Estado:** Implementado
> **Depende de:** M2-t11-rediseno-visual (`specs/M2-t11-rediseno-visual/spec.md`) — tokens, clases base y reglas de diseño
> **Fecha:** 2026-10-30
> **Objetivo:** que la lista, el alta y la edición de producto usen la base visual de T-11, sin cambiar textos, rutas ni lógica.

Fuentes:
- **Jira:** tarea `SCRUM-39 · T-12`, épica `SCRUM-7 · M2 · Vendedores y entregas`.
- **Origen:** sale de la división de T-11 del 2026-10-30, sin decisiones nuevas de diseño. El código ya estaba escrito en la rama de T-11 y aquí falta verificarlo.
- **Código:** `features/products` (páginas y componentes del §1).

## 1. Alcance

**Entra en este spec:**

- `products-page`: `page-title`, búsqueda con `field-input` y grilla con entrada escalonada.
- `product-card`: `surface-interactive`.
- `product-card-skeleton`: `skeleton-block`.
- `product-form`, `create-product-page` y `edit-product-page`: campos `field-*`, botones `btn-*` y avisos `alert-*`.

**No entra en este spec:**

- Vendedores (T-13), Mi cuenta y login (T-14), y el marco (T-11).
- Cambiar textos visibles, rutas, flujos, servicios, validaciones o la lógica.
- Cambiar los selectores o textos que usan las pruebas.
- Tokens o clases base nuevos: se usan los de T-11.

## 2. Reglas de diseño

Las de `M2-t11-rediseno-visual` §2, incluida su tabla de contraste (§6). Este spec no agrega combinaciones de color nuevas.

## 3. Endpoints y datos

No hay cambios en el backend, en los endpoints ni en los modelos. El diff solo toca plantillas `.html` y las dos pruebas del input de foto (§7).

## 4. Plan de implementación

El código de los pasos 1 y 2 ya existe; se verifica, no se reescribe.

1. **Lista.** `products-page`, `product-card` y `product-card-skeleton` adoptan la base.
2. **Formularios.** `product-form`, `create-product-page` y `edit-product-page` adoptan la base.
3. **Verificación manual.** Capturas de la lista, la búsqueda, el alta y la edición, en escritorio y a 390 px. Recorrido de alta y edición de producto, y búsqueda.
4. **Cierre.** Actualizar `specs/README.md` y comentar en `SCRUM-39`.

## 5. Criterios de aceptación

- [x] **1.** La lista, el alta y la edición usan las clases base.
- [x] **2.** Las tarjetas responden a hover y press, y la lista entra escalonada con un máximo de 320 ms.
- [x] **3.** La búsqueda, el alta y la edición funcionan igual que antes.
- [x] No cambió ningún texto visible, ruta, servicio ni regla de validación. El diff solo toca plantillas `.html`, este spec y las dos pruebas del input de foto (§7).
- [x] Todo control mide 44 px o más y tiene foco visible.
- [x] Hay capturas en escritorio y a 390 px, sin scroll horizontal.
- [x] Las pruebas actuales pasan sin cambiarlas. `ng build` y `npm run check:architecture` pasan.
- [x] Sin errores en la consola, y con «reducir movimiento» nada se mueve.

**Verificación (2026-10-30, base local con el seed, rama aislada):**
- `ng test` (48 archivos), `ng build` y `npm run check:architecture` pasan con esta parte sobre T-11.
- Lista: 14 tarjetas con retrasos de 0 a 320 ms. Búsqueda: «creatina» deja 3 tarjetas.
- Alta: el envío vacío muestra los 4 errores; el alta de «Prueba Visual T12» muestra «Producto registrado» y el aviso flotante. Edición: el precio cambió a `160.00`, confirmado en la base local.
- Escritorio y 390 px (lista, alta y edición), sin scroll horizontal y sin errores en la consola.
- Tamaños: selector de archivo, campos, «Porción» y botones de 52 px; «Cambiar foto» de 44 px. La casilla «Se fracciona» mide 20 px, pero toda su etiqueta es clicable y mide 44 px de alto.
- Hover y press con ratón real (botón sostenido por CDP): la tarjeta sube 2 px, pasa a `shadow-raised` y se oscurece su borde; al presionar escala a 0.99, y los botones `btn-primary` a 0.98. Con «reducir movimiento» no hay ninguno de esos cambios. La sombra cambia sin transición, como pide T-11 (solo se animan `transform`, `opacity` y colores).
- «Reducir movimiento» emulado en un Chrome headless aparte: de 14 animaciones activas a 0 en `/admin/productos`.
- Respecto del commit base: cero diferencias de texto visible.
- **Defecto encontrado y corregido:** en la edición, `Tab` caía en el input de foto oculto (`sr-only`, 1×1 px) y el foco desaparecía de la pantalla. Venía desde antes de T-11. Ahora lleva `tabindex="-1"` en modo edición; «Cambiar foto» lo sigue abriendo, y `Tab` pasa de ese botón a «Nombre».

## 6. Plan de pruebas

- La lógica no cambia, así que la suite actual (`ng test`) es la red de seguridad. La única adición son dos pruebas del `tabIndex` del input de foto, por el defecto de foco del §5.
- Si una prueba falla por un cambio visual, se corrige la plantilla, no la prueba.
- Verificación visual: capturas, foco con `Tab` y emulación de «reducir movimiento» en Chrome.

## 7. Decisiones

- **Sí:** spec propio, por la división de T-11 (decisión del usuario del 2026-10-30): se revisa y se fusiona por separado.
- **Sí:** aplicar la entrada escalonada y las clases base como dice T-11, sin decisiones nuevas.
- **Sí:** corregir aquí el foco invisible del input de foto (`tabindex="-1"` en edición), porque incumple el criterio de foco visible de este spec, aunque viniera de antes. Se agregaron dos pruebas para que no regrese.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Se fusiona antes que T-11 y le faltan las clases base | El PR va contra la rama de T-11 e indica que T-11 se fusiona primero |

## Lo que **no** entra en este spec

- Vendedores (T-13), Mi cuenta y login (T-14), y el marco (T-11).
- Cambios de textos, rutas, lógica, servicios o validaciones.

Cada uno, si llega, va en su propio spec o en su historia.
