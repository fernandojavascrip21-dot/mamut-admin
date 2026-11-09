// Lo que recibe una fila del historial de fraccionados (HU-24); misma forma que FractionHistoryItem.
export interface FractionHistoryLineItem {
  id: number;
  requestId: string;
  createdAt: string;
  portions: number;
  wholeUnitCost: string;
  portionUnitCost: string;
  portionPrice: string;
  product: { id: number; name: string };
  portionProduct: { id: number; name: string };
  createdBy: { id: string; name: string };
}
