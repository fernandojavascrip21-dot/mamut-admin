// Zona horaria en la que el backend cuenta los periodos del corte (T-20); el frontend la usa para
// calcular «hoy» sin depender de la hora del dispositivo.
export const CUT_TIME_ZONE = 'America/Mexico_City';

// Nombres en español para el texto del periodo («mié 4 nov», «noviembre»). Se indexan con
// `getUTCDay()` (0 = domingo) y `getUTCMonth()` (0 = enero).
export const WEEKDAY_SHORT_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

export const MONTH_SHORT_NAMES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const;

export const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;
