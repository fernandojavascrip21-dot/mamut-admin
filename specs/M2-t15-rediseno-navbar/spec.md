# Spec técnico — T-15 · Rediseño del navbar

> **Estado:** Implementado
> **Depende de:** M2-t11-rediseno-visual (`specs/M2-t11-rediseno-visual/spec.md`) — tokens y reglas de diseño
> **Fecha:** 2026-10-30
> **Objetivo:** que el navbar comparta el lenguaje visual del login y use un menú tipo medidor de inventario, sin cambiar rutas, roles ni la API del componente.

## 1. Alcance

**Entra:**

- `core/layout/top-nav`: cabecera compacta (logo con anillo de acento, etiqueta del rol en mono, carrito y avatar cuadrados redondeados) y menú de celdas; la celda activa se llena de `bg-accent` desde abajo con `animate-stock-grow`, igual que las columnas del login.
- `core/layout/nav-icon` (nuevo): componente presentacional con los íconos de línea (menú y carrito), trazo 2.25 y 22px.
- `core/layout/top-nav/top-nav.constants.ts`: textos y color del avatar por rol.
- `core/layout/viewing-bar`: margen y esquinas redondeadas para alinearse con la píldora.

- Distribución responsive con un solo DOM: orden por `order-*` y la fila disuelta con `lg:contents` en escritorio.
- Barra «Viendo» delgada y neutra; con vendedor elegido solo cambia el borde y el tinte de acento. Sin doble anillo de foco. En la barra lateral va a ancho completo.
- En escritorio (`lg:`) el navbar es una barra lateral fija de 256px (marca, «Viendo», menú vertical, cuenta abajo) y el contenido ocupa el resto con `max-w-6xl`. En celular y tablet queda el encabezado superior con menú de celdas.
- La barra lateral se puede ocultar y mostrar (botón en la barra y botón flotante al ocultarla). La preferencia se guarda en `localStorage` (`mamut.sidebarCollapsed`) mediante `SidebarService`; el botón solo existe en escritorio.

**No entra:** rutas, menús (`admin-shell.constants.ts`, `seller-shell.constants.ts`), roles, servicios, lógica ni textos visibles.

## 2. Reglas de diseño

Solo tokens de `styles.css`, sin hex nuevos. Activo: texto blanco sobre `accent` (misma combinación que `btn-primary`, ver T-11 §6). Objetivos táctiles ≥ 44px, foco visible, `aria-current` y `aria-label` conservados, y `motion-reduce` en animaciones y transiciones.

## 3. Endpoints y datos

Sin cambios en backend ni modelos. `NavIcon` agrega el valor `'cart'`.

## 4. Verificación

`npm run check:architecture`, `ng build`, `ng test --include 'src/app/core/layout/**/*.spec.ts'` (30 pruebas) y revisión visual como administrador y vendedor en móvil y escritorio.
