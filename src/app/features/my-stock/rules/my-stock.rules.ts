import { normalizeText } from '@shared/utils/normalize-text';
import { MY_STOCK_ALERT_TEXTS } from '../constants/my-stock-page.constants';
import type { MyStockAlert } from '../interfaces/my-stock.models';

// Subcadena del nombre sin distinguir mayúsculas ni acentos; una búsqueda vacía (o solo espacios)
// devuelve la lista tal cual. Solo filtra la lista: el total de piezas no cambia. Se reescribe aquí
// y no se importa de `features/stock`, porque una feature no importa otra.
export function filterMyStockByName<T extends { name: string }>(items: T[], query: string): T[] {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery === '') return items;
  return items.filter((item) => normalizeText(item.name).includes(normalizedQuery));
}

// Piezas que tiene el vendedor de un producto: «Cantidad N». Sin singular ni plural, y no se parece a
// `unitsLabel` («1 pieza»), que es para totales.
export function unitsLeftLabel(units: number): string {
  return `Cantidad ${units}`;
}

// Texto del aviso de baja existencia (HU-18): «Te quedan pocas piezas de: Creatina, Whey (agotado).
// Ya se le avisó al administrador.». Los agotados llevan «(agotado)»; sin avisos devuelve null y no
// se pinta nada. Respeta el orden del backend: agotados primero, luego por nombre.
export function lowStockNotice(alerts: MyStockAlert[]): string | null {
  if (alerts.length === 0) return null;
  const names = alerts
    .map((alert) => (alert.stockLevel === 'out' ? `${alert.name} ${MY_STOCK_ALERT_TEXTS.outSuffix}` : alert.name))
    .join(MY_STOCK_ALERT_TEXTS.separator);
  return `${MY_STOCK_ALERT_TEXTS.prefix} ${names}. ${MY_STOCK_ALERT_TEXTS.adminNotified}`;
}
