import type { DeliveryProductSummary } from '../../interfaces/delivery.models';

// Opción del Select: el producto más su nombre ya normalizado (sin mayúsculas ni acentos), que es
// el campo por el que filtra el Select.
export interface ProductOption extends DeliveryProductSummary {
  searchText: string;
}
