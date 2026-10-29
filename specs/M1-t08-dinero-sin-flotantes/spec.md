# Spec técnico — T-08 · Manejo de dinero sin flotantes

> **Estado:** Aprovado
> **Depende de:** M1-t06-logica-a-servicios (`specs/M1-t06-logica-a-servicios/spec.md`) — agrega validadores a `products/validators/product-form.validators.ts` y cambia `priceNotBelowCost`; M1-t05-codigo-en-ingles (`specs/M1-t05-codigo-en-ingles/spec.md`) — usa sus nombres
> **Fecha:** 2026-10-26
> **Objetivo:** que precio y costo viajen como texto decimal, se validen y comparen en unidades enteras (centavos y diezmilésimas) y nunca se redondeen en silencio, dejando la convención lista para ventas y cortes.

Fuentes: la regla «Cantidades monetarias como enteros en centavos o con tipos decimales, nunca con `number` flotante para cálculos de caja» de «Buenas prácticas de código» en `CLAUDE.md`/`AGENTS.md` (2026-10-26); tarea `SCRUM-29 · T-08` del proyecto Jira `MammutSuplements` (espacio `SCRUM`), épica `SCRUM-6 · M1 · Productos y bodega`; `backend/src/db/schema.ts` (`products.price numeric(10,2)`, `products.unit_cost numeric(10,4)`, y las mismas escalas en `stock_movements.unit_price`, `direct_sale_items`, `vendor_stock`); `backend/src/lib/handler.ts` (`requireNumber`) y `backend/src/products/products.ts`.

## 1. Por qué existe este spec

Hoy no hay cálculos de caja, pero el manejo de dinero ya tiene huecos que M3 (ventas y cortes) heredaría:

| Hueco | Efecto hoy |
| --- | --- |
| El formulario y `requireNumber` aceptan cualquier cantidad de decimales | Un precio `450.555` se guarda como `450.56`: Postgres redondea sin avisar |
| No se valida el máximo de la columna | Un costo `1000000` (más de 6 dígitos enteros en `numeric(10,4)`) revienta como `500`, no como error de validación |
| Precio y costo viajan como `number` en el JSON de alta y edición, y se comparan con `Number()` en frontend y backend | Para una comparación alcanza, pero con totales de ventas y cortes se sumarían flotantes, que es lo que la regla prohíbe |

## 2. Alcance

**Entra en este spec:**

- Helper de dinero en el frontend (`src/app/shared/money.ts`) y en el backend (`backend/src/lib/money.ts`), con las mismas funciones (§4).
- Backend: `requireMoney(body, field, { scale })` en `src/lib/handler.ts`, usado por `POST /api/products` y `PATCH /api/products/:id` para `price` (escala 2) y `unitCost` (escala 4). Acepta texto o número JSON, valida formato, decimales, `> 0` y máximo de la columna, y devuelve el texto exacto normalizado.
- Backend: la regla «precio no menor que el costo» de HU-06 compara con el helper, no con `number`.
- Frontend: `price`/`unitCost` de `CreateProductInput`, `UpdateProductInput` y `ProductFormValue` pasan a `string`; validadores `maxDecimals(scale)` y `maxMoney(max)` en `product-form.validators.ts`; `priceNotBelowCost` compara con el helper.
- Mensajes de error en el campo y `422` en la API para decimales de más o monto fuera de rango (§3).
- Convención para ventas, cortes y precios por vendedor documentada en `CLAUDE.md`/`AGENTS.md` (§3, «Convención para M2/M3»).

**No entra en este spec:**

- Ventas, cortes, `vendor_stock.unit_price` / `unit_cost_with_shipping` y cualquier total: llegan con M2/M3 y siguen la convención.
- Cambiar columnas de la base: las escalas actuales (precio 2, costo 4) se quedan.
- Mostrar dinero: el pipe `currency` sobre `Number(texto)` sigue igual; formatear un texto con 2 decimales no acumula error.
- Librerías decimales (descartado, §8).

## 3. Reglas de negocio

- **Precio: hasta 2 decimales; costo: hasta 4** (decisión del usuario), igual que las columnas. El costo admite 4 porque puede salir de dividir una caja entre piezas (1000 / 12 = 83.3333).
- **Rango**: precio `> 0` y `<= 99,999,999.99`; costo `> 0` y `<= 999,999.9999` (máximos de `numeric(10,2)` y `numeric(10,4)`).
- **Nunca redondear en silencio**: decimales de más o fuera de rango → error en el campo y `422` en la API. Mensajes:
  - «El precio admite hasta 2 decimales» / «El costo admite hasta 4 decimales».
  - «El precio es demasiado grande» / «El costo es demasiado grande».
