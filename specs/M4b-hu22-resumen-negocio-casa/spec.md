# Spec técnico — HU-22 · Ver el resumen del negocio en el corte para casa con «Yo»

> **Estado:** Aprobado
> **Depende de:** M4b-t22-base-corte-para-casa (`specs/M4b-t22-base-corte-para-casa/spec.md`) — `getHomeCut`, totales del corte para casa y su redondeo; M4b-hu21-corte-para-casa (`specs/M4b-hu21-corte-para-casa/spec.md`) — «Corte de casa» en `/admin/corte`, `getHome()`, inputs `cutType` y `layout="overview"`; M4a-t20-base-cortes (`specs/M4a-t20-base-cortes/spec.md`) — `GET /api/cuts`, periodo y `salesOf`; M2-hu10-barra-viendo (`specs/M2-hu10-barra-viendo/spec.md`) — «Yo · bodega»; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — dinero como texto
> **Fecha:** 2026-11-06
> **Nota (2026-11-06, interruptor):** al probar el resumen del negocio, el usuario vio que con «Yo · bodega» y «Corte de casa» ya no había forma de ver solo sus ventas: el resumen reemplazaba al corte de la bodega y la ganancia salía mezclada con la de los vendedores. Decidió un **interruptor** «Incluir a mis vendedores» que aparece solo con «Yo · bodega» y «Corte de casa»: apagado (valor inicial) es el corte para casa de la bodega de HU-21, y encendido es el resumen del negocio. Cambia lo aprobado en el objetivo, en §1, §2, §3, §4, §5, §6, §7, §9 y §10. El backend no cambia.
> **Objetivo:** que el administrador, con «Yo · bodega» y «Corte de casa», genere el resumen de todo el negocio en el periodo (vendido y ganancia real de la bodega y de todos los vendedores) con un desglose por titular calculado en el backend, cuando encienda el interruptor «Incluir a mis vendedores», y vea solo sus ventas cuando esté apagado.

Fuentes:

- **Jira:** historia `SCRUM-60 · HU-22`, épica `SCRUM-10 · M4b · Corte para casa`. Requerimientos RF-29, RF-30, RNF-03, RNF-04. Talla S. Depende de T-22 y HU-21.
- **Código:** `backend/src/cuts/home-cut.ts` (`getHomeCut`, consultas de totales), `backend/src/cuts/cuts.ts` (`resolveCutPeriod`, `salesOf`), `backend/app/api/cuts/route.ts`, `backend/tests/home-cut.test.ts`; `src/app/features/cash-cut/` (página `admin-cash-cut-page`, `CashCutService`, `cut-summary`).
- **Decisiones del usuario del 2026-11-06** (§10). Cierran los tres «Por decidir» de `SCRUM-60` y ajustan sus criterios 1 y 2 (§2).

## 1. Alcance

**Entra en este spec:**

- **Backend, en `backend/src/cuts/`:**
  - Parámetro nuevo `scope` (`holder` | `business`) en `GET /api/cuts`. `holder` es el valor por omisión y deja todo como hoy.
  - Archivo nuevo `business-cut.ts` con el caso de uso de solo lectura `getBusinessCut(input, actor)`.
  - Constantes nuevas en `constants.ts` y su exportación en `index.ts`.
- **Frontend, en `features/cash-cut/`:**
  - `CashCutService.getBusiness()`, que pide `GET /api/cuts?type=home&scope=business`.
  - Con «Yo · bodega» y «Corte de casa» y el interruptor encendido, la página pide y pinta el resumen del negocio; con el interruptor apagado sigue pidiendo el corte para casa de la bodega sola, como HU-21.
  - Interruptor «Incluir a mis vendedores» (`p-toggleswitch`), que solo existe con «Yo · bodega» y «Corte de casa» (§2).
  - Input `scope` en `cut-summary`, solo para la leyenda de «Vendido».
  - Componente nuevo `cut-holder-line` para cada renglón del desglose por titular.
- **Dos excepciones aprobadas a la protección de tests:** el usuario edita a mano un caso de HU-21 (§6) y los casos del resumen del negocio que suponían que «Yo» lo pedía siempre (§6b).
- **Pruebas nuevas** (§9) y verificación manual a 375 px.

**No entra en este spec:**

- El corte con precios («Corte del vendedor») con «Yo»: sigue siendo solo la bodega, como en HU-19.
- Tocar un titular del desglose para abrir su corte.
- El desglose por producto y la lista de ventas del negocio.
- «Costo de fábrica» y «Para cubrir envíos» en pantalla. El backend los manda, la pantalla no los pinta (decisión de HU-21).
- Una tercera opción en «Tipo de corte» (el usuario prefirió el interruptor).
- Subtotales «Mis ventas» y «Mis vendedores» dentro de la tarjeta del resumen.
- El interruptor con «Corte del vendedor» (con precios) o con un vendedor en «Viendo».
- Recordar la posición del interruptor entre pantallas.
- Contar como «mis ventas» lo que el administrador registra desde el stock de un vendedor: sigue siendo del vendedor.
- Cambiar el corte para casa de un vendedor (HU-21) o el caso sin `scope` del backend (T-22).
- «Mi corte» del vendedor (HU-20).
- Exportar (v2), productos más vendidos (RF-18, v2) y la prueba de cuentas completa (T-23).
- Modificar cualquier otro test con commit distinto de los casos de §6 y §6b.

