# Spec técnico — T-41 · Base de recepción: leer la remisión del proveedor y registrar la entrada a bodega (backend)

> **Estado:** Aprobado
> **Depende de:**
> - M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`): las piezas solo cambian insertando `stock_movements` con `insertMovements`, y el trigger mantiene `products.stock`.
> - M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`): el costo viaja como texto, con hasta 4 decimales y sin redondeo silencioso.
> - M5-t24-base-fraccionado (`specs/M5-t24-base-fraccionado/spec.md`): de ahí sale el patrón de tabla propia con `request_id` único más una columna de enlace en `stock_movements`.
> - M9-t36-base-resurtir (`specs/M9-t36-base-resurtir/spec.md`): de ahí salen la forma del módulo solo para administrador, la idempotencia con candado y el límite de 200 renglones.
> - HU-27 «Entrada a bodega» (`SCRUM-77`, módulo `@purchases`, sin carpeta de spec): registra una sola entrada por petición. Este spec no lo cambia; reusa `MAX_QTY` y `PRODUCT_INACTIVE`.
> **Fecha:** 2026-11-11
> **Objetivo:** que el administrador suba la remisión del proveedor (Excel, PDF o imagen), reciba del backend los renglones propuestos y, al confirmar, registre en una sola operación idempotente las entradas `purchase` de los productos reconocidos, y deje como pendientes los productos nuevos y los cambios de costo.

Fuentes:

- **Jira:** tarea `SCRUM-103 · T-41`, épica `SCRUM-79 · M9 · Resurtir y exportar (v2)`. Requerimientos RF-32 y RF-33. Bloquea a HU-42 (`SCRUM-104`, pantallas «Cargar remisión» y «Productos nuevos»). Se relaciona con T-38 (`SCRUM-93`, importar el inventario desde el Excel).
- **Código:**
  - `backend/src/purchases/purchases.ts`: `createPurchase`, `findReplay` y el candado `pg_advisory_xact_lock`, el modelo de idempotencia a seguir.
  - `backend/src/products/products.ts`: `createProduct`, `priceBelowCost` y `updateProduct`.
  - `backend/src/stock/movements.ts`: `insertMovements`.
  - `backend/src/db/transaction.ts`: `withTransaction` y `lockRows`.
  - `backend/app/api/products/photo/route.ts`: cómo una ruta lee un archivo con `request.formData()`.
  - `supabase/migrations/20261030000000_stock_movements_request_id.sql`: el índice `stock_movements_request_holder_key` es único por `(request_id, titular)`.
  - `supabase/migrations/20261107000000_fractions.sql`: la columna `fraction_id` y su check de tipo.
- **Decisiones del usuario del 2026-11-11** (§9). Cierran el «Por decidir» de `SCRUM-103`.
- **Remisión real** (paso 0, 2026-11-11): `references/WhatsApp Image 2026-07-29 at 10.27.24.jpeg`, una captura del Excel del proveedor. `references/` está en `.gitignore`, así que no se sube. Columnas: «Nombre | Precio Mayoreo | Precio Distribuidor | Cant. Mayoreo | Cant. Distribuidor | Total Mayoreo | Total Distribuidor», y al final una fila «ENVIO». Los nombres traen etiquetas como `*OFERTA*`, `*NUEVO*`, `*CAD 07/27` o `"NUEVA PRESENTACIÓN"`. El proveedor manda a veces el Excel y a veces solo la imagen.

## 1. Por qué existe este spec

Hoy la mercancía que llega se captura producto por producto con «Entrada a bodega» (HU-27). El proveedor ya manda una remisión con todo el pedido (RF-32, RF-33). Este spec hace que el backend:

- la lea;
- proponga el producto que corresponde a cada renglón;
- registre todo junto al confirmar.

Hay dos razones para no reusar `@purchases`:

- **Idempotencia.** El índice `stock_movements_request_holder_key` es único por `(request_id, titular)`. Una remisión tiene varios renglones, todos de la bodega, así que no caben bajo un solo `requestId` en `stock_movements`. Se usa el patrón de `fractions`: una tabla propia con `request_id` único, más una columna de enlace en el movimiento.
- **Pendientes.** Los renglones que no se pueden registrar al momento (un producto que no existe, o un costo distinto al guardado) se tienen que guardar para resolverlos después. Eso necesita tablas propias.

## 2. Alcance

**Entra en este spec:**

- **Base:** la migración `supabase/migrations/20261111000000_supplier_receipts.sql` (§4) con:
  - las tablas `supplier_receipts`, `supplier_receipt_lines` y `supplier_product_aliases`;
  - la columna `stock_movements.receipt_line_id`.
- **Dependencias del backend:**
  - `exceljs` `4.4.0`, la misma versión que ya usa el frontend.
  - `@google/genai`, con la versión exacta vigente al implementar (sin `^`). Reemplaza a `@anthropic-ai/sdk` (decisión del usuario del 2026-11-12, §9), que se desinstala.
- **Variable de entorno:** `GEMINI_API_KEY` (opcional; sin ella solo se lee Excel) en `backend/.env` y `backend/.env.example`, documentada en `backend/README.md`. `ANTHROPIC_API_KEY` se quita de los dos.
- **Cambios en `@products`, sin cambiar su comportamiento actual:**
  - `insertProduct(tx, input)`: el `insert` de `products` sale de `createProduct`, que pasa a usarlo.
  - `setUnitCost(tx, id, unitCost)`: cambia solo el costo de fábrica.
  - `productsForMatching()`: id, nombre, imagen, costo, piezas en bodega y `active` de todos los productos.
- **Módulo nuevo `backend/src/receipts/`** con alias `@receipts` en `backend/tsconfig.json`. Archivos:
  - `index.ts`, `constants.ts` y `types.ts`;
  - `access.ts`: `requireAdmin`;
  - `normalize.ts`: normaliza nombres;
  - `readers/excel-reader.ts` y `readers/gemini-reader.ts` (PDF e imagen);
  - `preview.ts`, `receipts.ts` y `pending.ts`: los casos de uso.
- **Casos de uso, todos solo administrador:**
  - `previewReceipt`;
  - `confirmReceipt` y `getReceipt`;
  - `listPendingReceiptLines`;
  - `createProductFromLine` y `discardLine`;
  - `acceptLineCost` y `rejectLineCost`.
