// Iconos de los movimientos rápidos de «Stock general» (HU-13).
export type StockQuickActionIcon = 'entry' | 'deliver' | 'return' | 'new';

// Un movimiento rápido: el enlace ya viene armado desde la página (ruta o ventana `ventana`).
export interface StockQuickAction {
  label: string;
  link: string | readonly unknown[];
  icon: StockQuickActionIcon;
}
