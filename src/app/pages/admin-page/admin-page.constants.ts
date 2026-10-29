import type { CartLink, NavMenuItem } from '@shared/components/top-nav/top-nav.models';

// Menú superior y enlace al carrito de esta sección.
export const MENU: NavMenuItem[] = [
  { path: 'stock', label: 'Stock', icon: 'package' },
  { path: 'productos', label: 'Productos', icon: 'tag' },
  { path: 'corte', label: 'Corte', icon: 'receipt' },
  { path: 'vendedores', label: 'Vendedores', icon: 'users' },
];

export const CART: CartLink = { path: 'carrito', label: 'Carrito' };
