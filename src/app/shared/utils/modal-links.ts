import type { UrlSegmentGroup, UrlTree } from '@angular/router';
import {
  MODAL_DELIVERY_PATH,
  MODAL_EDIT_HOLDING_PATH,
  MODAL_FRACTION_PATH,
  MODAL_OUTLET,
  MODAL_PURCHASE_PATH,
  MODAL_RETURN_PATH,
  MODAL_SHRINKAGE_PATH,
} from '../constants/modal.constants';

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

export function editHoldingModalLink(sellerId: string, productId: number): unknown[] {
  return ['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_EDIT_HOLDING_PATH, sellerId, productId] } }];
}

// Igual que «dejar»: el producto va como parámetro matricial y la ruta primaria se conserva.
export function fractionModalLink(params: { productId?: number } = {}): unknown[] {
  const matrix: Record<string, number> = {};
  if (params.productId !== undefined) matrix['producto'] = params.productId;
  return ['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_FRACTION_PATH, matrix] } }];
}

// El titular va como parámetro matricial `vendedor`; sin él, el pop-up es de la bodega.
export function shrinkageModalLink(params: { sellerId?: string } = {}): unknown[] {
  const matrix: Record<string, string> = {};
  if (params.sellerId) matrix['vendedor'] = params.sellerId;
  return ['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_SHRINKAGE_PATH, matrix] } }];
}

// «Entrada a bodega» (HU-27): siempre de la bodega, sin parámetros.
export function purchaseModalLink(): unknown[] {
  return ['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_PURCHASE_PATH] } }];
}

// «Lista de resurtir» (HU-31): siempre de la bodega, sin parámetros.
export function restockModalLink(): unknown[] {
  return ['/admin'];
}

export function closeModalLink(): unknown[] {
  return ['/admin', { outlets: { [MODAL_OUTLET]: null } }];
}

// Cierra la ventana y lleva a otra página de /admin en la misma navegación. El outlet `ventana`
// cuelga del grupo /admin, así que la ruta primaria y el cierre van juntos en ese grupo: con
// `['/admin/x/y', { outlets: … }]` el cierre caería bajo `y` y la ventana seguiría abierta.
export function leaveModalLink(primary: string[]): unknown[] {
  return ['/admin', { outlets: { primary, [MODAL_OUTLET]: null } }];
}

// Nombre de la ventana abierta en el outlet `ventana` (`dejar`, `retirar`, `editar`) o null si no hay ninguna.
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