## 2. Reglas de negocio

- **Cuándo sale el resumen (criterio 1):**
  - Con «Yo · bodega» en «Viendo» y «Corte de casa» en el selector aparece el interruptor «Incluir a mis vendedores».
  - Apagado, «Generar corte» pide el corte para casa de la bodega sola (HU-21): «Mis ventas desde bodega…».
  - Encendido, «Generar corte» pide el resumen del negocio.
  - Con un vendedor en «Viendo», «Corte de casa» sigue siendo su corte para casa (HU-21) y no hay interruptor.
  - Con «Corte del vendedor», «Yo · bodega» sigue cortando solo la bodega (HU-19) y no hay interruptor. Cierra el primer «Por decidir».
- **Interruptor «Incluir a mis vendedores»:**
  - Siempre arranca apagado al entrar a «Corte». No se guarda nada.
  - Debajo, una ayuda que cambia: apagado, «Solo lo que vendiste desde la bodega.»; encendido, «Suma lo que vendieron tus vendedores.».
  - Cambiarlo quita el corte generado, igual que el tipo, el periodo, la flecha y «Viendo».
  - Si desaparece (porque se elige «Corte del vendedor» o un vendedor), el corte que se pide no lleva `scope` aunque haya quedado encendido.
  - «Mis ventas» es solo la bodega (`holder_profile_id is null`). Una venta que el administrador registra desde el stock de un vendedor cuenta del vendedor.
- **Qué ventas cuentan:**
  - Todas las ventas vigentes del periodo: las de la bodega (`holder_profile_id is null`) y las de cualquier vendedor, activo o desactivado (criterio 4).
  - Las anuladas no cuentan. El rango del periodo es el de T-20 (`[inicio, fin)` en hora de México).
- **Cifras (ajuste a los criterios 1 y 2 de Jira, decisión del 2026-11-06):**
  - La pantalla muestra solo «Vendido» y «Ganancia», igual que el layout `overview` de HU-21. «Ganancia» es la ganancia real del negocio (vendido menos costo de fábrica).
  - No se muestran «Costo de fábrica» ni «Para cubrir envíos», aunque el backend los mande.
- **Desglose por titular (criterio 2):**
  - Un renglón por titular con ventas en el periodo: la bodega y cada vendedor. Un titular sin ventas no aparece.
  - Cada renglón: nombre («Bodega» para la bodega), «3 ventas · 5 piezas», el vendido y «+$640.00» (la ganancia real). Una ganancia negativa lleva signo menos.
  - Un vendedor desactivado lleva la etiqueta «Desactivado» (`p-tag`).
  - Orden, lo da el backend: la bodega primero, luego los vendedores de mayor a menor vendido, y en empate por nombre.
  - Los renglones no se pueden tocar. No hay desglose por producto ni lista de ventas. Cierra el segundo y el tercer «Por decidir».
- **Cuadre sin centavos de diferencia (criterio 3):**
  - Cada titular se calcula con las mismas expresiones que `getHomeCut`, así su renglón es idéntico a su propio corte para casa.
  - Los totales del negocio son la suma (`sum()` en SQL) de las cifras ya redondeadas de cada titular. Así la suma de los renglones siempre da el total.
  - Ejemplo: bodega $500.00 y Luis $1,840.00 dan un vendido del negocio de $2,340.00.
- **Dinero:** los montos llegan como texto y solo se convierten con `Number()` para el pipe `currency`. El frontend no suma titulares ni resta costos.
- **Título y leyenda:**
  - El título del resultado sigue siendo «Corte para casa», el mismo de HU-21 con la bodega.
  - La leyenda de «Vendido» dice «Todo el negocio · 2 al 8 nov · 12 piezas».
  - La sección del desglose se titula «Por titular».
- **Generar, descartar y recargar:** igual que HU-21. Al cambiar el tipo de corte, el periodo, la flecha, «Viendo» o el interruptor, el resultado se quita. Una respuesta tardía se descarta. «Generar de nuevo» y «Reintentar» vuelven a pedir el mismo corte que se generó (el resumen del negocio o la bodega sola).
- **Estados (criterios 5 y 6):** los mismos de HU-19.
  - **Cargando:** «Calculando el corte…».
  - **Vacío:** con `totals.salesCount === 0` sale «No hay ventas en este periodo».
  - **Error o sin conexión:** «No se pudo generar el corte», con «Reintentar».
