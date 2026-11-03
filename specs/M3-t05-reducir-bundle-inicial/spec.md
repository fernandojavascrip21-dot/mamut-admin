# Spec técnico — T-05 · Reducir el bundle inicial

> **Estado:** Aprovado
> **Depende de:** M3-t04-primeng-navegacion-tarjetas-dialog (`specs/M3-t04-primeng-navegacion-tarjetas-dialog/spec.md`) — cierra la migración a PrimeNG y deja el bundle inicial en 705,6 kB. M3-t01-primeng-listas-dialogos (`specs/M3-t01-primeng-listas-dialogos/spec.md`) — origen de `<p-toast>` y `<p-confirmdialog>` en `app.html` y de la decisión pendiente de diferir el diálogo (su §«Pendiente»).
> **Fecha:** 2026-11-03
> **Objetivo:** bajar el bundle inicial de producción lo más cerca posible de 500 kB (hoy 705,6 kB) cambiando solo cómo y cuándo se carga el código, sin tocar rutas, textos, reglas de negocio ni el aspecto de ninguna pantalla.

Fuentes:

- **Medición del 2026-11-03** sobre `dist/mamut-admin/browser` (build de producción tras M3-t04): `index.csr.html` precarga exactamente `chunk-DIT4hJpB.js` (347,8 kB), `chunk-DbcIXHap.js` (167,0 kB), `main-*.js` (143,6 kB) y `styles-*.css` (47,2 kB): **705,6 kB bruto, 173 kB transferido**. El presupuesto `initial` de `angular.json` avisa a 500 kB y falla a 1 MB.
- **M3-t01:** el bundle inicial pasó de 502,8 a 691,6 kB al adoptar PrimeNG; allí se propuso diferir `<p-confirmdialog>` con `@defer` y se dejó la decisión abierta.
- **Código:** `src/app/app.html` (`<p-toast>` y `<p-confirmdialog>` siempre presentes), `src/app/app.ts` (los importa), `src/app/app.config.ts` (`providePrimeNG(PRIMENG_CONFIG)` con `MAMMUT_THEME`, `MessageService`, `ConfirmationService` y `provideEnvironmentInitializer(ViewingService)`), `core/confirm/confirm.service.ts` y `core/toast/toast.service.ts`.
- **Angular:** [`@defer`](https://angular.dev/guide/templates/defer) y su interacción con la hidratación (`provideClientHydration`).

## 1. Alcance

**Entra en este spec:**

- Medir qué contribuye al bundle inicial y dejar la tabla en el spec (paso 1).
- Diferir `<p-confirmdialog>` con `@defer` conservando el contrato de `ConfirmService.ask()`.
- Evaluar diferir `<p-toast>`, recortar o repartir el preset `MAMMUT_THEME`, diferir el arranque de `ViewingService` y reducir el peso real de los recursos estáticos (`logo-mammoth.png`, 208 kB), cada uno solo si la medición lo justifica.
- Documentar la medición final, cuánto se ganó y, si no se llega a 500 kB, por qué.
- Actualizar `CLAUDE.md`, `AGENTS.md`, `specs/README.md` y el cuadro de M3-t01 si cambia una regla.
- Pruebas de frontend (§6).

**No entra en este spec:**

- Subir el presupuesto `initial` de `angular.json` para que desaparezca el aviso. Si no se llega a 500 kB, el aviso se queda y se explica.
- Cambiar rutas, URLs, textos, reglas de negocio, aspecto, backend o base de datos.
- Sustituir PrimeNG, Tailwind o Angular, ni quitar controles ya migrados.
- Optimizar chunks diferidos (pantallas, formularios): ya cargan bajo demanda.

## 2. Inventario del bundle inicial (línea base)

| Archivo | Bruto | Qué se sabe | Qué falta saber |
| --- | --- | --- | --- |
| `chunk-DIT4hJpB.js` | 347,8 kB | Compartido; sin menciones de PrimeNG | Cuánto es Angular core/common/router/http y cuánto código propio de `core/` |
| `chunk-DbcIXHap.js` | 167,0 kB | Núcleo de PrimeNG (`@primeuix/styled`, base, configuración) | Parte del preset `MAMMUT_THEME` y de los estilos base de cada control |
| `main-*.js` | 143,6 kB | App + `p-toast` (131 menciones) y `p-confirmdialog` (10) | Cuánto pesa cada uno |
| `styles-*.css` | 47,2 kB | Tailwind y las secciones de `styles.css` | Cuánto es utilidades y cuánto PrimeNG |
| **Total** | **705,6 kB** | 173 kB transferidos | — |

Las rutas de `app.routes.ts` ya usan `loadComponent`/`loadChildren`; el inicial no arrastra pantallas. La ganancia posible está en lo que `app.html` y `app.config.ts` cargan siempre.

## 3. Reglas de comportamiento

- **Mismo resultado visible:** ninguna pantalla cambia de aspecto, texto ni comportamiento, en escritorio y a 375 px. Nada de lo que el usuario ve en el primer render se retrasa por un `@defer`.
- **`ConfirmService.ask()` no cambia:** devuelve `Promise<boolean>`; cancelar, Escape y la X resuelven `false`; una segunda confirmación resuelve la primera en `false`.
- **Confirmación temprana:** `ConfirmDialog` escucha un `Subject` de `ConfirmationService` sin repetir lo emitido. Si se pidiera una confirmación antes de que el diálogo diferido exista, la petición se perdería y la promesa quedaría colgada. El diferido debe garantizar que el diálogo ya escucha antes de que se pueda pedir una confirmación (disparador `on idle` o `on immediate` y, si hace falta, que `ask()` espere a que el diálogo esté listo).
- **Toast:** solo se difiere si la medición compensa y sin perder el primer aviso (el login muestra errores de inmediato).
- **Presupuesto:** no se modifica `angular.json` para tapar el aviso.
- **Hidratación:** los bloques `@defer` no deben romper `provideClientHydration` ni el renderizado en servidor.

## 4. Modelo de datos

No agrega datos ni cambia contratos de la API. Solo cambia código de frontend:

```html
<!-- src/app/app.html (propuesta del paso 2; el disparador se confirma con la medición) -->
<router-outlet />
<p-toast position="top-right" [breakpoints]="toastBreakpoints" />
@defer (on idle) {
  <p-confirmdialog [style]="confirmStyle" [breakpoints]="confirmBreakpoints" />
}
```

- `App` deja de importar `ConfirmDialog` de forma estática: el `@defer` lo carga como dependencia diferida.
- Las constantes nuevas (si las hay) van en el `.constants.ts` de su área, no en la clase.
- Cualquier espera de «diálogo listo» vive en `core/confirm/` (servicio y constantes), no en `app.ts`.

## 5. Plan de implementación

1. **Medición base.** `ng build --stats-json` y un visualizador (esbuild-visualizer o `source-map-explorer`); completar la tabla de §2 con la contribución de Angular, PrimeNG core, `MAMMUT_THEME`, toast, confirmdialog y código propio. Registrar 705,6 kB como línea base. **Prueba:** la tabla suma el total; sin cambios de código.
2. **Diferir `<p-confirmdialog>`.** `@defer` en `app.html`, `App` sin el import estático, y garantía de que ninguna confirmación se pierde (§3). **Prueba:** `ng build` y medir; specs de `confirm.service` y de las pantallas que confirman (cerrar sesión, descartar cambios); una prueba que pide una confirmación inmediatamente al arrancar y la ve resolverse.
3. **Evaluar `<p-toast>`.** Medir cuánto pesa en `main`; diferirlo solo si la ganancia es relevante y el primer aviso no se pierde; si no, dejar escrito por qué se descarta. **Prueba:** specs de `toast.service`; un aviso inmediato tras abrir la app sigue apareciendo.
4. **Preset y configuración de PrimeNG.** Con la medición en la mano, decidir si `MAMMUT_THEME` o algún subpreset puede recortarse o repartirse sin cambiar el aspecto; no tocar lo que no pese. **Prueba:** spec del tema (`mammut-theme.constants.spec.ts`) y revisión visual.
5. **Otras cargas.** Evaluar diferir el `provideEnvironmentInitializer(ViewingService)` si su código pesa en el inicial, y optimizar `logo-mammoth.png` (208 kB; no entra en el presupuesto pero sí en la carga real) sin cambiar cómo se ve. **Prueba:** specs afectados y revisión visual del login y la barra lateral.
6. **Cierre.** `ng build` de producción, `ng test --watch=false` y `npm run check:architecture` pasan; se mide de nuevo y se completa la tabla antes/después. Se actualizan `CLAUDE.md`/`AGENTS.md` solo si cambia una regla (cómo se monta el diálogo), `specs/README.md` y el cuadro de M3-t01.

Cada paso queda commiteable y la app funcional.

## 6. Plan de pruebas

- **Cómo se mide:** `ng build` de producción en la misma rama, columna «Initial total» (bruto y transferido), antes y después de cada paso; los números van en una tabla del spec. Mismo comando y misma máquina en todas las mediciones.
- **Specs existentes** de `confirm.service`, `toast.service`, `app` y las pantallas que confirman pasan; solo se reescribe lo que dependa de que el diálogo exista desde el primer render.
- **Pruebas nuevas:**
  - Una confirmación pedida justo al arrancar se resuelve (acepta → `true`, cancela → `false`) y no queda colgada.
  - Una segunda confirmación con una abierta sigue resolviendo la primera en `false`.
  - El primer aviso del toast aparece sin esperar.
- **Revisión visual** en navegador (escritorio y 375 px): login con error (toast), cerrar sesión (confirmación), descartar cambios (confirmación), pantalla de Productos y pop-up «Dejar».
- **`ng test --watch=false` completo, `ng build` de producción y `npm run check:architecture`** antes de cerrar. Sin cambios en `backend/`.

## 7. Criterios de aceptación

- [ ] Hay una medición base (705,6 kB) y una final, con la tabla de contribuyentes y el antes/después de cada paso.
- [ ] El bundle inicial final es menor que 705,6 kB; si queda por encima de 500 kB, el spec explica por qué y cuánto se ganó. `angular.json` conserva el presupuesto de 500 kB / 1 MB.
- [ ] `<p-confirmdialog>` se carga diferido y `ConfirmService.ask()` conserva su contrato, incluida una confirmación pedida justo al arrancar.
- [ ] El toast muestra el primer aviso sin retraso (se difirió o no, según la medición, y el spec lo explica).
- [ ] Ninguna pantalla cambia de aspecto ni de texto en escritorio ni a 375 px; sin cambios en rutas.
- [ ] No se sustituye ni se quita ningún control de PrimeNG; no se añaden librerías.
- [ ] `CLAUDE.md`, `AGENTS.md`, `specs/README.md` y el cuadro de M3-t01 quedan en sincronía si cambió alguna regla.
- [ ] Sin cambios en `backend/`. `ng build`, `ng test` y `npm run check:architecture` pasan.

## 8. Decisiones

- **Sí:** medir antes de decidir; ningún paso promete un ahorro que no se haya medido.
- **Sí:** diferir `<p-confirmdialog>` como primer paso, la opción que ya proponía M3-t01.
- **Sí:** el aviso del presupuesto se queda si no se llega a 500 kB; se documenta, no se oculta.
- **A decidir con la medición:** diferir `<p-toast>`, recortar `MAMMUT_THEME` y optimizar el logo.
- **No:** subir `maximumWarning` en `angular.json`.
- **No:** reemplazar PrimeNG por otra librería ni quitar controles ya migrados.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Una confirmación pedida antes de que cargue el diálogo se pierde y la promesa de `ask()` queda colgada | Disparador `on idle`/`on immediate`, y que `ask()` espere a que el diálogo esté listo; prueba explícita de la confirmación temprana |
| `@defer` rompe la hidratación o el render en servidor | Probar `ng build` con SSR y recargar una URL con sesión; revisar la consola del navegador |
| El diferido retrasa algo visible en el primer render | Dejar fuera de `@defer` todo lo que se ve al abrir; revisión visual del login y de las pantallas |
| El ahorro real es menor que el esperado (la mayor parte es Angular + núcleo de PrimeNG) | El paso 1 lo mide antes de actuar; si no se llega a 500 kB se documenta la causa |
| Recortar el preset cambia colores o estados | Spec del tema y revisión visual; no tocar lo que no pese |
| Optimizar el logo cambia cómo se ve la marca | Comparar antes y después a escritorio y a 375 px; si se nota, se descarta |

## Lo que **no** entra en este spec

- Subir el presupuesto de bundle.
- Rutas, textos, reglas de negocio, backend y base de datos.
- Sustituir o quitar PrimeNG, Tailwind o Angular.
- Optimizar los chunks que ya se cargan bajo demanda.
