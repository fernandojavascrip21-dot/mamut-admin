# Spec técnico — T-04 · Aplicar las reglas de Angular moderno en todo el frontend

> **Estado:** Aprovado
> **Depende de:** M1-hu06-editar-producto (`specs/M1-hu06-editar-producto/spec.md`) — este refactor parte de `main` con HU-06 ya fusionada
> **Fecha:** 2026-10-26
> **Objetivo:** que todo el frontend existente cumpla las reglas de «Buenas prácticas de código › Angular» y «TypeScript estricto» de `CLAUDE.md`/`AGENTS.md`, sin cambiar nada de lo que ve o hace el usuario.

Fuentes: la sección «Buenas prácticas de código» agregada a `CLAUDE.md` y `AGENTS.md` el 2026-10-26; tarea `SCRUM-25 · T-04` del proyecto Jira `MammutSuplements` (espacio `SCRUM`), épica `SCRUM-6 · M1 · Productos y bodega`; y una revisión del código de la rama `spec-M1-hu06-editar-producto` hecha el 2026-10-26 (resultados en §1).

## 1. Por qué existe este spec

Las reglas nuevas de `CLAUDE.md` se dividieron en tres specs (decisión del usuario): **este** (mecánica de Angular y TypeScript estricto), uno para renombrar el código a inglés (`M1-t05-codigo-en-ingles`), y uno para mover la lógica de negocio a servicios (`M1-t06-logica-a-servicios`, SOLID). Se hacen en ese orden (T-04 → T-05 → T-06; el orden original ponía SOLID antes que inglés y se cambió para que SOLID cree sus archivos ya en inglés): este no cambia nombres ni reparte responsabilidades, para que cada spec se pueda revisar por separado.

La revisión del 2026-10-26 encontró, en los 11 componentes del frontend (`app.ts` + 10 en `pages/` y `shared/`):

| Regla | Estado hoy |
| --- | --- |
| Standalone, sin NgModules | ✅ ya se cumple |
| `inject()` | ✅ ya se cumple (ningún constructor con dependencias) |
| `@if` / `@for` / `@switch` | ✅ ya se cumple (ningún `*ngIf`/`*ngFor`); falta revisar que todo `@for` tenga `track` |
| Sin `any`, sin `console.log` | ✅ ya se cumple |
| `input()` / `output()` | ✅ `producto-card` ya usa `input.required` |
| `OnPush` | ❌ 0 de 11 componentes |
| Sin decoradores | ❌ `@ViewChild` en `login-page`, `account-page`, `nuevo-producto-page`; `@HostListener` en `nuevo-producto-page` |
| No anidar `subscribe` + limpieza | ❌ 8 `subscribe` en `login-page`, `account-page`, `nuevo-producto-page` (5, uno anidado: subir foto → guardar) y `productos-page`; ninguno con `takeUntilDestroyed` |
| Lazy loading | ❌ ninguna ruta usa `loadComponent`/`loadChildren` |
| TypeScript estricto | ❌ el `tsconfig.json` de la raíz no tiene `"strict": true` (el backend sí). Activarlo hoy da **0 errores** en `tsconfig.app.json` y `tsconfig.spec.json` |

## 2. Alcance

**Entra en este spec:**

- `changeDetection: ChangeDetectionStrategy.OnPush` en los 11 componentes.
- `@ViewChild` → `viewChild()` (signal queries) y `@HostListener` → `host: { '(window:beforeunload)': … }` en los metadatos del componente.
- **Cargas al entrar → `rxResource`**: la lista de productos (`productos-page`), las categorías y el producto a editar (`nuevo-producto-page`). Sus estados cargando/error salen del `status()`/`error()` del recurso, y «Reintentar» llama a `reload()`.
- **Acciones del usuario → un solo `subscribe`, sin anidar, con `takeUntilDestroyed()`**: login, cerrar sesión, guardar (alta y edición). Subir foto → guardar pasa a una sola cadena con `switchMap`.
- Lazy loading: `src/app/pages/admin-page/admin.routes.ts` y `src/app/pages/vendedor-page/vendedor.routes.ts` cargados con `loadChildren`; cada página (incluidas `login-page`, `account-page`, `admin-page` y `vendedor-page`) con `loadComponent`. `roleGuard`, `guestGuard`, `cambiosSinGuardarGuard` y los `data` quedan donde están hoy.
- `"strict": true` en `tsconfig.json`.
- `angular.json` → `schematics` con `changeDetection: "OnPush"` y `style: "none"` para `@schematics/angular:component`, para que `ng generate component` ya cumpla las reglas.
- Revisar que cada `@for` tenga `track` con un id estable (no `$index` donde haya `id`).
- Aclarar en `CLAUDE.md`/`AGENTS.md` la regla de `subscribe` (cargas → `rxResource`; acciones → un `subscribe` con `takeUntilDestroyed`), y corregir la línea de «Components» que dice que los archivos terminan en `.component.css` (contradice la regla de estilos sin `.css`).

