// Zona en la que se muestra la fecha: el backend guarda UTC y el negocio opera en Ciudad de México.
export const FRACTION_HISTORY_TIME_ZONE = 'America/Mexico_City';
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
