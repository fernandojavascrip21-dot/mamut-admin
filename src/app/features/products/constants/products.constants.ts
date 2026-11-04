// Marca que la falla vino de subir la foto, no del guardado: cualquier error ahí es «sin
// conexión», aunque el backend responda 422 (p. ej. archivo que no es imagen). La usa
// ProductSaveService.
export const UPLOAD_FAILED = Symbol('upload-failed');

// Ventana «Dejar a vendedor» de la feature entregas (HU-11). Productos solo enlaza a su URL, porque
// una feature no importa a otra; los parámetros son `producto`, `vendedor` y `volver`.

// Destino de «Ver carrito» en la barra de «Productos» (HU-17).
export const ADMIN_CART_URL = '/admin/carrito';