- **Formato en la API** (decisión del usuario): las respuestas ya mandan `price`/`unitCost` como texto (`"450.00"`, `"500.0000"`). Las peticiones mandan texto; el backend también acepta número JSON (`450.5`) y lo normaliza, para no romper clientes ni pruebas existentes. Notación científica, `NaN`, separadores de miles o comas decimales → `422`.
- **Calcular en unidades enteras** (decisión del usuario): toda comparación o aritmética de dinero convierte el texto a entero en la unidad mínima de su escala (centavos para escala 2, diezmilésimas para escala 4) sin pasar por `number` flotante, opera con enteros, y vuelve a texto al final. Para comparar precio con costo, ambos se llevan a escala 4.
- **Convención para M2/M3** (se documenta; no se implementa aquí):
  - Cada venta guarda en su fila el precio y el costo del momento como `numeric` (regla de HU-06: cambiar el precio no toca ventas pasadas).
  - Totales de una venta: `qty × unidades mínimas` con enteros en el backend; totales de cortes y reportes: `sum()` en SQL sobre `numeric`, nunca sumando en JS valores leídos como `number`.
  - Un costo con 4 decimales multiplicado por piezas se redondea a centavos **una sola vez, al final** (mitad hacia arriba), al guardar o mostrar un total en pesos.

## 4. Modelo de datos

No agrega tablas, columnas ni endpoints. Funciones nuevas (mismo contrato en frontend y backend):

```ts
// src/app/shared/money.ts y backend/src/lib/money.ts

export type MoneyScale = 2 | 4;

// "450.5" → 45050 (escala 2). Parsea por texto, sin pasar por number flotante.
// Lanza (backend) / devuelve null (frontend) si el formato o los decimales no cumplen.
export function toMinorUnits(value: string, scale: MoneyScale): number;

// 45050 → "450.50" (escala 2).
export function fromMinorUnits(units: number, scale: MoneyScale): string;

// Compara dos montos de cualquier escala llevándolos a escala 4: -1, 0 o 1.
export function compareMoney(a: string, aScale: MoneyScale, b: string, bScale: MoneyScale): -1 | 0 | 1;

// Cuántos decimales trae un texto decimal válido; null si no es un decimal válido.
export function decimalPlaces(value: string): number | null;
```

Los enteros se mantienen dentro de `Number.MAX_SAFE_INTEGER`: el máximo de `numeric(10,4)` en diezmilésimas es `9_999_999_999`.

**Backend — `src/lib/handler.ts` (agrega):**

```ts
// Monto obligatorio: acepta "450.5" o 450.5, valida formato, decimales según `scale`, > 0 y
// máximo de su columna; devuelve el texto normalizado ("450.50") listo para numeric.
export function requireMoney(
  body: Record<string, unknown>,
  field: string,
  opts: { scale: MoneyScale; label: string },   // label: "El precio" / "El costo" para el mensaje
): string { /* ... */ }
```

`CreateProductInput.price/unitCost` y `UpdateProductInput.price/unitCost` del backend pasan a `string`; `createProduct`/`updateProduct` comparan con `compareMoney(price, 2, unitCost, 4)`.

**Frontend — `products/interfaces/product.models.ts` (cambia):** `price: string` y `unitCost: string` en `CreateProductInput`, `UpdateProductInput` y `ProductFormValue`.

**Frontend — `products/validators/product-form.validators.ts` (agrega/cambia):**

```ts
export function maxDecimals(scale: MoneyScale): ValidatorFn { /* ... */ }  // error `maxDecimals`
export function maxMoney(max: string, scale: MoneyScale): ValidatorFn { /* ... */ } // error `maxMoney`
// priceNotBelowCost: ahora con compareMoney, sin Number().
```

## 5. Plan de implementación

1. Backend: `src/lib/money.ts` + `tests/money.test.ts` (unitarias, sin base).
2. Backend: `requireMoney` en `handler.ts`; `POST`/`PATCH` de productos lo usan para `price` y `unitCost`; `createProduct`/`updateProduct` reciben texto y comparan con `compareMoney`. Ampliar `tests/products.test.ts` y `tests/products-id.test.ts` con los casos de §7. `npm run type-check` y `npm test`.
3. Frontend: `shared/money.ts` + `money.spec.ts`.
4. Frontend: interfaces a `string`, validadores `maxDecimals`/`maxMoney`, `priceNotBelowCost` con `compareMoney`, mensajes en `product-form`; ajustar `ProductSaveService` y los specs afectados.
5. `CLAUDE.md`/`AGENTS.md`: la convención de §3 (decimales, unidades enteras, texto en la API, convención para M2/M3) y la existencia de `money.ts` en ambos lados.
6. Verificación: `ng build`, `npm test` en raíz y `backend/`, y recorrido manual de §7.

## 6. Criterios de aceptación