- **Solo administrador (RNF-04):** un vendedor recibe `403` con `scope=business`. La página vive bajo `/admin`.
- **Celular (RNF-03):** a 375 px se usa sin zoom ni scroll horizontal, también con nombres largos en el desglose.

## 3. Endpoint

`GET /api/cuts` gana el parámetro `scope`. No hay rutas nuevas.

| Selección | Petición |
| --- | --- |
| Yo · bodega · Semana · Corte de casa · interruptor encendido | `GET /api/cuts?type=home&scope=business&period=week&date=2026-11-02` |
| Yo · bodega · Semana · Corte de casa · interruptor apagado | `GET /api/cuts?type=home&period=week&date=2026-11-02` (igual que HU-21, sin `scope`) |
| Luis · Semana · Corte de casa | `GET /api/cuts?type=home&holderId=<id>&period=week&date=2026-11-02` (igual que HU-21) |
| Yo · bodega · Día · Corte del vendedor | `GET /api/cuts?period=day&date=2026-11-06` (igual que HU-19) |

Validación (la hace la ruta, antes de leer la base):

- `scope` distinto de `holder` y `business` → `422` «El alcance del corte debe ser holder o business».
- `scope=business` sin `type=home` → `422` «El resumen del negocio solo existe en el corte para casa».
- `scope=business` con `holderId` → `422` «El resumen del negocio no lleva holderId».
- Vendedor con `scope=business` → `403`, sin leer nada.
- `period` y `date` se validan como en T-20.

Respuesta `200`:

```jsonc
{
  "cut": {
    "type": "home",
    "scope": "business",
    "holder": null,
    "period": { "kind": "week", "from": "2026-11-02", "to": "2026-11-08", "timeZone": "America/Mexico_City" },
    "totals": { "salesCount": 4, "units": 7, "total": "2340.00", "factoryCost": "1512.50", "realProfit": "827.50", "shippingCover": "200.00" },
    "holders": [
      { "holder": null, "salesCount": 1, "units": 2, "total": "500.00", "factoryCost": "312.50", "realProfit": "187.50", "shippingCover": "0.00" },
      { "holder": { "id": "a000…0002", "fullName": "Luis Vendedor", "active": false }, "salesCount": 3, "units": 5, "total": "1840.00", "factoryCost": "1200.00", "realProfit": "640.00", "shippingCover": "200.00" }
    ]
  }
}
```

## 4. Modelo de datos

Sin cambios en la base. No hay migración.

**Backend (`backend/src/cuts/`):**

```ts
// constants.ts
export const CUT_SCOPES = ['holder', 'business'] as const;
export const DEFAULT_CUT_SCOPE = 'holder';
export const INVALID_CUT_SCOPE = 'El alcance del corte debe ser holder o business';
export const BUSINESS_REQUIRES_HOME = 'El resumen del negocio solo existe en el corte para casa';
export const BUSINESS_WITHOUT_HOLDER = 'El resumen del negocio no lleva holderId';

// business-cut.ts
export type CutScope = 'holder' | 'business';
export interface BusinessCutHolder extends HomeCutTotals {
  holder: { id: string; fullName: string; active: boolean } | null; // null = bodega
}
export interface BusinessCut {
  type: 'home';
  scope: 'business';
  holder: null;
  period: HomeCut['period'];
  totals: HomeCutTotals;
  holders: BusinessCutHolder[];
}
export function parseCutScope(scope: string): CutScope; // 422 con INVALID_CUT_SCOPE
export async function getBusinessCut(input: { period: CutPeriodKind; date?: string }, actor: CutActor): Promise<BusinessCut>;
```

- **Consulta:** una CTE agrupa por `ds.holder_profile_id` las ventas vigentes del periodo (las condiciones de `salesOf` sin el filtro de titular). Usa por titular las mismas expresiones de redondeo que `queryHomeTotals`. Se une a `profiles` con `left join` y sin filtrar por `active`.
- **Totales:** `sum()` sobre las filas de la CTE. Con cero filas, todo queda en cero y `holders` vacío.
- **Orden:** `holder_profile_id is null desc, total desc, full_name asc`.
- **Reuso:** `salesOf` recibe hoy un titular. El filtro del periodo se extrae a un helper exportado de `cuts.ts` (`salesInPeriod(period)`), y `salesOf` lo usa. El SQL de `salesOf` queda igual.
- **Ruta:** lee `scope` con `parseCutScope(params.get('scope') ?? DEFAULT_CUT_SCOPE)`, valida las dos combinaciones de §3 y llama a `getBusinessCut`, `getHomeCut` o `getCashCut`.

**Frontend (`src/app/features/cash-cut/`):**

```ts
// interfaces/cash-cut.models.ts
export type CutScope = 'holder' | 'business';
export interface BusinessCutHolder {
  holder: { id: string; fullName: string; active: boolean } | null;
  salesCount: number;
  units: number;
  total: string;
  factoryCost: string;
  realProfit: string;
  shippingCover: string;
}
// En CashCut se agrega una llave opcional, como las de HU-21:
holders?: BusinessCutHolder[];
```

