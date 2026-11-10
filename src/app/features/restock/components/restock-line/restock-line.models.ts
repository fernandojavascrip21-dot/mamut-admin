import type { RestockStockLevel } from '../../interfaces/restock.models';

// Vista de un renglón: lo que se pinta además de los campos del formulario.
export interface RestockLineView {
  kind: 'catalog' | 'custom';
  productId: number | null;
  name: string;
  image: string | null;
  units: number | null;
  stockLevel: RestockStockLevel | null;
  orderable: boolean;
}
