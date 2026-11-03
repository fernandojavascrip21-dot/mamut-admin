import type { MenuItem } from 'primeng/api';

export type NavIcon = 'package' | 'tag' | 'bag' | 'receipt' | 'users' | 'cart' | 'panel-close' | 'panel-open';

export interface NavMenuItem {
  path: string;
  label: string;
  icon: NavIcon;
}

// El carrito vive en la cabecera, separado del menú (su ícono es fijo, no se elige por item).
export interface CartLink {
  path: string;
  label: string;
}

// Entrada del `p-menu` de PrimeNG: el SVG propio va en `data` porque `icon` espera una clase CSS
// de una librería de iconos (que el proyecto no usa).
export interface NavMenuEntry extends MenuItem {
  routerLink: string;
  label: string;
  data: { icon: NavIcon };
}
