import type { NavMenuEntry, NavMenuItem } from './top-nav.models';

// Convierte el menú de cada shell (ruta, texto e icono) al formato de `p-menu`. Los shells no
// cambian sus constantes de entrada.
export function toNavMenuEntries(items: NavMenuItem[]): NavMenuEntry[] {
  return items.map((item) => ({
    label: item.label,
    routerLink: item.path,
    data: { icon: item.icon },
  }));
}
