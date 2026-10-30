# Spec técnico — HU-10 · Elegir a quién estoy viendo (barra «Viendo»)

> **Estado:** Implementado
> **Depende de:** M2-hu09-ver-mis-vendedores (`specs/M2-hu09-ver-mis-vendedores/spec.md`) — `GET /api/sellers` y el detalle `/admin/vendedores/:id`; M2-hu08-alta-vendedor (`specs/M2-hu08-alta-vendedor/spec.md`) — alta de vendedor y `SellerSaveService`; M0-base (`specs/M0-base/spec.md`) — `admin-shell`, `seller-shell` y sesión
> **Fecha:** 2026-10-29
> **Objetivo:** que el administrador elija en una barra «Viendo», bajo el menú de todo `/admin`, si está viendo la bodega o a un vendedor activo, y que esa elección se mantenga entre pantallas y al recargar.

Fuentes:
- **Jira:** historia `SCRUM-34 · HU-10`, épica `SCRUM-7 · M2 · Vendedores y entregas`.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§2 Roles, barra «Viendo»: «única forma de cambiar de vendedor… La selección se mantiene entre pantallas»; §3, pantallas 02 y 04).
- **Canvas de mockups:** artboards `AdminInicio` y `AdminInicioLuis` (franja «Viendo» con un `<select>` que cambia de color con un vendedor elegido).
- **Código:** `core/layout/admin-shell`, `core/layout/top-nav` (patrón de componente presentacional de `core/layout`), `core/toast/` (patrón de servicio de `core`), `core/auth/services/auth.service.ts` (`currentUser`, SSR con `isPlatformBrowser`), `features/sellers/` (`SellersService.list()`, `sellers-page`, `seller-detail-page`, `SellerSaveService`, `sortSellersByName`).
- **Decisiones del usuario del 2026-10-29** (§8).
- **Cambio posterior (2026-10-30, `M2-t15-rediseno-navbar`):** en escritorio (≥1024px) la barra «Viendo» va dentro de la barra lateral, bajo la marca, y la barra lateral se puede ocultar. En celular y tablet sigue bajo el menú. Su comportamiento, textos y API (`app-viewing-bar`) no cambian.

## 1. Alcance

**Entra en este spec:**

- **Frontend, `core`:**
  - Área nueva `core/viewing/` con `ViewingService`: la selección («Yo · bodega» o un vendedor), su lista de vendedores activos (de `GET /api/sellers`, que ya existe) y su estado cargando/error.
  - La selección se guarda en `sessionStorage`: sobrevive a recargar la pestaña y se borra al cerrar sesión.
  - Componente presentacional `core/layout/viewing-bar`: franja con la etiqueta «Viendo», un `<select>` y «Reintentar» si la lista falla.
  - `admin-shell` muestra la barra bajo `top-nav` en todas las pantallas de `/admin`. `seller-shell` no la tiene.
- **Frontend, `features/sellers`:**
  - Barra y «Vendedores» sincronizados: elegir a un vendedor en la barra estando en «Vendedores» abre su detalle; abrir un detalle lo pone en la barra; elegir «Yo · bodega» en un detalle regresa a la lista.
  - Un vendedor recién dado de alta aparece en la barra sin recargar (`SellerSaveService` recarga la lista de la barra).
- **Frontend, `shared`:** la comparación de nombres sin acentos de `sortSellersByName` pasa a `shared/utils/sort-by-name.ts`, porque la barra (en `core`) también la usa.
- **Pruebas** de frontend (§7).

**No entra en este spec:**

- «Stock general» (`/admin/stock`) con la bodega, cada vendedor y el total: es HU-13 (`SCRUM-37`), que leerá la selección de `ViewingService`. El criterio 3 de Jira queda parcial (§6).
- Que «Productos», «Carrito» o «Corte» cambien según la selección (vender de su stock, a sus precios, su corte): llegan con sus historias (HU-11, M3).
- «Dejar» y «Retirar» en el detalle del vendedor (HU-11, HU-12).
- El cambio de título «Stock general» → «Resumen de Luis» del mockup 02 (HU-13).
- Cambios en el backend: `GET /api/sellers` ya da lo que la barra necesita.
- Ver o elegir vendedores desactivados.

