# Spec técnico — HU-20 · Ver mi corte como vendedor, con la ganancia del precio que puso el administrador

> **Estado:** Aprovado
> **Depende de:** M4a-t20-base-cortes (`specs/M4a-t20-base-cortes/spec.md`) — `GET /api/cuts` y el recorte por rol que este spec cambia; M4a-hu19-corte-administrador (`specs/M4a-hu19-corte-administrador/spec.md`) — feature `cash-cut`, componentes y reglas de periodo que se reutilizan; M2-hu11-dejar-a-vendedor (`specs/M2-hu11-dejar-a-vendedor/spec.md`) — precio y costo con envío propios del vendedor; M3-hu16-confirmar-venta (`specs/M3-hu16-confirmar-venta/spec.md`) — ventas del vendedor; M3-hu14-ver-mi-stock (`specs/M3-hu14-ver-mi-stock/spec.md`) — shell y rutas del vendedor; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — dinero como texto
> **Fecha:** 2026-11-04
> **Objetivo:** que el vendedor, en «Mi corte», genere su corte de un día, semana o mes (actual o anterior) y vea lo vendido, lo que entrega, su ganancia calculada con el precio y el costo con envío que le puso el administrador, el desglose por producto y las ventas que lo forman.

Fuentes:

- **Jira:** historia `SCRUM-56 · HU-20`, épica `SCRUM-9 · M4a · Corte del vendedor`. Requerimientos RF-02, RF-11, RNF-03, RNF-04. Talla S. Depende de T-20, HU-14 y HU-16.
- **Confluence:** «Mockups y flujo de pantallas · MVP v1» (§3, pantalla 10 Mi corte, v1 parcial: sin contado ni crédito).
- **Canvas:** tableros `VendedorCorte` (sin generar y generado) y `EstadosMiCorte` (cargando, vacío y error).
- **Código:** `backend/src/cuts/cuts.ts` (`trimForRole`), `backend/src/sales/sales.ts` (el precio y el costo que guarda cada venta), `backend/src/deliveries/` (precio y costo propios), `features/cash-cut/` (HU-19), `core/layout/routes/seller.routes.ts` (hoy `mi-corte` carga «Próximamente»).
- **Decisiones del usuario del 2026-11-04** (§9).

## 1. Por qué este spec cambia una regla anterior

Jira (criterios 4 y 5 de `SCRUM-56`), RF-02, RNF-04 y T-20 decían que el vendedor nunca ve costo ni ganancia. El usuario decidió lo contrario: el vendedor **sí ve su ganancia**, y esa ganancia se cuenta con el precio de venta y el costo con envío que el administrador le puso al dejarle el producto (HU-11).

Esa cuenta ya existe: cada venta guarda `unit_price` (el del vendedor, o el general si no tiene) y `unit_cost` (`unitCostWithShipping ?? unitCost`), y el corte de T-20 calcula `ganancia = total − costo` con ellos. Este spec **no cambia la fórmula**: quita el recorte que le escondía esas cifras al vendedor y construye su pantalla.

## 2. Alcance

**Entra en este spec:**

- **Backend (`@cuts`):**
  - `getCashCut` devuelve costo y ganancia también al vendedor. Se elimina `trimForRole`.
  - El vendedor sigue pidiendo solo su corte (otro `holderId` es `403`) y sigue sin poder ver el de la bodega ni el de otros.
  - Pruebas de `backend/tests/cuts.test.ts` ajustadas (§7). Sin endpoints, tablas ni migraciones nuevas.
- **Frontend (`features/cash-cut/`):**
  - Página `seller-cash-cut-page` en `/vendedor/mi-corte`, que reemplaza a «Próximamente».
  - Periodo Día (por defecto), Semana o Mes, con flechas «‹ Anterior» / «Siguiente ›» como HU-19.
  - «Generar corte» y el resultado: vendido, lo que entrega (costo con envío), ganancia, desglose por producto con foto y lista de ventas plegada, hora de generación y «Generar de nuevo».
  - Estados del canvas: sin generar, cargando, vacío y error con «Reintentar».
  - Reutiliza los componentes de HU-19 con ajustes de texto por un `input()` (§4).
- **Diseño:** flujo de `CLAUDE.md` (ui-ux-pro-max y luego frontend-design) sobre `VendedorCorte` y `EstadosMiCorte`.
- **Cierre:** actualizar la historia `SCRUM-56` en Jira (criterios 4 y 5) y la regla RF-02/RNF-04 en lo que toca al corte.
- **Pruebas** del backend y del frontend (§7) y verificación manual a 375 px.