- **Rutas:**
  - `backend/app/api/receipts/preview/route.ts` (`POST` multipart)
  - `backend/app/api/receipts/route.ts` (`POST`)
  - `backend/app/api/receipts/[requestId]/route.ts` (`GET`)
  - `backend/app/api/receipts/pending/route.ts` (`GET`)
  - `backend/app/api/receipts/lines/[id]/product/route.ts` (`POST`)
  - `backend/app/api/receipts/lines/[id]/discard/route.ts` (`POST`)
  - `backend/app/api/receipts/lines/[id]/cost/accept/route.ts` (`POST`)
  - `backend/app/api/receipts/lines/[id]/cost/reject/route.ts` (`POST`)
- **`backend/src/db/schema.ts`:** regenerado con `db:pull`, más los fixups de `CLAUDE.md`.
- **Pruebas** contra la base real en un archivo nuevo, `backend/tests/receipts.test.ts` (§7). No se toca ningún test que ya tenga commit.

**No entra en este spec:**

- Las pantallas «Cargar remisión» y «Productos nuevos / Cambios de costo» con su filtro (HU-42, `SCRUM-104`), ni ningún cambio en el frontend.
- Guardar el archivo original (Supabase Storage). El archivo se lee en memoria y se descarta.
- Ligar la remisión a un pedido de resurtir cerrado (T-36) o comparar lo pedido contra lo recibido.
- El proveedor como dato o catálogo (pendiente heredado de la v1), y el código del proveedor en `products`.
- Emparejar por parecido (`pg_trgm`) o con IA. Solo hay alias y nombre normalizado.
- Un borrador de remisión guardado: la vista previa no se guarda.
- Excel antiguo (`.xls`), CSV, e imágenes que no sean JPG o PNG (WebP, HEIC).
- El costo de envío de la fila «ENVIO»: se ignora.
- Cambiar el precio de venta al aceptar un costo nuevo.
- Reabrir un pendiente ya resuelto, o deshacer una remisión confirmada.
- Cambios en `@purchases`, en `@restock`, en el seed o en la importación del inventario (T-38).

## 3. Reglas de negocio

### Quién

Solo el **administrador** usa los casos de uso y las rutas de este spec. Un vendedor recibe `403`.

### Normalizar un nombre (`normalize.ts`)

Pasos, en este orden:

1. Minúsculas.
2. Quitar acentos (NFD sin marcas diacríticas).
3. Cambiar cualquier carácter que no sea letra o dígito por un espacio.
4. Juntar los espacios repetidos y recortar los extremos.

Ejemplo: «Proteína  WHEY-Gold 2 lb» → `proteina whey gold 2 lb`.

`normalizeName` se usa tal cual para reconocer encabezados de Excel.

**Etiquetas del proveedor (`stripSupplierTags`).** El proveedor agrega al nombre etiquetas que cambian entre remisiones (`*OFERTA*`, `*NUEVO*`, `*CAD 07/27`, `"NUEVA PRESENTACIÓN"`, `*EDICION LIMITADA*`).

- Se corta el nombre desde el primer `*`, `"`, `“` o `”` hasta el final, y se recortan los espacios de los extremos.
- Si no queda nada, el renglón va a `skipped` con `missing_name`.
- Ejemplo: «RAW CREATINE MONOHYDRATE 250 SERV UNFLAVORED \*NUEVO\*» → «RAW CREATINE MONOHYDRATE 250 SERV UNFLAVORED».

**Llave para emparejar (`matchKey`)** = `normalizeName(stripSupplierTags(readName))`. Se usa para:

- emparejar con el catálogo (el nombre del producto pasa solo por `normalizeName`);
- guardar alias al confirmar y al dar de alta un pendiente.

`readName` siempre guarda el texto original, con etiquetas.

### Vista previa (`POST /api/receipts/preview`)

**Archivo**

- Va en el campo `file`.
- Pesa hasta 10 MB; si pesa más, `422`. Una imagen pesa hasta 5 MB (`MAX_IMAGE_BYTES`: una captura o foto de remisión pesa mucho menos, y así el envío en línea a la API queda acotado); si pesa más, `422` «La imagen pesa más de 5 MB».
- El tipo se decide por los primeros bytes, no por la extensión:
  - `%PDF` → PDF;
  - `PK` → `.xlsx`;
  - `FF D8 FF` → imagen `image/jpeg`;
  - `89 50 4E 47` → imagen `image/png`;
  - cualquier otro → `422` «Solo se aceptan remisiones en PDF, Excel (.xlsx) o imagen (JPG o PNG)».

**Excel (`excel-reader.ts`)**

- Se lee la primera hoja.
- **Encabezado.** Es la primera fila, dentro de las primeras 20, que tiene a la vez una celda de producto y una de piezas, comparando el texto ya normalizado contra los sinónimos de `constants.ts`:
  - producto: `producto`, `descripcion`, `nombre`, `articulo`, `concepto`;
  - piezas: `cant distribuidor`, `cantidad`, `cant`, `piezas`, `pzas`, `unidades`;
  - costo (opcional): `precio distribuidor`, `costo`, `costo unitario`, `precio unitario`, `p u`, `precio`.
- La comparación es por igualdad exacta: «Cant. Mayoreo» (`cant mayoreo`), «Precio Mayoreo» y las columnas «Total …» no coinciden y se ignoran. Si en el encabezado coinciden varias celdas del mismo tipo, gana la del sinónimo que va primero en la lista.
- Sin encabezado → `422` «No encontré las columnas de producto y piezas en la remisión».
- **Filas que se ignoran sin motivo:**
  - vacías;
  - cuyo nombre normalizado es `total`, `subtotal`, `iva`, `descuento` o `envio`.
- **Piezas.**
  - Se acepta un número entero, o un texto que solo tiene dígitos.
  - Tienen que ir de 1 a `MAX_QTY`. Una celda vacía o `0` va a `skipped` con `invalid_qty`: en la remisión real es un producto que se listó pero no se surtió («BLOOM SPARKLING…», total `0.00`), y el administrador lo ve como no leído.
- **Costo.**
  - Se lee el texto que muestra la celda (`cell.text`), no el `number` interno. Así no aparece ruido de flotante como `12.300000000001`.
  - Se quitan `$`, los espacios y las comas de miles.
  - Tiene que tener a lo más 4 decimales (`decimalPlaces`), estar entre `0` y `999999.9999`, y **nunca se redondea**.
  - Una celda de costo vacía da `unitCost: null`.

**PDF e imagen (`gemini-reader.ts`)**

