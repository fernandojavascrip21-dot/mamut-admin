// Lo que pinta una fila del historial de mermas (HU-26); es un subconjunto de ShrinkageHistoryItem.
export interface ShrinkageHistoryLineItem {
  createdAt: string;
  qty: number;
  reasonLabel: string | null;
  holder: { id: string; fullName: string } | null; // null = bodega
  product: { id: number; name: string; image: string | null };
}
