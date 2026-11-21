# Spec técnico — T-43 · Envío de correo con Resend en producción

> **Estado:** Aprobado
> **Depende de:** M13-hu44-desactivar-reactivar-eliminar-vendedor (`specs/M13-hu44-desactivar-reactivar-eliminar-vendedor/spec.md`) — módulo `backend/src/notifications/` y aviso de estado; M13-hu45-contrasena-temporal-vendedor (`specs/M13-hu45-contrasena-temporal-vendedor/spec.md`) — aviso de contraseña cambiada; M7-t31-configuracion-por-ambiente (`specs/M7-t31-configuracion-por-ambiente/spec.md`) — sección «Despliegue» de `backend/README.md`
> **Fecha:** 2026-11-20
> **Objetivo:** que en producción los tres avisos al vendedor (desactivado, reactivado y contraseña cambiada) lleguen a su correo registrado desde un remitente del dominio propio verificado en Resend, sin cambiar código.

Fuentes:

- **Jira:** tarea `SCRUM-110`, épica `SCRUM-105 · M13 · Gestión de vendedores (v2)`. Nació como pendiente de despliegue de HU-44 (`SCRUM-108`).
- **Código (solo lectura, no cambia):**
  - `backend/src/notifications/resend.ts`: `sendEmail` devuelve `'skipped'` sin `RESEND_API_KEY`, `RESEND_FROM` o el id de la plantilla, y `'failed'` si Resend responde con error; nunca lanza.
  - `backend/src/notifications/index.ts`: `sendSellerStatusEmail` lee `RESEND_TEMPLATE_SELLER_STATUS` y `sendSellerPasswordEmail` lee `RESEND_TEMPLATE_SELLER_PASSWORD`.
  - `backend/.env.example` (bloque de Resend) y `backend/README.md` (sección «Despliegue»).
- **Decisiones del usuario del 2026-11-20:** ver §6.

## 1. Por qué existe este spec

En local, los avisos salen con el remitente de prueba `onboarding@resend.dev`. Resend solo entrega ese remitente al correo dueño de la cuenta, así que ningún vendedor real recibe nada.

Para que el correo llegue a cualquier vendedor hace falta un dominio propio verificado en Resend, un remitente de ese dominio y las variables cargadas en el backend de producción.

El código ya está listo y desplegado: T-42, HU-44 y HU-45 están en producción. Este spec es configuración y documentación.

## 2. Alcance

**Entra en este spec:**

- **Resend:**
  - Agregar el dominio propio en resend.com/domains y verificarlo.
  - Crear una API key nueva, solo para producción, con permiso «Sending access» limitada a ese dominio.
  - Comprobar que las dos plantillas están **publicadas**: «Aviso de estado del vendedor» y «Contraseña cambiada».
- **DNS en Vercel:** agregar los registros que da Resend (SPF, DKIM y, si lo pide, MX del subdominio de rebote) en Vercel → Domains → el dominio.
- **Vercel, proyecto del backend, entorno Production:** cargar las cuatro variables y redesplegar.
- **Verificación en producción** de los tres correos (§5).
- **Documentación:**
  - `backend/README.md`, sección «Despliegue»: un punto nuevo «Correo (Resend)» con los pasos de este spec, las cuatro variables y los síntomas de error.
  - `backend/.env.example`: el comentario del bloque de Resend dice «Sin las tres variables» y solo menciona HU-44; pasa a decir que son cuatro, que cada aviso necesita su plantilla y que cubre HU-44 y HU-45.
  - `specs/README.md`: fila del spec y relación con HU-44 y HU-45.
- **Jira:** actualizar `SCRUM-110` para que incluya la plantilla de contraseña (HU-45) y comentar el avance.

**No entra en este spec:**

- **Cambios de código** en `backend/src/notifications/` o en otro módulo, y pruebas nuevas.
- **Un comando de prueba de envío** (`npm run email:check` o similar).
- **Avisos nuevos** (por ejemplo, al administrador o al dar de alta un vendedor).
- **Variables en los entornos Preview o Development de Vercel:** sin ellas, esos ambientes responden `skipped` y no mandan correos reales.
- **Cambiar la clave o el remitente de local:** `backend/.env` sigue con `onboarding@resend.dev`.
- **Webhooks de Resend** para saber si el correo se entregó o rebotó.

## 3. Modelo de datos

Este spec no introduce estructuras de datos ni migraciones. Solo define valores de configuración del backend de producción:

| Variable | Valor en producción | Dónde |
| --- | --- | --- |
| `RESEND_API_KEY` | Clave nueva con «Sending access» limitada al dominio | Vercel → backend → Production |
| `RESEND_FROM` | `Mammut <avisos@<dominio>>` (dominio raíz verificado) | Vercel → backend → Production |
| `RESEND_TEMPLATE_SELLER_STATUS` | id de «Aviso de estado del vendedor» (hoy `1021a868-99cd-4bf6-bc46-a9f3d641e027`) | Vercel → backend → Production |
| `RESEND_TEMPLATE_SELLER_PASSWORD` | id de «Contraseña cambiada» (empieza con `da0d5fef-`) | Vercel → backend → Production |

Reglas:

- La clave nunca se escribe en el repo, en Jira ni en el spec. Solo vive en Vercel.
- Los ids de plantilla son de la misma cuenta de Resend que la clave. Una clave de otra cuenta hace que Resend responda `4xx`.
- El nombre del dominio no se escribe en el repo (repo público): la documentación usa `<dominio>`.

## 4. Plan de implementación