- Los dos se mandan a la API de Gemini (Google, capa gratuita de Google AI Studio) con su SDK oficial `@google/genai`, y comparten la llamada, el esquema y las instrucciones:
  - el modelo es la constante `RECEIPT_AI_MODEL`: un modelo Flash de Gemini incluido en la capa gratuita. Su id exacto se confirma en Google AI Studio al crear la clave y la prueba real lo valida;
  - el archivo va como `inlineData` en base64 con su `mimeType` (`application/pdf`, `image/jpeg` o `image/png`), seguido de un texto corto;
  - la salida es JSON con un esquema fijo (`responseMimeType: 'application/json'` más el esquema): `{ lines: [{ name: string, qty: integer | null, unitCost: string | null }] }`;
  - la instrucción (`RECEIPT_AI_INSTRUCTIONS` en `constants.ts`) pide:
    - copiar los textos tal como aparecen, sin calcular nada;
    - si hay columnas de Mayoreo y de Distribuidor, tomar piezas de «Cant. Distribuidor» y costo de «Precio Distribuidor»;
    - omitir las filas de totales y de envío.
- **Límites:**
  - PDF: 20 páginas, contadas con la heurística de `/Type /Page` sobre los bytes. Con más → `422` antes de llamar a la API;
  - imagen: 5 MB (ver «Archivo»);
  - un tiempo de espera de 60 s, sin reintentos.
- **Errores:**
  - sin `GEMINI_API_KEY` → `500` con el mensaje «La lectura de PDF e imágenes no está configurada»;
  - una falla de la API, un límite de la capa gratuita agotado (`429`), un tiempo agotado o una respuesta bloqueada o que no cumple el esquema → `500` «No se pudo leer el archivo; intenta de nuevo o sube el Excel».
- La salida del modelo **no se confía**. Cada renglón pasa por las mismas validaciones (etiquetas, piezas y costo) que el Excel.
- **Inyección para pruebas.** Los lectores se reciben como dependencia: `previewReceipt(file, actor, deps = { readPdf, readImage })`. Las pruebas pasan unos falsos, y la ruta usa los reales.

**Renglones que no se leen**

Van a `skipped`, con `{ position, text, reason }`. Los motivos (`SkipReason`), con su etiqueta en `constants.ts`:

| `reason` | Etiqueta |
| --- | --- |
| `missing_name` | «Falta el nombre del producto» |
| `invalid_qty` | «Las piezas no son un número entero mayor a 0» |
| `invalid_cost` | «El costo no es válido» |
| `inactive_product` | «Producto desactivado» |

- Más de 200 renglones leídos (sumando `lines` y `skipped`) → `422`.
- Ningún renglón válido → `200` con `lines: []`. La pantalla de HU-42 muestra el estado vacío.

**Emparejar cada renglón, en este orden**

La llave del renglón es `matchKey(readName)`.

1. **Alias:** hay un `supplier_product_aliases` con esa llave como `normalized_name` y su producto está activo → `match: 'alias'`. Un alias cuyo producto está desactivado se ignora y se sigue al paso 2.
2. **Nombre:** hay exactamente un producto activo cuyo `normalizeName(name)` es igual a la llave → `match: 'name'`.
   - Si hay más de uno, se trata como sin emparejar.
   - Si solo coincide un producto desactivado, el renglón va a `skipped` con `inactive_product`.
3. **Sin emparejar** → `match: 'none'` y `product: null`.

Las bolsitas activas sí se emparejan, igual que en HU-27.

**Cada renglón propuesto trae:**

- `position` y `readName` (el texto tal cual);
- `suggestedName`: `stripSupplierTags(readName)` sin espacios repetidos ni en los extremos, con las mayúsculas originales;
- `qty` y `unitCost`;
- `match`, y `product` (`{ id, name, image, unitCost }`) o `null`;
- `costChanged`: `true` si hay producto, el costo leído no es `null` y `compareMoney(unitCost, 4, product.unitCost, 4) !== 0`.

**Bodega antes → después**

- `stock` trae `{ productId, before, after }` por producto emparejado.
- `before` es el `products.stock` actual.
- `after` es `before` más la suma de las piezas de todos los renglones de ese producto en el archivo.

**La vista previa no escribe nada:** ni remisión, ni alias, ni movimientos.

### Confirmar (`POST /api/receipts`)

**Cuerpo:**

```json
{
  "requestId": "<uuid>",
  "source": "excel | pdf | image",
  "fileName": "<texto o null>",
  "lines": [
    { "readName": "...", "qty": 0, "unitCost": "<texto o null>", "productId": 0 }
  ]
}
```

- `productId` es un número o `null`.
- Son los renglones finales: HU-42 puede haber cambiado el producto o las piezas que propuso la vista previa.

**Validaciones (todas `422` salvo donde se indica):**

- `requestId` tiene que ser un UUID.
- De 1 a 200 renglones.
- `readName`: de 1 a 200 caracteres.
- `qty`: entero de 1 a `MAX_QTY`.
- `unitCost`: texto o número con `requireMoney` a `scale: 4`, o `null`.
- `fileName`: hasta 255 caracteres, o `null`.
- Si un `productId` no existe → `404`.
- Si un `productId` está desactivado → `409` con `PRODUCT_INACTIVE`, y no se registra nada de la remisión.
- Un mismo producto puede venir en dos renglones: cada uno es su propia entrada.

**Qué hace, en una sola transacción:**

1. Toma el candado `pg_advisory_xact_lock(hashtext(requestId))` y vuelve a buscar la remisión por `requestId`.
2. Inserta `supplier_receipts` y sus renglones en el orden recibido (`position` desde 1).
3. **Renglón con producto** → `status 'received'`, y un movimiento `purchase` con:
   - la bodega como titular (`holder_profile_id null`);
   - `qty > 0`;
   - `request_id null`;
   - `receipt_line_id` igual al id del renglón.

   Además:
   - Si el costo leído no es `null` y difiere de `products.unit_cost` → `cost_status 'pending'`, con `previous_unit_cost` igual al costo del producto en ese momento.
   - Si no difiere, o no hay costo → `cost_status null`.
   - **Las piezas entran ya**: solo el cambio de costo queda pendiente.
   - **Nunca cambia `products.unit_cost`.**
4. **Renglón sin producto** → `status 'pending'` («Producto nuevo»). No mueve inventario y guarda las piezas y el costo leídos.
5. **Alias:** cada renglón con producto hace un *upsert* de `matchKey(readName)` → `productId`. Si el administrador cambió el emparejamiento, gana el último.