**No entra en este spec:**

- **«Enviar corte al administrador»**: guardar cortes enviados, el `POST`, la tabla y lo que ve el administrador. Va en un spec propio (§9).
- Corte para casa y «para cubrir envíos» (M4b).
- Contado, crédito, abonos y notas a crédito (v2, RF-13).
- Selector de fecha libre, Exportar y productos más vendidos.
- Que el administrador vea los cortes que el vendedor generó.
- Costo de fábrica o precio general: el vendedor solo ve lo guardado en sus ventas (ver riesgo, §8).
- Cambiar la fórmula de ganancia, el redondeo o la regla de periodo de T-20.

## 3. Reglas de negocio

- **Quién:** solo un vendedor activo, en `/vendedor/mi-corte` (`roleGuard`). La página no manda `holderId`: el backend usa al propio vendedor. No hay barra «Viendo».
- **Ganancia con el precio del administrador:**
  - El precio y el costo con envío salen de lo que el administrador escribió al dejarle el producto (HU-11), tal como quedaron guardados en cada venta.
  - Si el administrador no modificó el precio, se toma el precio de venta general del producto; si no puso costo con envío, se toma el costo de fábrica. La ganancia es siempre el precio con que se vendió menos el costo guardado en esa venta (decisión del usuario).
  - **Cuando el administrador actualiza un precio (decisión del usuario).** El precio y el costo se fijan en el momento de cada venta, y el corte suma esas ventas tal como quedaron:
    - **Ventas ya hechas:** si el vendedor ya vendió con el precio anterior, esas ventas entran al corte y a la ganancia con ese precio. Una actualización posterior no las cambia.
    - **Ventas nuevas:** toda venta que el vendedor haga después de la actualización toma el precio nuevo, y con él se calcula su ganancia. Si todavía no había vendido ese producto, su primera venta ya sale con el precio nuevo.
    - **Un periodo que cruza la actualización** muestra el producto en dos renglones: uno con el precio anterior (lo vendido antes) y otro con el nuevo (lo vendido después).
  - **De dónde sale el precio nuevo** (`sales.ts`, al confirmar la venta): el precio propio del vendedor si lo tiene; si no, el precio general vigente del producto (editado en HU-06). Con el costo igual: el costo con envío propio, o el costo de fábrica vigente.
  - Si el vendedor tiene precio propio, cambiar el precio general no lo afecta. El administrador actualiza el suyo dejándole producto otra vez (HU-11), y desde ahí rige el nuevo. Un mismo producto con dos precios sale en dos renglones del desglose (regla de T-20).
  - Ejemplo: 2 piezas a $920 con costo con envío $700 → vendido $1,840.00, costo con envío $1,400.00, ganancia $440.00.
- **Cifras:** son `totals.total`, `totals.cost` y `totals.profit` de `GET /api/cuts`. El frontend no suma ni resta dinero; solo formatea con el pipe `currency`. La ganancia negativa se muestra con signo menos.
- **Resumen:**
  - «Vendido»: «Vendí · 2 al 8 nov · 5 piezas».
  - «Total a entregar»: el costo con envío (`totals.cost`).
  - «Ganancia»: `totals.profit`.
- **Periodo:** igual que HU-19 (Día, Semana de lunes a domingo o Mes, en hora de México; «Siguiente» deshabilitado en el actual; cambiar de clase vuelve al periodo actual). Al entrar es «Día» del periodo actual.
- **Generar:**
  - Antes: tarjeta «Mi corte · {periodo}» con «Elige el periodo y genera tu corte cuando termines de vender.».
  - Al tocar «Generar corte» se pide `GET /api/cuts?period=…&date=…`.
  - Al cambiar clase o flecha, el resultado se quita y vuelve la tarjeta. Una respuesta tardía se descarta.
  - Generado: «Generado hoy a las 18:42» (hora del dispositivo) y «Generar de nuevo».
- **Desglose y ventas:** «Lo que vendí», un renglón por producto y precio (foto, nombre, «2 × $920.00», subtotal, costo con envío y ganancia). «Ventas (N)» plegadas, la más reciente primero, con hora o fecha, total y ganancia. Una venta que el administrador registró desde el stock del vendedor lleva «Registrada por el administrador» (`registeredByAdmin`).
- **Estados:**
  - Cargando: «Calculando tu corte…» y «Sumando tus ventas.», con esqueletos.
  - Vacío (`salesCount === 0`): «Sin ventas en este periodo» y «Cambia el periodo o vende algo para ver tu corte.».
  - Error: «No se pudo generar tu corte» con el mensaje de `http-errors.ts` (sin conexión: «Revisa tu conexión e inténtalo de nuevo.») y «Reintentar».
