import type { ViewingSeller } from './interfaces/viewing.models';

// Etiqueta de un vendedor en la barra «Viendo»: «Nombre · Negocio», o solo el nombre sin negocio.
// Sin negocio (null) solo se muestra el nombre: una línea vacía no aporta en la barra.
export function viewingSellerLabel(seller: ViewingSeller): string {
  return seller.businessName ? `${seller.fullName} · ${seller.businessName}` : seller.fullName;
}
