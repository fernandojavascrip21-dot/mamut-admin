// Llave de localStorage del carrito de cada usuario: `mamut.cart.<userId>`. Con una llave por usuario,
// otra cuenta en el mismo navegador nunca ve el carrito de quien salió.
export const CART_STORAGE_PREFIX = 'mamut.cart.';

// Versión del formato guardado (la 2 agrega el `requestId` de la venta en curso, HU-16; la 3 agrega el
// `holderId`, el titular del stock del que vende el administrador, HU-17). Si cambia, el carrito
// guardado con otra versión se descarta, salvo las anteriores, que se siguen leyendo.
export const CART_STORAGE_VERSION = 3;

// Las versiones 1 (sin `requestId`) y 2 (sin `holderId`) se leen como versión 3 con titular bodega
// y se reescriben en la siguiente modificación, para que actualizar la app no borre los carritos ya armados.
export const LEGACY_CART_STORAGE_VERSIONS = [1, 2];

// Forma de un UUID; un `requestId` guardado que no la cumpla descarta el carrito entero.
export const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
