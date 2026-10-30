# Spec técnico — HU-09 · Ver mis vendedores

> **Estado:** aPROVADO
> **Depende de:** M2-hu08-alta-vendedor (`specs/M2-hu08-alta-vendedor/spec.md`) — `/admin/vendedores`, `features/sellers/` y `POST /api/sellers`; M2-t10-base-vendedores (`specs/M2-t10-base-vendedores/spec.md`) — `profiles.phone` y `vendor_stock`; M1-t07-stock-por-movimientos (`specs/M1-t07-stock-por-movimientos/spec.md`) — `vendor_stock.qty` lo mantiene el trigger a partir de los movimientos
> **Fecha:** 2026-10-29
> **Objetivo:** que el administrador vea en «Mis vendedores» a cada vendedor activo con sus piezas en total, y que al tocar uno vea su stock por producto.

Fuentes:
- **Jira:** historia `SCRUM-33 · HU-09`, épica `SCRUM-7 · M2 · Vendedores y entregas`.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantalla 04 Mis vendedores, v1 parcial: sin «lo que le deben» ni «merma»).
- **Canvas de mockups:** artboards `Entregar` (lista «Mis vendedores» y, con un vendedor en «Viendo», «Stock de Luis») y `EstadosVendedores` (cargando, vacío y error).
- **Código:** `backend/src/accounts/sellers.ts`, `backend/app/api/sellers/route.ts`, `backend/src/stock/`, `features/sellers/` y `features/products/pages/products-page` (patrón de lista con `rxResource`, esqueletos y «Reintentar»).
- **Decisiones del usuario del 2026-10-29** (§8).

## 1. Alcance

**Entra en este spec:**

- **Backend:**
  - Consultas de stock por vendedor en el módulo `stock`: total de piezas por vendedor y piezas por producto de un vendedor, leyendo `vendor_stock`.
  - Casos de uso `listSellers` y `getSeller` en `backend/src/accounts/sellers.ts`.
  - `GET /api/sellers` (en la ruta que ya existe) y `GET /api/sellers/:id` (ruta nueva), solo para administradores.
- **Frontend:**
  - `/admin/vendedores` pasa de página mínima a «Mis vendedores»: lista de vendedores activos (iniciales, nombre y piezas), en orden alfabético, con el botón «Nuevo vendedor» y los estados cargando, vacío y error con «Reintentar».
  - Detalle nuevo en `/admin/vendedores/:id`: iniciales, nombre, teléfono, correo y total de piezas, y debajo su stock por producto (foto, nombre y piezas), en solo lectura.
- **Seed local:** movimientos `delivery` para que `vendedor1@mammut.local` tenga 6 piezas.
- **Pruebas** de backend y frontend (§7).

**No entra en este spec:**

- Los botones «Dejar» y «Retirar» del detalle, y la acción de dejar o retirar producto: llegan con HU-11 y HU-12. El criterio 3 de Jira se cumple en parte (§6).
- La barra «Viendo» (HU-10) y el aviso del mockup «Elige un vendedor en Viendo…».
- «Vendió hoy» (M3) y «lo que le deben» y «merma» (v2 y M6), como dice la propia historia.
- El precio y el costo con envío por vendedor (`vendor_stock.unit_price`, `unit_cost_with_shipping`): los asigna HU-11, que también los mostrará.
- Ver, reactivar o editar vendedores desactivados, y editar los datos de un vendedor.
- Buscar o filtrar vendedores.

## 2. Reglas de negocio

