// Renglón listo para pintar en la tabla de solo lectura: catálogo y escritos a mano en una sola lista.
export interface RestockOrderDetailRow {
  key: string;
  name: string;
  image: string | null;
  qty: number;
  // Costo guardado en el renglón; null en un escrito a mano sin costo.
  unitCost: string | null;
  handwritten: boolean;
}
