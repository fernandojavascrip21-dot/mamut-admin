# Mammoth Suplements

Catálogo de suplementos con panel de administración. Vue 3 (\`<script setup>\`) + Vite + Vue Router + Pinia + Tailwind.

## Correr

\`\`\`bash
npm install
npm run dev
\`\`\`

## Acceso al panel

Ruta directa \`/admin/login\` (sin enlace en la navegación pública).

- Correo: \`admin@mammoth.mx\`
- Contraseña: \`mammoth123\`

Las credenciales viven en \`src/config.js\` junto con el número de WhatsApp del negocio.

## Estructura

- \`src/componentes/\` — TarjetaProducto, ModalProducto, InsigniaExistencia, BotonWhatsApp, BarraBusqueda, SidebarCategorias, TablaProductos, FormularioProducto y auxiliares.
- \`src/vistas/\` — Catálogo, login y las dos pantallas del panel.
- \`src/layouts/\` — layout público y layout de administración (paleta invertida).
- \`src/servicios/productos.js\` — **única** capa de datos. Hoy \`productos.json\` + localStorage; cada función lleva el comentario \`// BACKEND:\` con la llamada real que la sustituye.
- \`src/stores/\` — \`productos\` y \`sesion\` (Pinia).
- \`src/utilidades/\` — formato de precios, reglas de existencia, enlaces de WhatsApp y conversión de enlaces de Google Drive.
- \`src/estilos/global.css\` — Tailwind + clases de componente (\`.btn-primario\`, \`.campo\`, \`.insignia-*\`). La paleta está en \`tailwind.config.js\`.

## Imágenes

Las fotos viven en una carpeta pública de Google Drive. Se pega el enlace normal del archivo y \`urlImagen()\` lo convierte al formato de visualización directa. Si una foto no carga, se muestra el logo como reemplazo.