- **Celular (RNF-03):** a 375 px sin zoom ni scroll horizontal; botones de al menos 44 px.
- **Textos:** los de este spec son los del canvas. Se confirman en el paso de diseño (§5, paso 4).

## 4. Endpoint y modelo de datos

**Endpoint:** sin cambios de forma. `GET /api/cuts` (T-20 §3) responde al vendedor la misma forma que al administrador:

| Selección | Petición |
| --- | --- |
| Día actual (hoy mié 4 nov 2026) | `GET /api/cuts?period=day&date=2026-11-04` |
| Semana anterior | `GET /api/cuts?period=week&date=2026-10-26` |
| Otro vendedor | `GET /api/cuts?holderId=<otro>` → `403` |

**Sin tablas, columnas ni migraciones.**

**Backend:** en `backend/src/cuts/cuts.ts`, `getCashCut` deja de llamar a `trimForRole` y esa función se elimina. `CutActor` se conserva porque `resolveCutHolder` sigue decidiendo el titular por rol. En `CashCut`, `CutProductLine` y `CutSale` los campos de costo y ganancia dejan de ser opcionales en el backend.

**Frontend** (`src/app/features/cash-cut/`):

- `interfaces/cash-cut.models.ts`: sin cambios (los campos de costo y ganancia pueden seguir siendo opcionales; el vendedor ahora los recibe).
- `constants/seller-cash-cut-page.constants.ts`: textos de la página (§3).
- `pages/seller-cash-cut-page/`: página generada con `ng generate component`. Mismo patrón que `admin-cash-cut-page` (`rxResource`, señal de la petición generada, estados), sin `ViewingService`.
- `cash-cut.routes.ts`: agrega `SELLER_CASH_CUT_ROUTES` (página con `loadComponent`, `data.title` «Mi corte»).
- `core/layout/routes/seller.routes.ts`: `mi-corte` pasa de `comingSoon` a `loadChildren` de `SELLER_CASH_CUT_ROUTES`.
- Componentes reutilizados con un `input()` nuevo para el texto que cambia:
  - `cut-summary`: `perspective: 'admin' | 'seller'`. Con `'seller'`: «Vendí…» y «Total a entregar» en lugar de «Costo con envío».
  - `cut-sale-item`: la etiqueta pasa a «Registrada por el administrador» con `'seller'`.
  - `cut-period-picker` y `cut-product-line`: sin cambios.

## 5. Plan de implementación

1. **Backend: quitar el recorte.**
   - Eliminar `trimForRole` y su llamada en `getCashCut`.
   - Ajustar `backend/tests/cuts.test.ts` (§7).
   - `npm run type-check`, `npx vitest run tests/cuts.test.ts` y `tests/architecture.test.ts` pasan.
2. **Ruta y página vacía.**
   - Crear `SELLER_CASH_CUT_ROUTES`, `seller-cash-cut-page` (con `ng generate component`) y sus constantes.
   - Montar `mi-corte` en `seller.routes.ts`, con `seller.routes.spec.ts` ampliado.
   - `ng test`, `ng build` y `npm run check:architecture` pasan.
3. **Página del vendedor.**
   - Periodo con flechas, tarjeta «Generar corte», `rxResource`, resultado con hora y «Generar de nuevo», y estados cargando, vacío y error.
   - El input `perspective` en `cut-summary` y `cut-sale-item`.
   - Spec de la página y de los componentes ajustados. `ng test`, `ng build` y `npm run check:architecture` pasan.
4. **Diseño.**
   - ui-ux-pro-max y luego frontend-design sobre `VendedorCorte` y `EstadosMiCorte`, traducidos a los tokens de `styles.css` y a PrimeNG. Se quitan del canvas «Enviar corte al administrador» y los renglones de contado y crédito.
   - Se confirman los textos de §3.
   - Cierre: `ng build`, `ng test` y `npm run check:architecture` pasan.
5. **Verificación manual** contra la base local con el seed, en escritorio y a 375 px:
   - Con el administrador, dejarle a `vendedor1@` 5 piezas con precio $920 y costo con envío $700; entrar como vendedor, vender 2 y generar «Día»: $1,840.00, $1,400.00 y $440.00.
   - Cambiar el precio del administrador con otra entrega y vender 1: el desglose muestra dos precios y el corte no recalcula lo anterior.
   - Una venta que el administrador hizo desde el stock del vendedor aparece con «Registrada por el administrador».
   - Flecha «‹ Anterior», clase distinta y periodo vacío; backend apagado y «Reintentar».
   - Al terminar, `npm run db:reset`.
