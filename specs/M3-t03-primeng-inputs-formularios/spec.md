# Spec técnico — T-03 · PrimeNG: inputs de formularios

> **Estado:** Implementado
> **Depende de:** M3-t02-primeng-botones (`specs/M3-t02-primeng-botones/spec.md`) — patrón de «una sola sección en `styles.css`» y retiro de utilidades al terminar; M3-t01-primeng-listas-dialogos (`specs/M3-t01-primeng-listas-dialogos/spec.md`) — cuadro «Camino de migración» (tramo 6) y el `Select` con filtro normalizado del picker de «Dejar»; M2-t17-primeng-formulario-producto (`specs/M2-t17-primeng-formulario-producto/spec.md`) — primer uso de `pInputText` y `p-select` con `[invalid]`; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — reglas de los campos de dinero.
> **Fecha:** 2026-11-02
> **Objetivo:** pasar todos los campos de texto que usan `field-input` a `pInputText` y los dos `<select>` nativos de «Dejar» y «Retirar» a `p-select`, con el borde de error en una sola regla de `styles.css`, y retirar la utilidad `field-input`.

Fuentes:

- **Cuadro «Camino de migración» de M3-t01 (§2), tramo 6:** «Formularios: inputs (precio/costo con `money.ts`, teléfono, buscador)». El selector «Viendo» (`viewing-bar`) es del tramo 7 y no entra.
- **Inventario del 2026-11-02:** `grep -rnE 'field-input|<select' src/app --include='*.html'`. Fuera de `product-form` (ya en PrimeNG desde M2-t17, salvo el input de foto) quedan 11 campos de texto y 2 `<select>` en 5 plantillas (§2).
- **Decisiones del usuario (2026-11-02):** texto + selects; los iconos SVG se conservan sobre `pInputText`; contraseñas con `pInputText` y el botón «Mostrar» propio; piezas con `pInputText` numérico; borde de error en una regla única; filtro solo en el selector de producto de «Retirar»; retirar `field-input` al terminar.
- **PrimeNG:** [InputText](https://primeng.dev/inputtext) (`pInputText`, `[invalid]`) y [Select](https://primeng.dev/select) (`filter`, `filterBy`, `inputId`, `ariaLabelledBy`, `placeholder`).

## 1. Alcance

**Entra en este spec:**

- Una sección «PrimeNG: campos» en `styles.css`: borde de 2 px en `.p-inputtext.p-invalid` y `.p-select.p-invalid`.
- Migrar a `pInputText` los 11 campos de texto de §2 (login, alta de vendedor, «Dejar», «Retirar» y buscador de Productos), con `[invalid]` en lugar de las clases condicionales `border-2 border-danger` / `border border-line-strong`.
- Migrar a `p-select` el selector de vendedor de `delivery-form` (sin filtro) y el de producto de `return-form` (con filtro sin mayúsculas ni acentos, como el picker de «Dejar»).
- Limpiar `product-form`: quitar los `[class.border-2]` repetidos (los cubre la regla única) y pasar el input de foto de `field-input` a utilidades locales de Tailwind.
- Retirar `@utility field-input` de `styles.css` y actualizar `CLAUDE.md`, `AGENTS.md`, `specs/README.md` y el cuadro de M3-t01.
- Pruebas de frontend (§6).

**No entra en este spec:**

- El selector «Viendo» de `viewing-bar` y el resto de la navegación (tramo 7).
- El input de foto como `FileUpload` de PrimeNG: sigue siendo `<input type="file">` nativo, solo cambia su clase.
- `IconField`/`InputIcon`, `p-password` e `InputNumber`: los iconos siguen siendo SVG posicionados con Tailwind, las contraseñas usan su botón propio y las piezas y el dinero siguen como texto.
- La utilidad `field-label` (es una etiqueta, no un control): se conserva.
- Cambiar textos, validadores, mensajes de error, orden de los campos o reglas de negocio (por ejemplo «precio menor que el costo»).
- Tarjetas, shells y pop-up `ventana` (tramos 8 y 9). Backend y base de datos.

## 2. Inventario de lo que se migra

| Plantilla | Campos de texto → `pInputText` | `<select>` → `p-select` |
| --- | --- | --- |
| `features/auth/pages/login-page` | Correo, contraseña (ambos con icono SVG; la contraseña con su botón ojo) | — |
| `features/sellers/pages/create-seller-page` | Nombre, teléfono, correo, contraseña temporal (con «Mostrar» / `toggle-password`) | — |
| `features/deliveries/components/delivery-form` | Piezas (`qty`), otro costo (`unit-cost`), otro precio (`unit-price`) | Vendedor (`#seller`), sin filtro |
| `features/sellers/components/return-form` | Piezas a retirar (`qty`) | Producto (`#product`), con filtro |
| `features/products/pages/products-page` | Buscador (`#product-search`, `type="search"`, con lupa) | — |
| `features/products/components/product-form` | Limpieza: sin `[class.border-2]`; input de foto sin `field-input` | — |

Se conservan `id`, `name`, `type`, `inputmode`, `autocomplete`, `formControlName`, `aria-describedby`, `aria-invalid`, las refs de plantilla (`#qtyInput`…) y las clases de enganche de las pruebas.

## 3. Reglas de comportamiento

- **Aspecto:** un campo migrado se ve como los de `product-form` hoy (52 px de alto, radio `xl`, borde `line-strong`, fondo blanco, foco de marca), en reposo, con foco de teclado, con error y deshabilitado. Los paddings para los iconos (`pl-11`, `pl-12`, `pr-14`) siguen como utilidades locales.
- **Error:** el borde rojo de 2 px aparece cuando el campo tiene error visible (`[invalid]`), con el color `invalidBorderColor` del preset. Lo define una sola regla de `styles.css`, no cada plantilla. Los errores se siguen mostrando al enviar, como hoy.
- **Dinero:** costo y precio de «Dejar» siguen siendo `string`, `type="text" inputmode="decimal"`, sin formatear ni redondear mientras se escribe; se conservan `money.ts` y sus validadores (M1-t08).
- **Piezas:** `type="text" inputmode="numeric"`, mismos validadores; el valor del control no cambia de tipo.
- **Teléfono:** se escribe sin reformatear (`type="tel"`); solo se muestra con el pipe `phone` fuera del input.
- **Contraseñas:** el botón «Mostrar»/ojo propio cambia `type` entre `password` y `text` y conserva `aria-pressed`.
- **Selector de vendedor (`delivery-form`):** `p-select` con `placeholder="Elige un vendedor"` y el control `sellerId` sigue siendo `string` (`''` sin elegir). Con vendedor fijo no se muestra, como hoy.
- **Selector de producto (`return-form`):** `p-select` con `placeholder="Elige un producto"`, el control `productId` sigue siendo `number | null`, y filtro por `searchText` (nombre normalizado con `normalizeText`), igual que el picker de «Dejar». Al elegir, aparece la tarjeta del producto como hoy.
- **Foco al enviar con errores:** el primer campo con error recibe el foco; para los `p-select` se llama a `Select.focus()` (como `focusCategory()` en `product-form`).
- **Accesibilidad:** cada `p-select` asocia su etiqueta con `inputId` (= `id` de hoy) y `ariaLabelledBy`; los errores con `aria-describedby`/`aria-invalid` vía pass-through, como la categoría de `product-form`. La lista se monta en `body` y no desborda a 375 px.
- **Movimiento:** las transiciones respetan `prefers-reduced-motion` (variable `--mammut-ui-transition-duration` del preset) y los `p-select` usan `motionOptions` como `product-form`.

## 4. Modelo de datos

No agrega datos persistentes ni cambia contratos de la API. Solo cambia código de frontend:

```ts
// features/sellers/components/return-form/return-form.models.ts
export interface ReturnProductOption {
  id: number;
  label: string;
  searchText: string; // nuevo: normalizeText(line.name), para el filtro del p-select
}
```

```css
/* styles.css — sección «PrimeNG: campos» (capa primeng), junto a «PrimeNG: botones» */
.p-inputtext.p-invalid,
.p-select.p-invalid {
  border-width: 2px;
}
```

```ts
// delivery-form.component.ts / return-form.component.ts — la ref del selector cambia de tipo
private readonly sellerSelect = viewChild<Select>('sellerSelect');   // antes ElementRef<HTMLSelectElement>
private readonly productSelect = viewChild<Select>('productSelect'); // antes ElementRef<HTMLSelectElement>
```

- Cada componente que usa los controles importa `InputText` y/o `Select` desde `primeng/inputtext` y `primeng/select`, uno a uno.
- Las constantes nuevas (por ejemplo, opciones de movimiento o pass-through de un `p-select`) van en el `.constants.ts` del componente, no en la clase.

## 5. Plan de implementación

1. **Regla única y `product-form`.** Se añade la sección «PrimeNG: campos» a `styles.css`. En `product-form` se quitan los `[class.border-2]` y el input de foto pasa a utilidades locales equivalentes a `field-input`. **Prueba:** los specs de `product-form`, `create-product-page` y `edit-product-page` pasan; en navegador, los campos con error de alta de producto siguen con borde de 2 px.
2. **Campos con icono: login y buscador.** `login-page` (correo y contraseña con SVG y botón ojo) y `products-page` (buscador con lupa) pasan a `pInputText`. **Prueba:** specs de `login-page` y `products-page`; el icono queda centrado y no se pisa con el texto.
3. **Alta de vendedor.** `create-seller-page`: nombre, teléfono, correo y contraseña temporal a `pInputText` con `[invalid]`, sin las clases condicionales de borde. **Prueba:** spec de `create-seller-page`, incluido `toggle-password`.
4. **«Dejar».** `delivery-form`: piezas, otro costo y otro precio a `pInputText`; el selector de vendedor a `p-select` sin filtro, con `viewChild<Select>` para el foco. Se actualiza la prueba que hoy cambia `select.value` para que elija la opción en el `p-select`. **Prueba:** spec de `delivery-form` y de `create-delivery-page`.
5. **«Retirar».** `return-form`: piezas a retirar a `pInputText`; el selector de producto a `p-select` con filtro por `searchText` (se añade a `ReturnProductOption`). Se actualiza la prueba que hoy lee `#product option`. **Prueba:** spec de `return-form` y de `return-units-page`, incluido el filtro sin acentos.
6. **Cierre.** Se retira `@utility field-input` de `styles.css`. `grep -rn 'field-input' src` no devuelve nada. `ng build`, `ng test` y `npm run check:architecture` pasan. Se actualizan `CLAUDE.md`/`AGENTS.md` (los campos son `pInputText`/`p-select`; desaparece la regla «no aplicar `field-input` a PrimeNG»), `specs/README.md` y el cuadro de M3-t01 (tramo 6), y se mide el bundle.

Cada paso queda commiteable y la app funcional: mientras no llegue el paso 6, `field-input` y `pInputText` conviven, porque la utilidad sigue definida.

## 6. Plan de pruebas

- **Plantillas migradas:** los specs existentes de las 6 plantillas de §2 pasan sin cambiar su lógica; solo se actualizan las pruebas que dependen del `<select>` nativo (`delivery-form`: elegir vendedor; `return-form`: leer opciones y elegir producto).
- **`return-form`:** prueba nueva de que el filtro encuentra «Proteína» escribiendo «proteina».
- **Foco al enviar:** en `delivery-form` y `return-form`, enviar sin vendedor/producto deja el foco en el `p-select` correspondiente.
- **Revisión visual:** en navegador, a escritorio y a 375 px (iframe, como en M3-t02), cada pantalla migrada en reposo, con foco de teclado, con error y deshabilitado (guardando): login, alta de vendedor, alta de producto, «Dejar», «Retirar» y buscador de Productos.
- **`ng test --watch=false` completo, `ng build` de producción y `npm run check:architecture`** antes de cerrar el spec. Sin cambios en `backend/`.

## 7. Criterios de aceptación

- [ ] `styles.css` tiene una sección «PrimeNG: campos» con el borde de error de 2 px para `.p-inputtext.p-invalid` y `.p-select.p-invalid`, y ninguna plantilla repite `border-2`/`border-danger` en un campo.
- [ ] Los 11 campos de texto de §2 usan `pInputText` con `[invalid]`, y conservan `type`, `inputmode`, `id`, `formControlName` y `aria-*`.
- [ ] El selector de vendedor de «Dejar» y el de producto de «Retirar» son `p-select`; el de producto filtra sin mayúsculas ni acentos.
- [ ] Enviar con un selector vacío muestra el error y deja el foco en ese `p-select`.
- [ ] Costo, precio, piezas y teléfono siguen siendo texto sin formatear ni redondear al escribir; los validadores y mensajes no cambian.
- [ ] Los iconos del login y la lupa del buscador siguen en su sitio, y el botón «Mostrar»/ojo conserva `aria-pressed`.
- [ ] `product-form` ya no tiene `[class.border-2]` y su input de foto se ve como hoy.
- [ ] `@utility field-input` no existe y `grep -rn 'field-input' src` no devuelve resultados.
- [ ] A 375 px ninguna pantalla migrada hace scroll horizontal, y la lista de los `p-select` no desborda.
- [ ] Un campo migrado no se distingue a simple vista de los de `product-form` en reposo, con foco, con error y deshabilitado.
- [ ] El selector «Viendo», las tarjetas, los shells y el pop-up `ventana` no cambian.
- [ ] `CLAUDE.md`, `AGENTS.md`, `specs/README.md` y el cuadro de M3-t01 quedan actualizados y en sincronía.
- [ ] Sin cambios en `backend/`. `ng build`, `ng test` y `npm run check:architecture` pasan.

## 8. Decisiones

- **Sí:** campos de texto **y** los dos `<select>` en un solo spec (decisión del usuario). Son el mismo tramo «formularios» y `p-select` ya está tematizado.
- **Sí:** `pInputText` con los SVG de hoy posicionados con Tailwind (decisión del usuario). Sin `IconField`/`InputIcon`: no cambia el DOM ni suma subpresets.
- **Sí:** contraseñas con `pInputText` y el botón propio (decisión del usuario). `p-password` trae medidor, icono y DOM propios que no pide el diseño.
- **Sí:** piezas con `pInputText` `inputmode="numeric"` (decisión del usuario). Coherente con el dinero; `InputNumber` cambiaría el tipo del control y los validadores.
- **Sí:** borde de error en una sola regla de `styles.css` (decisión del usuario), y se limpia `product-form`, como se hizo con los botones en M3-t02.
- **Sí:** filtro solo en el selector de producto de «Retirar» (decisión del usuario); la lista de vendedores es corta.
- **Sí:** retirar `field-input` al terminar (decisión del usuario). El input de foto, único control nativo que queda, lleva utilidades locales.
- **Sí:** los `p-select` usan `placeholder` para el estado vacío y conservan el tipo de su control (`string` con `''` para vendedor, `number | null` para producto), en vez de una opción explícita vacía. Evita tocar validadores, modelos del formulario y payloads.
- **No:** `FileUpload` para la foto, `InputNumber`, `p-password`, `IconField`. Sin beneficio para el diseño actual.
- **No:** tocar el selector «Viendo» (tramo 7) ni cambiar textos, validadores o reglas.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El padding de `pInputText` pisa el de los iconos (`pl-12`, `pr-14`) | Las utilidades locales van en la capa `utilities`, que gana a `primeng`; se revisa en el paso 2 |
| Las pruebas que manipulan el `<select>` nativo dejan de funcionar | Se reescriben en los pasos 4 y 5 para abrir el `p-select` y elegir la opción, como la prueba del picker de «Dejar» |
| El foco al enviar con error deja de llegar al selector | `viewChild<Select>` y `Select.focus()`, igual que la categoría de `product-form`; prueba explícita |
| La regla de 2 px choca con el borde que ya pone el preset en `product-form` | Se quitan los `[class.border-2]` en el paso 1 y se comprueba alta y edición de producto |
| `autocomplete` del login o del alta de vendedor se pierde | Se conservan todos los atributos del `<input>`; `pInputText` es una directiva y no reemplaza el elemento |
| La lista del `p-select` desborda a 375 px dentro del pop-up | `appendTo="body"` y tope de ancho, como el picker de M3-t01; revisión a 375 px |
| Un `field-input` olvidado queda sin estilo al retirar la utilidad | El criterio exige `grep` sin resultados y el paso 6 se hace después de migrar todo |

## Lo que **no** entra en este spec

- Navegación y selector «Viendo» (tramo 7).
- Tarjetas, shells y pop-up `ventana` (tramos 8 y 9).
- `FileUpload`, `InputNumber`, `p-password`, `IconField`/`InputIcon`.
- Backend, base de datos, reglas de negocio y textos.

Cada uno, si llega, va en su propio spec, y su avance se marca en el cuadro «Camino de migración» de M3-t01 (§2).
