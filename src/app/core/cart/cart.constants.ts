// Llave de localStorage del carrito de cada usuario: `mamut.cart.<userId>`. Con una llave por usuario,
// otra cuenta en el mismo navegador nunca ve el carrito de quien salió.
export const CART_STORAGE_PREFIX = 'mamut.cart.';

// Versión del formato guardado (la 2 agrega el `requestId` de la venta en curso, HU-16). Si cambia,
// el carrito guardado con otra versión se descarta, salvo la anterior, que se sigue leyendo.
export const CART_STORAGE_VERSION = 2;

// La versión 1 (sin `requestId`) se lee como versión 2 sin llave y se reescribe en la siguiente
// modificación, para que actualizar la app no borre los carritos ya armados.
export const LEGACY_CART_STORAGE_VERSION = 1;

// Forma de un UUID; un `requestId` guardado que no la cumpla descarta el carrito entero.
export const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
