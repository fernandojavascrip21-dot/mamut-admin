# Spec técnico — T-11 · Base visual y marco de la app

> **Estado:** Implementado
> **Depende de:** M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`) — `viewing-bar` dentro de `top-nav`; M0-base (`specs/M0-base/spec.md`) — shells, menú y pantallas de M0; el rediseño del login (sin spec, commit `b8ad18d`: `login-brand-panel`, `login-background` y las animaciones `rise-in`, `stock-grow` y `light-sweep` de `src/styles.css`)
> **Fecha:** 2026-10-29
> **Objetivo:** crear la base visual compartida y rediseñar el marco de la app con el estilo del login nuevo (marco oscuro en tinta con acentos ámbar y contenido claro en crema), sin cambiar textos, rutas ni lógica.

Fuentes:
- **Jira:** tarea `SCRUM-38 · T-11`, épica `SCRUM-7 · M2 · Vendedores y entregas`.
- **Partes:** este spec se dividió el 2026-10-30 (§8). Las pantallas de cada área están en `M2-t12-rediseno-productos`, `M2-t13-rediseno-vendedores` y `M2-t14-rediseno-cuenta-login`, que siguen las reglas y la base de este spec.
- **Referencias visuales:**
  - el login rediseñado (`features/auth/pages/login-page` y su `ui/`);
  - el logo `public/logo-mammoth.png` (oscuro, crema y ámbar);
  - el canvas de mockups («Mammut Inventario MVP»), traducido a los tokens de la app como pide `CLAUDE.md`.
- **Código:** las plantillas del marco y las piezas globales (§1), `src/styles.css` (tokens `@theme` y animaciones) y `scripts/check-architecture.mjs`.
- **Decisiones del usuario del 2026-10-29 y 2026-10-30** (§8).

## 1. Alcance

**Entra en este spec:**

- **Base visual** en `src/styles.css`:
  - tokens nuevos que amplían la paleta sin cambiar los que existen (§4);
  - clases `@utility` compartidas para botones, campos, tarjetas, títulos, avisos y esqueletos (§4);
  - las animaciones de entrada de listas, que reusan `rise-in` del login.
- **Marco (`core/layout`):**
  - `top-nav` pasa a fondo tinta, con el menú superior en el mismo lugar que hoy;
  - `viewing-bar` queda integrada al menú como una franja del mismo bloque oscuro;
  - `admin-shell` y `seller-shell`.
- **Piezas globales:** `core/toast/components/toast`, `shared/components/confirm-dialog` y `shared/pages/coming-soon-page`.
- **Animación:** las reglas de micro-interacciones y de entrada escalonada (§2), que las clases base ya incluyen y que T-12 y T-13 aplican a sus listas. Todo se apaga con `prefers-reduced-motion`.
- **Documentación:** la regla de las clases base en «Styling» de `CLAUDE.md` y de `AGENTS.md`, y `specs/README.md`.

**No entra en este spec:**

- Las pantallas de Productos (T-12), Vendedores (T-13), Mi cuenta y login (T-14).
- Cambiar textos visibles, rutas, flujos, servicios, validaciones o la lógica de cualquier pantalla (decisión del usuario: «solo aspecto»).
- Cambiar los selectores o textos que usan las pruebas, como `.field-error`, `.retry`, `.new-seller`, `.units`, `.phone`, `.total`, `.empty`, `#email`, los `aria-label` y los textos de los estados.
- Mover la navegación: el menú sigue arriba. No hay barra inferior ni menú lateral.
- Un modo oscuro completo o un selector de tema.
- Cambiar o quitar tokens existentes (`page`, `ink`, `accent`…) o las fuentes.
- Componentes Angular nuevos de UI (`app-button`, `app-text-field`…).
- Pantallas que todavía no existen (Stock general, Carrito, Corte, Mi stock): siguen mostrando «Próximamente», ya con el estilo nuevo.
- La decisión pendiente de HU-10 sobre el enlace «‹ Vendedores» con un vendedor elegido. Se resuelve aparte.

## 2. Reglas de diseño

