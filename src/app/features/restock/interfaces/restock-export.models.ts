// Lo que se escribe en el archivo: nunca lleva costos.
export interface RestockExportRow {
  name: string;
  qty: number;
}

export interface RestockExportDocument {
  title: string;
  dateLabel: string;
  note: string | null;
  rows: RestockExportRow[];
  totalLabel: string;
  fileName: string;
}
