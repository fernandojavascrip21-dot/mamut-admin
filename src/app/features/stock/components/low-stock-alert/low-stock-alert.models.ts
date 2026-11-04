import type { StockLevel } from '@shared/constants/stock-level.constants';

// Un renglón de la tarjeta de avisos: producto, de quién es y cuántas piezas quedan.
export interface LowStockAlertItem {
  key: string;
  name: string;
  holder: string;
  units: number;
  stockLevel: StockLevel;
}