- [ ] Capturar un precio con 3 decimales o un costo con 5 muestra el error en el campo y no llama al backend.
- [ ] `POST`/`PATCH` de productos con `price: "450.555"`, `unitCost: "1.00001"`, `price: "100000000"` o `unitCost: "1000000"` responden `422` con el mensaje de §3, sin guardar ni redondear.
- [ ] `POST`/`PATCH` aceptan `price` como texto (`"450.5"`) y como número (`450.5`), y guardan `450.50`.
- [ ] Notación científica (`"1e3"`), coma decimal (`"450,50"`) o texto no numérico responden `422`.
- [ ] Precio igual al costo con escalas distintas (`"83.33"` vs `"83.3300"`) se acepta; `"83.33"` vs `"83.3301"` se rechaza como precio menor que el costo, en frontend y backend.
- [ ] Ningún archivo de `src/app` ni de `backend/src` compara o suma montos con `Number()`/`parseFloat` (salvo para pasarlos al pipe `currency` al mostrarlos).
- [ ] `CLAUDE.md` y `AGENTS.md` documentan la convención de dinero, incluida la de M2/M3.
- [ ] `ng build`, `npm test` (raíz) y `npm test` (`backend/`) pasan.

## 7. Plan de pruebas

**Backend:**

- `tests/money.test.ts`: `toMinorUnits("450.5", 2) = 45050`; `"0.0001"` escala 4 = 1; decimales de más, `"1e3"`, `"450,50"`, `""`, `"-1"` → error; `fromMinorUnits` ida y vuelta; `compareMoney` entre escalas 2 y 4; el máximo de cada escala sin perder precisión.
- `tests/products.test.ts` / `tests/products-id.test.ts`: los casos `422` y de aceptación del criterio 2–5 sobre `POST` y `PATCH`.

**Frontend:**

- `money.spec.ts`: mismos casos que el backend.
- `product-form.validators.spec.ts`: `maxDecimals(2)` y `maxDecimals(4)`, `maxMoney`, `priceNotBelowCost` con escalas distintas.
- `product-form.component.spec.ts`: mensajes de decimales y de monto grande; el valor emitido trae `price`/`unitCost` como texto.

**Manual:** alta y edición con precio `450.5` (se guarda `450.50` y la tarjeta muestra «$450.50»), con `450.555` (error en el campo) y con costo `83.3333` (se acepta).

## 8. Decisiones tomadas y descartadas

- **Sí:** texto decimal en la API y unidades enteras para calcular. Razón (decisión del usuario): la base ya devuelve `numeric` como texto; los enteros en la unidad mínima son exactos sin dependencias.
- **No:** centavos enteros en el contrato de la API. Razón: cambiaría todos los endpoints y el frontend, y no sirve para el costo con 4 decimales.
- **No:** librería decimal (big.js/decimal.js). Razón: agrega una dependencia en dos proyectos para algo que resuelven enteros dentro de `MAX_SAFE_INTEGER`.
- **Sí:** precio con 2 decimales, costo con 4. Razón (decisión del usuario): igual que las columnas; el costo por pieza puede venir de dividir una caja.
- **Sí:** el backend acepta texto o número y normaliza a texto. Razón (decisión del usuario): no rompe al frontend ni a las pruebas mientras migran, y el resultado siempre es texto exacto.
- **Sí:** helper, validación y convención ahora, sin ventas ni cortes. Razón (decisión del usuario): M3 hereda una sola forma de manejar dinero en vez de inventarla en cada historia.
- **Sí:** validar el máximo de cada columna. Razón (decisión técnica de esta sesión): hoy un costo de 7 dígitos enteros revienta como `500`.
- **Sí:** el mismo helper duplicado en `src/app/shared/money.ts` y `backend/src/lib/money.ts`. Razón (decisión técnica de esta sesión): frontend y backend son proyectos independientes sin paquete compartido; sus pruebas cubren los mismos casos para que no diverjan.
- **Sí:** redondeo a centavos mitad hacia arriba, una sola vez al final, como convención para M2/M3. Razón (decisión técnica de esta sesión): es la práctica usual en caja; el spec de la primera historia de M3 puede revisarla con el negocio antes de implementarla.
- **Sí:** tarea Jira `SCRUM-29 · T-08`, después de T-06. Razón (decisión del usuario): una tarea por spec; necesita los validadores que crea T-06.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los helpers del frontend y del backend divergen | Mismo contrato (§4) y los mismos casos de prueba en `money.test.ts` y `money.spec.ts` |
| Un `<input type="number">` entrega valores como `"4.5e2"` o pierde el texto exacto | El formulario lee el texto tal cual lo escribió el usuario y `toMinorUnits` rechaza notación científica con un error claro |
| Algún cliente sigue mandando `number` con artefactos de flotante (`0.30000000000000004`) | `requireMoney` lo rechaza por decimales de más (`422`), en vez de guardarlo redondeado |
| La convención de redondeo de M3 no coincide con lo que espera el negocio | Queda escrita como convención revisable; la primera historia de M3 la confirma |