**Respuesta:** `201` con `{ receipt, replayed: false }`.

`receipt` trae:

- `requestId`, `source`, `fileName` y `createdAt`;
- `lines`, con `id`, `position`, `readName`, `qty`, `unitCost`, `status`, `costStatus` y `product` o `null`;
- `units`: `{ productId, units }`, con el `products.stock` leído después del commit.

**Idempotencia:**

- **Mismo `requestId` y mismos datos** → `200` con `replayed: true`, sin otra remisión ni otros movimientos.
  - Se compara `source` y los renglones en orden: `readName`, `qty`, `unitCost` (con `compareMoney`) y `productId`.
  - `fileName` no cuenta.
- **Otros datos** → `409` «Esta remisión ya se registró con otros datos.».
- **Dos peticiones iguales a la vez** dejan una sola remisión: el candado, más `isUniqueViolation` sobre `supplier_receipts_request_id_key`.

**`GET /api/receipts/[requestId]`** devuelve la misma forma, con los estados actuales de cada renglón. Si el `requestId` no existe, `404`.

### Pendientes (`GET /api/receipts/pending`)

Responde `{ newProducts, costChanges }`. Cada lista trae a lo más 100 renglones, del más nuevo al más viejo (`created_at` de la remisión, luego `position`).

- **`newProducts`:** renglones con `status 'pending'`. Cada uno trae:
  - `lineId`;
  - `receipt`: `{ requestId, createdAt }`;
  - `suggestedName`, `qty` y `unitCost` (o `null`).
- **`costChanges`:** renglones con `cost_status 'pending'`. Cada uno trae:
  - `lineId` y `receipt`;
  - `product`: `{ id, name, image, active }`;
  - `qty`;
  - `currentUnitCost`: el `products.unit_cost` de hoy;
  - `previousUnitCost`: el de cuando se confirmó;
  - `newUnitCost`: el leído.
- El filtro entre los dos apartados es de HU-42: el backend manda las dos listas juntas.

### Resolver un pendiente

Reglas comunes:

- Cada acción bloquea el renglón con `lockRows` dentro de `withTransaction`.
- Si ya no está pendiente → `409` «Este pendiente ya se resolvió.».
- Si el renglón no existe → `404`.

**Dar de alta un producto nuevo (`POST …/lines/[id]/product`)**

- **Cuerpo:** `{ name, price, categoryId, unitCost? }`.
- **Costo:**
  - `unitCost` es opcional y, si no viene, se usa el leído.
  - Si no hay ninguno de los dos → `422` «Falta el costo de fábrica».
- **Validaciones de `createProduct`:**
  - nombre duplicado → `409` `DUPLICATE_NAME`;
  - categoría que no existe → `422`;
  - precio menor que el costo → `422` `PRICE_BELOW_COST`.
- **En una transacción:**
  1. `insertProduct(tx, …)` con `stock = 0`, sin fraccionar y sin foto.
  2. Un `purchase` de la bodega por las piezas del renglón, con su `receipt_line_id`.
  3. El renglón pasa a `status 'created'`, con su `product_id`, `resolved_at` y `resolved_by`.
  4. *Upsert* del alias `matchKey(readName)` → el producto nuevo.
- **Respuesta:** `201` con `{ product, line, stock: { before: 0, after: qty } }`.

**Descartar un producto nuevo (`POST …/lines/[id]/discard`)**

- El renglón pasa a `status 'discarded'`: sus piezas nunca entran.
- **Respuesta:** `200` con `{ line }`.

**Aceptar un costo nuevo (`POST …/lines/[id]/cost/accept`)**

- Exige `cost_status 'pending'`.
- Producto desactivado → `409` `PRODUCT_INACTIVE`.
- Si `price` es menor que el costo nuevo → `422` «El precio de venta es menor que el costo nuevo; edita el precio primero» (`COST_ABOVE_PRICE`).
- Si todo pasa:
  - `setUnitCost(tx, productId, newUnitCost)`;
  - el renglón pasa a `cost_status 'accepted'`.
- **Respuesta:** `200` con `{ line, product: { id, unitCost } }`.
- Otros cambios de costo pendientes del mismo producto (de otras remisiones) siguen pendientes.

**Rechazar un costo nuevo (`POST …/lines/[id]/cost/reject`)**

- El renglón pasa a `cost_status 'rejected'`; el costo del producto no cambia.
- **Respuesta:** `200` con `{ line }`.

## 4. Modelo de datos

Migración `supabase/migrations/20261111000000_supplier_receipts.sql`:

```sql
-- T-41: remisiones del proveedor. Confirmar una remisión registra una entrada `purchase` por renglón
-- con producto; los renglones sin producto y los cambios de costo quedan pendientes. La
-- idempotencia es por supplier_receipts.request_id: el índice stock_movements_request_holder_key
-- es por (request_id, titular) y todos los renglones son de la bodega. RLS la activa el event
-- trigger rls_auto_enable del baseline; el backend entra con la conexión directa.

create table public.supplier_receipts (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  source text not null,
  file_name text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  constraint supplier_receipts_request_id_key unique (request_id),
  constraint supplier_receipts_source_check check (source in ('excel', 'pdf', 'image')),
  constraint supplier_receipts_file_name_check check (file_name is null or char_length(file_name) between 1 and 255)
);

create index supplier_receipts_created_at_idx on public.supplier_receipts (created_at desc);

create table public.supplier_receipt_lines (
  id bigint generated always as identity primary key,
  receipt_id bigint not null references public.supplier_receipts (id) on delete restrict,
  position integer not null check (position > 0),
  read_name text not null check (char_length(read_name) between 1 and 200),
  qty integer not null check (qty > 0),
  unit_cost numeric(10,4) check (unit_cost is null or unit_cost >= 0),   -- costo leído de la remisión
  product_id bigint references public.products (id) on delete restrict,
  status text not null,
  cost_status text,
  previous_unit_cost numeric(10,4),   -- products.unit_cost al confirmar, solo con cost_status
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  constraint supplier_receipt_lines_position_key unique (receipt_id, position),
  constraint supplier_receipt_lines_status_check
    check (status in ('received', 'pending', 'created', 'discarded')),
  constraint supplier_receipt_lines_product_check
    check ((status in ('received', 'created')) = (product_id is not null)),
  constraint supplier_receipt_lines_cost_status_check
    check (cost_status is null or (cost_status in ('pending', 'accepted', 'rejected')
      and status = 'received' and unit_cost is not null and previous_unit_cost is not null))
);

create index supplier_receipt_lines_pending_idx on public.supplier_receipt_lines (receipt_id)
  where status = 'pending' or cost_status = 'pending';

create table public.supplier_product_aliases (
  id bigint generated always as identity primary key,
  normalized_name text not null check (char_length(normalized_name) between 1 and 200),
  product_id bigint not null references public.products (id) on delete restrict,
  updated_by uuid not null references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint supplier_product_aliases_name_key unique (normalized_name)
);

alter table public.stock_movements
  add column receipt_line_id bigint references public.supplier_receipt_lines (id) on delete restrict,
  add constraint stock_movements_receipt_line_type_check
    check (receipt_line_id is null or type = 'purchase');

-- Una sola entrada por renglón: protege el alta de un pendiente contra un doble clic.
create unique index stock_movements_receipt_line_key on public.stock_movements (receipt_line_id)
  where receipt_line_id is not null;
```

