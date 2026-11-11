// Vista de un pedido cerrado en la lista de pedidos anteriores.
export interface RestockHistoryItemView {
  id: number;
  closedLabel: string;
  countsLabel: string;
  estimatedTotal: string;
  note: string | null;
}
