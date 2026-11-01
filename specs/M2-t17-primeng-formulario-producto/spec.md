# Spec técnico — T-17 · PrimeNG y formulario piloto de producto

> **Estado:** aPROVADO
> **Depende de:** M2-t11-rediseno-visual (`specs/M2-t11-rediseno-visual/spec.md`) — tokens y reglas visuales; M2-t12-rediseno-productos (`specs/M2-t12-rediseno-productos/spec.md`) — formulario con el diseño actual; M1-hu06-editar-producto (`specs/M1-hu06-editar-producto/spec.md`) — alta y edición; M1-t08-dinero-sin-flotantes (`specs/M1-t08-dinero-sin-flotantes/spec.md`) — contrato de dinero ya presente en el código
> **Fecha:** 2026-11-01
> **Objetivo:** incorporar PrimeNG con un tema adaptado a Mammut y usarlo en el formulario compartido de alta y edición de producto, conservando sus reglas y flujos.

Fuentes:

- Pedido y respuestas del usuario del 2026-11-01: configuración y formulario piloto; tema adaptado al diseño actual; licencia Community disponible.
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
- A 375 px y en escritorio, el formulario y el panel de categorías no producen scroll horizontal.
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
6. **Verificación del piloto.** Recorrer alta y edición contra la base local, comprobar SSR/hidratación y capturar móvil y escritorio. Ejecutar las comprobaciones del §7. Corregir únicamente regresiones de esta integración antes de cerrar el paso.
7. **Documentación y cierre.** Documentar en `CLAUDE.md` y `AGENTS.md` la configuración de licencia, imports por componente, tema y contrato de dinero. Actualizar el estado del spec y `specs/README.md` solo cuando sus criterios estén verificados.

Cada paso conserva el proyecto ejecutable. No se crean commits ni se hace push automáticamente.

## 6. Criterios de aceptación

- [x] La instalación resuelve los peers sin forzarlos y Angular permanece en su línea actual.
- [ ] Los comandos npm de inicio, desarrollo, watch, build y tests preparan la licencia antes de compilar; la preparación directa para `ng` está documentada.
- [ ] Sin clave la preparación informa cómo configurarla; con la licencia del usuario los controles funcionan sin avisos de licencia inválida o ausente.
- [x] La clave y los archivos locales que la contienen están excluidos de Git y no aparecen en logs ni ejemplos.
- [ ] PrimeNG se registra una sola vez y utiliza el tema de Mammut tanto al arrancar como al recargar.
- [ ] El contenido permanece claro aunque el sistema tenga tema oscuro; no cambia el aspecto de login, navegación, tarjetas, vendedores, toast o ventanas existentes.
- [ ] Nombre, precio, costo, porción y botones del piloto usan PrimeNG; categoría y fraccionamiento usan Select y Checkbox.
- [ ] Alta envía el mismo contrato de datos con categoría y sin ella; edición carga la categoría y permite volver a «Sin categoría».
- [ ] Precio y costo conservan su texto decimal; los excesos de decimales o rango muestran error y no emiten un payload válido.
- [ ] Precio menor que costo sigue mostrando el aviso en vivo y bloqueando Guardar.
- [ ] Los demás errores aparecen al enviar; nombre duplicado y categoría inexistente enfocan el campo correcto.
- [ ] Marcar y desmarcar fraccionamiento conserva la porción escrita y mantiene sus reglas de validación.
- [ ] El estado ocupado bloquea todos los controles y acciones; «Guardando…» y la prevención de envíos repetidos siguen funcionando.
- [ ] Foto opcional, cambio y eliminación de foto mantienen su flujo; edición no permite modificar piezas.
- [ ] La guarda de cambios sin guardar y los estados sin conexión de ambas páginas conservan su comportamiento.
- [ ] El selector funciona con teclado; todos los controles tienen nombre accesible y los mensajes se asocian al elemento interactivo real.
- [ ] Hay foco visible, objetivos táctiles de 44 px y capturas a 375 px y escritorio sin scroll horizontal, con el selector abierto y cerrado.
- [ ] Con movimiento reducido no se ejecutan animaciones prescindibles del piloto.
- [ ] SSR y la navegación cliente no muestran errores de acceso al DOM ni discrepancias de hidratación; las URLs auxiliares de T-16 siguen abriendo sus ventanas al recargar.
- [ ] Build de producción, tests afectados y comprobación de arquitectura pasan. Se conserva el presupuesto de bundle configurado y se registra el tamaño inicial antes y después.
- [ ] `CLAUDE.md`, `AGENTS.md` y el índice de specs reflejan la integración. No hay cambios en `backend/` ni en migraciones.

## 7. Plan de pruebas y verificación

- Adaptar las pruebas existentes del formulario y de las páginas al DOM público de los controles, sin eliminar sus aserciones de negocio para hacerlas pasar.
- Para Select y Checkbox, añadir cobertura de integración de formulario reactivo mediante interacción de usuario: selección, carga inicial, deshabilitado, error y foco. No basta con asignar el valor al FormControl en todas las pruebas.
- Reutilizar las pruebas de dinero, foto, validación y cambios sin guardar. No duplicar pruebas de la implementación interna de PrimeNG.
- Ejecutar `npm test -- --watch=false --include 'src/app/features/products/**/*.spec.ts'`, `npm run build` y `npm run check:architecture`.
- Como se cambia la configuración y el CSS global, ejecutar también una vez la suite completa con `npm test -- --watch=false`.
- Los comandos directos `ng build` y `ng test` requieren `npm run ui:prepare` previo desde un checkout nuevo.
- La verificación manual usa el entorno local existente: alta con y sin categoría, edición, fraccionamiento, foto, estados de guardado, teclado y vista móvil. No se ejecutan pruebas de backend por esta integración de frontend.
- Comparar el bundle inicial y los chunks del formulario antes y después. No elevar los límites de `angular.json` para ocultar un aumento ni importar un módulo agregador de PrimeNG.

**Línea base al redactar (2026-11-01):** `npm run build` y `npm run check:architecture` pasan antes de instalar PrimeNG. El bundle inicial del navegador mide 397.57 kB, con transferencia estimada de 103.41 kB. Esta comprobación no acredita los criterios de implementación; los cambios de esta fase son solo documentación.

## 8. Decisiones

- **Usuario:** configuración y formulario piloto, en lugar de migración completa.
- **Usuario:** aceptación del formulario compartido de producto propuesto, cubriendo alta y edición.
- **Usuario:** tema PrimeNG adaptado al diseño de Mammut y licencia Community ya disponible.
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
- Los pasos 2 a 7 siguen pendientes; aún no se migran controles ni se declara la integración completa.