## 2. Reglas de negocio

- **Solo el administrador** ve la barra. La monta `admin-shell`, así que aparece en Stock, Productos, Carrito, Corte y Vendedores (y sus subrutas). El vendedor nunca la ve y nunca pide `GET /api/sellers`: la lista solo se carga cuando se crea `admin-shell`.
- **Opciones:** primero «Yo · bodega» y después cada vendedor activo con su `fullName`, en orden alfabético sin distinguir mayúsculas ni acentos (la misma regla de HU-09). Los desactivados no salen, porque `GET /api/sellers` ya los excluye.
- **Única forma de cambiar de vendedor** (Mockups §2): ninguna otra pantalla tiene su propio selector de vendedor. Abrir el detalle de un vendedor en «Vendedores» cuenta como elegirlo, y la barra lo refleja.
- **Valor por defecto:** «Yo · bodega» (`selectedSellerId = null`).
- **Se mantiene entre pantallas** porque vive en un servicio de `core` (`providedIn: 'root'`), no en una página.
- **Se recuerda al recargar** (decisión del usuario): el id elegido se guarda en `sessionStorage` con la llave `mamut.viewing.sellerId`. Una pestaña nueva empieza en «Yo · bodega». Solo se lee y escribe en el navegador (`isPlatformBrowser`); en el render de servidor la selección es «Yo».
- **Se borra al cerrar sesión:** cuando `AuthService.currentUser()` pasa a `null`, `ViewingService` vuelve a «Yo» y quita la llave. Así otro administrador que entre en la misma pestaña no hereda la selección.
- **Selección efectiva:** el id guardado solo cuenta si está en la lista cargada. Mientras la lista carga o si falló, la selección efectiva es «Yo». Cuando la lista carga y el id guardado ya no está (vendedor desactivado), se borra sin aviso.
- **Vendedor nuevo:** después de un alta exitosa (HU-08), `SellerSaveService` llama a `ViewingService.reload()`, y el vendedor ya está en la barra al abrirla (criterio 4).
- **Sincronía con «Vendedores»** (decisión del usuario):
  - En `/admin/vendedores`, con un vendedor elegido, la página lleva a `/admin/vendedores/:id` de ese vendedor. Con «Yo», se ve la lista. Para volver a la lista hay que elegir «Yo · bodega», como en el mockup 04 («Con "Yo": resumen de cada vendedor… Con un vendedor: Dejar o Retirar»).
  - En `/admin/vendedores/:id`, cuando el detalle carga bien, ese vendedor queda elegido en la barra. Un `404` no cambia la selección.
  - En un detalle, elegir a otro vendedor en la barra abre el detalle de ese vendedor; elegir «Yo · bodega» regresa a `/admin/vendedores`.
  - `/admin/vendedores/nuevo` no reacciona a la barra: el alta no depende de a quién se ve.
  - Fuera de «Vendedores», cambiar la barra no navega a ningún lado; solo cambia la selección.
- **Estados de la barra** (decisión del usuario):
  - Cargando: el `<select>` está deshabilitado y muestra «Yo · bodega».
  - Error: el `<select>` solo ofrece «Yo · bodega» y al lado aparece «Reintentar», que vuelve a pedir la lista.
  - «Yo · bodega» siempre se puede usar.

## 3. Endpoints

No hay endpoints nuevos ni cambios en el backend. La barra usa `GET /api/sellers` (HU-09) tal como está, y solo lee `id` y `fullName` de cada fila.

## 4. Modelo de datos

No hay migración ni cambios de backend.

**Frontend, `core/viewing/`** (área nueva, como `core/toast/`):

