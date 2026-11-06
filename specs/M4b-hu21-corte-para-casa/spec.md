# Spec técnico — HU-21 · Generar el corte para casa de un vendedor (administrador)

> **Estado:** Aprovado
> **Depende de:** M4b-t22-base-corte-para-casa (`specs/M4b-t22-base-corte-para-casa/spec.md`) — `GET /api/cuts?type=home` con `factoryCost`, `realProfit` y `shippingCover` (esta última ya no se pinta, §10); M4a-hu19-corte-administrador (`specs/M4a-hu19-corte-administrador/spec.md`) — página «Corte», selector «Tipo de corte» y componentes de `features/cash-cut`; M4a-hu20-mi-corte-vendedor (`specs/M4a-hu20-mi-corte-vendedor/spec.md`) — componentes compartidos con «Mi corte»; M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`) — titular de «Viendo»; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — dinero como texto
> **Fecha:** 2026-11-05
> **Nota (2026-11-06):** el usuario decidió que el corte para casa **no muestra «Para cubrir envíos»**: el administrador ve la ganancia real (precio menos costo de fábrica) y el vendedor ve, en su corte con precios, la ganancia con el costo con envío que se le puso. El backend (T-22) conserva `shippingCover`; solo la pantalla deja de pintarlo. Cambia lo aprobado en los criterios 2, 3 y 5, en §2, §8 y §10, y en el paso 4. Además, el usuario pidió renombrar las opciones del selector «Tipo de corte»: «Corte del vendedor» (antes «Corte con precios (para vendedor)») y «Corte de casa» (antes «Corte (para casa)»). Los títulos del resultado no cambian.
>
> **Nota (2026-11-06, estructura del resultado):** el usuario pidió simplificar el resultado del administrador: solo «Vendido» y «Ganancia», sin costos; los datos del corte (quién vendió, cuándo, cuántas piezas) arriba en la tarjeta; y «Generado…» con «Generar de nuevo» al pie de la tarjeta. Aplica a «Corte de casa» y «Corte del vendedor», solo en la vista del administrador. «Mi corte» (HU-20) no cambia. Ver paso 4b y §5c.
> **Objetivo:** que el administrador, en «Corte», elija «Corte de casa» y genere para el titular de «Viendo» el corte con costo de fábrica y ganancia real, sin costo de envío, con las mismas ventas, piezas y vendido que el corte con precios.

Fuentes:

- **Jira:** historia `SCRUM-59 · HU-21`, épica `SCRUM-10 · M4b · Corte para casa`. Requerimientos RF-11, RF-29, RF-30, RNF-02, RNF-03, RNF-04. Talla M. Depende de T-22 y HU-19.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantalla 08 Corte de caja: «Corte (para casa): costo de fábrica» y «para cubrir envíos (diferencia entre los dos costos)»). El usuario decidió el 2026-11-06 que el corte para casa no la muestra (§10).
- **Canvas:** no se pudo leer desde esta cuenta (el enlace de Confluence da «no encontrado»). El diseño sigue a HU-19 (decisión del usuario, §9).
- **Código:** `features/cash-cut/` (página `admin-cash-cut-page`, `CUT_TYPE_OPTIONS`, `CashCutService`, componentes `cut-summary`, `cut-product-line` y `cut-sale-item`), y `backend/src/cuts/home-cut.ts` (forma de la respuesta).
- **Decisiones del usuario del 2026-11-05** (§9). Cierran los dos «Por decidir» de `SCRUM-59`.

## 1. Alcance

**Entra en este spec:**

- **Frontend, en `features/cash-cut/`:**
  - «Corte de casa» habilitado en el selector «Tipo de corte» de `/admin/corte`.
  - `CashCutService.getHome()`, que pide `GET /api/cuts?type=home`.
  - Llaves opcionales del corte para casa en `interfaces/cash-cut.models.ts`.
  - Input `cutType` en `cut-summary`, `cut-product-line` y `cut-sale-item`, para que pinten las cifras y los textos del corte para casa.
  - Corte para casa del titular de «Viendo»: un vendedor, o «Yo · bodega» como corte para casa de la bodega.
- **Una excepción aprobada a la protección de tests:** el usuario actualiza a mano un caso de HU-19 (§6, paso 3).
- **Pruebas nuevas** en archivos `*.home.spec.ts` (§7), y verificación manual a 375 px.

**No entra en este spec:**

- El resumen de todo el negocio con «Yo» y su desglose por titular (HU-22). Aquí, con «Yo · bodega», el corte para casa es solo el de la bodega.
- «Mi corte» del vendedor (HU-20): el vendedor nunca ve el corte para casa.
- Cambios en el backend. `GET /api/cuts?type=home` (T-22) se usa tal como está.
- Recordar el tipo de corte entre pantallas.
- «Para cubrir envíos» en cualquier parte del corte para casa (decisión del usuario del 2026-11-06, §10). El backend (T-22) lo sigue calculando; la pantalla no lo pinta.
- La prueba de cuentas con un ejemplo completo (T-23).
- «¿A crédito?», «cobrado», productos más vendidos (RF-18) y Exportar (RF-20).
- Modificar cualquier otro test que ya tenga commit.

## 2. Reglas de negocio

- **Tipo de corte (criterio 1):**
  - El selector ofrece «Corte del vendedor» y «Corte de casa». Los dos están habilitados, sin «Próximamente».
  - Al entrar a «Corte» siempre está elegido «Corte con precios», como el periodo, que siempre empieza en «Día». No se guarda nada.
  - La ayuda del selector cambia con el tipo:
    - Con precios: «Usa los precios y el costo con envío que le pusiste a cada vendedor.» (la de HU-19).
    - Para casa: «Usa el costo de fábrica guardado en cada venta.»
- **Generar (criterios 2 y 7):**
  - Con «Corte de casa», «Generar corte» pide `GET /api/cuts?type=home&holderId=…&period=…&date=…`. Con «Yo · bodega», `holderId` no se manda.
  - Al cambiar el tipo de corte, el periodo, la flecha o el titular de «Viendo», el corte generado se quita y vuelve la tarjeta «Generar corte». Una respuesta que llega tarde se descarta, igual que en HU-19.
  - «Generar de nuevo» y «Reintentar» vuelven a pedir el mismo tipo de corte.
- **Resultado (criterios 2 a 5):**
  - **Título:** «Corte para casa · Luis» con un vendedor, o «Corte para casa» con la bodega.
  - **Resumen:**
    - «Vendido», con la misma leyenda de HU-19 («Vendió Luis · 2 al 8 nov · 5 piezas» o «Mis ventas desde bodega · …»).
    - «Costo de fábrica».
    - «Ganancia real».
    - Las cifras son `totals.total`, `totals.factoryCost` y `totals.realProfit`. No se recalcula nada en el frontend.
    - Una ganancia real negativa se muestra con signo menos.
  - **Desglose** (cierra el segundo «Por decidir»):
    - Mismo encabezado y mismo orden que HU-19.
    - Cada renglón muestra foto, nombre, «2 × $920.00», «costo de fábrica $1,200.00», el subtotal y «+$640.00» (la ganancia real).
  - **Ventas:**
    - La misma lista plegable de HU-19.
    - Cada venta muestra hora o fecha, el total, la ganancia real y «Registrada por ti» si corresponde.
    - Al desplegarla, cada producto muestra cantidad × precio, subtotal y su ganancia real.
  - **Mismas ventas (criterio 4, RF-30):** las piezas, el vendido, el desglose y las ventas son los mismos que en el corte con precios. Solo cambian el costo y la ganancia. Lo garantiza el backend (T-22), y la pantalla solo pinta lo que llega.
- **Dinero:** los montos llegan como texto y solo se convierten con `Number()` para el pipe `currency` (`$1,840.00`). Ninguna suma ni resta se hace en el frontend.
- **Estados (criterios 6 y 8):** los mismos de HU-19.
  - **Cargando:** «Calculando el corte…».
  - **Vacío:** con `salesCount === 0` sale «No hay ventas en este periodo», no un corte en ceros.
  - **Error:** «No se pudo generar el corte», con «Reintentar».
- **Solo administrador (RNF-04):**
  - La página vive bajo `/admin` (`roleGuard`).
  - La página del vendedor («Mi corte») no cambia, y sus componentes siguen con `cutType` en `'seller'`.
- **Celular (RNF-03, criterio 9):** a 375 px se usa sin zoom ni scroll horizontal, también con el resumen de tres cifras.
- **Textos:** los de este spec son propuestas, porque el canvas no se pudo leer. Se confirman en el paso de diseño (§6, paso 4).

## 3. Endpoint

No hay endpoints nuevos. Se usa `GET /api/cuts` con `type=home` (T-22, `specs/M4b-t22-base-corte-para-casa/spec.md` §4):

| Selección | Petición |
| --- | --- |
| Luis · Semana actual · Para casa | `GET /api/cuts?type=home&holderId=<id de Luis>&period=week&date=2026-11-02` |
| Yo · bodega · Día · Para casa | `GET /api/cuts?type=home&period=day&date=2026-11-05` |
| Luis · Semana · Con precios | `GET /api/cuts?holderId=<id>&period=week&date=2026-11-02` (igual que HU-19) |

Respuestas: `200` con `{ cut }`, con `type: "home"` y las llaves `factoryCost`, `realProfit`, `shippingCover` y `factoryUnitCost`, sin `cost`/`profit`. `401`/`403` los maneja el interceptor de sesión. `404` y `422` se muestran como error con «Reintentar».

## 4. Modelo de datos

Sin cambios en el backend. Cambios en `src/app/features/cash-cut/`:

```ts
// interfaces/cash-cut.models.ts — se agregan llaves opcionales del corte para casa (T-22).
// Son opcionales para que el corte con precios y los fixtures de HU-19/HU-20 sigan igual.
export type CutTypeValue = 'seller' | 'home'; // valor del selector; 'seller' = corte con precios