**No entra en este spec (va en los otros dos o en otro lado):**

- Mover lógica de negocio de los componentes a servicios (validaciones del formulario, regla precio/costo, «hay cambios») — `M1-t06-logica-a-servicios`.
- Renombrar clases, funciones, archivos o carpetas a inglés — `M1-t05-codigo-en-ingles`.
- Agregar ESLint o un script `lint` (decisión del usuario: defaults del CLI + `strict`).
- Backend: ya está en inglés, con `strict`, sin `any` ni `console.log`, y el stock ya nace como movimiento; no se toca (decisión del usuario).
- Reglas de dinero: hoy el frontend solo usa `Number()` para mostrar y comparar precio/costo, no hay cálculos de caja; se revisan cuando llegue M3 (ventas/corte).
- Cualquier cambio visible: textos, estilos, rutas (URLs), comportamiento.

## 3. Modelo de datos

Este spec no agrega estructuras de datos, endpoints ni migraciones. Solo cambia la forma interna de los componentes y la configuración.

**Patrón de carga (ejemplo, `productos-page`):**

```ts
// La lista se pide al entrar; status()/error() reemplazan al signal de estado manual, y
// «Reintentar» es productsResource.reload().
readonly productsResource = rxResource({ stream: () => this.productos.listProductos() });
readonly items = computed(() => this.productsResource.value() ?? []);
```

**Patrón de acción (ejemplo, guardar con foto):**

```ts
private readonly destroyRef = inject(DestroyRef);

// Una sola cadena: si hay foto nueva se sube primero y su URL alimenta el guardado; sin
// subscribe anidado. takeUntilDestroyed evita actualizar estado si el usuario ya salió.
upload$.pipe(
  switchMap((url) => this.productos.crear({ ...input, image: url })),
  takeUntilDestroyed(this.destroyRef),
).subscribe({ next: …, error: … });
```

**Rutas (forma final):**

```ts
// app.routes.ts
{ path: 'admin', loadComponent: () => import('./pages/admin-page/admin-page.component').then(m => m.AdminPageComponent),
  canMatch: [roleGuard], data: { roles: ['admin'] },
  loadChildren: () => import('./pages/admin-page/admin.routes').then(m => m.ADMIN_ROUTES) },
// admin.routes.ts: los hijos de hoy, cada uno con loadComponent; mismas rutas, títulos y guards.
```

**`angular.json`:**

```json
"schematics": {
  "@schematics/angular:component": { "changeDetection": "OnPush", "style": "none" }
}
```

## 4. Plan de implementación

Cada paso deja `ng build` y `npm test` en verde.

1. `"strict": true` en `tsconfig.json` y `schematics` en `angular.json` (§3). Verificar `ng build` y `npm test`.
2. `OnPush` en los 11 componentes. Correr `npm test`; cualquier prueba que dependa de detección por defecto se arregla con `fixture.detectChanges()`/`await fixture.whenStable()`, no quitando `OnPush`. Revisar `track` en todos los `@for`.
3. `viewChild()` en `login-page` y `account-page` (los setters de foco del diálogo pasan a `effect`/`afterRenderEffect` sobre el signal de la query).
4. `productos-page`: lista con `rxResource`, «Reintentar» → `reload()`; actualizar su spec.
5. `nuevo-producto-page`: categorías y producto a editar con `rxResource`; `viewChild()` en lugar de los 9 `@ViewChild`; `host` en lugar de `@HostListener('window:beforeunload')`; guardar (alta y edición) como una sola cadena con `switchMap` + `takeUntilDestroyed`; actualizar su spec.
6. `login-page` y `account-page`: login y cerrar sesión con `takeUntilDestroyed`.
7. Lazy loading: crear `admin.routes.ts` y `vendedor.routes.ts`, pasar todas las páginas a `loadComponent`; ajustar `app.routes.spec.ts` (resolver `loadComponent`/`loadChildren` en vez de comparar `component`). Confirmar que `app.routes.server.ts` sigue cubriendo `admin/**` y `vendedor/**` sin cambios.
8. `CLAUDE.md`/`AGENTS.md`: aclarar la regla de `subscribe` y corregir la línea de `.component.css` (§2).
9. Verificación: `ng build` (revisar en la salida que aparecen chunks lazy separados para admin y vendedor), `npm test`, y verificación manual con `ng serve` + backend (§6).

## 5. Criterios de aceptación