- **`CashCut`** gana solo `holders?`. Los fixtures con commit siguen compilando, y si una respuesta no trae `holders` el desglose sale vacío.
- **`services/cash-cut.service.ts`:** `getBusiness(query: Pick<CashCutQuery, 'period' | 'date'>): Observable<CashCut>` manda `type=home`, `scope=business`, `period` y `date`. `get()` y `getHome()` no cambian.
- **Página:**
  - `CutRequest` pasa a `CashCutQuery & { cutType: CutTypeValue; scope: CutScope }` (en `models/admin-cash-cut-page.models.ts`). `scope` es `'business'` solo con «Yo · bodega», «Corte de casa» y el interruptor encendido; en cualquier otro caso es `'holder'`.
  - Señales `includeSellers` (`signal(false)`) y `showSellersToggle` (`computed`: `cutType() === 'home'` y sin vendedor en «Viendo»). `generate()` guarda `scope` según ambas.
  - `request` compara también `scope`, así cambiar el interruptor descarta el corte y una respuesta tardía no se pinta.
  - El `stream` de `rxResource` llama a `getBusiness()` con `scope === 'business'`, a `getHome()` con `cutType === 'home'` y a `get()` en el resto, siempre por la petición generada y no por los controles.
  - `isBusiness` (`computed`) vale `true` cuando la petición generada es `scope === 'business'`, y decide qué secciones se pintan.
  - `selectIncludeSellers(value)` asigna y quita el corte generado.
- **Interruptor:** `p-toggleswitch` (de `primeng/toggleswitch`) bajo «Tipo de corte», con la etiqueta «Incluir a mis vendedores» asociada al control. El tema (`core/ui/constants/mammut-theme.constants.ts`) solo carga los subpresets de Aura que se usan, así que se agrega el de `toggleswitch` con variables de `styles.css` y sin hex. Los textos van en `constants/admin-cash-cut-page.constants.ts`.
- **`cut-summary`:** gana `scope = input<CutScope>('holder')`. Con `'business'` la leyenda empieza con «Todo el negocio». Nada más cambia.
- **`components/cut-holder-line/`** (con `ng generate component`): presentacional, con `holder = input.required<BusinessCutHolder>()`. Sus textos («Bodega», «ventas», «piezas», «Desactivado») van en `cut-holder-line.constants.ts`.
- **Constantes:** «Todo el negocio» en `cut-summary.constants.ts`; «Por titular» en `constants/admin-cash-cut-page.constants.ts`.

## 5. Plan de implementación

Con `/spec-impl` en modo agentes, igual que HU-21: `test-writer` escribe los tests en rojo → el usuario los revisa y hace su commit → `implementer` escribe el código → `reviewer` revisa el diff → el usuario hace el commit del paso.

1. **Backend.**
   - `salesInPeriod` en `cuts.ts`, sin cambiar el SQL de `salesOf`.
   - Constantes, `parseCutScope`, `business-cut.ts` con `getBusinessCut`, exportación en `index.ts`, y `scope` en la ruta.
   - Tests nuevos en `backend/tests/business-cut.test.ts` (§9).
   - `npm test` (con `SUPABASE_SERVICE_ROLE_KEY`, para que no se salten los de cuentas) y `npm run type-check` pasan. `cuts.test.ts`, `home-cut.test.ts` y `architecture.test.ts` siguen sin cambios.
2. **Modelos y servicio del frontend.**
   - `CutScope`, `BusinessCutHolder` y `holders?` en `interfaces/cash-cut.models.ts`.
   - `CashCutService.getBusiness()`.
   - Tests nuevos en `services/cash-cut.service.business.spec.ts`.
3. **Componentes.**
   - Input `scope` en `cut-summary`.
   - `ng generate component features/cash-cut/components/cut-holder-line`.
   - Tests nuevos en `cut-summary.business.spec.ts` y `cut-holder-line.component.spec.ts`.
   - Los specs que ya existen pasan sin cambios, porque `scope` vale `'holder'` por omisión.
4. **Página.**
   - Primero, la excepción de §6: el usuario edita ese caso y hace su commit.
   - Luego `test-writer` escribe `admin-cash-cut-page.business.spec.ts` (§9).
   - `implementer`: `getBusiness()` en el `stream`, `isBusiness`, el resumen con `scope="business"`, la sección «Por titular» con `app-cut-holder-line`, y sin desglose por producto ni ventas en ese caso.
   - `ng test`, `ng build` y `npm run check:architecture` pasan.
5. **Diseño.**
   - ui-ux-pro-max y luego frontend-design, solo para la sección «Por titular» y su renglón. Se respeta la tarjeta `overview` de HU-21, con tokens de `styles.css` y PrimeNG (`p-tag`).
   - Es un paso sin pruebas nuevas: `implementer` y luego `reviewer`.
