import type { ConfirmOptions } from '@core/confirm/confirm.models';
import type { CartLink, NavMenuItem } from '../top-nav/top-nav.models';

// Menú superior y enlace al carrito de esta sección.
export const MENU: NavMenuItem[] = [
  { path: 'stock', label: 'Stock', icon: 'package' },
  { path: 'productos', label: 'Productos', icon: 'tag' },
  { path: 'corte', label: 'Corte', icon: 'receipt' },
  { path: 'vendedores', label: 'Vendedores', icon: 'users' },
];

export const CART: CartLink = { path: 'carrito', label: 'Carrito' };

// Nombre del titular «bodega» en el aviso de vaciar el carrito (HU-17); un vendedor usa su nombre.
export const WAREHOUSE_HOLDER_NAME = 'la bodega';

// Textos fijos de la pregunta al cambiar de «Viendo» con un carrito de otro titular. El mensaje con
// los nombres lo arma el shell.
export const CLEAR_CART_CONFIRM = {
  title: '¿Vaciar el carrito?',
  confirmLabel: 'Vaciar y cambiar',
  cancelLabel: 'Cancelar',
  tone: 'default',
} satisfies Omit<ConfirmOptions, 'message'>;
