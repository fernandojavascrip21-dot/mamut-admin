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
