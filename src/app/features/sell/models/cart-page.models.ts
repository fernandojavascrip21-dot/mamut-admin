import type { CART_PAGE_TEXTS } from '../constants/cart-page.constants';
import type { SellProduct } from '../interfaces/sell-stock.models';

// Cómo está un renglón del carrito frente al stock de ahora: 'ok' si alcanza, 'over' si pide más
// piezas de las que le quedan y 'soldOut' si ya no le queda ninguna (o el producto ya no viene).
export type CartRowStatus = 'ok' | 'over' | 'soldOut';

// Un renglón del carrito ya resuelto: `units` son las piezas del carrito, `available` las que le
// quedan hoy, y `subtotal` es piezas × precio como texto con 2 decimales.
export interface CartRow {
  product: SellProduct;
  units: number;
  available: number;
  subtotal: string;
  status: CartRowStatus;
}

// Estado de la pantalla «Carrito». «vacío» es un carrito sin renglones: no necesita el stock, así que
// se muestra sin pedirlo; con renglones, el estado sigue a la carga del stock.
export type CartPageState = 'empty' | 'loading' | 'error' | 'ready';

// Por qué no se pudo confirmar la venta, para elegir la alerta de «Carrito»: sin conexión (con
// «Reintentar»), piezas que ya no alcanzan, o un dato que el backend rechazó (con su mensaje).
export type CartConfirmError = 'offline' | 'not-enough-units' | 'invalid';

// Textos que recibe `cart-view`: los de «Carrito» con la misma forma para los dos roles; cada página
// pasa los suyos (el administrador cambia los de cargando, vacío y error).
export type CartPageTexts = { [K in keyof typeof CART_PAGE_TEXTS]: string };
