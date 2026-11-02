# Spec técnico — T-02 · PrimeNG: botones y enlaces con aspecto de botón

> **Estado:** Implementado
> **Depende de:** M3-t01-primeng-listas-dialogos (`specs/M3-t01-primeng-listas-dialogos/spec.md`) — su cuadro «Camino de migración» (§2) y el preset con `button` (`primary`, `secondary`, `danger`) que este spec completa; M2-t17-primeng-formulario-producto (`specs/M2-t17-primeng-formulario-producto/spec.md`) — primer uso de `pButton`; M2-t11-rediseno-visual (`specs/M2-t11-rediseno-visual/spec.md`) — las utilidades `btn-*` que se reemplazan y los tokens de color.
> **Fecha:** 2026-11-02
> **Objetivo:** reemplazar las utilidades `btn-primary`, `btn-secondary` y `btn-ghost` por el `pButton` de PrimeNG (en `<button>` y en `<a routerLink>`), tematizado con el preset `MAMMUT_THEME`, y retirar esas utilidades de `styles.css`.

Fuentes:

- **Análisis del 2026-11-02 sobre lo que falta migrar:** las utilidades `btn-*` aparecen en 17 plantillas de todas las features y ningún tramo del cuadro de M3-t01 las cubría; el usuario pidió empezar por los botones, con alcance completo (botones y enlaces) y retirando las utilidades al terminar.
- **Código:** `src/styles.css` (`@utility btn-primary`, `btn-secondary`, `btn-ghost`), `core/ui/constants/mammut-theme.constants.ts` (`button`), `features/products/components/product-form` (único uso actual de `pButton`, con clases de estado repetidas en cada botón) y las plantillas listadas en §2.
- **PrimeNG:** [Button](https://primeng.dev/button) (`pButton` como directiva sobre `<button>` y `<a>`, `severity`, `text`, `outlined`, `rounded`, `size`) y los tokens de [tematización del botón](https://primeng.dev/theming/styled).
- **Inventario:** `grep -rnE 'btn-(primary|secondary|ghost)' src/app` — ningún uso en `.ts` ni en pruebas; las pruebas se apoyan en clases de enganche (`retry`, `deliver`, `cancel`, `done`…), que se conservan.

## 1. Alcance

**Entra en este spec:**

- Completar el preset de botón de `MAMMUT_THEME` con las variantes que faltan: `text` (la «fantasma» de hoy) y `outlined` en `danger` (el botón con borde rojo de «Cerrar sesión» y «Reintentar» en los avisos de error de los formularios).
- Una sola sección en `styles.css` con lo que el preset no expone: estado deshabilitado, brillo del botón primario y la pulsación (`scale`), respetando `prefers-reduced-motion`.
- Migrar a `pButton` todos los usos de `btn-*` en las 17 plantillas de §2, tanto `<button>` como `<a routerLink>`.
- Simplificar `product-form`: quitar las cadenas de clases de estado deshabilitado repetidas en cada `pButton`, que pasan al CSS único.
- Retirar `btn-primary`, `btn-secondary` y `btn-ghost` de `styles.css` y actualizar `CLAUDE.md`, `AGENTS.md`, `specs/README.md` y el cuadro de M3-t01.
- Pruebas de frontend (§6).

**No entra en este spec:**

- Cambiar tamaños, textos, orden, iconos ni la distribución de los botones: solo cambia el componente que los pinta. Los tamaños siguen siendo utilidades locales de Tailwind (`h-11`, `h-[52px]`, `px-4`…), como en el piloto de M2-t17.
- Los controles de la navegación (`top-nav`, menús de los shells, botón del carrito, selector «Viendo»), que no usan `btn-*` y pertenecen al tramo 7.
- Inputs, selectores y formularios (tramo 6), tarjetas y shells (tramo 8) y `modal-panel` como pop-up (tramo 9). El **botón de cerrar** de `modal-panel` sí entra, porque usa `btn-ghost`.
- `p-button` como componente con `label`/`icon`: se usa la directiva `pButton` con contenido proyectado, como en `product-form`. No se agrega `primeicons`: los iconos siguen siendo SVG en línea.
- Estados de carga con el spinner de PrimeNG (`[loading]`): los textos de espera («Guardando…») se conservan tal cual.
- Backend, base de datos, reglas de negocio, rutas y textos.

## 2. Inventario de lo que se migra

Variantes de hoy y su equivalente:

| Utilidad de hoy | `pButton` | Notas |
| --- | --- | --- |
| `btn-primary` | sin `severity` (primario) | Brillo `shadow-accent/25` y deshabilitado gris vía CSS único |
| `btn-secondary` | `severity="secondary"` | Blanco con borde `line-strong` |
| `btn-ghost` | `[text]="true"` | Color `accent-hover` sobre crema (contraste); fondo `page` al pasar el cursor |
| `btn-secondary` + `border-danger text-danger hover:bg-danger-bg` | `severity="danger" [outlined]="true"` | «Cerrar sesión» y «Reintentar» de los avisos de error de alta y edición |
| `btn-primary … rounded-full px-0` (solo icono) | `[rounded]="true"` | Botón «+» de `products-page` |
| `btn-ghost … px-0` (solo icono) | `[text]="true"` | Botón de volver de Mi cuenta y X de `modal-panel` |

Plantillas (17):

| Feature | Plantillas |
| --- | --- |
| `products` | `product-card`, `products-page`, `create-product-page`, `edit-product-page` (+ limpieza de `product-form`) |
| `sellers` | `sellers-page`, `seller-detail-page`, `create-seller-page`, `return-units-page`, `return-summary-page`, `return-form` |
| `deliveries` | `create-delivery-page`, `delivery-form`, `delivery-summary`, `delivery-summary-page` |
| `auth` / `account` | `login-page`, `account-page` |
| `shared` | `modal-panel` (solo el botón de cerrar) |

## 3. Reglas de comportamiento

- **Aspecto:** un botón migrado debe verse igual que el de hoy: mismos colores, radio, tipografía, altura y sombra, en reposo, al pasar el cursor, al enfocar con teclado y deshabilitado. No se distingue sin abrir el inspector.
- **Enlaces:** `<a pButton routerLink>` navega igual, se abre en otra pestaña con clic medio o `Cmd/Ctrl+clic` y conserva su `href`. No se sustituye por `<button>` con `router.navigate`.
- **Deshabilitado:** gris `disabled` de fondo, texto `muted`, sin sombra ni pulsación, cursor `not-allowed`, también en el botón primario con `[disabled]`. Lo define una sola regla en `styles.css`, no cada plantilla.
- **Foco:** el anillo de foco del preset (3 px, color de marca, separación de 2 px) sustituye al `outline` de las utilidades.
- **Movimiento:** la pulsación (`scale(0.98)`) y las transiciones se desactivan con `prefers-reduced-motion`.
- **Ganchos de prueba:** las clases `retry`, `retry-history`, `retry-returns`, `deliver`, `return`, `cancel`, `done`, `another`, `close`, `close-empty`, `close-notfound`, `new-seller`, `toggle-password` se conservan junto a `pButton`.
- **Texto:** el contenido de cada botón no cambia; `pButton` lo envuelve en su propio `<span>`, así que las pruebas que leen `textContent` siguen igual.
- **SSR:** el build de producción con `outputMode: "server"` no se rompe, y los enlaces se renderizan con su `href` en el servidor.

## 4. Modelo de datos

No agrega datos persistentes ni cambia contratos de la API. Solo cambia código de frontend:

```ts
// core/ui/constants/mammut-theme.constants.ts — button (ya existe)
//  + text:     { primary: { color: 'var(--color-accent-hover)', hoverBackground: 'var(--color-page)',
//                           activeBackground: 'var(--color-page)' } }   // reemplaza a btn-ghost
//  + outlined: { danger:  { color: 'var(--color-danger)', borderColor: 'var(--color-danger)',
//                           hoverBackground: 'var(--color-danger-bg)', activeBackground: 'var(--color-danger-bg)' } }
//  Todo con var(--color-*) de styles.css; sin hexadecimales en TypeScript.

// styles.css — una sección «PrimeNG: botones» (no un .css por componente):
//  .p-button:disabled { … gris, sin sombra, cursor not-allowed, opacity: 1 … }
//  .p-button:not(.p-button-text, .p-button-outlined, .p-button-secondary, .p-button-danger) { brillo }
//  .p-button:active:not(:disabled) { transform: scale(0.98) }  // y @media (prefers-reduced-motion)
```

Ejemplos de la plantilla, antes y después:

```html
<!-- antes -->
<button type="button" class="retry btn-secondary mt-2 h-11 px-4 text-sm" (click)="retry()">Reintentar</button>
<a routerLink="/admin/vendedores" class="btn-ghost w-fit px-0">‹ Vendedores</a>

<!-- después -->
<button pButton severity="secondary" type="button" class="retry mt-2 h-11 px-4 text-sm" (click)="retry()">Reintentar</button>
<a pButton [text]="true" routerLink="/admin/vendedores" class="w-fit px-0">‹ Vendedores</a>
```

- Cada componente que usa el botón importa `ButtonDirective` desde `primeng/button`, uno a uno, como `product-form`.

## 5. Plan de implementación

1. **Preset y CSS único.** Se añaden `text` y `outlined.danger` al botón de `MAMMUT_THEME`, y la sección «PrimeNG: botones» a `styles.css` (deshabilitado, brillo primario, pulsación con `prefers-reduced-motion`). **Prueba:** la prueba del tema sigue sin referencias sin resolver; un botón de cada variante, en una página de prueba borrada antes de commitear, se compara lado a lado con el `btn-*` de hoy (reposo, cursor encima, foco con Tab y deshabilitado).
2. **Productos.** `product-card`, `products-page` (incluido el «+» redondo), `create-product-page` y `edit-product-page`. En `product-form` se quitan las clases de estado deshabilitado repetidas en sus tres `pButton`, que pasan al CSS único. **Prueba:** los specs de esas páginas pasan sin cambiar su lógica.
3. **Vendedores.** `sellers-page`, `seller-detail-page` («Dejar producto» y «Retirar producto» incluidos), `create-seller-page` (incluido `toggle-password`), `return-units-page`, `return-summary-page` y `return-form`.
4. **Entregas.** `create-delivery-page`, `delivery-form`, `delivery-summary` y `delivery-summary-page`.
5. **Acceso y cuenta.** `login-page` (el botón con la flecha animada por `group`), `account-page` («Cerrar sesión» en rojo con borde y el botón de volver) y el botón de cerrar de `modal-panel`. **Prueba:** el foco, el Tab atrapado y Escape de `modal-panel` siguen igual.
6. **Cierre.** Se retiran `btn-primary`, `btn-secondary` y `btn-ghost` de `styles.css`. `grep -rnE 'btn-(primary|secondary|ghost)' src` no devuelve nada. `ng build`, `ng test` y `npm run check:architecture` pasan. Se actualizan `CLAUDE.md`/`AGENTS.md` (los botones son `pButton`; la regla «no aplicar `btn-*` a PrimeNG» deja de tener sentido y se reescribe), `specs/README.md` y el cuadro de M3-t01 (§2), y se comprueba el tamaño del bundle.

Cada paso queda commiteable y la app funcional: mientras no llegue el paso 6, `btn-*` y `pButton` conviven sin chocar, porque las utilidades siguen definidas.

## 6. Plan de pruebas

- **Tema (`mammut-theme.constants.spec.ts`):** los tokens nuevos no dejan referencias sin resolver.
- **Plantillas migradas:** los specs de las 17 plantillas existentes pasan sin cambiar su lógica; se actualizan solo los selectores que dependan del DOM nuevo, y las clases de enganche se conservan.
- **Enlaces:** en `seller-detail-page` y `products-page`, los botones-enlace («Dejar producto», «Nuevo producto», «Volver») conservan su `href` renderizado.
- **`modal-panel`:** el botón de cerrar sigue emitiendo `closed`, y el foco inicial, el Tab atrapado y Escape no cambian.
- **Revisión visual:** en navegador, a escritorio y a 375 px, cada variante (primario, secundario, fantasma, peligro con borde, redondo e icono) en reposo, con cursor encima, con foco de teclado y deshabilitado; y las pantallas `login`, `cuenta`, formulario de producto, detalle del vendedor y los pop-ups de «Dejar» y «Retirar».
- **`ng test --watch=false` completo, `ng build` de producción y `npm run check:architecture`** antes de cerrar el spec. Sin cambios en `backend/`.

## 7. Criterios de aceptación

- [ ] El botón de `MAMMUT_THEME` incluye las variantes `text` y `outlined.danger`, con tokens de `styles.css` y sin hexadecimales en TypeScript.
- [ ] `styles.css` tiene una sola sección para los estados de los botones de PrimeNG (deshabilitado, brillo primario, pulsación) y respeta `prefers-reduced-motion`.
- [ ] Las 17 plantillas de §2 usan `pButton` en lugar de `btn-*`, con `<a pButton routerLink>` en los enlaces.
- [ ] `product-form` ya no repite clases de estado deshabilitado en sus `pButton`.
- [ ] `btn-primary`, `btn-secondary` y `btn-ghost` no existen en `styles.css`, y `grep -rnE 'btn-(primary|secondary|ghost)' src` no devuelve resultados.
- [ ] Un botón migrado no se distingue a simple vista del de hoy en reposo, con cursor encima, con foco de teclado y deshabilitado (colores, radio, tipografía, altura y sombra).
- [ ] Los enlaces migrados conservan su `href` y se pueden abrir en otra pestaña.
- [ ] El botón de cerrar de `modal-panel` cierra el pop-up, y su foco, Tab atrapado y Escape se comportan como hoy.
- [ ] A 375 px, ninguna pantalla migrada hace scroll horizontal por culpa de un botón.
- [ ] El build de producción con SSR pasa y los enlaces salen con su `href` desde el servidor.
- [ ] Los controles de la navegación, las tarjetas, los inputs y el pop-up `ventana` conservan su aspecto (no se tocaron en este tramo).
- [ ] `CLAUDE.md`, `AGENTS.md`, `specs/README.md` y el cuadro de M3-t01 quedan actualizados y en sincronía.
- [ ] Sin cambios en `backend/`. `ng test` y `npm run check:architecture` pasan.

## 8. Decisiones

- **Sí:** migrar botones **y** enlaces con aspecto de botón en un solo spec (decisión del usuario). Son una misma variante visual; separarlos dejaría dos sistemas conviviendo más tiempo.
- **Sí:** retirar `btn-primary`, `btn-secondary` y `btn-ghost` de `styles.css` al terminar (decisión del usuario). Una sola fuente de verdad: el preset.
- **Sí:** `pButton` como directiva con contenido proyectado, igual que `product-form`. Conserva el HTML y las clases de enganche de hoy; `p-button` con `label` obligaría a reescribir textos y botones con icono SVG.
- **Sí:** los tamaños siguen como utilidades locales de Tailwind (`h-11`, `h-[52px]`…). El preset define el color y la forma; la altura varía por pantalla y no merece variantes `size` de PrimeNG.
- **Sí:** el estado deshabilitado, el brillo del primario y la pulsación van en una sola sección de `styles.css`, porque el preset de Aura no los expone como tokens. Quita las cadenas de clases repetidas de `product-form`.
- **Sí:** `<a pButton routerLink>` en los enlaces, para conservar `href`, clic medio y accesibilidad de enlace; no `<button>` con `router.navigate`.
- **No:** `[loading]` de PrimeNG ni `primeicons`. Los textos de espera y los SVG actuales se conservan; cambiarlos es otro alcance.
- **No:** agregar variantes `size` ni `p-button` con `label`/`icon`. Sin beneficio para el diseño actual.
- **No:** tocar los controles de navegación (tramo 7), tarjetas y shells (tramo 8) ni el pop-up (tramo 9).

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `pButton` en `<a>` queda con subrayado, color de enlace o `display` distinto | El paso 1 compara un enlace-botón con el de hoy; lo que falte se arregla en la sección única de `styles.css` |
| El estado deshabilitado de Aura (opacidad) no coincide con el gris de hoy | Una regla en `styles.css` con `opacity: 1`, igual que en `product-form`, con criterio visual explícito |
| El `scale` de pulsación mueve el layout o choca con `prefers-reduced-motion` | Solo `transform`, sin cambiar el flujo; se desactiva dentro de `@media (prefers-reduced-motion: reduce)` |
| Contraste del botón fantasma sobre crema (`accent-hover`, 4,5:1 mínimo) | El token `text` usa el mismo color de hoy; se comprueba en el paso 1 |
| El botón redondo de solo icono pierde su proporción (`h-11 w-11`) | `[rounded]="true"` con `px-0`; se revisa en el paso 2 |
| El Tab atrapado de `modal-panel` falla al cambiar el DOM del botón de cerrar | El selector de focos (`FOCUSABLE_SELECTOR`) busca `button`; el paso 5 lo prueba con el panel |
| Tamaño del bundle al sumar `ButtonDirective` en más componentes | Es una directiva pequeña y ya está en un chunk compartido; se mide en el paso 6 (el bundle inicial ya supera el aviso de 500 kB tras M3-t01) |
| Un `btn-*` olvidado queda sin estilo al retirar las utilidades | El criterio de aceptación exige `grep` sin resultados, y el paso 6 se hace después de migrar todo |

## Lo que **no** entra en este spec

- Navegación, tarjetas, shells y pop-up `ventana` (tramos 7, 8 y 9 de M3-t01).
- Formularios e inputs (tramo 6).
- Spinner de carga, iconos de PrimeNG y variantes de tamaño.
- Backend, base de datos, reglas de negocio y textos.

Cada uno, si llega, va en su propio spec, y su avance se marca en el cuadro «Camino de migración» de M3-t01 (§2).