```ts
// core/viewing/interfaces/viewing.models.ts
export interface ViewingSeller { id: string; fullName: string }
export type ViewingListStatus = 'loading' | 'error' | 'ready';

// core/viewing/constants/viewing.constants.ts
export const VIEWING_STORAGE_KEY = 'mamut.viewing.sellerId';

// core/viewing/viewing.service.ts (providedIn: 'root')
readonly sellers: Signal<ViewingSeller[]>              // activos, ordenados; [] mientras carga o con error
readonly listStatus: Signal<ViewingListStatus>
readonly selectedSellerId: Signal<string | null>       // efectiva: null = «Yo · bodega»
readonly selectedSeller: Signal<ViewingSeller | null>
readonly picked: Observable<string | null>             // solo cuando el administrador elige en la barra
load(): void                                           // la primera vez pide la lista; después no hace nada
reload(): void                                         // vuelve a pedir la lista (Reintentar, alta de vendedor)
pick(sellerId: string | null): void                    // desde la barra: guarda y emite `picked`
select(sellerId: string | null): void                  // desde una página: guarda sin emitir `picked`
```

- `ViewingService` pide `GET ${API_BASE_URL}/api/sellers` con `HttpClient`. No importa `SellersService`, porque `core` no puede importar `features/` (`check:architecture`).
- `picked` existe para que las páginas de «Vendedores» naveguen solo cuando el administrador usa la barra, y no cuando la propia página fija la selección al cargar un detalle. Así no hay navegaciones en bucle.

**Frontend, `core/layout/viewing-bar/`** (presentacional, como `top-nav`):

```ts
// core/layout/viewing-bar/viewing-bar.component.ts
sellers = input.required<ViewingSeller[]>();
selectedSellerId = input<string | null>(null);
status = input.required<ViewingListStatus>();
selectionChange = output<string | null>();
retry = output<void>();
```

- Constantes visibles (etiqueta «Viendo», «Yo · bodega», «Reintentar») en `core/layout/viewing-bar/viewing-bar.constants.ts`.
- `admin-shell` inyecta `ViewingService`, llama a `load()` al crearse y conecta `selectionChange` → `pick()` y `retry` → `reload()`.

**Frontend, `shared/utils/sort-by-name.ts`:**

```ts
export function sortByName<T extends { fullName: string }>(items: readonly T[]): T[]   // copia, localeCompare 'es', sensitivity 'base'
```

- `features/sellers/rules/seller.rules.ts` → `sortSellersByName` pasa a usar `sortByName` (sin cambiar su contrato ni sus pruebas).

**Frontend, `features/sellers/`:**

- `pages/sellers-page`: al entrar, si `selectedSellerId()` no es `null`, navega a su detalle (`replaceUrl`).
- `pages/seller-detail-page`: con el detalle en `ready`, llama a `select(id)`. Se suscribe a `picked` (`takeUntilDestroyed`): un id lleva a su detalle, `null` lleva a `/admin/vendedores`.
- `services/seller-save.service.ts`: en un alta exitosa, llama a `ViewingService.reload()`.

## 5. Plan de implementación

1. **Shared.** Crear `shared/utils/sort-by-name.ts` con su spec y hacer que `sortSellersByName` lo use. `ng test` y `npm run check:architecture` pasan.
2. **Core · estado.** Crear la carpeta `core/viewing/` (`interfaces/`, `constants/`) y `ViewingService` (lista, estados, selección efectiva, `sessionStorage`, limpieza al cerrar sesión, `picked`), con su spec. Todavía no se usa en ninguna pantalla. `ng test` pasa.
3. **Diseño.** Antes de la barra, el flujo de `CLAUDE.md`: ui-ux-pro-max y luego frontend-design, sobre el artboard `AdminInicio`, traducido a los tokens de `styles.css`. La franja con «Yo» usa un fondo oscuro de la paleta (`bg-ink`) y con un vendedor elegido un fondo de acento de la paleta, con contraste de 4.5:1 o más. No se copian los colores del mockup ni su menú inferior.
4. **Core · barra.** `ng generate component core/layout/viewing-bar`, con sus constantes y su spec. Montarla en `admin-shell` bajo `top-nav`, con `load()`, `pick()` y `reload()`. Ampliar los specs de `admin-shell` (la barra está) y `seller-shell` (la barra no está). `ng build`, `ng test` y `npm run check:architecture` pasan.
5. **Sellers · sincronía.** Cambiar `sellers-page` y `seller-detail-page` según §2, y `SellerSaveService` para que llame a `reload()`. Ampliar sus specs. `ng build`, `ng test` y `npm run check:architecture` pasan.
6. **Verificación manual** contra la base local con el seed:
   - Como admin, la barra está en Stock, Productos, Carrito, Corte y Vendedores, con «Yo · bodega», Valeria Vendedora y Víctor Vendedor (no Iván Inactivo).
   - Elegir a Víctor y cambiar de pantalla: la barra sigue en Víctor. Recargar: sigue en Víctor.
   - En «Vendedores» con Víctor elegido se abre su detalle; elegir a Valeria abre el de ella; elegir «Yo · bodega» regresa a la lista. Tocar a Víctor en la lista lo pone en la barra.
   - Dar de alta un vendedor: aparece en la barra sin recargar.
   - Cerrar sesión y volver a entrar: la barra está en «Yo · bodega».
   - Como `vendedor1@mammut.local`, «Mi stock» no tiene barra y la pestaña Red no muestra `GET /api/sellers`.
   - Sin errores en la consola.