Tipos de `backend/src/receipts/types.ts`. Son los nombres reales; los campos son los de §3:

```ts
export type ReceiptSource = 'excel' | 'pdf' | 'image'
export type ReceiptImageType = 'image/jpeg' | 'image/png'
export type MatchKind = 'alias' | 'name' | 'none'
export type SkipReason = 'missing_name' | 'invalid_qty' | 'invalid_cost' | 'inactive_product'
export type ReceiptLineStatus = 'received' | 'pending' | 'created' | 'discarded'
export type CostStatus = 'pending' | 'accepted' | 'rejected'

// Lo que devuelve un lector (Excel o PDF) antes de validar: textos crudos.
export interface RawReceiptLine { position: number; name: string | null; qty: unknown; unitCost: unknown }
export type PdfReader = (bytes: Uint8Array) => Promise<RawReceiptLine[]>
export type ImageReader = (bytes: Uint8Array, mediaType: ReceiptImageType) => Promise<RawReceiptLine[]>

export interface ReceiptPreview {
  source: ReceiptSource
  lines: PreviewLine[]
  skipped: { position: number; text: string; reason: SkipReason; label: string }[]
  stock: { productId: number; before: number; after: number }[]
}

export interface ConfirmReceiptInput {
  requestId: string
  source: ReceiptSource
  fileName: string | null
  lines: { readName: string; qty: number; unitCost: string | null; productId: number | null }[]
}
```

`PreviewLine`, `Receipt`, `ReceiptLine`, `PendingReceiptLines` y `ReceiptActor` siguen las formas de §3.

## 5. Plan de implementación

0. **Formato real de la remisión.** ✅ Hecho el 2026-11-11 con la imagen de `references/` (ver «Fuentes»). Ajustó §3: sinónimos de Distribuidor, la fila `envio`, `stripSupplierTags`/`matchKey` y la lectura de imágenes. No se sube ningún binario: las pruebas arman en memoria un Excel con el mismo encabezado, y la prueba real con Gemini lee la imagen local si existe.
1. **Migración.**
   - Escribir `supabase/migrations/20261111000000_supplier_receipts.sql` (§4) y comprobarla con `npm run db:reset`.
   - Aplicarla a producción a mano en el SQL Editor:
     - Revisión de solo lectura: `select to_regclass('public.supplier_receipts'), to_regclass('public.supplier_receipt_lines'), to_regclass('public.supplier_product_aliases')` da tres `null`. Además, `select column_name from information_schema.columns where table_name = 'stock_movements' and column_name in ('receipt_line_id', 'fraction_id')` da solo `fraction_id`.
     - La migración dentro de `begin; … commit;`.
     - Verificación: `select relname, relrowsecurity from pg_class where relname in ('supplier_receipts', 'supplier_receipt_lines', 'supplier_product_aliases')` da tres filas con `true`.
   - Correr `npm run db:pull` en `backend/` (con `.env` en PRODUCCIÓN) y aplicar los fixups de `CLAUDE.md`.
   - Al terminar el paso, `npm run type-check` y `npm test` pasan sin cambios.
2. **`@products`.**
   - Extraer `insertProduct(tx, input)` de `createProduct`, que lo sigue usando con su movimiento `initial`.
   - Agregar `setUnitCost(tx, id, unitCost)` y `productsForMatching()`.
   - Los tests de productos con commit pasan sin cambios.
3. **Módulo `receipts`.**
   - Crear `backend/src/receipts/`: `index.ts`, `constants.ts` (mensajes, sinónimos, motivos, límites, `RECEIPT_AI_MODEL` y `RECEIPT_AI_INSTRUCTIONS`), `types.ts`, `access.ts` y `normalize.ts`.
   - Agregar el alias `@receipts` en `backend/tsconfig.json`.
   - `npm run type-check` pasa.
4. **Excel y vista previa.**
   - Instalar `exceljs@4.4.0` en `backend/`.
   - Escribir `readers/excel-reader.ts` y `preview.ts`: detección del tipo, validación de renglones, emparejamiento y `stock`. Las ramas de PDF e imagen ya llaman a `deps.readPdf` / `deps.readImage`; sin lector real todavía.
   - Escribir la ruta `preview`. Al terminar, la vista previa con Excel funciona de punta a punta.
5. **Confirmar y releer.** `receipts.ts`, con `confirmReceipt` (transacción, candado, `findReplay`, movimientos y alias) y `getReceipt`, más sus dos rutas.
6. **Pendientes.** `pending.ts`, con la lista y las cuatro acciones, más sus rutas.
7. **PDF e imagen con Gemini.** (Se implementó primero con Claude; el 2026-11-12 se cambió a Gemini por costo, §9.)
   - Desinstalar `@anthropic-ai/sdk` e instalar `@google/genai` con la versión exacta.
   - Reemplazar `readers/claude-reader.ts` por `readers/gemini-reader.ts`: modelo, `inlineData` en base64, salida JSON con esquema, instrucciones, límite de páginas y tiempo de espera.
   - Conectar `readPdf` y `readImage` por omisión en la ruta.
   - Cambiar `ANTHROPIC_API_KEY` por `GEMINI_API_KEY` en `backend/.env.example` y en `backend/README.md` (cómo sacar la clave gratis en Google AI Studio y el aviso de uso de datos de la capa gratuita). No se agrega a CI; la prueba real se salta sin la clave.