6. **Cierre.**
   - Actualizar `specs/README.md` (fila y relaciones), `specs/M4a-t20-base-cortes/spec.md` (nota: el vendedor ya recibe costo y ganancia) y `CLAUDE.md`/`AGENTS.md` (feature `cash-cut` y fin de la regla «vendedor sin costos» en el corte).
   - Editar `SCRUM-56` (criterios 4 y 5), comentar el avance en cada paso y moverla de estado según el flujo de `CLAUDE.md`.

## 6. Criterios de aceptación

Por criterio de `SCRUM-56`, con 4 y 5 reescritos:

- [ ] **1.** Como vendedor, en «Mi corte» veo el selector Día, Semana y Mes (Día por defecto) y «Generar corte».
- [ ] **2.** Con «Semana», «Generar corte» muestra lo vendido, el total a entregar, la ganancia y el desglose por producto con foto, nombre, piezas, mi precio y subtotal.
- [ ] **3.** 2 piezas a $920 con costo con envío $700 se muestran como vendido $1,840.00, total a entregar $1,400.00 y ganancia $440.00, sin sumar ni redondear en el frontend.
- [ ] **4 (reescrito).** La ganancia usa el precio y el costo con envío que el administrador puso al dejarme el producto. Si los cambia, las ventas nuevas usan los nuevos y las anteriores conservan los suyos.
- [ ] **5 (reescrito).** `GET /api/cuts` con el `holderId` de otro vendedor responde `403` sin datos ajenos, y con el de la bodega también. Sin `holderId` responde mi corte con costo y ganancia.
- [ ] **6.** Un periodo sin ventas muestra el estado vacío del canvas, no un corte en ceros.
- [ ] **7.** Mientras carga se ve «Calculando tu corte…». Si falla o no hay conexión se ve el error, y «Reintentar» vuelve a pedirlo.
- [ ] **8.** A 375 px se usa sin zoom ni scroll horizontal, con botones de al menos 44 px.

Además:

- [ ] Si el vendedor ya vendió un producto y luego el administrador cambia su precio, la venta anterior sigue en el corte y en la ganancia con el precio que tenía.
- [ ] Si el administrador cambia el precio y el vendedor aún no había vendido ese producto, su primera venta sale con el precio nuevo y su ganancia se calcula con él.
- [ ] Un periodo con ventas antes y después del cambio muestra dos renglones del producto, cada uno con su precio.
- [ ] Si el vendedor tiene precio propio, subir el precio general no cambia sus ventas; sí las nuevas tras dejarle producto con otro precio.
- [ ] Las flechas «‹ Anterior» y «Siguiente ›» cambian el periodo y su texto; «Siguiente ›» está deshabilitado en el periodo actual.
- [ ] Cambiar de clase o de periodo quita el resultado y vuelve la tarjeta «Generar corte»; una respuesta tardía no se muestra.
- [ ] El resultado muestra «Generado hoy a las HH:MM», y «Generar de nuevo» vuelve a pedir el mismo corte.
- [ ] La lista «Ventas» marca con «Registrada por el administrador» las ventas que él registró desde mi stock.
- [ ] No existe el botón «Enviar corte al administrador» ni nada de contado o crédito.
- [ ] `/vendedor/mi-corte` ya no carga «Próximamente», y el administrador no entra a esa ruta.
- [ ] `trimForRole` ya no existe; el corte del administrador sigue igual (sus pruebas pasan sin cambios).
- [ ] `features/cash-cut` no importa otras features. `npm run check:architecture`, `ng build`, `ng test` y `npm test` del backend (con `SUPABASE_SERVICE_ROLE_KEY`) pasan.

## 7. Plan de pruebas

- **`backend/tests/cuts.test.ts`:**
  - La prueba «el vendedor recibe el corte sin costo ni ganancia en ningún nivel» pasa a «el vendedor recibe costo y ganancia calculados con su precio y su costo con envío».
  - La de la ruta (`vendedor: su corte sin holderId…`) conserva el `403` y comprueba que el JSON trae `cost` y `profit`.
  - Se agrega: el vendedor y el administrador reciben cifras idénticas para el mismo titular y periodo.
  - Se agrega: tras cambiar el precio con otra entrega, las ventas viejas conservan su precio.
  - Se agrega: tras subir el precio general del producto (vendedor sin precio propio), la venta nueva sale con el precio nuevo y la anterior con el viejo.
  - Se agrega: con precio propio del vendedor, subir el general no cambia el precio de la venta nueva.