- [ ] Los 11 componentes declaran `changeDetection: ChangeDetectionStrategy.OnPush` (`grep -L OnPush` sobre `*.component.ts` y `app.ts` no devuelve nada).
- [ ] No queda ningún `@ViewChild`, `@ViewChildren`, `@Input`, `@Output` ni `@HostListener` en `src/app` (sin contar specs).
- [ ] Ningún `subscribe` está dentro del callback de otro `subscribe`, y todo `subscribe` en un componente lleva `takeUntilDestroyed`.
- [ ] La lista de productos, las categorías y el producto a editar se cargan con `rxResource`, y «Reintentar» en `productos-page` y en «Editar producto» vuelve a pedir los datos.
- [ ] `app.routes.ts` no importa ningún componente de página de forma estática; `admin` y `vendedor` usan `loadChildren`, y `ng build` genera chunks lazy separados.
- [ ] Un vendedor que inicia sesión no descarga el chunk de `admin.routes` (pestaña Red del navegador).
- [ ] `tsconfig.json` tiene `"strict": true` y `ng build` pasa sin errores.
- [ ] `ng generate component` crea componentes con `OnPush` y sin `.css`.
- [ ] Todo `@for` tiene `track` por un id estable cuando el elemento tiene `id`.
- [ ] `CLAUDE.md` y `AGENTS.md` explican la regla de `subscribe` y ya no mencionan `.component.css`.
- [ ] `npm test` (raíz) pasa, y el recorrido manual de §6 se comporta igual que antes del refactor.

## 6. Plan de pruebas

**Automático:** `npm test` en la raíz. Las pruebas existentes son la red de seguridad del refactor: no se borra ni se relaja ningún caso, solo se ajusta cómo esperan la detección de cambios (`OnPush`) o cómo resuelven las rutas lazy (`app.routes.spec.ts`).

**Manual (con `ng serve` + `npm run dev` del backend), comparando con el comportamiento antes del refactor:**

- Login con admin y con vendedor; recargar `/admin/productos` con sesión (sigue sin rebotar a `/login`); reabrir `/login` con sesión (redirige a la home del rol).
- «Productos»: carga, búsqueda, sin resultados, apagar el backend → error → «Reintentar».
- Alta con y sin foto, precio < costo bloquea «Guardar», duplicado, sin conexión → «Reintentar» sin volver a subir la foto.
- Editar: carga, guardar, producto inexistente, «¿Descartar los cambios?» con el enlace, el botón atrás y el menú; recargar con cambios (aviso nativo).
- «Mi cuenta» → cerrar sesión con el diálogo (foco y `Escape`).
- Pestaña Red: el vendedor no descarga código de admin.

## 7. Decisiones tomadas y descartadas

- **Sí:** dividir las reglas nuevas en tres specs (Angular moderno, inglés, SOLID) y empezar por este. Razón (decisión del usuario): cada uno toca casi todo el frontend; juntos serían imposibles de revisar.
- **Sí:** hacerlo después de fusionar HU-06. Razón (decisión del usuario): `nuevo-producto-page` es el archivo más tocado por ambos.
- **Sí:** lazy loading con `loadChildren` por rol y `loadComponent` por página. Razón (decisión del usuario): el código de admin nunca llega al vendedor; los guards se quedan en el padre.
- **Sí:** cargas con `rxResource`, acciones con un solo `subscribe` + `takeUntilDestroyed`. Razón (decisión del usuario): un submit no es un recurso; forzarlo a `rxResource` sería más indirecto sin beneficio.
- **No:** modelar también las acciones como recursos disparados por signals. Razón: lo anterior.
- **Sí:** prevenir regresiones con los defaults de `ng generate` y `strict`, sin ESLint. Razón (decisión del usuario): no hay ESLint en el proyecto y agregarlo es configuración aparte.
- **Sí:** solo frontend. Razón (decisión del usuario): las reglas de Angular no aplican al backend, y lo demás ya se cumple ahí.
- **Sí:** `strict` en este spec aunque no sea «de Angular». Razón (decisión técnica de esta sesión): hoy da 0 errores; activarlo primero protege el resto del refactor.
- **Sí:** crear la tarea `SCRUM-25 · T-04` en la épica M1. Razón (decisión del usuario): una tarea Jira por spec, para comentar avance y cerrarla al terminar.
- **No:** cambiar URLs, textos o estilos. Razón: es un refactor; el usuario no debe notar nada.

## 8. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `OnPush` deja de pintar algo que dependía de detección por defecto (p. ej. estado mutado fuera de signals) | Todo el estado ya está en signals; el paso 2 corre las pruebas de inmediato y el recorrido manual de §6 revisa cada pantalla |
| `rxResource` cambia el orden de los estados cargando/error y rompe pruebas o el «Reintentar» | Pasos 4 y 5 separados por pantalla, cada uno con su spec actualizado antes del siguiente |
| Lazy loading con `canMatch` + SSR rompe el renderizado solo en cliente de `admin/**` y `vendedor/**` | `app.routes.server.ts` usa rutas por path, no componentes; el paso 7 lo confirma y §6 incluye recargar con sesión |
| `viewChild()` cambia el momento en que el foco del diálogo y del primer campo inválido se aplica | Mismo comportamiento verificado a mano (foco, `Escape`) en §6; las pruebas de foco existentes se mantienen |
| `app.routes.spec.ts` compara `component` y deja de servir con `loadComponent` | El paso 7 la ajusta para resolver los imports, sin quitar casos |
