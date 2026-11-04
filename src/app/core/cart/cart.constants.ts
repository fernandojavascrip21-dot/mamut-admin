// Llave de localStorage del carrito de cada usuario: `mamut.cart.<userId>`. Con una llave por usuario,
// otra cuenta en el mismo navegador nunca ve el carrito de quien salió.
export const CART_STORAGE_PREFIX = 'mamut.cart.';

// Versión del formato guardado. Si cambia, el carrito guardado con otra versión se descarta.
export const CART_STORAGE_VERSION = 1;