- **`seller-cash-cut-page.component.spec.ts`:** tarjeta «Generar corte»; petición sin `holderId`; resultado con resumen, desglose y ventas; vacío; error con «Reintentar»; el resultado se quita al cambiar clase o flecha; respuesta tardía descartada; «Generar de nuevo».
- **`cut-summary.component.spec.ts` y `cut-sale-item.component.spec.ts`:** textos con `perspective: 'seller'` («Vendí…», «Total a entregar», «Registrada por el administrador») y sin cambio con `'admin'`.
- **`core/layout/routes/seller.routes.spec.ts`:** `mi-corte` carga `SELLER_CASH_CUT_ROUTES`.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Producto sin costo con envío: la venta guardó el costo de fábrica, y la ganancia del vendedor lo revelaría (RF-02) | Se acepta por decisión del usuario: sin costo propio, la ganancia se saca del costo de fábrica y del precio general. Si molesta, un spec posterior guarda en `direct_sale_items` si el costo era el propio y oculta la ganancia de esas líneas |
| Un cliente viejo o un vendedor modificando la petición pide datos ajenos | `resolveCutHolder` mantiene el `403` por rol. Se prueba contra la base real |
| El vendedor interpreta «Total a entregar» distinto de lo que el administrador cobra | El texto sale del canvas; se confirma en el paso de diseño y con el administrador antes de pasar a `Finalizada` |
| Cambia RF-02/RNF-04 y otras pantallas del vendedor siguen sin mostrar costos | Este spec solo cambia el corte. «Mi stock», «Vender» y «Venta confirmada» conservan su recorte |
| Se reutilizan componentes del administrador y se filtran textos de HU-19 | El input `perspective` y pruebas de los dos textos |

## 9. Decisiones

- **Sí:** el vendedor ve costo con envío y ganancia en su corte, calculados con el precio y el costo que el administrador le puso al dejarle el producto (decisión del usuario).
- **No:** seguir ocultando costo y ganancia (RF-02/RNF-04 del corte). Se actualiza la historia en Jira.
- **Sí:** no cambiar la fórmula ni el backend más allá de quitar el recorte. La venta ya guarda precio y costo del momento (T-18).
- **No:** recalcular la ganancia con los precios actuales.
- **Sí:** los precios actualizados por el administrador rigen para las ventas nuevas (decisión del usuario); es lo que ya hace `createSale`, así que no hay cambio de backend. Las ventas hechas conservan el precio de su momento, para que un corte pasado no cambie cuando suben los precios.
- **No:** reescribir con el precio nuevo las ventas ya registradas: alteraría cortes ya revisados y rompe la regla de dinero de `CLAUDE.md` (precio y costo del momento).
- **Sí:** «Total a entregar» = costo con envío, y la ganancia es lo que el vendedor se queda (propuesta a confirmar al revisar este Draft; la respuesta del usuario fijó la ganancia, no el nombre del total).
- **No:** «Total a entregar» = todo lo vendido: contradice que la ganancia sea del vendedor.
- **Sí:** el vendedor ve periodos anteriores con flechas, como HU-19 (T-20 ya lo permite).
- **No:** solo el periodo en curso.
- **Sí:** la lista «Ventas» plegada, con la marca «Registrada por el administrador» (propuesta, por simetría con HU-19).
- **Sí:** «Enviar corte al administrador» queda fuera y va en un spec propio. El usuario lo marcó «entra completo» en una respuesta previa; se separa porque agrega tabla, migración, `POST` y una vista del administrador, y juntarlo con el cambio de ganancia haría un spec de más de tres áreas. Se puede volver a juntar al revisar el Draft.
- **No:** guardar cortes en este spec ni reutilizar la tabla heredada `cuts` (es de `clients`).
- **Sí:** si el administrador no modificó el precio o el costo con envío, la ganancia usa el precio general y el costo de fábrica del producto guardados en la venta, igual que la del administrador (decisión del usuario). Sin migración (ver riesgos).
- **No:** ocultar la ganancia de las líneas sin costo con envío propio.
- **Sí:** reutilizar `features/cash-cut/` con un `input()` de texto, no duplicar los componentes.
- **Sí:** el periodo recordado por defecto es «Día» (regla de `SCRUM-56`).

## Lo que **no** entra en este spec

- «Enviar corte al administrador» y guardar cortes.
- Corte para casa y «para cubrir envíos» (M4b).
- Contado, crédito y abonos (v2).
- Selector de fecha libre, Exportar y más vendidos.
- Una marca de costo propio contra costo de fábrica en las ventas.

Cada uno, si llega, va en su propio spec o en su historia.
