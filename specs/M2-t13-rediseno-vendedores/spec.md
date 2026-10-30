# Spec técnico — T-13 · Rediseño visual de Vendedores

> **Estado:** Implementado
> **Depende de:** M2-t11-rediseno-visual (`specs/M2-t11-rediseno-visual/spec.md`) — tokens, clases base y reglas de diseño
> **Fecha:** 2026-10-30
> **Objetivo:** que «Mis vendedores», el detalle y el alta de vendedor usen la base visual de T-11, sin cambiar textos, rutas ni lógica.

Fuentes:
- **Jira:** tarea `SCRUM-40 · T-13`, épica `SCRUM-7 · M2 · Vendedores y entregas`.
- **Origen:** sale de la división de T-11 del 2026-10-30, sin decisiones nuevas de diseño. El código ya estaba escrito en la rama de T-11 y aquí falta verificarlo.
- **Código:** `features/sellers` (páginas y componentes del §1).

## 1. Alcance

**Entra en este spec:**

- `sellers-page` y `seller-row`: `surface-interactive` y entrada escalonada.
- `seller-row-skeleton`.
- `seller-detail-page` y `seller-stock-line`.
- `create-seller-page`, incluido el estado «Vendedor dado de alta».

**No entra en este spec:**

- Productos (T-12), Mi cuenta y login (T-14), y el marco (T-11).
- La decisión pendiente de HU-10 sobre el enlace «‹ Vendedores» con un vendedor elegido.
- Cambiar textos visibles, rutas, flujos, servicios, validaciones o la lógica.
- Cambiar los selectores o textos que usan las pruebas.
- Tokens o clases base nuevos: se usan los de T-11.

## 2. Reglas de diseño

Las de `M2-t11-rediseno-visual` §2, incluida su tabla de contraste (§6). Este spec no agrega combinaciones de color nuevas.

## 3. Endpoints y datos

No hay cambios en el backend, en los endpoints ni en los modelos. El diff solo toca plantillas `.html`.

## 4. Plan de implementación

El código de los pasos 1 y 2 ya existe; se verifica, no se reescribe.

1. **Lista y detalle.** `sellers-page`, `seller-row`, `seller-row-skeleton`, `seller-detail-page` y `seller-stock-line` adoptan la base.
2. **Alta.** `create-seller-page` adopta la base, incluido «Vendedor dado de alta».
3. **Verificación manual.** Capturas de la lista, el detalle y el alta, en escritorio y a 390 px. Recorrido de alta de vendedor, detalle y sincronía con la barra «Viendo».
4. **Cierre.** Actualizar `specs/README.md` y comentar en `SCRUM-40`.

## 5. Criterios de aceptación

- [x] **1.** La lista, el detalle y el alta (incluido «Vendedor dado de alta») usan las clases base.
- [x] **2.** Las filas responden a hover y press, y la lista entra escalonada con un máximo de 320 ms.
- [x] **3.** El alta, el detalle y la sincronía con la barra «Viendo» funcionan igual que antes.
- [x] No cambió ningún texto visible, ruta, servicio ni regla de validación. El diff solo toca plantillas `.html` y este spec.
- [x] Todo control mide 44 px o más y tiene foco visible.
- [x] Hay capturas en escritorio y a 390 px, sin scroll horizontal.
- [x] Las pruebas actuales pasan sin cambiarlas. `ng build` y `npm run check:architecture` pasan.
- [x] Sin errores en la consola, y con «reducir movimiento» nada se mueve.

**Verificación (2026-10-30, base local con el seed, rama aislada):**
- `ng test` (48 archivos), `ng build` y `npm run check:architecture` pasan con esta parte sobre T-11.
- Lista: filas con retrasos de 0 a 160 ms. Detalle de Víctor: «55 1000 0001», «6 piezas», y las líneas de creatina y proteína.
- Barra «Viendo»: abrir el detalle elige a Víctor; «Yo · bodega» regresa a la lista.
- Alta: el envío vacío muestra los 4 errores; el alta de «Prueba Visual T13» muestra «Vendedor dado de alta», y el vendedor aparece en la barra sin recargar.
- Escritorio y 390 px, sin scroll horizontal, sin controles de menos de 44 px y sin errores en la consola.
- «Reducir movimiento» emulado en un Chrome headless aparte: de 5 animaciones activas a 0 en `/admin/vendedores`.
- Respecto del commit base: cero diferencias de texto visible, y el diff solo toca plantillas `.html` y este spec.
- **Observación:** a 390 px los nombres largos se recortan en la fila («Valeria Vended…»). Es el `truncate` que ya tenía HU-09; no se cambió aquí.

## 6. Plan de pruebas

- No se escriben pruebas nuevas, porque la lógica no cambia. La suite actual (`ng test`) es la red de seguridad.
- Si una prueba falla por un cambio visual, se corrige la plantilla, no la prueba.
- Verificación visual: capturas, foco con `Tab` y emulación de «reducir movimiento» en Chrome.

## 7. Decisiones

- **Sí:** spec propio, por la división de T-11 (decisión del usuario del 2026-10-30): se revisa y se fusiona por separado.
- **Sí:** aplicar la entrada escalonada y las clases base como dice T-11, sin decisiones nuevas.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Se fusiona antes que T-11 y le faltan las clases base | El PR va contra la rama de T-11 e indica que T-11 se fusiona primero |

## Lo que **no** entra en este spec

- Productos (T-12), Mi cuenta y login (T-14), y el marco (T-11).
- La decisión pendiente de HU-10 sobre el enlace «‹ Vendedores» con un vendedor elegido.
- Cambios de textos, rutas, lógica, servicios o validaciones.

Cada uno, si llega, va en su propio spec o en su historia.