- **Solo el administrador** ve la lista y el detalle. Los dos endpoints exigen `requireRole(request, 'admin')`: un vendedor recibe `403` y sin sesión es `401`.
- **Solo vendedores activos.** La lista trae los `profiles` con `role = 'vendedor'` y `active = true`. Un vendedor desactivado no aparece en la lista, y su detalle responde `404` igual que uno que no existe.
- **Piezas de un vendedor** = suma de `vendor_stock.qty` de ese vendedor (con `coalesce` a 0). Esa tabla la mantiene solo el trigger a partir de `stock_movements` (T-07): aquí solo se lee, nunca se escribe. Un vendedor sin filas en `vendor_stock` tiene 0 piezas.
- **Stock por producto** del detalle: las filas de `vendor_stock` de ese vendedor con `qty > 0`, unidas a `products` (nombre e imagen) y ordenadas por nombre del producto. Se incluyen también productos archivados, porque las piezas siguen en manos del vendedor. `products.image` es `text not null default ''`, así que una imagen vacía se responde como `null` («sin foto»).
- **Orden de la lista:** alfabético por nombre, sin distinguir mayúsculas ni acentos («Ángel» va junto a «Ana»). Lo hace una regla pura del frontend con `localeCompare(…, 'es', { sensitivity: 'base' })`.
- **Texto de piezas:** «1 pieza», «N piezas» (también «0 piezas»).
- **Teléfono** en el detalle: siempre con el pipe `phone` («55 2468 1357»), como pide `CLAUDE.md`.
- **Id inválido:** `GET /api/sellers/:id` usa `parseUuid`; un id que no es UUID da `404`, igual que uno que no existe o que no es de un vendedor (p. ej., el id de un administrador).

## 3. Endpoints

`GET /api/sellers`, solo para administradores. Responde los vendedores activos, ordenados por `full_name` (el frontend vuelve a ordenar sin acentos).

```json
// 200
[
  { "id": "uuid", "fullName": "Víctor Vendedor", "units": 6 },
  { "id": "uuid", "fullName": "Valeria Vendedora", "units": 0 }
]
```

`GET /api/sellers/:id`, solo para administradores.

```json
// 200
{
  "id": "uuid", "fullName": "Víctor Vendedor", "email": "vendedor1@mammut.local",
  "phone": "5510000001", "active": true, "units": 6,
  "stock": [
    { "productId": 12, "name": "Creatina Monohidratada Demo", "image": null, "units": 2 },
    { "productId": 10, "name": "Proteína Demo Whey 2 lb", "image": "https://…", "units": 4 }
  ]
}
```

| Caso | Status | `error.message` |
| --- | --- | --- |
| Id que no es UUID, no existe, no es vendedor o está desactivado | 404 | El de `notFound()` |
| Sin sesión / no es administrador | 401 / 403 | Los de `requireRole` |

## 4. Modelo de datos

No hay migración: `vendor_stock` y `profiles.phone` ya existen (T-03, T-10).

**Backend:**

```ts
// backend/src/stock/holdings.ts (exportado en backend/src/stock/index.ts)
export interface HolderStockLine { productId: number; name: string; image: string | null; units: number }
export function unitsByHolder(profileIds: string[]): Promise<Map<string, number>>   // sum(vendor_stock.qty) por vendedor
export function stockOfHolder(profileId: string): Promise<HolderStockLine[]>         // qty > 0, por nombre de producto

// backend/src/accounts/sellers.ts
export interface SellerSummary { id: string; fullName: string; units: number }
export type SellerDetail = SellerView & { units: number; stock: HolderStockLine[] }
export function listSellers(): Promise<SellerSummary[]>
export function getSeller(id: string): Promise<SellerDetail>   // 404 si no es un vendedor activo
```

- `accounts` usa `stock` solo por su index (`@stock`), como manda `tests/architecture.test.ts`. La lectura de `vendor_stock` vive en `stock` porque esa tabla es del módulo de stock.
- `HolderStockLine` sale de `@stock`; `SellerSummary` y `SellerDetail`, de `@accounts`.

**Frontend (`src/app/features/sellers/`):**

```ts
// interfaces/seller.models.ts (se agregan)
export interface SellerSummary { id: string; fullName: string; units: number }
export interface SellerStockLine { productId: number; name: string; image: string | null; units: number }
export interface SellerDetail extends Seller { units: number; stock: SellerStockLine[] }

// services/sellers.service.ts (se agregan)
list(): Observable<SellerSummary[]>            // GET ${API_BASE_URL}/api/sellers
get(id: string): Observable<SellerDetail>      // GET ${API_BASE_URL}/api/sellers/:id

// rules/seller.rules.ts (se agregan)
sortSellersByName(sellers: SellerSummary[]): SellerSummary[]   // copia ordenada, sin mutar
unitsLabel(units: number): string                              // «1 pieza» / «N piezas»
```

- **Componentes presentacionales** (`features/sellers/components/`, solo `input()`/`output()`):
  - `seller-row`: iniciales (`shared/utils/initials`), nombre y piezas, como enlace al detalle.
  - `seller-row-skeleton`: esqueleto de una fila para el estado «cargando».
  - `seller-stock-line`: foto del producto (o sus iniciales si no tiene foto), nombre y piezas.