8. **Pruebas.** Escribir `backend/tests/receipts.test.ts` (§7) y correr `npm run type-check`, `npm run build` y `npm test` con `SUPABASE_SERVICE_ROLE_KEY`.
9. **Índice y Jira.**
   - Actualizar `specs/README.md`: estado y relaciones.
   - Comentar el avance en `SCRUM-103`: el paso del plan y ✅/❌/⏳ por criterio.
   - Moverla En curso → In review.
   - Recordar que la migración tiene que estar en producción antes de desplegar HU-42.

## 6. Criterios de aceptación

**Migración**

- [ ] Pasa con `npm run db:reset`.
- [ ] En producción deja las tres tablas con RLS activo y `stock_movements.receipt_line_id`.

**Vista previa**

- [ ] Con un Excel con encabezado «Descripción | Cant. | Costo unitario», tres productos, una fila «TOTAL» y una fila vacía, devuelve tres `lines` y nada en `skipped`.
- [ ] Con un Excel con el formato del proveedor («Nombre | Precio Mayoreo | Precio Distribuidor | Cant. Mayoreo | Cant. Distribuidor | Total Mayoreo | Total Distribuidor» y una fila «ENVIO»), las piezas salen de «Cant. Distribuidor», el costo de «Precio Distribuidor» (`1,580.00` → `"1580.00"`), y «ENVIO» no aparece ni en `lines` ni en `skipped`. Una fila con «Cant. Distribuidor» vacía va a `skipped` con `invalid_qty`.
- [ ] Etiquetas: «DRAGON CREATINE MONOHYDRATE 1 KG UNFLAVORED \*OFERTA\*» empareja por nombre con el producto «Dragon Creatine Monohydrate 1 kg Unflavored»; «… \*CAD 07/27» y «… "NUEVO"» también se cortan; `suggestedName` sale sin la etiqueta y `readName` la conserva. El alias guardado al confirmar es la llave sin etiqueta, así que la siguiente remisión con `*NUEVO*` en vez de `*OFERTA*` empareja por alias.
- [ ] La vista previa no agrega filas a `supplier_receipts`, `supplier_receipt_lines`, `supplier_product_aliases` ni `stock_movements`, y no cambia `products.stock`.
- [ ] Emparejamiento:
  - un renglón con alias guardado sale con `match: 'alias'`;
  - «PROTEÍNA whey» contra el producto «Proteína Whey» sale con `match: 'name'`;
  - un nombre desconocido sale con `match: 'none'` y `suggestedName`;
  - un nombre igual a un producto desactivado va a `skipped` con `inactive_product`.
- [ ] Un alias que apunta a un producto desactivado se ignora: si hay un activo con el mismo nombre, el renglón sale con `match: 'name'`.
- [ ] `costChanged` es `true` solo si hay costo leído y difiere del `unit_cost` del producto (`12.5` contra `12.5000` da `false`).
- [ ] Los renglones con piezas `0`, `-1`, `2.5` o `abc` van a `skipped` con `invalid_qty`. Un costo `12.34567` va con `invalid_cost` y nunca se redondea.
- [ ] `stock` trae `before` y `after` por producto, y suma dos renglones del mismo producto.
- [ ] Responden `422`:
  - un archivo de más de 10 MB;
  - un `.xls`, un `.csv` o una imagen WebP/GIF;
  - una imagen JPG o PNG de más de 5 MB;
  - un Excel sin encabezado reconocible;
  - más de 200 renglones;
  - un PDF de más de 20 páginas.
- [ ] Con un `readPdf` falso que devuelve dos renglones válidos y uno con `qty: null`, la vista previa de un PDF trae dos `lines` y un `skipped`, con `source: 'pdf'`.
- [ ] Con un `readImage` falso, una imagen JPG y otra PNG (bytes mínimos con su firma) dan `source: 'image'`, y el lector recibe `image/jpeg` o `image/png` según los bytes. Un renglón con etiqueta que devuelve el lector se corta igual que en Excel.
- [ ] Sin `GEMINI_API_KEY`, los lectores reales responden `500` «La lectura de PDF e imágenes no está configurada», tanto con PDF como con imagen.

**Confirmar**

- [ ] Con dos renglones con producto (uno con costo distinto) y uno sin producto, `POST /api/receipts` responde `201`:
  - dos `purchase` de la bodega con su `receipt_line_id` y `request_id null`;
  - la bodega de cada producto sube sus piezas;
  - el renglón con costo distinto queda `received` + `cost_status 'pending'`, con `previous_unit_cost`;
  - `products.unit_cost` no cambia;
  - el renglón sin producto queda `pending` sin movimiento;
  - se guardan dos alias.
- [ ] Repetir con el mismo `requestId` y los mismos datos responde `200` y `replayed: true`, sin otra remisión ni movimientos. Con otros datos responde `409` «Esta remisión ya se registró con otros datos.».
- [ ] Dos confirmaciones iguales a la vez (`Promise.all`) dejan una sola remisión y una sola entrada por renglón.
- [ ] Un `productId` desactivado responde `409` `PRODUCT_INACTIVE` y no deja remisión ni movimientos. Uno inexistente responde `404`.
- [ ] Responden `422`:
  - `qty` fuera de rango;
  - `unitCost` con 5 decimales;
  - `lines` vacío o con más de 200 renglones;
  - `readName` vacío;
  - un `requestId` que no es UUID.
- [ ] Confirmar con otro producto para un nombre que ya tenía alias reemplaza el alias.
- [ ] `GET /api/receipts/[requestId]` devuelve la remisión con los estados actuales. Uno inexistente responde `404`.

**Pendientes**

- [ ] `GET /api/receipts/pending` trae el renglón sin producto en `newProducts` y el cambio de costo en `costChanges`, con `currentUnitCost`, `previousUnitCost` y `newUnitCost`.
- [ ] Dar de alta el pendiente:
  - crea el producto con `stock = 0` más un `purchase` por sus piezas, así que la bodega queda en `qty`;
  - el renglón queda `created` con su `product_id`;
  - se guarda el alias.
  - Una segunda llamada responde `409` «Este pendiente ya se resolvió.».
- [ ] Al dar de alta: sin costo leído ni `unitCost` responde `422`; un nombre duplicado responde `409`; un precio menor que el costo responde `422`.
- [ ] Descartar deja el renglón `discarded` y sale de `newProducts`, sin movimientos.
- [ ] Aceptar un costo cambia `products.unit_cost` al costo leído y deja el renglón `accepted`.
  - Con un precio menor que el costo nuevo responde `422` `COST_ABOVE_PRICE`.
  - Con el producto desactivado responde `409`.