1. **Jira.** Mover `SCRUM-110` a «En curso» si no lo está, añadirle la plantilla de contraseña (HU-45) y el tercer correo a verificar, y comentar el plan.
2. **Documentación.** Actualizar el comentario de Resend en `backend/.env.example` y agregar el punto «Correo (Resend)» a la sección «Despliegue» de `backend/README.md`. Actualizar `specs/README.md`. Es el único paso con cambios en el repo; queda listo para commit.
3. **Dominio en Resend.** El usuario agrega el dominio en resend.com/domains (región por omisión) y copia los registros DNS.
4. **DNS en Vercel.** El usuario agrega cada registro en Vercel → Domains → el dominio, con el nombre y valor exactos que da Resend. Espera a que Resend marque el dominio como «Verified».
5. **API key.** El usuario crea en Resend una clave nueva «Sending access» limitada al dominio. La copia una sola vez directo a Vercel.
6. **Plantillas.** El usuario confirma en Resend que las dos plantillas están publicadas y que sus ids coinciden con los de §3.
7. **Variables en Vercel.** El usuario carga las cuatro variables en el proyecto del backend, solo en el entorno Production.
8. **Redespliegue.** El usuario redespliega el backend de producción para que lea las variables.
9. **Verificación.** Se recorren los casos de §5 con un vendedor de prueba cuyo correo sea del usuario. Se comenta el resultado en `SCRUM-110`.

## 5. Criterios de aceptación

- [ ] Resend muestra el dominio como «Verified».
- [ ] Vercel tiene las cuatro variables en el proyecto del backend, solo en Production, y el backend se redesplegó después de cargarlas.
- [ ] La clave de producción es distinta de la de local y solo tiene «Sending access» para el dominio.
- [ ] Al desactivar un vendedor de prueba en producción, llega «Tu acceso a Mammut fue desactivado» a su correo registrado, con remitente `Mammut <avisos@<dominio>>`.
- [ ] Al reactivarlo, llega «Tu acceso a Mammut fue reactivado».
- [ ] Al cambiarle la contraseña temporal, llega «Tu contraseña de Mammut fue cambiada», sin la contraseña.
- [ ] Ninguno de los tres correos trae contraseña, enlaces ni cifras.
- [ ] Un vendedor de prueba llamado `Ana <b>&</b> "Co"` recibe el nombre tal cual, sin HTML interpretado ni doble escape.
- [ ] Los tres correos llegan a la bandeja de entrada de Gmail, no a spam.
- [ ] El administrador no ve el aviso «no se pudo avisarle por correo» en ninguno de los tres casos.
- [ ] `backend/.env.example` y `backend/README.md` describen las cuatro variables y los dos avisos, sin valores reales.
- [ ] El vendedor de prueba se elimina o desactiva al terminar.

## 6. Decisiones

- **Sí:** solo configuración y documentación. El envío ya funciona y se apaga solo sin variables (`skipped`), así que no hay código que cambiar.
- **No:** un comando de prueba de envío. Agregaría código y pruebas para algo que se verifica una vez desde la app.
- **Sí:** las dos plantillas en esta tarea. `SCRUM-110` nació antes de HU-45; sin la segunda, el aviso de contraseña seguiría saliendo `skipped` en producción.
- **Sí:** remitente `Mammut <avisos@<dominio>>` en el dominio raíz, como el ejemplo que ya tiene `backend/.env.example`.
- **No:** subdominio de envío (`avisos.<dominio>`). Aísla la reputación, pero el volumen es de unos pocos avisos al mes.
- **Sí:** clave nueva solo para producción, limitada al dominio. Si una se filtra se revoca sin afectar a la otra.
- **No:** la misma clave en local y producción. Una clave filtrada en local permitiría enviar como el dominio.
- **Sí:** DNS en Vercel, donde ya se administra el dominio.
- **Sí:** variables solo en Production. Preview y Development no deben mandar correos a vendedores reales.
- **Sí:** número `T-43` para la carpeta `M13-t43-…`, el siguiente libre después de T-42; el resumen de `SCRUM-110` no tenía número.
- **Sí:** el nombre del dominio no se escribe en el repo, que es público.

## 7. Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El dominio ya tiene un registro SPF (por ejemplo, de un correo propio) | Resend pide su SPF en un subdominio de rebote (`send.<dominio>`), así que no choca con el SPF del dominio raíz. Si Resend pide cambiar el del raíz, se unen en un solo registro, nunca dos. |
| Resend responde `4xx` y el administrador ve «no se pudo avisarle» | Revisar, en este orden: plantilla publicada, `RESEND_FROM` con el dominio verificado y clave de la misma cuenta que las plantillas. El log del backend en Vercel trae el status HTTP, sin datos del correo. |
| Los correos caen en spam | Confirmar SPF y DKIM en verde en Resend. Agregar un registro DMARC (`_dmarc.<dominio>`, `v=DMARC1; p=none;`) si Resend lo recomienda. |
| Las variables se cargan pero el backend no las lee | Vercel solo las aplica en un despliegue nuevo: redesplegar sin caché de build. |
| La propagación DNS tarda | Puede tardar hasta 48 h. La verificación (paso 9) espera a que Resend marque «Verified». |
| «Enviado» no garantiza la entrega | `sent` solo significa que Resend aceptó el correo. La verificación se hace viendo el correo en la bandeja. |

## Lo que **no** entra en este spec

- Cambios de código o pruebas nuevas.
- Comando de prueba de envío.
- Avisos nuevos por correo.
- Variables de Resend en Preview o Development.
- Cambios en la clave o el remitente de local.
- Webhooks de entrega o rebote.

Cada uno, si llega, va en su propio spec.
