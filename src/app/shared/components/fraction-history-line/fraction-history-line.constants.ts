// Zona en la que se muestra la fecha: el backend guarda UTC y el negocio opera en Ciudad de México.
// DatePipe solo entiende desfases ('-0600'), no nombres IANA: con 'America/Mexico_City' usaba en
// silencio la zona del equipo. México no tiene horario de verano desde 2022, así que el desfase es fijo.
export const FRACTION_HISTORY_TIME_ZONE = '-0600';
export const FRACTION_HISTORY_DATE_FORMAT = 'dd/MM/yyyy HH:mm';

// Moneda de los montos: el pipe currency toma el texto del backend y lo muestra en centavos.
export const FRACTION_HISTORY_CURRENCY = 'MXN';
export const FRACTION_HISTORY_CURRENCY_DISPLAY = 'symbol-narrow';

export const FRACTION_HISTORY_LINE_TEXTS = {
  entire: 'entero',
  portionsWord: 'bolsitas',
  unitCostLabel: 'Costo por bolsita',
  priceLabel: 'Precio',
  by: 'Por',
} as const;
