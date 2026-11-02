import type { UrlSegmentGroup, UrlTree } from '@angular/router';
import { MODAL_DELIVERY_PATH, MODAL_OUTLET, MODAL_RETURN_PATH } from '../constants/modal.constants';

// Solo modifica el outlet de admin: conserva la ruta primaria y encapsula sus parámetros.
export function deliveryModalLink(params: { sellerId?: string; productId?: number } = {}): unknown[] {
  const matrix: Record<string, string | number> = {};
  if (params.sellerId) matrix['vendedor'] = params.sellerId;
  if (params.productId !== undefined) matrix['producto'] = params.productId;
  return ['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_DELIVERY_PATH, matrix] } }];
}

export function returnModalLink(sellerId: string): unknown[] {
  return ['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_RETURN_PATH, sellerId] } }];
}

export function closeModalLink(): unknown[] {
  return ['/admin', { outlets: { [MODAL_OUTLET]: null } }];
}

// Nombre de la ventana abierta en el outlet `ventana` (`dejar`, `retirar`) o null si no hay ninguna.
// El outlet cuelga del grupo `/admin`, no de la raíz, así que se busca bajando por los grupos.
export function openModalPath(tree: UrlTree): string | null {
  const find = (group: UrlSegmentGroup): string | null => {
    const modal = group.children[MODAL_OUTLET]?.segments[0]?.path;
    if (modal) return modal;
    for (const child of Object.values(group.children)) {
      const found = find(child);
      if (found) return found;
    }
    return null;
  };
  return find(tree.root);
}
