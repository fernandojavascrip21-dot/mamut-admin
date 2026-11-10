// Iconos de los movimientos rápidos de «Stock general» (HU-13; `shrinkage` desde M6-hu25; `restock`
// desde M9-hu31, la lista de resurtir).
export type StockQuickActionIcon = 'entry' | 'deliver' | 'return' | 'sell' | 'new' | 'fraction' | 'shrinkage' | 'restock';

// Un movimiento rápido: el enlace ya viene armado desde la página (ruta o ventana `ventana`).
export interface StockQuickAction {
  label: string;
  link: string | readonly unknown[];
  icon: StockQuickActionIcon;
}