- **Marco oscuro, contenido claro:**
  - El bloque superior (cabecera, menú y franja «Viendo») va en `bg-ink`, con texto `text-page` y los secundarios en `text-page/75`.
  - El contenido de cada pantalla va en `bg-page`, con superficies blancas (`surface-card`).
- **Menú superior:**
  - El ítem activo se marca con una pastilla `bg-page/10` y texto `text-page`, más un subrayado ámbar de 2 px. Los inactivos van en `text-page/75` y, con hover, en `text-page`.
  - Se conservan `aria-current="page"`, los `aria-label` y el orden de los ítems.
- **Avatar y carrito sobre tinta:**
  - El avatar del administrador pasa de `bg-ink` (invisible sobre tinta) a `bg-accent-2` con un anillo `ring-page/20`. El del vendedor se queda en `bg-accent-2`.
  - El carrito se dibuja en `text-page`.
- **Franja «Viendo»:**
  - Con «Yo · bodega» va en `bg-ink-raised`, un tono más claro que el menú.
  - Con un vendedor elegido sigue en `bg-accent-hover` con sus iniciales, como hoy.
  - No cambian su comportamiento, sus estados (cargando, error, «Reintentar») ni sus pruebas.
- **El ámbar** (`accent`) solo se usa en texto grande, de 24 px o más en negrita, o en piezas decorativas sobre tinta, porque ahí da 3.3:1. Para texto normal sobre tinta se usan `page`, `page/75`, `accent-2-bg` o `faint`.
- **Contraste:** toda combinación nueva de texto y fondo mide 4.5:1 o más (3:1 para texto grande) y se anota en la tabla del §6. Valores ya medidos:

  | Texto | Fondo | Contraste |
  | --- | --- | --- |
  | `page` | `ink` | 14.9:1 |
  | `page/75` | `ink` | 8.9:1 |
  | `faint` | `ink` | 6.3:1 |
  | `page` | `ink-raised` (#2c211a) | 13.7:1 |
  | `faint` | `ink-raised` | 5.8:1 |
  | `accent` | `ink` | 3.6:1 (solo texto grande o decorativo) |
  | `muted` | `page` | 5.4:1 |
  | blanco | `accent` | 4.8:1 |

- **Tamaño de toque** de 44 px o más en todo control, y foco visible.
- **Animación:**
  - Las listas de productos y vendedores entran con `animate-rise-in`, con un retraso de `índice × 40 ms`, tope de 8 elementos (320 ms). A partir del noveno entran sin retraso extra, para no hacer esperar en listas largas.
  - Los esqueletos usan `animate-pulse`.
  - Toda animación lleva `motion-reduce:animate-none` o `motion-reduce:transition-none`.
  - Solo se animan `transform`, `opacity` y colores.
- **Iconos:** SVG en línea con `stroke="currentColor"` y `aria-hidden="true"`, como hoy. No se usan emojis.

## 3. Endpoints

No hay cambios en el backend ni en los endpoints.

## 4. Modelo de datos

No hay datos nuevos, ni migración, ni modelos TypeScript nuevos. Lo nuevo vive en `src/styles.css`.

**Tokens nuevos** (se agregan al `@theme`; ninguno existente cambia):

```css
--color-ink-raised: #2c211a;   /* franja «Viendo» con «Yo» y superficies elevadas sobre tinta */
--shadow-card: 0 1px 2px rgb(35 26 20 / 0.06), 0 4px 16px rgb(35 26 20 / 0.06);
--shadow-raised: 0 8px 28px rgb(35 26 20 / 0.14);
--radius-card: 1rem;
```

**Clases base** (`@utility` de Tailwind v4 en `src/styles.css`, una vez cada una; las plantillas las combinan con utilidades normales):

| Clase | Para qué | Contenido principal |
| --- | --- | --- |
| `btn-primary` | Botón principal | `bg-accent`, texto blanco, `h-[52px]`, `rounded-xl`, sombra ámbar suave, `hover:bg-accent-hover`, `active:scale-[0.98]`, estado `disabled` con `bg-disabled`/`text-muted` |
| `btn-secondary` | Botón con borde | Borde `line-strong`, fondo blanco y `hover:bg-page` |
| `btn-ghost` | Acción discreta y enlaces tipo botón | Sin borde; `hover:bg-page`, `text-accent-hover` para conservar contraste sobre blanco y crema (decisión confirmada en el paso 2) |
| `field-input` | Inputs y selects de formularios | `h-[52px]`, `rounded-xl`, borde `line-strong`, fondo blanco, foco con anillo `accent/15`, `disabled` como hoy |
| `field-label` | Etiquetas de campo | `text-sm font-semibold text-ink` |
| `surface-card` | Tarjetas, filas y paneles | Fondo blanco, borde `line`, `rounded-[var(--radius-card)]`, `shadow-card` |
| `surface-interactive` | Tarjetas y filas que son enlaces | `surface-card` + `hover:-translate-y-0.5`, `hover:shadow-raised`, `transition` y `motion-reduce:transform-none` |
| `page-title` | Título de cada pantalla | `font-display`, `text-[32px]`, `font-extrabold`, `tracking-[-0.02em]` |
| `alert-danger` / `alert-success` | Avisos dentro de pantalla | Los colores `danger-*` / `success-*` actuales, `rounded-xl` y `p-3.5` |
| `skeleton-block` | Esqueletos de carga | `bg-line`, `rounded-lg` y `animate-pulse` con `motion-reduce:animate-none` |

- Los errores de campo siguen con su clase de prueba (`field-error`) y sus utilidades actuales.
- Una clase base no reemplaza a una clase de prueba: las dos conviven en el mismo elemento, como ya pasa con `field-error`.

## 5. Plan de implementación

Cada paso deja la app funcionando, con `ng build`, `ng test` y `npm run check:architecture` pasando antes de seguir.

1. **Diseño y capturas «antes».**
   - Correr ui-ux-pro-max y luego frontend-design sobre esta dirección, como pide `CLAUDE.md`, y ajustar los detalles de las clases base sin salir del §2.
   - Tomar capturas de cada pantalla (§6) en escritorio y en un marco de 390×844 px. Se guardan en el scratchpad, fuera del repo.
2. **Base visual.**
   - Agregar los tokens y las clases `@utility` del §4 en `src/styles.css`.
   - Medir el contraste de cada combinación nueva y completar la tabla del §6.
   - Ninguna plantilla cambia todavía, así que la app se ve igual.
3. **Marco.**
   - Rediseñar `top-nav` (cabecera y menú en tinta, avatar y carrito sobre tinta) y `viewing-bar` (franja integrada, `bg-ink-raised` con «Yo»).
   - Revisar `admin-shell` y `seller-shell`.
   - Las pruebas de shells, `top-nav` y `viewing-bar` pasan sin cambios.
4. **Piezas globales.** `toast`, `confirm-dialog` (sombra `shadow-raised`, botones `btn-*`) y `coming-soon-page`.
5. **Verificación manual.**
   - Capturas «después» del marco y las piezas globales, en escritorio y a 390 px.
   - Como administrador: menú, barra «Viendo» (con «Yo», con un vendedor y sus estados), aviso flotante, diálogo y «Próximamente».
   - Como vendedor: el menú sin barra «Viendo», y «Mi stock».
   - Foco con `Tab` en el marco y en el diálogo.
   - Revisar que no haya errores en la consola y que la emulación de «reducir movimiento» deje todo quieto.
6. **Cierre.**
    - Agregar a «Styling» de `CLAUDE.md` y `AGENTS.md` la regla: «usar las clases base de `src/styles.css` (`btn-*`, `field-*`, `surface-*`, `page-title`, `alert-*`, `skeleton-block`) antes de repetir utilidades».
    - Actualizar `specs/README.md`.
    - Comentar el avance en `SCRUM-38` en cada paso, con el patrón de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-38`:

- [x] **1.** `src/styles.css` tiene los tokens y las clases base del §4, y el marco y las piezas globales las usan. Las pantallas de cada área las adoptan en T-12, T-13 y T-14.
- [x] **2.** La cabecera, el menú y la franja «Viendo» forman un bloque en tinta: con «Yo · bodega» la franja va en `ink-raised`, y con un vendedor elegido en óxido con sus iniciales. El ítem activo del menú se distingue con la pastilla y el subrayado ámbar.
- [x] **3.** «Próximamente», el aviso flotante y el diálogo de confirmación siguen el estilo nuevo. Con «reducir movimiento», nada se mueve.
- [x] **4.** La tabla de contraste está completa, y cada texto sobre un fondo nuevo mide 4.5:1 o más (3:1 si es texto grande).
- [x] **5.** Las pruebas actuales pasan sin cambiar sus selectores ni sus textos, salvo la excepción de `top-nav.component.spec.ts` (§8). `ng build` y `npm run check:architecture` pasan.

Además:

- [x] No cambió ningún texto visible, ruta, servicio ni regla de validación. El diff de este spec solo toca `.html`, `src/styles.css`, esa prueba y la documentación.
- [x] Ningún token existente cambió de valor.
- [x] Todo control del marco mide 44 px o más y tiene foco visible sobre tinta y sobre fondo claro.
- [x] Hay capturas del marco y las piezas globales en escritorio y a 390 px, sin scroll horizontal.
- [x] El recorrido del §5, paso 5, funciona igual que antes, como administrador y como vendedor, sin errores en la consola.
- [x] `CLAUDE.md` y `AGENTS.md` documentan las clases base.

**Verificación (2026-10-30, base local con el seed, rama aislada):**
- `ng test` (48 archivos), `ng build` y `npm run check:architecture` pasan solo con el commit de esta parte.
- Marco: el menú y la franja «Viendo» forman el bloque en tinta; con Víctor elegido la franja va en óxido con «VV». Escritorio y 390 px, sin scroll horizontal; todos los controles del marco miden 44 px o más.
- Foco: contorno crema de 3 px sobre tinta y ámbar de 3 px sobre claro, medido con `Tab`. El diálogo recibe el foco al abrir, y sus botones miden 52 px.
- Vendedor: menú propio, sin barra «Viendo» y sin errores en la consola. «Próximamente» y el aviso flotante siguen el estilo nuevo.
- «Reducir movimiento»: emulado con `Emulation.setEmulatedMedia` en un Chrome headless aparte; 0 animaciones activas en `/admin/stock`.
- Respecto del commit base (`b8ad18d`): ninguna línea quitada en `styles.css` (ningún token cambió), y cero diferencias de texto visible en las plantillas de esta parte.
- **No verificado en el navegador:** los estados cargando y error de la barra «Viendo» (cubiertos por las pruebas de `viewing-bar`).

**Tabla de contraste** (medida en el paso 2 y ampliada con los estados de las plantillas):

| Texto | Fondo | Contraste | Uso |
| --- | --- | --- | --- |
| `ink` | blanco | 17.08:1 | Campos, etiquetas y tarjetas |
| `ink` | `page` | 14.93:1 | Títulos y botones secundarios en hover |
| `muted` | blanco | 6.12:1 | Texto secundario en tarjetas y placeholders de campos |
| `muted` | `page` | 5.35:1 | Texto secundario del contenido |
| blanco | `accent` | 4.80:1 | Botón principal |
| blanco | `accent-hover` | 7.48:1 | Botón principal en hover |
| `accent` | blanco | 4.80:1 | Acción ámbar sobre superficie blanca |
| `accent-hover` | blanco | 7.48:1 | Texto de `btn-ghost` sobre tarjetas |
| `accent-hover` | `page` | 6.54:1 | Texto de `btn-ghost` sobre crema y en hover |
| `page` | `ink` | 14.93:1 | Texto del marco |
| `page/75` | `ink` | 8.85:1 | Texto secundario del marco |
| `page` | `page/10` sobre `ink` | 11.39:1 | Texto del ítem activo del menú |
| `page` | `ink-raised` | 13.70:1 | Franja de bodega |
| `page/75` | `ink-raised` | 8.29:1 | Texto secundario de la franja |
| `faint` | `ink` | 6.34:1 | Texto secundario sobre tinta |
| `faint` | `ink-raised` | 5.81:1 | Texto secundario sobre tinta elevada |
| `page` | `accent-hover` | 6.54:1 | Contexto del vendedor elegido |
| blanco | `accent-2` | 4.85:1 | Iniciales del avatar |
| `accent-2-text` | `accent-2-bg` | 7.56:1 | Identificadores sobre superficie ámbar clara |
| `danger-text` | `danger-bg` | 8.17:1 | Aviso de error |
| `danger` | blanco | 5.80:1 | Errores de campo y acciones de peligro |
| `success-text` | `success-bg` | 8.76:1 | Aviso de éxito |
| `page` | `blanco/10 sobre ink-raised` | 10.08:1 | Selector Viendo |
| `page` | `blanco/10 sobre accent-hover` | 5.20:1 | Selector Viendo |
| `page` | `page/5 sobre ink` | 13.17:1 | Hover del menú |
| `white` | `danger` | 5.80:1 | Confirmación de peligro |
| `white` | `danger-text` | 9.40:1 | Confirmación de peligro en hover |
| `danger` | `danger-bg` | 5.04:1 | Acción de peligro en hover |
| `ink` | `disabled` | 12.33:1 | Insignia de administrador |
| `ink` | `line` | 12.33:1 | Iniciales sin foto |
| `danger-text` | `blanco/50 sobre danger-bg` | 8.77:1 | Cerrar aviso en hover |
| `success-text` | `blanco/50 sobre success-bg` | 9.31:1 | Cerrar aviso en hover |
| `accent` | `ink` | 3.56:1 | Solo texto grande de al menos 24 px en negrita o decoración |

Mediciones del paso 2: luminancia relativa sRGB y fórmula `(Lclaro + 0.05) / (Loscuro + 0.05)`;
las transparencias se componen sobre el fondo indicado antes de calcular. Se compara el valor
sin redondear; la tabla muestra dos decimales.

`accent` sobre `page` mide **4.20:1**, por lo que no se usará para texto normal nuevo.
El usuario confirmó en el paso 2 que `btn-ghost` use `accent-hover` para su texto sobre
blanco y crema; el §4 incorpora esa decisión sin cambiar ningún token existente.
Los estados deshabilitados conservan los colores existentes: `muted` sobre `disabled`
(4.42:1) y `faint` sobre `disabled-input` (2.40:1). Son controles inactivos, excluidos del
requisito de contraste por [WCAG 2.2, criterio 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html#inactive-user-interface-components).

## 7. Plan de pruebas

- No se escriben pruebas nuevas de comportamiento, porque la lógica no cambia. Toda la suite actual (`ng test`) debe pasar en cada paso sin tocar sus selectores ni sus textos.
- Si una prueba falla por un cambio visual, se corrige la plantilla, no la prueba. La excepción es una prueba que dependa de una clase solo visual (p. ej. `bg-ink`): ahí se cambia la prueba para usar una clase de prueba o un atributo, y se anota en el §8.
- **Verificación visual y de accesibilidad:**
  - capturas antes y después;
  - tabla de contraste;
  - revisión de foco con `Tab` en el marco, en un formulario y en el diálogo;
  - emulación de «reducir movimiento» en Chrome.

## 8. Decisiones

- **Sí:** continuar todos los pasos hasta terminar el spec y avisar al final, sin pausas de revisión entre áreas (indicación posterior del usuario). Se mantienen las verificaciones de cada paso.
- **Excepción de pruebas visuales (paso 3, prevista en §7):** `top-nav.component.spec.ts` dependía de `bg-ink` y `bg-accent-2-bg`. Se sustituyen esas comprobaciones de color por iniciales, destino, `aria-current` y ubicación del carrito fuera del menú. Se conservan los selectores, los textos visibles y las comprobaciones del tamaño táctil; el aspecto se comprueba con capturas.
- **Sí:** `btn-ghost` usa `text-accent-hover` (confirmado por el usuario durante el paso 2): da 7.48:1 sobre blanco y 6.54:1 sobre crema. Reemplaza el `text-accent` inicialmente propuesto, que sobre crema solo mide 4.20:1. No cambia el valor de ningún token.
- **Sí:** dividir el spec en cuatro partes (decisión del usuario del 2026-10-30, que cambia la del 2026-10-29 de hacer un solo spec). Se dividió con los pasos 1 a 8 ya escritos, sin commit: el código se conservó y se repartió por rutas, con un commit y un PR por parte. T-12, T-13 y T-14 dependen de este spec, pero no entre sí.
- **No:** descartar el código y rehacer cada parte. Repetiría trabajo sin cambiar el resultado.
- **Sí:** seguir el estilo del login, con el marco oscuro y el contenido claro (decisión del usuario). La app se siente como una sola cosa desde que se entra.
- **No:** todo oscuro. Obligaría a revisar el contraste de cada pantalla y de los datos de dinero, y es más cansado para el uso diario.
- **Sí:** ampliar los tokens sin cambiar los existentes (decisión del usuario). Respeta la regla de `CLAUDE.md` de mantener la paleta, y nada de lo que ya funciona cambia de color.
- **Sí:** mantener el menú superior (decisión del usuario), solo rediseñado. No cambia la navegación ni las pruebas de los shells.
- **No:** barra inferior en el celular ni menú lateral. Son cambios de navegación, no de aspecto.
- **Sí:** clases `@utility` en `src/styles.css` (decisión del usuario). Un cambio de estilo se hace en un solo lugar, y no hay componentes nuevos que obliguen a reescribir los formularios reactivos.
- **No:** componentes `app-button` o `app-text-field`. Habría que reescribir los formularios alrededor de ellos para un cambio que es solo visual.
- **Sí:** micro-interacciones y entrada escalonada de listas (decisión del usuario), con tope de 320 ms para no hacer esperar.
- **No:** animación rica en cada pantalla, como la del login. Distrae en el uso diario.
- **Sí:** «solo aspecto» (decisión del usuario): textos, rutas, lógica y selectores de prueba no cambian. Así la suite actual sirve como red de seguridad.
- **Sí:** «Viendo» integrada al menú como franja (decisión del usuario): `ink-raised` con «Yo» y óxido con un vendedor. Se distingue del menú sin salir del bloque oscuro.
- **Sí:** el avatar del administrador pasa a `bg-accent-2`, porque su `bg-ink` actual desaparecería sobre la cabecera en tinta.
- **Sí:** verificación con capturas, contraste, pruebas y recorrido manual (decisión del usuario).
- **Sí:** se creó `SCRUM-38 · T-11` en la épica M2 (decisión del usuario).

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| T-12, T-13 y T-14 se fusionan antes que este spec y les faltan sus clases base | Sus PRs van contra la rama de T-11, y cada uno indica que T-11 se fusiona primero |
| Una prueba depende de una clase visual que cambia | Se cambia la prueba a una clase de prueba o a un atributo y se anota en el §8; nunca se cambia un texto |
| Contraste insuficiente en una combinación nueva sobre tinta | Tabla de contraste obligatoria en el paso 2; el ámbar solo se usa en texto grande o decorativo |
| La entrada escalonada hace sentir lenta una lista larga | Tope de 8 elementos con retraso (320 ms); `motion-reduce` la apaga |
| `@utility` con estados (`hover:`, `disabled:`) no se aplica como se espera en Tailwind v4 | Probar cada clase en el paso 2 antes de usarla en las plantillas; si una no funciona, esa clase va como utilidades sueltas |
| El avatar o el carrito quedan invisibles sobre tinta | Cubierto en el §2; se revisa en las capturas del paso 3 |

## Lo que **no** entra en este spec

- Las pantallas de Productos, Vendedores, Mi cuenta y login (T-12, T-13, T-14).
- Cambios de textos, rutas, lógica, servicios o validaciones.
- Mover la navegación (barra inferior o menú lateral).
- Modo oscuro completo o selector de tema.
- Cambiar tokens o fuentes existentes.
- Componentes Angular de UI nuevos.
- Pantallas que aún no existen (Stock general, Carrito, Corte, Mi stock).
- El enlace «‹ Vendedores» pendiente de HU-10.

Cada uno, si llega, va en su propio spec o en su historia.
