import type { ConfirmOptions } from '@core/confirm/confirm.models';
import { CLEAR_CART_CONFIRM_TEXTS } from './cart.constants';

// Opciones de la pregunta «¿Vaciar el carrito?» (HU-17): la comparten admin-shell (cambiar de
// «Viendo») y «Productos» (agregar con otro titular), para que ambas digan lo mismo.
export function clearCartConfirmOptions(cartHolder: string, nextHolder: string): ConfirmOptions {
  return {
    ...CLEAR_CART_CONFIRM_TEXTS,
    message: `Tu carrito es de ${cartHolder}. Si cambias a ${nextHolder}, se vacía.`,
    tone: 'default',
  };
}