5b. **Interruptor «Incluir a mis vendedores»** (ajuste del 2026-11-06).
   - Primero, las excepciones de §6b: el usuario edita esos casos y hace su commit.
   - `test-writer` escribe `admin-cash-cut-page.toggle.spec.ts` (§9) y el usuario hace su commit.
   - `implementer`: `scope` en `CutRequest`, `includeSellers`, `showSellersToggle`, `isBusiness` por `scope`, el `stream`, el `p-toggleswitch` con sus textos y el subpreset de `toggleswitch` en el tema.
   - Cambio pequeño de una sola pieza de interfaz: no pasa por ui-ux-pro-max ni frontend-design, solo usa los tokens y la etiqueta de los demás controles de la pantalla.
   - `ng test`, `ng build` y `npm run check:architecture` pasan, y luego `reviewer`.
6. **Verificación manual** contra la base local con el seed, en escritorio y a 375 px:
   - Vender $500 desde la bodega y $1,840 con `vendedor1` en la misma semana. «Yo · bodega» + «Corte de casa» + «Semana» con el interruptor apagado muestra solo la bodega ($500.00). Encendido muestra «Vendido $2,340.00», y los renglones «Bodega» y el vendedor suman lo mismo.
   - Cambiar el interruptor quita el resultado. El interruptor no aparece con «Corte del vendedor» ni con un vendedor en «Viendo».
   - La ganancia de cada renglón es igual a la del corte para casa de ese titular (con el titular en «Viendo»).
   - `vendedor2` vende y luego se desactiva: sigue en el total y en el desglose, con «Desactivado».
   - Con «Corte del vendedor», «Yo · bodega» sigue mostrando solo la bodega.
   - Un periodo sin ventas muestra el estado vacío. Con el backend apagado se ve el error con «Reintentar».
   - A 375 px no hay scroll horizontal.
   - Al terminar, `npm run db:reset`.
7. **Cierre.**
   - Actualizar `specs/README.md` (estado y relaciones).
   - Agregar el resumen del negocio y su interruptor al párrafo de `features/cash-cut` en `CLAUDE.md` y `AGENTS.md`.
   - Comentar en `SCRUM-60` el ajuste de los criterios 1 y 2 (solo vendido y ganancia), el avance de cada paso, y moverla de estado según el flujo de `CLAUDE.md`.

## 6. Excepción aprobada a la protección de tests

`src/app/features/cash-cut/pages/admin-cash-cut-page/admin-cash-cut-page.home.spec.ts`, caso de la línea 260: `it('con «Yo · bodega» y «Para casa» no manda holderId y no muestra «Para cubrir envíos»', …)`.

- **Por qué cambia:** exige la leyenda «Mis ventas desde bodega» con «Yo · bodega» y «Corte de casa». HU-22 reemplaza ese resultado por el resumen del negocio, que dice «Todo el negocio».
- **Quién lo cambia:** el usuario, a mano. El hook `proteger-tests.sh` bloquea a los agentes y no se desactiva.
- **Qué queda:** `it('con «Yo · bodega» y «Corte de casa» pide el resumen del negocio y no muestra «Para cubrir envíos»', …)`, que comprueba:
  - `type=home`, `scope=business`, sin `holderId`, con `period` y `date`;
  - el título «Corte para casa»;
  - la leyenda contiene «Todo el negocio»;
  - `.profit` y la ausencia de `.shipping-cover`, como hoy.
- **Commit:** propio, antes del código de la página, con `ALLOW_TEST_CHANGES=1 git commit -m "test(cash-cut): pedir el resumen del negocio con la bodega"`.
- **Los demás casos con «Yo · bodega» y «Corte de casa»** (líneas 276, 291, 307 y 320 del mismo archivo) pasan sin cambios: solo comprueban `type=home`, el título «Corte para casa», «Generar de nuevo» y «Reintentar». Por eso el título no cambia y `holders` es opcional.
- **Ningún otro test con commit se modifica.** El `reviewer` lo comprueba en cada paso.

## 6b. Segunda excepción aprobada a la protección de tests (2026-11-06)

Con el interruptor apagado por omisión, «Yo · bodega» + «Corte de casa» pide otra vez la bodega sola, y los casos que suponían que pedía el resumen del negocio dejan de cumplirse. Los edita el usuario a mano (con un script), en un commit propio con `ALLOW_TEST_CHANGES=1`, antes del código de la página. El hook `proteger-tests.sh` bloquea a los agentes y no se desactiva.

