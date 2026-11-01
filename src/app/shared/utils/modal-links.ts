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
