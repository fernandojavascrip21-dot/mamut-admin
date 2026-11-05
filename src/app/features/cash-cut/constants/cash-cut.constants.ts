import type { CardPassThrough } from 'primeng/types/card';

// Zona horaria en la que el backend cuenta los periodos del corte (T-20); el frontend la usa para
// calcular «hoy» sin depender de la hora del dispositivo.
export const CUT_TIME_ZONE = 'America/Mexico_City';

// Nombres en español para el texto del periodo («mié 4 nov», «noviembre»). Se indexan con
// `getUTCDay()` (0 = domingo) y `getUTCMonth()` (0 = enero).
export const WEEKDAY_SHORT_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'] as const;

export const MONTH_SHORT_NAMES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
] as const;

export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

// El marco de las tarjetas del corte es `p-card`; la distribución va dentro, sin relleno propio de PrimeNG.
export const CUT_CARD_PASS_THROUGH = {
  body: { class: 'p-0' },
  content: { class: 'p-0' },
} satisfies CardPassThrough;