1. `pages/admin-cash-cut-page/admin-cash-cut-page.home.spec.ts`, el caso de §6 (el de «pide el resumen del negocio»): vuelve a comprobar lo de HU-21 con el interruptor apagado — `type=home`, **sin** `scope`, sin `holderId`, con `period` y `date`; título «Corte para casa»; leyenda «Mis ventas desde bodega»; `.profit` y sin `.shipping-cover`. El fixture `BUSINESS_CUT` de ese archivo deja de usarse.
2. `pages/admin-cash-cut-page/admin-cash-cut-page.business.spec.ts`: los casos que generan con «Yo · bodega» y «Corte de casa» deben encender el interruptor antes de «Generar corte». Se agrega un ayudante `turnOnSellers()` y se llama en `generateBusiness()` y en los casos que hacen `pickCutType(HOME_OPTION)` y `click('.generate')` con la bodega. Los casos con un vendedor, con «Corte del vendedor» o que cambian «Viendo» no cambian.

- **Ningún otro test con commit se modifica.** El `reviewer` lo comprueba.

## 7. Criterios de aceptación

Por criterio de `SCRUM-60` (1 y 2 ajustados el 2026-11-06):

- [ ] **1.** Con «Yo · bodega», «Corte de casa» y el interruptor «Incluir a mis vendedores» encendido, «Generar corte» pide `type=home&scope=business` y muestra «Vendido» y «Ganancia» (ganancia real) del negocio en el periodo, sumando la bodega y todos los vendedores.
- [ ] **2.** El resumen muestra el desglose «Por titular»: la bodega y cada vendedor con ventas en el periodo, cada uno con «N ventas · M piezas», su vendido y su ganancia real.
- [ ] **3.** Con la bodega en $500 y Luis en $1,840, el vendido del negocio es $2,340.00. En la respuesta, la suma de `total`, `factoryCost`, `realProfit` y `shippingCover` de los titulares es igual a la de `totals`, al centavo.
- [ ] **4.** Un vendedor desactivado con ventas en el periodo cuenta en el total y aparece en el desglose con la etiqueta «Desactivado».
- [ ] **5.** Un periodo sin ventas muestra «No hay ventas en este periodo», no un resumen en ceros.
- [ ] **6.** Mientras carga se ve «Calculando el corte…». Si falla o no hay conexión se ve el error, y «Reintentar» vuelve a pedir el resumen del negocio. A 375 px se usa sin zoom ni scroll horizontal.

Además (decisiones del 2026-11-06, §10):

- [ ] El resumen no muestra «Costo de fábrica» ni «Para cubrir envíos», aunque el backend los mande.
- [ ] El renglón de cada titular tiene las mismas cifras que su propio corte para casa (`getHomeCut`) en el mismo periodo.
- [ ] El desglose sale con la bodega primero y luego los vendedores de mayor a menor vendido. No tiene desglose por producto ni lista de ventas, y sus renglones no se pueden tocar.
- [ ] Con «Corte del vendedor», «Yo · bodega» sigue cortando solo la bodega, sin `scope` y sin interruptor.
- [ ] Con un vendedor en «Viendo», «Corte de casa» sigue pidiendo su corte para casa, sin `scope` y sin interruptor.
- [ ] El interruptor «Incluir a mis vendedores» solo aparece con «Yo · bodega» y «Corte de casa», y siempre arranca apagado.
- [ ] Con el interruptor apagado, «Generar corte» pide `type=home` sin `scope` y muestra la bodega sola («Mis ventas desde bodega…»), sin «Por titular».
- [ ] Cambiar el interruptor quita el corte generado, una respuesta tardía no se muestra, y «Generar de nuevo» y «Reintentar» repiten el mismo corte.
- [ ] Si el interruptor queda encendido y se cambia a «Corte del vendedor» o a un vendedor, el corte que se pide no lleva `scope`.
- [ ] La etiqueta «Incluir a mis vendedores» está asociada al control y la ayuda cambia con su estado.
- [ ] Un vendedor recibe `403` con `scope=business`. `scope` inválido, `scope=business` sin `type=home` y `scope=business` con `holderId` dan `422`.
- [ ] `GET /api/cuts` sin `scope` responde igual que antes: `cuts.test.ts` y `home-cut.test.ts` pasan sin cambios.
- [ ] Los únicos tests con commit que cambian son los de §6 y §6b, en commits propios con `ALLOW_TEST_CHANGES=1`.
- [ ] `features/cash-cut` no importa otras features. `npm run check:architecture`, `ng build`, `ng test`, y en `backend/` `npm test` y `npm run type-check`, pasan.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los totales del negocio difieren por un centavo de la suma de los renglones | Los totales son `sum()` de las cifras ya redondeadas de cada titular, no un redondeo aparte. Un test lo comprueba con costos de 4 decimales |
| El renglón de un titular no coincide con su propio corte para casa | La CTE usa las mismas expresiones que `queryHomeTotals`. Un test compara cada renglón con `getHomeCut` |
| Un vendedor desactivado desaparece del resumen | `left join profiles` sin filtrar por `active`. Un test desactiva a un vendedor con ventas |
| Extraer `salesInPeriod` cambia las cifras de los cortes que ya existen | El SQL de `salesOf` queda igual. `cuts.test.ts` y `home-cut.test.ts` corren sin cambios |
| Una respuesta del corte para casa de la bodega se pinta como resumen del negocio | `holders` es opcional y el desglose sale vacío. La página solo decide por la petición generada (`scope`) |
| El interruptor queda encendido y se pide un corte con `scope` donde no corresponde | `generate()` solo manda `scope: 'business'` si `showSellersToggle()` es verdadero. Un test lo comprueba cambiando a «Corte del vendedor» y a un vendedor |
| El tema de PrimeNG no trae el interruptor y se ve sin estilo | Se agrega el subpreset de `toggleswitch` con variables de `styles.css`. Se revisa en la verificación manual |
| El interruptor apagado por omisión rompe tests con commit | §6b lista los casos exactos y los edita el usuario. El `reviewer` comprueba que no cambie ningún otro |
| Nombres largos rompen el renglón a 375 px | Se revisa en el paso de diseño y en la verificación manual, con truncado del nombre |