totals: { …; factoryCost?: string; realProfit?: string; shippingCover?: string };
CutProductLine: { …; factoryCost?: string; realProfit?: string; shippingCover?: string };
CutSale: { …; realProfit?: string; shippingCover?: string };
CutSaleLine: { …; factoryUnitCost?: string; realProfit?: string };
```

- **`CashCut`** no gana la llave `type`: la página sabe qué tipo pidió. Así no cambian los fixtures que ya tienen commit.
- **`models/admin-cash-cut-page.models.ts`:**
  - `CutTypeOption.value` pasa a ser `CutTypeValue`.
  - Tipo nuevo `CutRequest = CashCutQuery & { cutType: CutTypeValue }`, que es la petición generada por la página.
  - `CashCutQuery` no cambia.
- **`services/cash-cut.service.ts`:** método nuevo `getHome(query: CashCutQuery): Observable<CashCut>`. Arma los mismos parámetros que `get()` más `type=home`. `get()` no cambia.
- **`constants/admin-cash-cut-page.constants.ts`:**
  - En `CUT_TYPE_OPTIONS`, `seller` queda `{ label: 'Corte del vendedor', disabled: false }` y `home` queda `{ label: 'Corte de casa', disabled: false }`.
  - Textos nuevos: la ayuda para casa, los títulos «Corte para casa» y las etiquetas «Costo de fábrica», «Ganancia real» y «costo de fábrica». Los textos de los componentes van en sus `*.constants.ts`.
- **Componentes:** cada uno gana `cutType = input<CutTypeValue>('seller')`. Con `'home'` lee las llaves del corte para casa y usa sus textos. Con `'seller'` se comporta exactamente como hoy.
- **Página:**
  - `cutType` pasa de constante a `signal<CutTypeValue>('seller')`, enlazado al `p-select`.
  - `generated` guarda un `CutRequest`, y `request` lo compara también por `cutType`.
  - El `stream` de `rxResource` llama a `getHome()` o a `get()` según `cutType`.

## 5. Excepción aprobada a la protección de tests

`src/app/features/cash-cut/pages/admin-cash-cut-page/admin-cash-cut-page.component.spec.ts`, caso de las líneas 163 a 168: `it('el tipo de corte «para casa» está deshabilitado y «para vendedor» es el elegido', …)`.

- **Por qué cambia:** HU-21 habilita «para casa» (criterio 1). Con ese caso como está, ninguna implementación puede cumplir HU-21.
- **Quién lo cambia:** el usuario, a mano. El hook `proteger-tests.sh` bloquea a los agentes, y no se desactiva.
- **Qué queda:** `it('el tipo de corte «para casa» está habilitado y «para vendedor» es el elegido', …)`, que comprueba tres cosas:
  - la opción `home` tiene `disabled: false`;
  - su etiqueta no contiene «Próximamente»;
  - `fixture.componentInstance.cutType()` es `'seller'`.
- **Commit:** propio, antes del código de la página, con `ALLOW_TEST_CHANGES=1 git commit -m "test(cash-cut): habilitar el corte para casa en la prueba de HU-19"`.
- **Ningún otro test con commit se modifica.** El `reviewer` lo comprueba en cada paso.

## 5b. Segunda excepción aprobada a la protección de tests (2026-11-06)

Al quitar «Para cubrir envíos» del corte para casa, cambian las aserciones que exigían pintarlo. Las edita el usuario a mano, en un commit propio con `ALLOW_TEST_CHANGES=1`:

- `components/cut-summary/cut-summary.home.spec.ts`: el caso de la cifra `$200.00`, el de «para cubrir envíos» negativo, y el título «las cuatro cifras». Pasan a comprobar tres cifras y que `.shipping-cover` y «Para cubrir envíos» nunca aparecen, con vendedor y con la bodega.
- `pages/admin-cash-cut-page/admin-cash-cut-page.home.spec.ts`: la aserción de `.shipping-cover` = `$200.00` pasa a `toBeNull()`, y las constantes `HOME_OPTION` y `PRICES_OPTION` pasan a `'Corte de casa'` y `'Corte del vendedor'` (nombres nuevos del selector).
- Los fixtures conservan `shippingCover` (el backend lo sigue mandando). `cut-product-line.home.spec.ts` y `cut-sale-item.home.spec.ts` no cambian.

## 5c. Tercera excepción aprobada a la protección de tests (2026-11-06)

La estructura nueva del resultado (paso 4b) cambia aserciones de tests con commit de esta rama y de la página de HU-19. Las edita el usuario con un script, en un commit propio con `ALLOW_TEST_CHANGES=1`. Contrato del layout `overview`: `.sold` y `.sold-caption` (mismo texto) se conservan; la ganancia es `.profit-label` («Ganancia») y `.profit` en el resumen, el renglón y la venta (con «Corte de casa» su valor es la ganancia real), `.line-profit` en los productos de una venta desplegada; no existen `.cost`, `.cost-label`, `.factory-cost*`, `.real-profit*` ni `.line-real-profit` con `layout="overview"`.

- `components/cut-summary/cut-summary.home.spec.ts`, `cut-product-line/cut-product-line.home.spec.ts` y `cut-sale-item/cut-sale-item.home.spec.ts`: los casos de «Corte de casa» pasan a `layout="overview"` y a las clases de arriba. Los casos «sin cutType» no cambian.
- `pages/admin-cash-cut-page/admin-cash-cut-page.component.spec.ts` (HU-19): dos aserciones de `app-cut-summary .cost-label` pasan a `.profit-label` = «Ganancia».
- `pages/admin-cash-cut-page/admin-cash-cut-page.home.spec.ts`: las aserciones de `.factory-cost` y `.real-profit` pasan al contrato de arriba.
- No cambian: los specs de HU-20, `seller-cash-cut-page` y los de componente de HU-19 (el valor por omisión de `layout` es `classic`, igual que hoy).

## 6. Plan de implementación

Con `/spec-impl` en modo agentes, cada paso con pruebas sigue este orden:

1. `test-writer` escribe los tests en rojo.
2. El usuario revisa los tests y hace su commit.
3. `implementer` escribe el código que los hace pasar.
4. `reviewer` revisa el diff.
5. El usuario hace el commit del paso.

Los pasos:

1. **Modelos y servicio.**
   - Llaves opcionales y `CutTypeValue` en `interfaces/cash-cut.models.ts`, y `CutRequest` en `models/admin-cash-cut-page.models.ts`.
   - `CashCutService.getHome()`.
   - Tests nuevos en `services/cash-cut.service.home.spec.ts`: `type=home` con `holderId`, `period` y `date`, y sin `holderId` para la bodega.
   - `ng test`, `ng build` y `npm run check:architecture` pasan, y los tests de HU-19 y HU-20 siguen sin cambios.
2. **Componentes con `cutType`.**
   - Input `cutType` en `cut-summary`, `cut-product-line` y `cut-sale-item`, con sus textos en sus `*.constants.ts`.
   - Tests nuevos:
     - `cut-summary.home.spec.ts`: las tres cifras, sin «Para cubrir envíos» (con vendedor y con la bodega) y ganancia real negativa con signo.
     - `cut-product-line.home.spec.ts`: «costo de fábrica $1,200.00» y «+$640.00».
     - `cut-sale-item.home.spec.ts`: ganancia real por venta y por renglón.
   - Los specs que ya existen pasan sin cambios, porque el valor por omisión es `'seller'`.
3. **Página.**
   - Primero, la excepción de §5: el usuario edita ese caso y hace su commit.
   - Luego `test-writer` escribe `admin-cash-cut-page.home.spec.ts`:
     - petición con `type=home`, con un vendedor y con la bodega;
     - título y cifras del corte para casa;
     - al cambiar el tipo, el resultado se quita;
     - una respuesta tardía no se muestra;
     - «Generar de nuevo» y «Reintentar» piden el mismo tipo;
     - estado vacío con `salesCount 0`;
     - la ayuda cambia con el tipo.
   - `implementer`:
     - `cutType` como señal;
     - opción `home` habilitada;
     - `CutRequest` en `generated` y `request`;
     - `getHome()` en el `stream`;
     - títulos, ayuda y `cutType` hacia los componentes.
   - `ng test`, `ng build` y `npm run check:architecture` pasan.
4. **Diseño.**
   - ui-ux-pro-max y luego frontend-design, solo para el resumen de tres cifras y los textos nuevos. Se respeta la tarjeta de HU-19, con tokens de `styles.css` y PrimeNG.
   - Se confirman los textos de §2.
   - Es un paso sin pruebas nuevas: `implementer` y luego `reviewer`.
4b. **Estructura del resultado del administrador** (decisión del usuario del 2026-11-06).
   - Cada uno de `cut-summary`, `cut-product-line` y `cut-sale-item` gana `layout = input<'classic' | 'overview'>('classic')`. La página del administrador pasa `layout="overview"`; «Mi corte» no lo pasa y queda igual. Se elimina la rama «home» del layout `classic` (queda solo `overview` para ambos tipos).
   - **Resumen (`overview`):** arriba la franja con `.sold-caption` («Vendió Luis · 2 al 8 nov · 5 piezas»), luego «Vendido» y «Ganancia» lado a lado con el mismo peso (la ganancia en verde, o en rojo si es negativa), y al pie de la tarjeta «Generado hoy a las HH:MM» y «Generar de nuevo» (la página los proyecta con `ng-content`; conservan `.generated-at` y `.regenerate`). Sin costos.
   - **Desglose:** «2 × $920.00», subtotal y «+ganancia», sin línea de costo. **Ventas:** «Ganancia $X» y, al desplegar, la ganancia de cada producto.
   - Tests nuevos del `test-writer` en `*.overview.spec.ts` (con «Corte del vendedor» y «Corte de casa»); las ediciones de §5c las hace el usuario antes. Antes de implementar, ui-ux-pro-max y frontend-design para la franja, la pareja de cifras y el pie.

5. **Verificación manual** contra la base local con el seed, en escritorio y a 375 px:
   - Darle a Víctor una pieza con costo con envío `700` sobre un costo de fábrica de `600`, venderla y generar «Para casa · Día». Las cifras coinciden con las del corte con precios: el mismo vendido, y la ganancia real mayor en `100.00` (la diferencia de costos), sin cifra de envíos.
   - La pantalla no muestra «Para cubrir envíos» con ningún producto, aunque el backend mande `shippingCover`.
   - Al cambiar el tipo, el periodo o «Viendo», el resultado se quita.
   - Con «Yo · bodega», el corte para casa muestra las mismas tres cifras.
   - Un periodo sin ventas muestra el estado vacío.
   - Con el backend apagado se ve el error con «Reintentar».
   - A 375 px no hay scroll horizontal.
   - Al terminar, `npm run db:reset`.
6. **Cierre.**
   - Actualizar `specs/README.md` (fila y relaciones).
   - Agregar el corte para casa al párrafo de `features/cash-cut` en `CLAUDE.md` y `AGENTS.md`.
   - Comentar el avance en `SCRUM-59` en cada paso y moverla de estado según el flujo de `CLAUDE.md`.

## 7. Criterios de aceptación

Por criterio de `SCRUM-59`:

- [ ] **1.** En «Corte», el selector «Tipo de corte» ofrece «Corte del vendedor» y «Corte de casa». «Corte de casa» está habilitado y no dice «Próximamente».
- [ ] **2.** Con Luis, «Semana» y «Para casa», «Generar corte» muestra lo vendido, el costo de fábrica, la ganancia real y el desglose por producto (foto, piezas, precio y subtotal).
- [ ] **3.** 2 piezas a $920, con costo con envío $700 y de fábrica $600, se ven como vendido $1,840.00, costo de fábrica $1,200.00 y ganancia real $640.00, sin cifra de envíos y sin sumar ni redondear en el frontend.
- [ ] **4.** Con el mismo vendedor y periodo, los dos tipos de corte muestran las mismas ventas, piezas y vendido. Solo cambian el costo y la ganancia.
- [ ] **5.** El corte para casa no muestra «Para cubrir envíos» con ningún vendedor ni producto, aunque el backend mande `shippingCover`.
- [ ] **6.** Un periodo sin ventas muestra el estado vacío, no un corte en ceros.
- [ ] **7.** Al cambiar el tipo de corte, el periodo o el titular de «Viendo», el corte generado se quita y hay que volver a generarlo.
- [ ] **8.** Mientras carga se ve «Calculando el corte…». Si falla o no hay conexión se ve el error con «Reintentar», que vuelve a pedir el corte para casa.
- [ ] **9.** A 375 px se usa sin zoom ni scroll horizontal (RNF-03), y se genera en unos pocos toques (RNF-02).

Además (decisiones del 2026-11-05, §9):

- [ ] Al entrar a «Corte», «Corte con precios» está elegido.
- [ ] Con «Yo · bodega» y «Para casa» se genera el corte para casa de la bodega (sin `holderId`), con las mismas tres cifras.
- [ ] Cada renglón del desglose muestra «costo de fábrica» y la ganancia real, sin «para cubrir envíos».
- [ ] Cada venta de la lista muestra el total y la ganancia real, y al desplegarse cada producto muestra su ganancia real.
- [ ] La ayuda del selector cambia con el tipo de corte.
- [ ] El resultado del administrador (con los dos tipos de corte) muestra solo «Vendido» y «Ganancia», sin costos; arriba, quién vendió, cuándo y cuántas piezas; al pie, «Generado…» y «Generar de nuevo».
- [ ] El desglose por producto y las ventas muestran la ganancia, sin línea de costo; «Mi corte» del vendedor no cambia.
- [ ] «Mi corte» del vendedor no cambia: sus specs y los de HU-19 pasan sin modificarse, salvo el caso aprobado en §5.
- [ ] El único test que ya tenía commit y cambia es el de §5, en un commit propio con `ALLOW_TEST_CHANGES=1`.
- [ ] `features/cash-cut` no importa otras features. `npm run check:architecture`, `ng build` y `ng test` pasan.

## 8. Plan de pruebas

Todas en archivos nuevos `*.home.spec.ts`, al lado de lo que prueban:

- **`services/cash-cut.service.home.spec.ts`:** `getHome()` manda `type=home`, `period`, `date` y `holderId`. Sin `holderId` para la bodega. `get()` sigue sin `type`.
- **`components/cut-summary/cut-summary.home.spec.ts`:**
  - «Vendido», «Costo de fábrica» y «Ganancia real» con `$1,840.00`, `$1,200.00` y `$640.00`.
  - «Para cubrir envíos» no aparece, ni con vendedor ni con la bodega.
  - Una ganancia real negativa lleva signo.
- **`components/cut-product-line/cut-product-line.home.spec.ts`:** «costo de fábrica $1,200.00» y «+$640.00», y no muestra «costo con envío».
- **`components/cut-sale-item/cut-sale-item.home.spec.ts`:** el total y la ganancia real de la venta. Al desplegarse, la ganancia real de cada renglón.
- **`pages/admin-cash-cut-page/admin-cash-cut-page.home.spec.ts`:**
  - Peticiones con `type=home`, para un vendedor y para la bodega.
  - Título «Corte para casa · Luis» y resumen del corte para casa.
  - El resultado se quita al cambiar el tipo.
  - Una respuesta tardía no se muestra.
  - «Generar de nuevo» y «Reintentar» piden el mismo tipo.
  - Estado vacío.
  - La ayuda cambia con el tipo.
  - «Corte con precios» elegido al entrar.
- **Caso aprobado de §5**, en `admin-cash-cut-page.component.spec.ts`: lo cambia el usuario.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un componente con `cutType: 'home'` muestra por error el costo con envío | Los specs `*.home.spec.ts` comprueban que no aparece «costo con envío». La respuesta del corte para casa ni siquiera trae `cost`/`profit` |
| Se rompe «Mi corte» o el corte con precios al tocar los componentes | `cutType` vale `'seller'` por omisión. Los specs de HU-19 y HU-20 corren sin cambios en cada paso |
| Una respuesta tardía de un tipo se pinta con el otro tipo | `CutRequest` incluye `cutType`. Al cambiar, `request` vuelve a `undefined` y `rxResource` descarta la respuesta anterior |
| Los textos propuestos no coinciden con el canvas, que no se pudo leer | Se confirman en el paso 4 de diseño, y el usuario puede pasar capturas del tablero |
| Las ventas viejas tienen el costo de fábrica aproximado (T-22) | La pantalla pinta lo guardado. El aviso queda en T-22 y no se repite aquí |
| Editar el test de HU-19 deja la puerta abierta a más cambios de tests | La excepción nombra un solo caso, lo hace el usuario en un commit propio, y el `reviewer` marca cualquier otro |

## 10. Decisiones

- **Sí:** con «Yo · bodega», «Para casa» genera el corte para casa de la bodega (decisión del usuario). HU-22 lo reemplaza después por el resumen del negocio.
- **No:** deshabilitar «Para casa» con «Yo» hasta HU-22.
- **Sí:** el tipo de corte siempre empieza en «Con precios» (decisión del usuario). Cierra el primer «Por decidir» de `SCRUM-59`.
- **No:** recordarlo en `sessionStorage`. Sería estado nuevo que habría que limpiar al cerrar sesión.
- **Sí:** cada renglón del desglose muestra el costo de fábrica y la ganancia real; «para cubrir envíos» no se muestra (decisión del 2026-11-06). Cierra el segundo «Por decidir».
- **No:** «para cubrir envíos» en el renglón ni en el resumen. Tampoco solo foto, piezas, precio y subtotal.
- **Sí:** cada venta muestra el total y la ganancia real (decisión del usuario).
- **No:** «para cubrir envíos» por venta, ni quitar la lista de ventas.
- **Sí:** los mismos componentes con un input `cutType` y llaves propias del corte para casa (decisión del usuario).
- **No:** componentes nuevos para casa, que duplican plantillas casi iguales. Tampoco convertir la respuesta a `cost`/`profit`: sería una llave con dos sentidos, lo que T-22 descartó.
- **Sí:** el método aparte `getHome()`, que deja `get()` igual (decisión del usuario).
- **No:** `type` dentro de `CashCutQuery`, que obliga a cambiar los fixtures con commit.
- **Sí:** `CashCut` no gana la llave `type`, y las llaves del corte para casa son opcionales. Los fixtures que ya tienen commit siguen compilando.
- **Sí:** el valor del selector sigue siendo `'seller' | 'home'`, como en HU-19, aunque el backend use `prices`. El caso con commit comprueba `'seller'`.
- **Sí:** el diseño sigue a HU-19, (decisión del usuario, porque el canvas no se pudo leer).
- **Sí:** el usuario actualiza a mano el caso de HU-19 que exige «para casa» deshabilitado, en un commit propio con `ALLOW_TEST_CHANGES=1` (decisión del usuario, §5).
- **No:** que lo cambie un agente, porque rompería la protección `proteger-tests.sh`. Tampoco dejar «para casa» deshabilitado.
- **Sí:** los tests nuevos van en archivos `<nombre>.home.spec.ts` al lado de lo que prueban (decisión del usuario).

- **Sí:** las opciones del selector se llaman «Corte del vendedor» y «Corte de casa» (decisión del usuario del 2026-11-06, con el vocabulario del negocio). Los títulos «Corte con precios · Luis» y «Corte para casa · Luis» no cambian.
- **Sí:** el corte para casa no muestra «Para cubrir envíos» (decisión del usuario del 2026-11-06). El administrador ve la ganancia real con el costo de fábrica; el vendedor ve la suya con el costo con envío, en su corte con precios.
- **No:** quitar `shippingCover` del backend. T-22 ya está aplicada y HU-22 puede necesitarlo; solo la pantalla deja de pintarlo.

## Lo que **no** entra en este spec

- Resumen del negocio con «Yo» y desglose por titular (HU-22).
- «Mi corte» del vendedor y cualquier cambio en el backend.
- Recordar el tipo de corte.
- Prueba de cuentas completa (T-23), crédito, más vendidos y Exportar.
- Modificar cualquier test con commit distinto del caso de §5.