- **Páginas:**
  - `pages/sellers-page`: se reescribe con `rxResource` sobre `list()`.
  - `pages/seller-detail-page`: nueva, con `rxResource` sobre `get(id)`.
- **Modelos de página:** `models/seller-detail-page.models.ts` con `type SellerDetailState = 'loading' | 'error' | 'not-found' | 'ready'`, si la página lo necesita (como `edit-product-page`).
- **Rutas** (`sellers.routes.ts`): agrega `:id` después de `nuevo` (para que `nuevo` no se lea como un id), lazy, con `data: { title: 'Vendedor' }`. `''` cambia su título a «Mis vendedores».
- No se agrega ningún alias: todo queda dentro de `features/sellers/`.

**Seed (`supabase/seed.sql`):** al final se agregan entregas a Víctor Vendedor (`vendedor1@mammut.local`): 4 piezas de «Proteína Demo Whey 2 lb» y 2 de «Creatina Monohidratada Demo». Son movimientos `delivery` en pares: bodega `−N` (`holder_profile_id` null) y vendedor `+N`, hechos por el administrador del seed, con `reason` «Entrega de prueba (seed local)». La bodega de esos productos baja de 12 a 8 y de 20 a 18; ninguna prueba depende de esas cantidades.

## 5. Plan de implementación

1. **Backend · stock.** Crear `backend/src/stock/holdings.ts` (`unitsByHolder`, `stockOfHolder`) y exportarlo en `stock/index.ts`. `npm run type-check` pasa.
2. **Backend · casos de uso y rutas.** Agregar `listSellers` y `getSeller` a `accounts/sellers.ts` (el detalle reusa `toView` para el correo). Agregar `GET` a `app/api/sellers/route.ts` y crear `app/api/sellers/[id]/route.ts`, ambas delgadas, con `requireRole(request, 'admin')` y `parseUuid`. Ampliar `backend/tests/sellers.test.ts` (§7). `npm run type-check` y `npm test` pasan, incluido `architecture.test.ts`.
3. **Seed.** Agregar las entregas a `vendedor1@mammut.local` y correr `npm run db:reset`. En Studio, `vendor_stock` de Víctor suma 6. `npm test` del backend sigue pasando.
4. **Frontend · datos.** Agregar los modelos, `list()`/`get()` y las reglas `sortSellersByName` y `unitsLabel`, con sus specs. `ng test` pasa.
5. **Frontend · diseño.** Antes de las pantallas, el flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design, sobre el mockup `Entregar`/`EstadosVendedores`, traducido a los tokens de `styles.css` y al sistema de productos (`product-card`, esqueletos). No se copian colores ni el menú inferior del mockup: la app ya tiene `top-nav`.
6. **Frontend · «Mis vendedores».** `ng generate component` para `seller-row` y `seller-row-skeleton`. Reescribir `sellers-page`:
   - Título «Mis vendedores» y botón «Nuevo vendedor».
   - Lista ordenada; cada fila lleva a `/admin/vendedores/:id`.
   - Cargando: «Cargando vendedores…» con esqueletos.
   - Vacío: «Aún no tienes vendedores», «Da de alta a tu primer vendedor para dejarle producto.» y el botón «Nuevo vendedor».
   - Error: «No pudimos cargar a tus vendedores», «Revisa tu conexión e inténtalo de nuevo.» y «Reintentar» (`reload()`).
7. **Frontend · detalle.** `ng generate component` para `seller-stock-line` y `seller-detail-page`, más la ruta `:id`.
   - Enlace «‹ Vendedores», cabecera (iniciales, nombre, teléfono con `phone`, correo y total de piezas) y lista de productos.
   - Sin productos: «Todavía no tiene producto.»
   - No encontrado: «No encontramos a este vendedor» con enlace a la lista.
   - Error de carga: aviso con «Reintentar».
   - `ng build`, `ng test` y `npm run check:architecture` pasan.
8. **Verificación manual** contra la base local con el seed nuevo:
   - Como admin, «Mis vendedores» muestra a Valeria (0 piezas) y a Víctor (6 piezas), y no a Iván (desactivado).
   - El detalle de Víctor lista 4 de proteína y 2 de creatina.
   - El backend apagado muestra el error; «Reintentar» con el backend encendido carga la lista.
   - Un id inventado muestra «No encontramos a este vendedor».
