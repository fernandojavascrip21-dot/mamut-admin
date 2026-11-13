// Una entrada registrada en el resultado: lo que sumó y la bodega antes y después (null si no hay dato).
export interface ReceiptResultEntry {
  id: number;
  name: string;
  qty: number;
  before: number | null;
  after: number | null;
}