- [ ] Rechazar un costo deja el renglón `rejected` y no cambia `products.unit_cost`.

**Generales**

- [ ] Un vendedor recibe `403` en cada caso de uso de este spec.
- [ ] `npm run type-check`, `npm run build`, `npm test` (con `SUPABASE_SERVICE_ROLE_KEY`) y `tests/architecture.test.ts` pasan, sin cambios en tests con commit.

## 7. Plan de pruebas

Las pruebas van contra la base real. Como el resto, se saltan sin `SUPABASE_SERVICE_ROLE_KEY`.

**`backend/tests/receipts.test.ts` (nuevo)**

- **Datos:**
  - productos de prueba con el prefijo `test-rcp-` + `Date.now()`, creados con `createProduct`;
  - uno de ellos desactivado;
  - un vendedor `test-auth-` (`createTestUser`) para el `403`.
- **Archivos:**
  - Los Excel se arman en memoria con `exceljs` dentro de cada caso, no hay binarios con commit. Si el paso 0 deja una remisión anonimizada en `backend/tests/fixtures/`, se agrega un caso que la lee.
  - Los PDF de los casos sin API son unos bytes mínimos que empiezan con `%PDF`, más un `readPdf` falso. Las imágenes, bytes mínimos con la firma JPEG (`FF D8 FF`) o PNG (`89 50 4E 47`), más un `readImage` falso.
- **Casos:**
  - uno por criterio de §6, llamando a los casos de uso con un actor `{ userId, role }`, como en `fractions.test.ts`;
  - para `normalizeName`, `stripSupplierTags`, `matchKey`, `excel-reader` y la validación de renglones, pruebas puras en el mismo archivo, que no tocan la base.
- **Prueba real con Gemini:**
  - un caso con `it.skipIf(!process.env.GEMINI_API_KEY || !existsSync(<imagen>))` lee la imagen de `references/` (ruta en una constante local del test) con el `readImage` real y comprueba que devuelve al menos 20 renglones con nombre y piezas, y ninguno llamado «ENVIO»;
  - la imagen no se sube (`references/` está en `.gitignore`): en CI y en clones nuevos el caso se salta, y el job `backend-db` avisa que hay pruebas saltadas.
- **Limpieza, en este orden:**
  1. los movimientos con `receipt_line_id` de las remisiones de prueba, del más nuevo al más viejo (revierte saldos);
  2. los renglones y las remisiones;
  3. los alias `test-rcp-`;
  4. el resto de movimientos y los productos;
  5. al final, `cleanupTestData()` para el vendedor.

**Lo que no cambia**

- **Tests con commit:** ninguno. Si uno de productos falla tras extraer `insertProduct`, se corrige el código, no el test.
- **Arquitectura:** `tests/architecture.test.ts` sigue pasando.
  - Su mapa `ALIASES` no lista `@purchases`, `@restock` ni `@shrinkage`, así que tampoco revisará `@receipts`.
  - Agregarlo es tocar un test con commit y requiere aprobación del usuario.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La remisión de ejemplo es una captura, no el `.xlsx`: el texto real de las celdas de encabezado puede diferir (saltos de línea, espacios). | `normalizeName` junta espacios y quita puntuación. Los encabezados se buscan por nombre, no por posición, y los sinónimos viven en `constants.ts`, así que ajustarlos es cambiar una lista. Se confirma con el primer Excel real que llegue. |
| `stripSupplierTags` corta un nombre legítimo que tenga `*` o comillas. | No se vio ninguno en el catálogo ni en la remisión. `readName` guarda el original y HU-42 deja corregir el emparejamiento. |
| Una foto torcida o borrosa se lee mal. | Igual que el PDF: validaciones, vista previa sin escritura y corrección en HU-42. El mensaje de error sugiere el Excel. |
| El costo de Excel trae ruido de flotante, o la celda tiene formato de moneda. | Se lee `cell.text`, se limpia `$`/comas y se valida con `decimalPlaces`. Si no pasa, va a `skipped` con `invalid_cost` y nunca se redondea. |
| El modelo lee mal un PDF (piezas o nombres inventados). | La salida pasa por las mismas validaciones, la vista previa no escribe nada y HU-42 permite corregir antes de confirmar. Para remisiones críticas está el Excel. |
| El PDF o la imagen del proveedor salen hacia la API de Gemini, y en la capa gratuita Google puede usarlos para mejorar sus productos y personas pueden revisarlos. | Decisión del usuario (§9). Solo se manda el archivo, sin datos de la cuenta ni del administrador, y el archivo no se guarda. Si el proveedor lo prohíbe, se usa el Excel; si más adelante importa, se pasa a la capa de pago de Gemini, donde no se usan. |
| La capa gratuita tiene límites diarios que fija Google y que pueden cambiar, o la API falla. | Solo se llama con PDF o imagen. Tiempo de espera de 60 s, sin reintentos, y un `500` con un mensaje que sugiere el Excel; CI nunca la llama. Excel nunca depende de Gemini. |
| El modelo Flash gratuito elegido se retira o deja la capa gratuita. | El id vive en `RECEIPT_AI_MODEL` (`constants.ts`): cambiarlo es una línea. La prueba real lo valida cuando hay clave. |
| El conteo de páginas por `/Type /Page` falla con PDF comprimidos (object streams). | Es solo un tope barato antes de llamar. Si se escapa uno grande, la API responde con error y el usuario ve el `500` de lectura. |
| Dos productos activos con el mismo nombre normalizado («Whey 2lb» y «WHEY 2 LB»). | Se tratan como sin emparejar, y HU-42 elige uno. Al confirmar se guarda el alias, así que la siguiente remisión ya empareja. |
| Un alias viejo empareja mal después de renombrar productos. | El alias apunta al `product_id`, no al nombre. Si el administrador corrige el emparejamiento al confirmar, el *upsert* lo reemplaza. |
| Aceptar un costo mayor que el precio rompe la regla de HU-04. | Responde `422` `COST_ABOVE_PRICE`, y el precio se edita primero en «Editar producto». |
| La migración no está en producción al desplegar. | Se aplica en el paso 1, antes del código, y queda anotada en `SCRUM-103` y en el índice. |
| `db push` no sirve en este proyecto. | Se aplica a mano en el SQL Editor, como dice `CLAUDE.md`. Nunca `migration repair` ni `db pull` de Supabase. |
| `rls_auto_enable` no existe en producción. | La verificación del paso 1 revisa `relrowsecurity`. Si da `false`, se agrega `enable row level security` y se avisa al usuario. |