7. **Cierre.** Actualizar `specs/README.md` y comentar el avance en `SCRUM-34` en cada paso, con el patrón de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-34`:

- [x] **1.** Como administrador, en «Stock», «Productos» y «Vendedores» (y también en «Carrito» y «Corte») se ve la barra «Viendo» con «Yo · bodega» y cada vendedor activo, en orden alfabético. Los desactivados no aparecen.
- [x] **2.** Con un vendedor elegido, cambiar de pantalla dentro de `/admin` deja la barra en ese vendedor. Recargar la página también.
- [x] **3 (parcial).** La selección queda disponible en `ViewingService.selectedSellerId()` para «Stock general». *Que «Stock general» muestre la bodega y el total con «Yo», y solo lo del vendedor con un vendedor, se verifica en HU-13 (`SCRUM-37`).*
- [x] **4.** Un vendedor recién dado de alta aparece en la barra sin recargar la página.
- [x] **5.** Como vendedor no se ve la barra «Viendo», y la app no pide `GET /api/sellers`.

Además:

- [x] Cerrar sesión deja la barra en «Yo · bodega» al volver a entrar, y quita `mamut.viewing.sellerId` de `sessionStorage`.
- [x] Un id guardado que ya no está en la lista (vendedor desactivado) regresa a «Yo · bodega» al cargar.
- [x] Mientras la lista carga, el `<select>` está deshabilitado en «Yo · bodega». Si falla, solo ofrece «Yo · bodega» y «Reintentar» vuelve a pedir la lista.
- [x] En «Vendedores»: con un vendedor elegido se abre su detalle; elegir otro abre el suyo; elegir «Yo · bodega» regresa a la lista; abrir un detalle desde la lista pone a ese vendedor en la barra; un detalle `404` no cambia la barra.
- [x] Fuera de «Vendedores», cambiar la barra no cambia la URL.
- [x] El render de servidor no falla por `sessionStorage` (`ng build` con SSR pasa y la app carga sin errores).
- [x] Frontend: `ng build`, `ng test` y `npm run check:architecture` pasan. El backend no cambia.

**Verificación automática (2026-10-30):** `ng test` 336/336 (las suites de §7: 18 archivos, 100 pruebas), `ng build` con SSR y `npm run check:architecture` pasan.

**Inspección manual (2026-10-30, por el usuario):** hecha con la barra «Viendo» dentro de la barra lateral de escritorio; `SCRUM-34` pasó a «Finalizada» en Jira.

**Verificación manual (2026-10-29, base local con el seed):**
- La barra sale en Stock, Productos y Vendedores con «Yo · bodega», Valeria Vendedora y Víctor Vendedor; Iván Inactivo no aparece.
- Elegir a Víctor en Stock no cambia la URL; abrir Productos con la página recargada la deja en Víctor.
- `/admin/vendedores` con Víctor abre su detalle; elegir a Valeria abre el de ella (misma página, otro `:id`); «Yo · bodega» regresa a la lista y quita la llave; tocar a Víctor en la lista lo pone en la barra.
- Un alta («Prueba Hu Diez», solo local) aparece en la barra sin recargar.
- Cerrar sesión y entrar como `admin@mammut.local`: la barra está en «Yo · bodega» (tras el arreglo de arranque descrito en §8).
- Como `vendedor1@mammut.local`, «Mi stock» no tiene barra y la única petición a la API es `POST /api/auth/login`.
- Sin errores en la consola.
- **Pendiente de decidir:** con un vendedor elegido, el enlace «‹ Vendedores» del detalle (y el menú «Vendedores») llevan a la lista, que vuelve a abrir el detalle, así que parecen no hacer nada.

## 7. Plan de pruebas

- **`shared/utils/sort-by-name.spec.ts`:** «Ángel», «ana», «Beto» quedan en ese orden, y la entrada no se muta.
- **`core/viewing/viewing.service.spec.ts`** (con `HttpTestingController`):
  - `load()` pide `GET /api/sellers` una sola vez aunque se llame dos veces; `reload()` vuelve a pedirla.
  - Estados `loading`, `ready` y `error`; con error, `sellers()` es `[]` y la selección efectiva es `null`.
  - `pick()` guarda en `sessionStorage` y emite `picked`; `select()` guarda sin emitir.
  - Un id guardado se recupera al crear el servicio, y cuenta en cuanto la lista lo incluye.
  - Un id guardado que no está en la lista se borra.
  - `AuthService.currentUser()` en `null` vuelve a «Yo» y quita la llave.
- **`core/layout/viewing-bar/viewing-bar.component.spec.ts`:**
  - Opciones en orden con «Yo · bodega» primero; la elegida marcada.
  - Cambiar el `<select>` emite `selectionChange` (`null` para «Yo»).
  - Cargando: `<select>` deshabilitado. Error: solo «Yo · bodega» y «Reintentar» emite `retry`.
- **`core/layout/admin-shell/admin-shell.component.spec.ts`:** la barra está y `load()` se llama al crear el shell.
- **`core/layout/seller-shell/seller-shell.component.spec.ts`:** la barra no está y no hay petición a `/api/sellers`.
- **`features/sellers/pages/sellers-page/…spec.ts`:** con un vendedor elegido navega a su detalle; con «Yo» muestra la lista.
- **`features/sellers/pages/seller-detail-page/…spec.ts`:**
  - Con el detalle cargado llama a `select(id)`; con `404` no.
  - `picked` con otro id navega a su detalle; con `null` navega a `/admin/vendedores`.
- **`features/sellers/services/seller-save.service.spec.ts`:** un alta exitosa llama a `reload()`; un error no.
- **`features/sellers/rules/seller.rules.spec.ts`:** sin cambios, sigue pasando con `sortByName` por dentro.

## 8. Decisiones

- **Sí:** el criterio 3 queda parcial y lo cierra HU-13 (decisión del usuario). «Stock general» es su propia historia; aquí solo se deja la selección lista para leerse, igual que el criterio 3 parcial de HU-09.
- **No:** un «Stock general» mínimo en esta historia. Adelantaría el trabajo y el endpoint de HU-13 en una historia de talla S.
- **Sí:** la selección se recuerda al recargar con `sessionStorage` y se borra al cerrar sesión (decisión del usuario; responde el «Por decidir» de Jira). Recargar es común en el celular y perder la selección obliga a buscar otra vez al vendedor, que es justo lo que la historia quiere evitar.
- **No:** `localStorage`. Haría que la app abra con un vendedor elegido días después, y se podría ver o vender desde el stock equivocado sin notarlo.
- **No:** solo en memoria. Recargar regresaría a «Yo» sin aviso.
- **Sí:** la barra en todo `/admin`, montada por `admin-shell` (decisión del usuario). Cubre las tres pantallas del criterio 1, y Carrito y Corte la necesitan después (mockup 08: «Elegir a quién (Viendo)»).
- **No:** marcar por ruta qué pantallas la muestran. Agrega una regla que habría que mantener en cada ruta nueva.
- **Sí:** barra y «Vendedores» sincronizados en los dos sentidos (decisión del usuario), como el mockup 04. Mantiene la regla «única forma de cambiar de vendedor»: tocar una fila de la lista y elegir en la barra dejan el mismo estado.
- **Sí:** con un vendedor elegido, «Vendedores» abre su detalle y la lista se ve solo con «Yo». Es lo que dibuja el mockup 04. El costo: con un vendedor elegido, la lista y «Nuevo vendedor» quedan a un cambio de barra.
- **Sí:** `picked` aparte de `selectedSellerId`. Solo lo que el administrador elige en la barra navega; la selección que fija un detalle al cargar no navega, y así no hay bucles entre la página y la barra.
- **Sí:** `ViewingService` en `core/viewing/`, con su propia llamada a `GET /api/sellers` (decisión del usuario). `core` no puede importar `features/sellers`, y el endpoint de HU-09 ya da el id y el nombre.
- **No:** mover `SellersService` a `shared`. `shared` no tiene estado ni HTTP de negocio.
- **No:** un endpoint nuevo solo para la barra. Duplicaría `GET /api/sellers`; las piezas que también trae pesan poco.
- **Sí:** `viewing-bar` presentacional en `core/layout/`, y `admin-shell` conecta el servicio, como hace con `top-nav`.
- **Sí:** franja con `<select>` nativo, como el mockup (decisión del usuario). Escala a muchos vendedores y en el celular abre el selector del sistema, que es accesible.
- **No:** fila de chips. Con muchos vendedores hay que deslizar para encontrar uno.
- **Sí:** «Yo · bodega» siempre se puede usar, y con error se ve «Reintentar» al lado (decisión del usuario). Una falla de red no bloquea las pantallas de la bodega.
- **Sí:** la selección efectiva es «Yo» hasta que la lista confirma el id guardado. Así nunca se trabaja «viendo» a un vendedor desactivado o cuyo nombre la barra no puede mostrar.
- **Sí:** limpiar la selección observando `AuthService.currentUser()` desde `ViewingService`. `AuthService` no tiene que saber que la barra existe.
- **Sí:** el orden sin acentos pasa a `shared/utils/sort-by-name.ts`, porque `core` no puede importar las reglas de `features/sellers`. `sortSellersByName` sigue igual por fuera.
- **Sí:** la lista de la barra se carga cuando se crea `admin-shell`, no al crear el servicio. Así el vendedor nunca pide `GET /api/sellers` (le daría `403`).
- **Sí (descubierto al implementar):** `ViewingService` se crea al arrancar la app (`provideEnvironmentInitializer` en `app.config.ts`), aunque su lista se sigue pidiendo solo desde `admin-shell`. En la verificación manual, cerrar sesión desde `/cuenta` después de recargar dejaba la llave en `sessionStorage`, porque nadie había creado el servicio y su `effect` no corría. Creado al arrancar, ve cerrar sesión desde cualquier pantalla, y en `/login` sin sesión borra una llave que haya quedado.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Bucle de navegación entre la barra y el detalle del vendedor | Solo `picked` (lo que elige el administrador en la barra) navega; `select()` desde la página no emite. Prueba en `seller-detail-page` |
| `sessionStorage` no existe en el render de servidor | Leer y escribir solo con `isPlatformBrowser`, como `AuthService` con `localStorage` |
| La barra muestra a un vendedor que ya no está activo | La selección efectiva requiere que el id esté en la lista cargada; si no, se borra |
| Con un vendedor elegido, el administrador no encuentra la lista ni «Nuevo vendedor» | La barra está siempre visible arriba; elegir «Yo · bodega» regresa a la lista. Se revisa en la verificación manual |
| Cerrar sesión fuera de `/admin` (p. ej. `/cuenta` tras recargar) no borra la selección | `ViewingService` se crea al arrancar la app; prueba «creado sin sesión borra la llave» |
| Dos pestañas con selecciones distintas | `sessionStorage` es por pestaña: cada una tiene la suya, a propósito |
| La lista de la barra queda vieja si se desactiva un vendedor en otra pestaña | No hay desactivación en la app todavía; cuando exista, esa historia llama a `reload()` |

## Lo que **no** entra en este spec

- «Stock general» con bodega, cada vendedor y total (HU-13).
- Que Productos, Carrito o Corte cambien según la selección (HU-11, M3).
- «Dejar» y «Retirar» en el detalle del vendedor (HU-11, HU-12).
- Cambios en el backend.
- Vendedores desactivados en la barra.

Cada uno, si llega, va en su propio spec o en su historia.
