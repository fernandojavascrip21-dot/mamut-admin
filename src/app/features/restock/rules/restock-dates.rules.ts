import { RESTOCK_TIME_ZONE } from '../constants/restock.constants';

// Fecha corta «11 nov 2026» en la hora de la bodega (America/Mexico_City).
export function formatRestockDate(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: RESTOCK_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

// Fecha «AAAA-MM-DD» en la hora de la bodega, para el nombre del archivo.
// El locale en-CA es el que Intl escribe en ese orden sin partir la fecha a mano.
export function restockDateStamp(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTOCK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

// Un cerrado trae closedAt; si el backend no lo trae se usa el último guardado para no romper la fecha.
export function closedOrSavedAt(order: { closedAt: string | null; updatedAt: string }): string {
  return order.closedAt ?? order.updatedAt;
}