9. **Cierre.** Actualizar `specs/README.md` y comentar el avance en `SCRUM-33` en cada paso, con el patrón de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-33`:

- [x] **1.** «Vendedores» abre «Mis vendedores» con cada vendedor activo (iniciales, nombre y piezas en total) y el botón «Nuevo vendedor». Los desactivados no aparecen.
- [x] **2.** Con 6 piezas entregadas a un vendedor por movimientos `delivery`, su fila muestra «6 piezas» (prueba de backend con `insertMovements` y Víctor en el seed local).
- [x] **3 (parcial).** Al tocar un vendedor se abre su detalle con su stock por producto (foto, nombre y piezas). *«Dejar» y «Retirar» se verifican en HU-11 y HU-12.*
- [x] **4.** Sin vendedores activos se ve «Aún no tienes vendedores» con el botón «Nuevo vendedor», que lleva a `/admin/vendedores/nuevo`.
- [x] **5.** Mientras carga se ve «Cargando vendedores…» con esqueletos. Si falla, se ve el error con «Reintentar», y «Reintentar» vuelve a pedir la lista.

Además:

- [x] `GET /api/sellers` y `GET /api/sellers/:id` responden `403` a un vendedor y `401` sin sesión.
- [x] `GET /api/sellers/:id` responde `404` con un id que no es UUID, uno que no existe, el id de un administrador y el de un vendedor desactivado.
- [x] El detalle solo lista productos con piezas > 0, y su total coincide con el de la fila de la lista.
- [x] La lista sale en orden alfabético sin distinguir acentos ni mayúsculas.
- [x] El criterio 2 de HU-08 queda completo: un vendedor recién dado de alta aparece en «Mis vendedores» con «0 piezas» (la barra «Viendo» sigue siendo de HU-10).
- [x] Backend: `npm run type-check` y `npm test` pasan, con `SUPABASE_SERVICE_ROLE_KEY` puesta. Frontend: `ng build`, `ng test` y `npm run check:architecture` pasan.

**Verificación manual (2026-10-29, base local con el seed nuevo):**
- «Vendedores» abre «Mis vendedores» con Valeria Vendedora (0 piezas) y Víctor Vendedor (6 piezas), en ese orden. Iván Inactivo no aparece.
- El detalle de Víctor muestra «55 1000 0001», su correo y «6 piezas»: 2 de creatina y 4 de proteína. El de Valeria muestra «Todavía no tiene producto.».
- Un id inventado y el id de Iván muestran «No encontramos a este vendedor». `/admin/vendedores/nuevo` sigue abriendo el alta.
- No hay errores en la consola.
- El estado de error con «Reintentar» se verificó solo con las pruebas unitarias (`sellers-page` y `seller-detail-page`), no apagando el backend.

## 7. Plan de pruebas

- **`backend/tests/sellers.test.ts`** (contra la base local; cuentas con prefijo `test-auth-`, productos y movimientos de prueba borrados al terminar, los movimientos del más nuevo al más viejo, como en `stock-movements.test.ts`):
  - `GET /api/sellers`: el vendedor de prueba aparece con `units: 0`. Tras `insertMovements` con un `delivery` de 6 (bodega `−6`, vendedor `+6`), aparece con `units: 6`. Un vendedor desactivado no aparece.
  - `GET /api/sellers/:id`: datos, teléfono y `stock` con la línea del producto entregado. Un producto con `qty` 0 en `vendor_stock` no sale. Los cuatro casos de `404`.
  - Los dos endpoints: `403` para un vendedor y `401` sin token.
- **`features/sellers/rules/seller.rules.spec.ts`:** `sortSellersByName` («Ángel», «ana», «Beto»; no muta la entrada) y `unitsLabel` (0, 1 y 6).
- **`features/sellers/services/sellers.service.spec.ts`:** `list()` y `get(id)` llaman a la URL correcta.
- **`features/sellers/components/seller-row/…spec.ts`:** iniciales, nombre, «6 piezas» y enlace al detalle.
- **`features/sellers/components/seller-stock-line/…spec.ts`:** foto o iniciales, nombre y piezas.
- **`features/sellers/pages/sellers-page/…spec.ts`:**
  - Cargando muestra los esqueletos.
  - Vacío muestra el estado y el botón.
  - Error muestra el aviso, y «Reintentar» vuelve a pedir la lista.
  - Lista ordenada y botón «Nuevo vendedor».
- **`features/sellers/pages/seller-detail-page/…spec.ts`:**
  - Cabecera con el teléfono formateado.
  - Líneas de stock.
  - «Todavía no tiene producto.»
  - «No encontramos a este vendedor» con un `404`.
  - Error con «Reintentar».

## 8. Decisiones

- **Sí:** detalle en `/admin/vendedores/:id` con stock por producto en solo lectura, sin «Dejar» ni «Retirar» (decisión del usuario). Esas acciones son HU-11 y HU-12, y agregarlas aquí adelantaría su trabajo. El criterio 3 queda parcial, igual que el 2 de HU-08.
- **No:** botones «Dejar»/«Retirar» deshabilitados con «Próximamente». Prometen algo que todavía no existe.
- **No:** el detalle como pantalla con un vendedor en «Viendo», como dibuja el mockup. La barra «Viendo» es de HU-10; una ruta propia funciona hoy y HU-10 puede llevar a ella.
- **Sí:** la fila muestra iniciales, nombre y piezas, tal como dice el criterio 1 (decisión del usuario). Sin teléfono en la lista.
- **Sí:** el detalle muestra nombre, teléfono, correo y total de piezas arriba (decisión del usuario). El correo es su «usuario» para entrar (T-10).
- **Sí:** de cada producto, foto, nombre y piezas (decisión del usuario). El precio y el costo con envío por vendedor los asigna HU-11, y se muestran ahí.
- **Sí:** solo vendedores activos (decisión del usuario, criterio 1). Un desactivado da `404` en el detalle, para no exponer una pantalla de alguien que ya no trabaja.
- **Sí:** orden alfabético sin acentos (decisión del usuario), hecho en una regla pura del frontend. Postgres no tiene `unaccent` instalado y no vale la pena agregar una extensión para esto.
- **Sí:** dos endpoints, lista y detalle (decisión del usuario). La lista suma en SQL y no trae líneas por producto, así que crece poco con el número de productos.
- **Sí:** la lectura de `vendor_stock` vive en el módulo `stock` y `accounts` la usa por `@stock`. Mantiene la tabla en su módulo dueño, según el monolito modular de `CLAUDE.md`.
- **No:** llamar a `toView` por cada vendedor en la lista. Hace una llamada a Supabase Auth por cuenta solo para el correo, que la lista no muestra. La lista lee `profiles` directo; solo el detalle usa `toView`.
- **Sí:** seed con 6 piezas para Víctor más una prueba de backend con `insertMovements` (decisión del usuario). Así el criterio 2 se ve en local antes de que exista HU-11, sin escribir `vendor_stock` a mano, que la base prohíbe.
- **Sí:** la página se titula «Mis vendedores», como el criterio 1 y el mockup; el menú sigue diciendo «Vendedores».

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `db:reset` para cargar el seed nuevo borra las cuentas creadas a mano en local (p. ej. `luis.prueba@mammut.local`) | Avisarlo antes del paso 3; las del seed se recrean solas |
| `nuevo` se toma como un `:id` si la ruta `:id` va antes | `:id` se declara después de `nuevo` en `sellers.routes.ts`, y `parseUuid` da `404` a cualquier id que no sea UUID |
| La suma de piezas no coincide entre lista y detalle | Las dos salen de `vendor_stock` en el mismo módulo; una prueba compara ambos totales |
| Las pruebas de backend dejan movimientos o `vendor_stock` de prueba | Limpieza antes y después, borrando movimientos del más nuevo al más viejo (el trigger revierte su efecto) |
| `next dev` con un `schema.ts` o rutas viejas tras cambiar de rama | Reiniciar `npm run dev` después de traer cambios del backend (pasó en HU-08) |

## Lo que **no** entra en este spec

- «Dejar» y «Retirar» (HU-11, HU-12).
- Barra «Viendo» (HU-10).
- «Vendió hoy», «lo que le deben» y merma del resumen.
- Precio y costo con envío por vendedor en el detalle.
- Vendedores desactivados: verlos, reactivarlos o editarlos.
- Búsqueda o filtros en la lista.

Cada uno, si llega, va en su propio spec o en su historia.
