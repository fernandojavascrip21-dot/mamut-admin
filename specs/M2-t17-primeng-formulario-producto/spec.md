# Spec técnico — T-17 · PrimeNG y formulario piloto de producto

> **Estado:** Implementado
> **Depende de:** M2-t11-rediseno-visual (`specs/M2-t11-rediseno-visual/spec.md`) — tokens y reglas visuales; M2-t12-rediseno-productos (`specs/M2-t12-rediseno-productos/spec.md`) — formulario con el diseño actual; M1-hu06-editar-producto (`specs/M1-hu06-editar-producto/spec.md`) — alta y edición; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — contrato de dinero ya presente en el código
> **Fecha:** 2026-11-01
> **Objetivo:** incorporar PrimeNG con un tema adaptado a Mammut y usarlo en el formulario compartido de alta y edición de producto, conservando sus reglas y flujos.

Fuentes:

- Pedido y respuestas del usuario del 2026-11-01: configuración y formulario piloto; tema adaptado al diseño actual; licencia Community disponible.
- Prioridad indicada durante la verificación del 2026-11-01: validar el responsive en computadoras; la revisión de pantallas móviles queda pendiente y no bloquea esta entrega.
- Código actual: `src/app/app.config.ts`, `src/styles.css`, `features/products/components/product-form` y sus páginas de alta y edición.
- [Instalación oficial](https://primeng.dev/installation): configuración global, tema, licencia e imports por componente.
- [PrimeNG 22.1](https://blog.primeui.dev/blog/primeng-22-1-0/): compatibilidad declarada con Angular 22.1 o superior.
- [Integración con Tailwind](https://primeng.dev/tailwind): orden de capas y convivencia con Tailwind 4.
- [InputText](https://primeng.dev/inputtext), [Select](https://primeng.dev/select), [Checkbox](https://primeng.dev/checkbox) y [Button](https://primeng.dev/button): componentes del piloto.
- [Licencia Community](https://primeui.dev/licenses/community): el usuario confirma que ya dispone de ella; la clave se configura fuera de los archivos versionados.

## 1. Alcance

**Entra en este spec:**

- Dependencias de PrimeNG para Angular 22 y su tema.
- Configuración global mediante `providePrimeNG` y textos de interfaz en español para los controles utilizados.
- Un preset basado en Aura que reutiliza los tokens de Mammut.
- Preparación de la licencia desde configuración local o variables del entorno de compilación.
- Migración de `product-form`, compartido por el alta y la edición.
- Adaptación de las pruebas afectadas por el DOM de PrimeNG.
- Documentación del uso de la librería y de la preparación local y en CI.

**No entra en este spec:**

- Migrar el resto de la aplicación, la lista de productos o sus tarjetas.
- Reemplazar `modal-panel`, `confirm-dialog`, el toast, la navegación o la barra «Viendo».
- Cambiar reglas de negocio, endpoints, modelos del backend, base de datos o almacenamiento de fotos.
- Agregar componentes Pro, PrimeBlocks, PrimeFlex o una pantalla de demostración.
- Modo oscuro, cambio de tema por el usuario o una paleta nueva.
- Cambiar a Signal Forms o crear wrappers propios para cada componente de PrimeNG.
- Verificación visual de pantallas móviles en esta entrega; se difiere por prioridad del usuario.

## 2. Configuración y arquitectura

### Dependencias

- Usar la línea estable PrimeNG 22 compatible con Angular 22.2. La documentación consultada muestra 22.1.4; al implementar se verifican sus `peerDependencies` y las del paquete de temas antes de instalar.
- Agregar `primeng` y `@primeuix/themes` con versiones compatibles, registradas en `package-lock.json`.
- Instalar solamente los peers que requiera esa versión. No usar `--force` ni `--legacy-peer-deps` para esconder incompatibilidades.
- No actualizar Angular como efecto secundario de esta tarea.
- Los componentes se importan individualmente en `ProductFormComponent`. La configuración global no importa sus módulos ni todas las exportaciones de la librería.
- El piloto no agrega `primeicons` ni `tailwindcss-primeui`: las utilidades actuales y los iconos internos de los controles bastan para este alcance.

### Archivos de configuración

| Archivo | Responsabilidad |
| --- | --- |
| `package.json`, `package-lock.json` | Dependencias y preparación previa a comandos npm |
| `src/app/app.config.ts` | Registrar el provider global |
| `src/app/core/ui/constants/mammut-theme.constants.ts` | Preset y correspondencias con los tokens de marca |
| `src/app/core/ui/constants/primeng.constants.ts` | Opciones globales, traducciones usadas y configuración del tema |
| `src/app/core/ui/constants/primeng-license.generated.ts` | Exportación local generada de la clave; ignorada por Git |
| `scripts/prepare-primeng-license.mjs` | Leer la clave y generar el archivo antes de compilar |
| `.env.example` | Ejemplo del frontend con `PRIMENG_LICENSE_KEY`, sin una clave real |
| `.gitignore` | Excluir `.env` del frontend y el archivo generado |
| `src/styles.css` | Orden de capas para PrimeNG y Tailwind |

- Crear primero la estructura de `core/ui/constants/`.
- La configuración no depende de features. El formulario importa los controles desde `primeng/*`.
- `app.config.server.ts` ya combina la configuración común: no registrar un segundo provider para SSR.
- No agregar APIs de animación antiguas por copiar ejemplos de versiones anteriores. Usar los requisitos de la versión instalada, conservando el arranque actual de Angular.

### Licencia

- La clave se obtiene de `PRIMENG_LICENSE_KEY`, con prioridad para la variable de proceso; como respaldo se lee el `.env` del frontend con las funciones nativas de Node.
- El `.env` raíz existente es un archivo local del usuario. No se sobrescribe ni se interpreta su contenido como clave si no declara esa variable.
- El script genera únicamente la exportación tipada de la clave mediante serialización segura. No imprime el valor.
- Sin variable o con texto vacío, la preparación falla con una instrucción para configurarla. No se inventa una clave ni se omite la verificación de PrimeNG.
- Agregar `ui:prepare` y los hooks `prestart`, `predev`, `prewatch`, `prebuild` y `pretest`. Conservar los comandos actuales de esos scripts.
- Para invocaciones directas de `ng`, documentar `npm run ui:prepare` como preparación previa. En CI, suministrar la variable antes del comando npm.
- La clave se pasa a la opción de licencia de `providePrimeNG` admitida por la versión instalada.
- No incluir la clave real en specs, ejemplos, pruebas o archivos versionados. La integración de frontend necesita entregarla al navegador; excluirla de Git no la convierte en un secreto del servidor.

## 3. Reglas de diseño y UX

- Mantener la estructura, el orden de campos, las etiquetas y los textos actuales del formulario.
- Usar Aura como base y personalizar sus tokens; conservar Tailwind para distribución y adaptación responsive.
- `src/styles.css` continúa siendo la fuente de colores y tipografías. El preset referencia sus variables CSS, sin copiar valores hexadecimales a TypeScript.

| Elemento | Referencia de Mammut |
| --- | --- |
| Acción principal, selección y casilla marcada | `accent`, con hover `accent-hover` |
| Texto principal y secundario | `ink`, `muted` |
| Superficies y campos | Superficie blanca actual, `page` y `disabled-input` según estado |
| Bordes normales | `line`, `line-strong` |
| Error | `danger`, `danger-text` y sus variantes de fondo y borde |
| Estados deshabilitados | `disabled`, `disabled-input`, `faint` |
| Tipografía | `font-sans`; títulos y cantidades conservan sus fuentes actuales |

- Desactivar la selección automática de tema oscuro por el sistema: la aplicación conserva su contenido claro.
- Declarar explícitamente el orden `theme, base, primeng, components, utilities`, con PrimeNG dentro de su capa. Conservar el Preflight de Tailwind.
- Evitar aplicar `field-input` o `btn-*` junto con un control PrimeNG si ambas piezas compiten por su aspecto. Conservar las utilidades compartidas en los controles que siguen siendo nativos y las clases de distribución o de pruebas donde correspondan.
- No cambiar la definición global de las utilidades existentes para acomodar el piloto.
- Controles con objetivos táctiles de al menos 44 px, foco visible y contraste según T-11. La casilla puede ser menor si su etiqueta completa cumple el objetivo táctil.
- En computadoras, comprobar el formulario y el panel de categorías en una ventana de portátil y en un monitor de escritorio, sin scroll horizontal. La revisión móvil queda pendiente.
- Respetar `prefers-reduced-motion` también en la apertura del selector, usando los mecanismos admitidos por PrimeNG.

## 4. Formulario piloto y contrato de datos

Este spec no agrega datos persistentes ni modifica `Product`, `ProductFormValue` o los contratos HTTP.

| Control actual | Incorporación de PrimeNG |
| --- | --- |
| Nombre, costo, precio y porción | Directiva `pInputText` sobre los inputs existentes |
| Piezas iniciales | Input nativo numérico, manteniendo su contrato; aplicar el aspecto de campo del piloto sin cambiar su validación |
| Categoría | `p-select` conectado al formulario reactivo |
| «Se fracciona en bolsitas» | `p-checkbox` en modo booleano |
| Guardar, Cambiar foto y Quitar foto | Directiva `pButton` sobre botones nativos con su `type` explícito |
| Archivo y previsualización | Input de archivo y presentación actuales |

- Mantener las entradas y salidas públicas de `ProductFormComponent`, incluidos `busy`, `saving`, `submitted` y `dirtyChange`.
- Precio y costo siguen siendo `string`, en inputs `type="text" inputmode="decimal"`. No se usa `InputNumber` para dinero ni se formatea o redondea mientras se escribe.
- Conservar máximo de dos decimales en precio y cuatro en costo; conservar los rangos y la comparación mediante las utilidades de dinero.
- Conservar `categoryId: FormControl<string>`. Las opciones del selector usan los identificadores convertidos a texto y una opción explícita `''` con etiqueta «Sin categoría».
- El payload sigue convirtiendo `''` en `null` y el resto en un identificador numérico. No incorporar un botón de limpiar que introduzca otro valor vacío.
- Preparar las opciones con `computed()`. Si requieren un tipo propio, declararlo en `product-form.models.ts`.
- Conservar la porción escrita al desmarcar y volver a marcar la casilla.
- Conservar la carga inicial de edición, las piezas de solo lectura en edición y el flujo actual de foto.
- Los errores de campo aparecen al enviar; «precio menor que el costo» sigue siendo la excepción en vivo. El estado visual inválido de PrimeNG se vincula a esos errores visibles, no solo a `touched` o `invalid` del control.
- `busy` deshabilita controles y acciones; `saving` conserva «Guardando…». El selector abierto tampoco permite modificar el valor cuando el formulario pasa a estar ocupado.
- Adaptar la referencia de categoría y su enfoque a la API pública de `Select`. No buscar nodos mediante clases privadas de PrimeNG.
- El error de categoría devuelto por el backend enfoca el control interactivo real y conserva la asociación con el mensaje. Las etiquetas apuntan al input interno mediante la API de accesibilidad del componente.
- Conservar el foco del primer campo inválido, el aviso de nombre duplicado, la guarda de cambios sin guardar y los flujos sin conexión de las páginas.

### Archivos del piloto

- `src/app/features/products/components/product-form/product-form.component.ts` y `.html`.
- `product-form.models.ts` y `product-form.constants.ts`, únicamente para opciones y textos de controles que lo requieran.
- `product-form.component.spec.ts`.
- Pruebas de `create-product-page` y `edit-product-page`, porque actualmente consultan el DOM de un `select` nativo.
- No se requiere cambiar servicios de datos, reglas de negocio, validadores ni rutas.

## 5. Plan de implementación

1. **Dependencias y licencia.** Verificar peers, instalar las dependencias compatibles y preparar el script, los hooks, el ejemplo de variable y las exclusiones de Git. Ejecutar la preparación sin clave y con una clave configurada, comprobando que nunca se imprime. La app actual debe seguir compilando.
2. **Provider y tema.** Crear las constantes de `core/ui`, registrar PrimeNG y ordenar las capas en `styles.css`. Ajustar el preset de Aura a los tokens de Mammut, su modo claro y los textos utilizados. Verificar arranque de navegador y servidor antes de migrar controles.
3. **Campos y botones.** Incorporar InputText y Button al formulario. Conservar los inputs monetarios y sus mensajes, las referencias de foco y la selección de foto. Ejecutar las pruebas del formulario y de ambas páginas.
4. **Selector de categoría.** Incorporar Select con opciones de texto y «Sin categoría». Adaptar el foco accesible y las pruebas que esperaban un `HTMLSelectElement`; probar selección mediante la interfaz del control. Comprobar carga inicial, limpieza a «Sin categoría», error del servidor y estado ocupado.
5. **Casilla de fraccionamiento.** Incorporar Checkbox booleano con etiqueta asociada. Adaptar las pruebas de interacción para comprobar aparición de porción, conservación de lo escrito, emisión de cambios y bloqueo durante guardado.
6. **Verificación del piloto.** Recorrer alta y edición contra la base local, comprobar SSR/hidratación y capturar una ventana de portátil y un monitor de escritorio. Ejecutar las comprobaciones del §7. Corregir únicamente regresiones de esta integración antes de cerrar el paso.
7. **Documentación y cierre.** Documentar en `CLAUDE.md` y `AGENTS.md` la configuración de licencia, imports por componente, tema y contrato de dinero. Actualizar el estado del spec y `specs/README.md` solo cuando sus criterios estén verificados.

Cada paso conserva el proyecto ejecutable. No se crean commits ni se hace push automáticamente.

## 6. Criterios de aceptación

- [x] La instalación resuelve los peers sin forzarlos y Angular permanece en su línea actual.
- [x] Los comandos npm de inicio, desarrollo, watch, build y tests preparan la licencia antes de compilar; la preparación directa para `ng` está documentada.
- [x] Sin clave la preparación informa cómo configurarla; con la licencia del usuario los controles funcionan sin avisos de licencia inválida o ausente.
- [x] La clave y los archivos locales que la contienen están excluidos de Git y no aparecen en logs ni ejemplos.
- [x] PrimeNG se registra una sola vez y utiliza el tema de Mammut tanto al arrancar como al recargar.
- [x] El contenido permanece claro aunque el sistema tenga tema oscuro; no cambia el aspecto de login, navegación, tarjetas, vendedores, toast o ventanas existentes.
- [x] Nombre, precio, costo, porción y botones del piloto usan PrimeNG; categoría y fraccionamiento usan Select y Checkbox.
- [x] Alta envía el mismo contrato de datos con categoría y sin ella; edición carga la categoría y permite volver a «Sin categoría».
- [x] Precio y costo conservan su texto decimal; los excesos de decimales o rango muestran error y no emiten un payload válido.
- [x] Precio menor que costo sigue mostrando el aviso en vivo y bloqueando Guardar.
- [x] Los demás errores aparecen al enviar; nombre duplicado y categoría inexistente enfocan el campo correcto.
- [x] Marcar y desmarcar fraccionamiento conserva la porción escrita y mantiene sus reglas de validación.
- [x] El estado ocupado bloquea todos los controles y acciones; «Guardando…» y la prevención de envíos repetidos siguen funcionando.
- [x] Foto opcional, cambio y eliminación de foto mantienen su flujo; edición no permite modificar piezas.
- [x] La guarda de cambios sin guardar y los estados sin conexión de ambas páginas conservan su comportamiento.
- [x] El selector funciona con teclado; todos los controles tienen nombre accesible y los mensajes se asocian al elemento interactivo real.
- [x] Hay foco visible, objetivos de interacción de 44 px y capturas en una ventana de portátil y en un monitor de escritorio sin scroll horizontal, con el selector abierto y cerrado.
- [x] Con movimiento reducido no se ejecutan animaciones prescindibles del piloto.
- [x] SSR y la navegación cliente no muestran errores de acceso al DOM ni discrepancias de hidratación; las URLs auxiliares de T-16 siguen abriendo sus ventanas al recargar.
- [x] Build de producción, tests afectados y comprobación de arquitectura pasan. Se conserva el presupuesto de bundle configurado y se registra el tamaño inicial antes y después.
- [x] `CLAUDE.md`, `AGENTS.md` y el índice de specs reflejan la integración. No hay cambios en `backend/` ni en migraciones.

## 7. Plan de pruebas y verificación

- Adaptar las pruebas existentes del formulario y de las páginas al DOM público de los controles, sin eliminar sus aserciones de negocio para hacerlas pasar.
- Para Select y Checkbox, añadir cobertura de integración de formulario reactivo mediante interacción de usuario: selección, carga inicial, deshabilitado, error y foco. No basta con asignar el valor al FormControl en todas las pruebas.
- Reutilizar las pruebas de dinero, foto, validación y cambios sin guardar. No duplicar pruebas de la implementación interna de PrimeNG.
- Ejecutar `npm test -- --watch=false --include 'src/app/features/products/**/*.spec.ts'`, `npm run build` y `npm run check:architecture`.
- Como se cambia la configuración y el CSS global, ejecutar también una vez la suite completa con `npm test -- --watch=false`.
- Los comandos directos `ng build` y `ng test` requieren `npm run ui:prepare` previo desde un checkout nuevo.
- La verificación manual usa el entorno local existente: alta con y sin categoría, edición, fraccionamiento, foto, estados de guardado, teclado y ventanas de computadora. No se ejecutan pruebas de backend por esta integración de frontend.
- Comparar el bundle inicial y los chunks del formulario antes y después. No elevar los límites de `angular.json` para ocultar un aumento ni importar un módulo agregador de PrimeNG.

**Línea base al redactar (2026-11-01):** `npm run build` y `npm run check:architecture` pasan antes de instalar PrimeNG. El bundle inicial del navegador mide 397.57 kB, con transferencia estimada de 103.41 kB. Esta comprobación no acredita los criterios de implementación; los cambios de esta fase son solo documentación.

## 8. Decisiones

- **Usuario:** configuración y formulario piloto, en lugar de migración completa.
- **Usuario:** aceptación del formulario compartido de producto propuesto, cubriendo alta y edición.
- **Usuario:** tema PrimeNG adaptado al diseño de Mammut y licencia Community ya disponible.
- **Usuario, durante el paso 6:** priorizar el responsive de computadoras. La revisión visual móvil queda pendiente y no es un requisito de cierre de esta entrega.
- **Diseño técnico del borrador:** Aura como base; permite aprovechar los controles y ajustar los tokens sin reemplazar la identidad visual.
- **Sí:** mantener formularios reactivos tipados y la API presentacional del componente. Cambiar la librería visual no requiere cambiar el modelo de formulario.
- **Sí:** imports directos y específicos; no crear wrappers sin una necesidad de reutilización concreta.
- **Sí:** configuración central de PrimeNG y variables CSS de la marca como fuente visual.
- **No:** InputNumber para dinero. El contrato vigente requiere texto y rechazo de decimales sobrantes.
- **No:** FileUpload en este piloto. Su uso ampliaría el flujo actual de subida y previsualización sin ser necesario para verificar la integración.
- **No:** migrar diálogos y notificaciones de paso. Sus reglas de foco, cierre y rutas auxiliares pertenecen a otros componentes y requieren su propio alcance.
- **No:** instalar PrimeFlex o el plugin de Tailwind para recrear utilidades que ya tiene el proyecto.
- **Sí:** preparar la licencia antes de compilar. Angular no expone automáticamente las variables de un `.env` a su código de navegador.
- **Jira:** tarea técnica solicitada directamente por el usuario, sin issue asociado; no se inventa una clave Jira ni se crea una historia como parte de este spec.

## 9. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El paquete de temas o un peer no coincide con PrimeNG y Angular | Verificar versiones antes de instalar; resolver una combinación compatible sin forzar npm |
| La inyección de CSS cambia campos ajenos al piloto | Encapsular los estilos de PrimeNG en su capa y conservar el Preflight y las utilidades actuales |
| Select devuelve números o `null` donde antes llegaban strings | Opciones con valor textual, sin limpieza implícita y pruebas del payload |
| Las referencias de foco apuntan al host del selector | Usar la API pública de foco y comprobar el elemento interactivo por teclado y en pruebas |
| La apariencia inválida se activa al tocar el control | Vincularla a los errores visibles del componente, conservando la excepción de precio menor que costo |
| La licencia no está disponible en un checkout nuevo o CI | Ejemplo de variable, preparación explícita y hooks antes de compilar |
| El bundle inicial supera el presupuesto | Imports individuales, medición y revisión de qué llega al arranque; no ampliar límites automáticamente |
| Hay discrepancias de estilos o acceso al DOM durante SSR | Verificar recarga y navegación cliente antes de dar el piloto por terminado |

## Lo que **no** entra en este spec

- Migrar pantallas o componentes fuera del formulario piloto.
- Cambiar inventario, dinero, contratos HTTP o reglas de negocio.
- Rediseñar la aplicación, añadir modo oscuro o cambiar de sistema de formularios.
- Publicar la clave de licencia en Git o modificar el entorno local del usuario durante la redacción.

Las siguientes migraciones se definen en sus propios specs después de evaluar el piloto.

## 10. Avance de implementación — 2026-11-01

- Rama: `spec-M2-t17-primeng-formulario-producto`, creada desde `main` conservando los archivos pendientes con autorización del usuario.
- **Paso 1 completado:** `primeng@22.1.4`, `@primeuix/themes@3.1.0` y el peer `@angular/cdk@22.2.0`. Ningún paquete Angular existente cambió de versión; RxJS 7.8.2 satisface el peer de PrimeNG.
- `scripts/prepare-primeng-license.mjs` lee la variable de proceso o el `.env` local y genera únicamente la exportación de la clave. Los hooks npm preparan el archivo; `.env` y el generado están ignorados por Git. Se conserva el `.env` del usuario.
- `node --test scripts/prepare-primeng-license.test.mjs`: cuatro pruebas pasan para clave ausente, lectura local sin exportar otras variables, precedencia del entorno, serialización segura y rechazo de un valor de entorno vacío.
- La preparación con la configuración local disponible termina correctamente sin imprimir la clave. Su validez dentro de PrimeNG se comprobará al registrar el provider en el paso 2.
- **Paso 2 completado:** provider único en `app.config.ts`, configuración tipada en `core/ui/constants/primeng.constants.ts` y preset en `mammut-theme.constants.ts`. El servidor hereda la misma configuración. Se desactivan Preflight de PrimeNG, ripple y modo oscuro automático; los textos del piloto quedan en español.
- El preset usa la base de Aura y los tokens de InputText, Select y Checkbox. Los botones configuran únicamente las variantes primaria y secundaria que usa el piloto. No se incluye el preset de todos los componentes ni las severidades de botones ajenas al piloto; así se conserva el presupuesto inicial sin modificar sus límites.
- Las capas se declaran antes del import de Tailwind. Las transiciones de PrimeNG referencian una variable que pasa a `0s` con `prefers-reduced-motion`.
- Verificación en Chrome del build de producción: login renderizado y recargado, sin avisos de licencia ni errores de la aplicación. Los mensajes de consola encontrados pertenecen a extensiones del navegador. Los estilos calculados resuelven `--p-primary-color` a `#ac5e1c` y la fuente a Public Sans. Al emular preferencia oscura, el esquema sigue en `light` y el fondo del campo en blanco; al emular movimiento reducido, las transiciones semánticas y de campo resuelven a `0s`.
- Para la prueba local del servidor se usó `NG_ALLOWED_HOSTS=localhost`; el `allowedHosts` vacío del proyecto rechaza ese host por defecto. No se cambia `angular.json`. El proceso y la pestaña de prueba se cerraron al terminar.
- Validación del paso 2: `npm run build -- --stats-json`, `npm test -- --watch=false` (531 pruebas) y `npm run check:architecture` pasan. Bundle inicial: **492.67 kB**, transferencia estimada **130.45 kB**, sin advertencias de presupuesto (línea base: 397.57 kB / 103.41 kB).
- **Paso 3 completado:** `product-form` importa `InputText` y `ButtonDirective` individualmente. Nombre, costo, precio, piezas y porción conservan sus inputs nativos con `pInputText`; Guardar, Cambiar foto y Quitar foto usan `pButton`. Los botones de foto siguen siendo de tipo `button` y Guardar de tipo `submit`.
- Precio y costo conservan `type="text" inputmode="decimal"`, sus valores sin formateo y las referencias de foco existentes. Los errores visuales de InputText dependen de los mensajes visibles; tocar un campo no activa por sí solo el error. Categoría, casilla y selector de archivo siguen siendo nativos en este paso.
- Se ampliaron las pruebas para comprobar el estado visual después del envío, el contrato textual de dinero y el bloqueo de todos los inputs durante guardado. La selección y eliminación de foto siguen cubiertas por las pruebas existentes.
- Al incorporar las directivas, el bundle inicial llegó a 507.66 kB. Se retiró la base completa de Aura y se declararon solo los tokens semánticos y primitivos que necesitan sus controles del piloto, conservando sus presets de InputText, Select y Checkbox. Una prueba verifica que todas sus referencias de tokens se resuelven. Esta optimización sustituye la carga de la base general descrita en el paso 2.
- Validación del paso 3: 136 pruebas de Productos pasan; después de optimizar el tema, la suite completa pasa con **533 pruebas en 75 archivos**. `npm run build` y `npm run check:architecture` pasan. Bundle inicial: **498.45 kB**, transferencia estimada **132.85 kB**, sin advertencias de presupuesto.
- **Paso 4 completado:** categoría usa `Select` con opciones calculadas y valores de texto, incluida la opción explícita `''` para «Sin categoría». El payload mantiene identificadores numéricos o `null`. La API pública de foco sustituye la referencia al select nativo.
- El combobox no editable de PrimeNG es un `span`: `ariaLabelledBy` asocia su nombre con «Categoría» y pulsar la etiqueta enfoca el control. El pass-through público `label` aplica `aria-describedby` y `aria-invalid` al elemento interactivo cuando el backend rechaza la categoría, y los retira al corregirse el estado.
- Al empezar a guardar, se cierra el panel y se deshabilitan sus opciones mediante la API pública `optionDisabled`, para bloquear también una opción que aún quede visible durante el cierre. `motionOptions.safe` respeta la preferencia de movimiento reducido.
- Se adaptaron las pruebas del formulario y de ambas páginas al DOM accesible de Select. Se comprueban selección mediante clic, selección con teclado, catálogo vacío, vuelta a «Sin categoría» en edición, payload, foco y bloqueo durante guardado. La carga del producto antes que el catálogo conserva la selección.
- `src/test-setup.ts` aporta `matchMedia` al entorno jsdom, que no implementa esa API ni evalúa media queries. Se registra exclusivamente en `architect.test.options.setupFiles` de `angular.json`; los presupuestos de build no cambian.
- Validación del paso 4: **141 pruebas de Productos** pasan y la suite completa pasa con **538 pruebas en 75 archivos**. `npm run build` y `npm run check:architecture` pasan. Bundle inicial: **513.14 kB**, transferencia estimada **136.85 kB**; el build avisa que supera en **13.14 kB** el umbral de advertencia de 500 kB. El tamaño y las oportunidades de optimización quedan incluidos en la revisión del paso 6, sin elevar los límites.
- **Paso 5 completado:** `product-form` importa `Checkbox` individualmente y lo conecta a `fractionable` en modo binario. `inputId` y una etiqueta externa asociada conservan un área de interacción de al menos 44 px, sin envolver el componente en otra etiqueta que pueda duplicar el clic.
- El control conserva su valor booleano, la carga inicial en edición y la emisión de `dirtyChange`. Desmarcar oculta la porción sin borrar su texto; el payload la omite con `null` hasta volver a marcar. El formulario deshabilitado bloquea tanto el clic en la casilla como en su etiqueta.
- Las pruebas de fraccionamiento ahora realizan clics reales sobre el input de Checkbox. Se agregaron casos de etiqueta y valor booleano, conservación de porción y payload, y bloqueo y posterior habilitación; la validación de porción obligatoria y su foco siguen pasando.
- Validación del paso 5: **144 pruebas de Productos en 11 archivos**, `npm run build` y `npm run check:architecture` pasan. Bundle inicial: **513.12 kB**, transferencia estimada **136.84 kB**; se mantiene la advertencia de presupuesto (**13.12 kB** sobre el umbral de 500 kB), sin modificar sus límites.
- Los pasos 6 y 7 siguen pendientes: verificación manual del piloto, revisión de tamaño y documentación de cierre. La comprobación de licencia en navegador con los controles del piloto sigue pendiente de esa verificación.

### Paso 6 — verificación en curso

- Se limita la detección de clases de Tailwind a `src/`, excluyendo las pruebas. Los catálogos y referencias HTML/Vue ya no generan utilidades para la aplicación. `@theme static` conserva las variables de marca consumidas por el preset desde TypeScript; se comprobó que sus 19 referencias a variables CSS siguen declaradas en el CSS compilado.
- Se retiró la escala primaria que no utiliza ningún control del piloto. Se mantienen los colores semánticos de selección, contraste, hover y estado activo y la comprobación de referencias de tokens.
- Bundle inicial: **502.82 kB**, transferencia estimada **135.61 kB**. El CSS pasa de 62.97 a **53.26 kB**. Sigue una advertencia de **2.82 kB** sobre el umbral de 500 kB; no se modifican los presupuestos ni se declara eliminado ese aviso.
- Build de producción y servidor local en `localhost:4200`, con `NG_ALLOWED_HOSTS=localhost`, consumiendo la API local en `localhost:3000`. Se confirmó que `backend/.env` apunta al Supabase de Docker, no a producción. Next requirió el segundo arranque previsto en las instrucciones del repositorio.
- En el navegador: alta vacía muestra los errores y enfoca Nombre; el precio `450.555` muestra su error de precisión sin redondearlo; un precio menor que el costo bloquea Guardar; categoría se selecciona con teclado; la porción es obligatoria al fraccionar y conserva `30 g` al desmarcar y volver a marcar con Espacio. El alta muestra su resumen y el toast.
- Se capturaron alta y edición en escritorio. La edición carga categoría, precio, costo y porción, y muestra piezas de solo lectura. La guarda ofrece «Seguir editando» y conserva lo escrito. Se comprobó la selección local de foto, su previsualización y las acciones Cambiar/Quitar foto.
- Consulta de solo lectura posterior a la interacción: el producto local **341**, con prefijo `test-ui-primeng-20261101`, tiene nombre editado, `category_id = null`, costo `83.3333`, precio `450.50`, stock `2`, fraccionamiento activo, porción `30 g` y foto guardada. Su único movimiento es `initial +2` en bodega. Permanece activo para revisión; no se tocaron productos de negocio ni se sobrescribió inventario.
- Validación automatizada tras optimizar: **541 pruebas en 75 archivos**, las cuatro pruebas del script de licencia, arquitectura y build pasan.
- El usuario priorizó computadoras durante este paso. La revisión visual móvil queda diferida y no se presenta como verificada. No se completó una captura válida a 375 px.
- **Cierre de la verificación (2026-11-02):** con Chrome headless sobre `localhost:4200` y la API local se completaron 14 comprobaciones, todas correctas. Se capturó el alta en una ventana de portátil (1440×900) y en un monitor de escritorio (1920×1080), con el selector abierto y cerrado, sin scroll horizontal en ninguno de los dos casos; las capturas son temporales y no se versionan.
- Con preferencia del sistema por tema oscuro, `color-scheme` sigue en `light` y el campo conserva fondo blanco. Con movimiento reducido, las transiciones de campo, selector y botón resuelven a `0s`. Los controles miden al menos 44 px de alto (el checkbox de 20 px forma parte de una etiqueta de 44 px) y el foco por teclado en Nombre muestra el anillo de 3 px.
- La ruta auxiliar `/(ventana:dejar;producto=…)` de T-16 abre su ventana al cargar la URL completa, y la navegación cliente posterior no registra excepciones. La consola no muestra avisos de licencia ni errores de la aplicación.
- Los estados sin conexión, la guarda de cambios y los flujos de foto siguen cubiertos por las pruebas de las páginas; no se repitieron manualmente.
- **Paso 7 completado:** `CLAUDE.md` y `AGENTS.md` documentan la licencia y los hooks, la configuración global, el tema basado en tokens, los imports por componente y el contrato de dinero con PrimeNG. El índice de specs y este documento quedan en estado **Implementado**. No hay cambios en `backend/` ni en migraciones.
- Validación final: **144 pruebas de Productos en 11 archivos** y **541 pruebas en 75 archivos** pasan; `npm run build` y `npm run check:architecture` pasan. Bundle inicial: **502.82 kB**, transferencia estimada **135.61 kB**; se conserva la advertencia de **2.82 kB** sobre el umbral de 500 kB con los límites de `angular.json` sin modificar.
