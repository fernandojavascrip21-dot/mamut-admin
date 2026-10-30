# Spec técnico — T-14 · Rediseño visual de Mi cuenta y login

> **Estado:** Implementado
> **Depende de:** M2-t11-rediseno-visual (`specs/M2-t11-rediseno-visual/spec.md`) — tokens, clases base y reglas de diseño
> **Fecha:** 2026-10-30
> **Objetivo:** que Mi cuenta use la base visual de T-11 y que el login se alinee a ella sin cambiar su aspecto.

Fuentes:
- **Jira:** tarea `SCRUM-41 · T-14`, épica `SCRUM-7 · M2 · Vendedores y entregas`.
- **Origen:** sale de la división de T-11 del 2026-10-30, sin decisiones nuevas de diseño. El código ya estaba escrito en la rama de T-11 y aquí falta verificarlo.
- **Código:** `features/account/pages/account-page` y `features/auth/pages/login-page/login-page.component.html`.

## 1. Alcance

**Entra en este spec:**

- `account-page`: `surface-card`, `btn-*` y el diálogo de cerrar sesión rediseñado en T-11.
- Login: su botón y sus campos pasan a `btn-primary` y `field-input`, sin cambiar su aspecto.

**No entra en este spec:**

- Productos (T-12), Vendedores (T-13) y el marco (T-11).
- Rediseñar el login otra vez.
- Cambiar textos visibles, rutas, flujos, servicios, validaciones o la lógica.
- Cambiar los selectores o textos que usan las pruebas.
- Tokens o clases base nuevos: se usan los de T-11.

## 2. Reglas de diseño

Las de `M2-t11-rediseno-visual` §2, incluida su tabla de contraste (§6). Este spec no agrega combinaciones de color nuevas.

## 3. Endpoints y datos

No hay cambios en el backend, en los endpoints ni en los modelos. El diff solo toca plantillas `.html`.

## 4. Plan de implementación

El código de los pasos 1 y 2 ya existe; se verifica, no se reescribe.

1. **Mi cuenta.** `account-page` adopta la base.
2. **Login.** Su botón y sus campos pasan a las clases base, con capturas antes y después.
3. **Verificación manual.** Capturas de Mi cuenta y del login, en escritorio y a 390 px. Recorrido de cerrar sesión, y de login correcto y fallido, como administrador y como vendedor.
4. **Cierre.** Actualizar `specs/README.md` y comentar en `SCRUM-41`.

## 5. Criterios de aceptación

- [x] **1.** Mi cuenta usa las clases base y el diálogo de cerrar sesión de T-11.
- [x] **2.** El botón y los campos del login usan `btn-primary` y `field-input`, y el login se ve igual que antes.
- [x] **3.** Cerrar sesión, y entrar con datos correctos o incorrectos, funcionan igual que antes.
- [x] No cambió ningún texto visible, ruta, servicio ni regla de validación. El diff solo toca plantillas `.html` y este spec.
- [x] Todo control mide 44 px o más y tiene foco visible.
- [x] Hay capturas en escritorio y a 390 px, sin scroll horizontal.
- [x] Las pruebas actuales pasan sin cambiarlas. `ng build` y `npm run check:architecture` pasan.
- [x] Sin errores en la consola, y con «reducir movimiento» nada se mueve.

**Verificación (2026-10-30, base local con el seed, rama aislada):**
- `ng test` (48 archivos), `ng build` y `npm run check:architecture` pasan con esta parte sobre T-11.
- Mi cuenta: escritorio y 390 px, sin scroll horizontal y sin controles de menos de 44 px. Cerrar sesión pasa por el diálogo y lleva a `/login`.
- Login: campos de 52 px con el padding de sus íconos (48 px) y botón de 54 px, igual que antes de alinearlo. Comparación píxel a píxel de `/login` entre T-11 (sin alinear) y esta rama, sin animación, a 1280 y 390 px: 0 píxeles de diferencia. Con datos incorrectos muestra «Usuario o contraseña incorrectos»; con datos correctos entra a `/admin/stock`.
- «Reducir movimiento» emulado en un Chrome headless aparte: de 35 animaciones activas a 0 en `/login`, y 0 en `/cuenta`.
- Sin errores en la consola. Respecto del commit base: cero diferencias de texto visible, y el diff solo toca plantillas `.html` y este spec.

## 6. Plan de pruebas

- No se escriben pruebas nuevas, porque la lógica no cambia. La suite actual (`ng test`) es la red de seguridad.
- Si una prueba falla por un cambio visual, se corrige la plantilla, no la prueba.
- Verificación visual: capturas, foco con `Tab` y emulación de «reducir movimiento» en Chrome.

## 7. Decisiones

- **Sí:** spec propio, por la división de T-11 (decisión del usuario del 2026-10-30): se revisa y se fusiona por separado.
- **Sí:** el login solo se alinea a la base (decisión del usuario del 2026-10-29), sin cambiar su aspecto. Conserva el padding de sus íconos y el alto de 54 px de su botón.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Se fusiona antes que T-11 y le faltan las clases base | El PR va contra la rama de T-11 e indica que T-11 se fusiona primero |

## Lo que **no** entra en este spec

- Productos (T-12), Vendedores (T-13) y el marco (T-11).
- Rediseñar el login otra vez.
- Cambios de textos, rutas, lógica, servicios o validaciones.

Cada uno, si llega, va en su propio spec o en su historia.
