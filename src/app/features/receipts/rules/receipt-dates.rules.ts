import { RECEIPT_TIME_ZONE } from '../constants/receipts.constants';

// Fecha corta «9 nov 2026» en la hora de la bodega. Intl con zona IANA: DatePipe solo entiende desfases.
export function formatReceiptDate(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: RECEIPT_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}