## 9. Decisiones

**Lectura**

- **Sí:** el Excel se lee con `exceljs` y columnas buscadas por encabezado, y el PDF y la imagen con un modelo de IA con salida estructurada (decisión del usuario; hoy Gemini, ver abajo).
  - **No:** todo con IA, que hace costosa y externa cada lectura de Excel.
  - **No:** plantillas de texto por proveedor, que se rompen al cambiar el formato.
  - **No:** solo Excel en este spec.
- **Sí (2026-11-12):** PDF e imagen con **Gemini** en la capa gratuita de Google AI Studio (modelo Flash en `RECEIPT_AI_MODEL`), con el lector inyectable para que las pruebas usen uno falso. La prueba real corre solo con `GEMINI_API_KEY`. Límite de 10 MB y 20 páginas (decisión del usuario).
  - **No (antes Sí):** la API de Claude con `claude-sonnet-5-5`. Leía bien, pero cuesta unos 2–4 centavos de dólar por remisión y el usuario prefirió una opción gratuita. Se implementó y se reemplazó.
  - **No:** OCR local con `tesseract.js`. Se probó contra la captura real: con la imagen agrandada lee bien ~70 % de los renglones, la columna de piezas casi no se lee y ~6 de 27 nombres salen con errores que impiden emparejar.
  - **No:** solo Excel, porque el proveedor a veces solo manda la captura.
- **Sí:** un solo spec, con la lectura del PDF como último paso del plan para que todo funcione antes con Excel (decisión del usuario).
  - **No:** dividir T-41 en dos specs.
- **Sí:** escribir el spec sin remisión de ejemplo, con el paso 0 para confirmar el formato (decisión del usuario).
- **Sí (paso 0, 2026-11-11):** leer también la remisión como imagen JPG/PNG, en este mismo spec, porque el proveedor a veces solo manda la captura (decisión del usuario). Comparte lector, esquema y validaciones con el PDF; tope de 5 MB.
  - **No:** dejar las imágenes para otro spec.
- **Sí (paso 0):** piezas de «Cant. Distribuidor» y costo de «Precio Distribuidor»; las columnas de Mayoreo se ignoran (decisión del usuario).
- **Sí (paso 0):** quitar las etiquetas del proveedor (`*OFERTA*`, `"NUEVO"`…) desde el primer `*` o comilla, tanto para emparejar y guardar alias como para `suggestedName` (decisión del usuario).
  - **No:** quitarlas solo al emparejar, o dejarlas y depender del alias.
- **Sí (paso 0):** la fila «ENVIO» se ignora; el costo de envío del proveedor queda fuera de este spec.

**Emparejar**

- **Sí:** emparejar primero por alias aprendido y luego por nombre normalizado exacto (decisión del usuario). El alias se guarda al confirmar cada renglón con producto y al dar de alta un pendiente, y gana el último (decisión del usuario).
  - **No:** parecido con `pg_trgm`, que confunde sabores y tamaños.
  - **No:** el código del proveedor en `products`.

**Vínculos y vista previa**

- **Sí:** la remisión no se liga a un pedido de resurtir y el archivo no se guarda (decisión del usuario).
- **Sí:** la vista previa no guarda nada. HU-42 corrige en pantalla y manda los renglones finales con su `requestId` (decisión del usuario).
  - **No:** un borrador de remisión con `PUT`.

**Costo**

- **Sí:** el costo leído se guarda en el renglón y **no** cambia `products.unit_cost` al confirmar (decisión del usuario).
- **Sí:** si un producto registrado llega con otro costo, el cambio queda pendiente en la misma vista que los productos nuevos, con un filtro entre los dos apartados. Aceptarlo actualiza el costo de fábrica y el precio de venta no se toca (decisión del usuario).
- **Sí:** en un producto dado de alta desde un pendiente, el costo leído es su `unit_cost` inicial.
- **Sí:** las piezas de un producto con costo distinto entran al confirmar; solo el costo espera (decisión del usuario).
  - **No:** detener el renglón hasta decidir el costo.

**Pendientes**

- **Sí:** los productos nuevos pendientes son renglones de `supplier_receipt_lines` con `status 'pending'` (decisión del usuario).
  - **No:** una tabla `pending_products` aparte, que pierde de qué remisión vino cada uno.
- **Sí:** los dos tipos de pendiente se pueden descartar: el producto nuevo con `discarded`, y el costo con `rejected` (decisión del usuario).
- **Sí:** un renglón que coincide con un producto desactivado es «no leído» con su motivo, y no se puede confirmar (decisión del usuario, igual que HU-27). Las bolsitas activas sí se emparejan.
- **Sí:** aceptar un costo mayor que el precio responde `422`, para respetar la regla de HU-04 en vez de inventar una excepción.

**Forma del backend**

- **Sí:** módulo `src/receipts/` con alias `@receipts`, tablas `supplier_receipts` / `supplier_receipt_lines` / `supplier_product_aliases` y rutas bajo `/api/receipts/…` (decisión del usuario).
- **Sí:** idempotencia por `supplier_receipts.request_id` con candado, más `stock_movements.receipt_line_id` con índice único, el patrón de `fractions`.
  - **No:** reusar `createPurchase` por renglón, porque el índice por `(request_id, titular)` no admite varias filas de la bodega con un solo `requestId`.
- **Sí:** extraer `insertProduct` y agregar `setUnitCost` en `@products`, para que el alta desde un pendiente comparta la transacción con el `purchase`, como pide `CLAUDE.md` para casos de uso que cruzan módulos.

## Lo que **no** entra en este spec

- Pantallas de HU-42 y cualquier cambio en el frontend.
- Guardar el archivo, ligar a pedidos de resurtir o comparar lo pedido contra lo recibido.
- Proveedor como dato, código del proveedor, emparejar por parecido o con IA.
- Borradores de remisión, `.xls`/CSV/imágenes que no sean JPG o PNG, el costo de envío, cambiar el precio al aceptar un costo, reabrir pendientes o deshacer remisiones.
- Cambios en `@purchases`, `@restock`, el seed o la importación del inventario (T-38).
