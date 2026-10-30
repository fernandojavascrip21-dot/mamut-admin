export type NavIcon = 'package' | 'tag' | 'bag' | 'receipt' | 'users';

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