## 9. Plan de pruebas

**Backend — `backend/tests/business-cut.test.ts`** (contra la base real, con datos `test-` que se limpian):

- Bodega $500 y vendedor $1,840 en el mismo día: `totals.total` = `2340.00`, y la suma de cada cifra de `holders` es igual a la de `totals`.
- Costos de 4 decimales en varios titulares: los totales siguen cuadrando al centavo con los renglones.
- Cada renglón es igual a los totales de `getHomeCut` de su titular.
- Un vendedor desactivado con ventas aparece con `active: false` y cuenta en el total.
- Orden: la bodega primero y luego los vendedores por `total` descendente.
- Las ventas anuladas y las de fuera del periodo no cuentan.
- Periodo sin ventas: totales en cero y `holders` vacío.
- Por HTTP: `403` para un vendedor, y `422` con `scope` inválido, sin `type=home` y con `holderId`.

**Frontend:**

- **`services/cash-cut.service.business.spec.ts`:** `getBusiness()` manda `type=home`, `scope=business`, `period` y `date`, sin `holderId`. `getHome()` sigue sin `scope`.
- **`components/cut-summary/cut-summary.business.spec.ts`:** con `scope="business"` la leyenda dice «Todo el negocio». Sin `scope` sigue diciendo «Mis ventas desde bodega».
- **`components/cut-holder-line/cut-holder-line.component.spec.ts`:** «Bodega» para `holder: null`; nombre, «3 ventas · 5 piezas», vendido y «+$640.00»; ganancia negativa con signo; «Desactivado» solo con `active: false`; sin costo de fábrica ni envíos.
- **`pages/admin-cash-cut-page/admin-cash-cut-page.business.spec.ts`:**
  - Con «Yo · bodega» y «Corte de casa» llama a `getBusiness()` y no a `getHome()`.
  - Pinta «Por titular» con un `app-cut-holder-line` por titular, en el orden de la respuesta, y no pinta el desglose por producto ni las ventas.
  - Con un vendedor en «Viendo», «Corte de casa» llama a `getHome()`.
  - Con «Corte del vendedor» y «Yo · bodega» llama a `get()`.
  - El resultado se quita al cambiar el tipo, el periodo o «Viendo», y una respuesta tardía no se muestra.
  - «Generar de nuevo» y «Reintentar» vuelven a pedir el resumen del negocio.
  - Estado vacío con `salesCount 0`.
- **`pages/admin-cash-cut-page/admin-cash-cut-page.toggle.spec.ts`** (nuevo, del ajuste del 2026-11-06):
  - El interruptor aparece con «Yo · bodega» y «Corte de casa», y no aparece con «Corte del vendedor» ni con un vendedor en «Viendo».
  - Arranca apagado; con él apagado pide `getHome()` sin `scope` y la leyenda dice «Mis ventas desde bodega», sin «Por titular».
  - Encendido pide `getBusiness()` y pinta «Todo el negocio» y «Por titular».
  - Cambiar el interruptor quita el resultado, y una respuesta tardía no se muestra.
  - «Generar de nuevo» y «Reintentar» repiten el mismo corte, con el interruptor encendido y apagado.
  - Con el interruptor encendido, cambiar a «Corte del vendedor» o a un vendedor pide el corte sin `scope`.
  - La ayuda cambia con el estado y la etiqueta está asociada al control.
- **Casos aprobados de §6 y §6b:** los cambia el usuario.

## 10. Decisiones

