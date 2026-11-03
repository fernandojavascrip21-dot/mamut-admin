export const BRAND_NAME = 'Mammut Supplements';
export const ACCOUNT_LABEL = 'Mi cuenta';

// El administrador usa el óxido de la marca; el vendedor, el dorado secundario. Las clases van
// completas (no interpoladas) para que el escaneo estático de Tailwind v4 las conserve.
export const AVATAR_BG_BY_ROLE = {
  admin: 'bg-accent',
  vendedor: 'bg-accent-2',
} as const;

// Etiqueta bajo el nombre de la marca: dice desde qué perfil se está navegando.
export const ROLE_LABEL_BY_ROLE = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
} as const;

// Clases del `p-menu`: celdas con divisores en celular y lista vertical en la barra lateral. Van
// escritas completas (no interpoladas) para que el escaneo estático de Tailwind v4 las conserve.
export const MENU_ROOT_CLASS = 'w-full min-w-0 border-0 bg-transparent p-0';
export const MENU_LIST_BASE_CLASS =
  'm-0 grid list-none divide-x divide-page/10 p-0 outline-none lg:flex lg:flex-col lg:gap-1 lg:divide-x-0';
export const MENU_ITEM_CLASS = 'min-w-0';
export const MENU_GRID_CLASS_BY_COLUMNS = { 4: 'grid-cols-4', 3: 'grid-cols-3' } as const;

// Tope del número en el globo del carrito: con más piezas se ve «99+» para que no desborde el botón.
export const CART_BADGE_MAX = 99;
