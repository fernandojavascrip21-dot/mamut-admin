import type { CartLink, NavMenuItem } from '../top-nav/top-nav.models';

// Menú superior y enlace al carrito de esta sección.
export const MENU: NavMenuItem[] = [
  { path: 'mi-stock', label: 'Mi stock', icon: 'package' },
  { path: 'vender', label: 'Vender', icon: 'bag' },
  { path: 'mi-corte', label: 'Mi corte', icon: 'receipt' },
];

export const CART: CartLink = { path: 'carrito', label: 'Carrito' };