- **Sí:** el resumen muestra solo «Vendido» y «Ganancia» (ganancia real), como el layout `overview` de HU-21 (decisión del usuario). Ajusta los criterios 1 y 2 de Jira, que pedían cuatro cifras.
- **No:** las cuatro cifras de Jira, ni «Para cubrir envíos» solo en el resumen. Romperían la decisión de HU-21.
- **Sí:** el parámetro nuevo `scope=business` en `GET /api/cuts` (decisión del usuario). Lo que existe no cambia y ningún test del backend con commit se toca.
- **No:** reemplazar el caso sin `holderId` de `type=home`. Rompe `home-cut.test.ts:180`. Tampoco una ruta aparte `GET /api/cuts/business`, que duplica la validación de periodo y fecha.
- **Sí:** con «Corte del vendedor», «Yo» sigue cortando solo la bodega (decisión del usuario). Cierra el primer «Por decidir».
- **No:** el corte con precios del negocio. Es otro cálculo y se sale de la talla S.
- **Sí:** el desglose es solo por titular y sus renglones no se pueden tocar (decisión del usuario). Cierra el segundo y el tercer «Por decidir».
- **No:** abrir el corte de un titular al tocarlo, porque cambiaría el estado global de «Viendo». Tampoco el desglose por producto del negocio.
- **Sí:** el resumen del negocio y el corte de la bodega sola conviven con un interruptor «Incluir a mis vendedores» (decisión del usuario del 2026-11-06). Sustituye a lo decidido antes («el resumen reemplaza al corte de la bodega»), que dejó sin salida ver solo las ventas del administrador.
- **No:** reemplazar el corte de la bodega por el resumen, ni una tercera opción «Resumen del negocio» en «Tipo de corte» (se eligió primero y el usuario prefirió el interruptor), ni subtotales «Mis ventas / Mis vendedores» en la tarjeta.
- **Sí:** el interruptor arranca apagado («Solo mis ventas»), no se guarda, y solo existe con «Yo · bodega» y «Corte de casa» (decisión del usuario).
- **No:** el interruptor con «Corte del vendedor»: el resumen del negocio con precios es otro cálculo y sigue fuera.
- **Sí:** «mis ventas» es solo la bodega; lo que el administrador registra desde el stock de un vendedor es del vendedor (decisión del usuario, como HU-19, HU-20 y HU-21).
- **Sí:** `scope` entra en `CutRequest` para que el interruptor forme parte de lo que se pide: cambiarlo descarta el corte y una respuesta tardía no se pinta. Cambia lo dicho antes («`CutRequest` no cambia»).
- **Sí:** el título del resultado sigue siendo «Corte para casa» en los dos modos y solo cambia la leyenda de «Vendido» («Todo el negocio» o «Mis ventas desde bodega»), para no tocar más tests con commit. El interruptor y esa leyenda dejan claro cuál es cada corte.
- **Sí:** los casos de §6b los edita el usuario a mano con `ALLOW_TEST_CHANGES=1` (decisión del usuario del 2026-11-06). No se deja el interruptor encendido por omisión para evitarlo: el usuario eligió apagado.
- **Sí:** el backend manda en totales y titulares las mismas llaves que T-22 (decisión del usuario). La pantalla pinta solo `total` y `realProfit`.
- **Sí:** la bodega primero y luego los vendedores por vendido, en empate por nombre (decisión del usuario).
- **Sí:** el renglón muestra nombre, «N ventas · M piezas», vendido, ganancia y la etiqueta «Desactivado» (decisión del usuario).
- **Sí:** los totales del negocio son la suma de las cifras ya redondeadas de cada titular. El criterio 3 pide que el desglose cuadre al centavo, y así cada renglón es igual al corte para casa de su titular.
- **No:** redondear el costo de fábrica una sola vez sobre todo el negocio. Puede diferir un centavo de la suma de los renglones.
- **Sí:** el usuario edita a mano el caso de HU-21 de §6, en un commit propio con `ALLOW_TEST_CHANGES=1` (decisión del usuario).
- **Sí:** el título sigue siendo «Corte para casa», y solo cambia la leyenda («Todo el negocio»). Así cambia un solo test con commit y no cinco.
- **Sí:** `holders` es opcional en `CashCut` y el resumen se deduce de la petición (`cutType` y `holderId`), sin llave `scope` en el modelo. Es el mismo criterio de HU-21: los fixtures con commit siguen compilando.
- **Sí:** un componente presentacional nuevo `cut-holder-line`, porque el renglón no se parece a `cut-product-line` (sin foto, precio ni piezas por precio).
- **Sí:** el filtro del periodo se extrae a `salesInPeriod`, y el resumen y `salesOf` usan las mismas condiciones. Así el resumen ve exactamente las ventas de los cortes por titular.

## Lo que **no** entra en este spec

- El corte con precios del negocio con «Yo».
- Abrir el corte de un titular desde el desglose.
- El desglose por producto y la lista de ventas del negocio.
- «Costo de fábrica» y «Para cubrir envíos» en pantalla.
- Una tercera opción en «Tipo de corte» y subtotales «Mis ventas / Mis vendedores» en la tarjeta.
- El interruptor con «Corte del vendedor» o con un vendedor en «Viendo».
- «Mi corte» del vendedor, Exportar, productos más vendidos y la prueba de cuentas completa (T-23).
- Modificar cualquier test con commit distinto de los casos de §6 y §6b.
