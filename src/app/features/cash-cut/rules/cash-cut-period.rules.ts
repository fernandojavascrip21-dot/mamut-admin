import {
  CUT_TIME_ZONE,
  MONTH_NAMES,
  MONTH_SHORT_NAMES,
  WEEKDAY_SHORT_NAMES,
} from '../constants/cash-cut.constants';
import type { CutPeriodKind } from '../interfaces/cash-cut.models';

// Regla de periodo del corte en el frontend. Solo sirve para el texto y la fecha de referencia que se
// manda (`date`); el periodo real lo calcula el backend (T-20) y, al generar, manda el suyo.
// Las fechas son texto 'YYYY-MM-DD' (calendario sin horas), así que no hay zonas horarias ni
// horario de verano de por medio: se opera en UTC solo como aritmética de calendario.

const DAY_MS = 24 * 60 * 60 * 1000;

// Texto 'YYYY-MM-DD' → instante UTC de ese día a medianoche.
function parseDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return formatDate(new Date(parseDate(date).getTime() + days * DAY_MS));
}

// Lunes de la semana (lunes a domingo) que contiene la fecha.
function mondayOf(date: string): string {
  const weekday = parseDate(date).getUTCDay(); // 0 = domingo
  return addDays(date, -((weekday + 6) % 7));
}

// «Hoy» en México: el día de calendario allá, no el del dispositivo. Cerca de la medianoche, UTC y
// México pueden estar en días distintos.
export function todayInMexico(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CUT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

// Primer y último día del periodo que contiene la fecha de referencia (ambos incluidos).
export function periodRange(kind: CutPeriodKind, reference: string): { from: string; to: string } {
  if (kind === 'day') return { from: reference, to: reference };
  if (kind === 'week') {
    const monday = mondayOf(reference);
    return { from: monday, to: addDays(monday, 6) };
  }
  const [year, month] = reference.split('-').map(Number);
  return {
    from: formatDate(new Date(Date.UTC(year, month - 1, 1))),
    to: formatDate(new Date(Date.UTC(year, month, 0))), // día 0 del mes siguiente = último de este
  };
}

// Fecha de referencia del periodo desplazado `offset` periodos desde hoy (0 = actual, -1 = anterior).
// Día: el propio día; semana: su lunes; mes: su día 1. Un offset positivo no existe (no se cortan
// periodos futuros), por eso se trata como 0.
export function shiftPeriod(kind: CutPeriodKind, today: string, offset: number): string {
  const back = Math.min(offset, 0);
  if (kind === 'day') return addDays(today, back);
  if (kind === 'week') return addDays(mondayOf(today), back * 7);
  const [year, month] = today.split('-').map(Number);
  return formatDate(new Date(Date.UTC(year, month - 1 + back, 1)));
}

// Texto del periodo: «mié 4 nov», «2 al 8 nov», «26 oct al 1 nov» o «noviembre». Agrega el año
// cuando el periodo no es del año en curso (o cuando cruza de un año a otro).
export function periodLabel(kind: CutPeriodKind, from: string, to: string, today: string): string {
  const start = parseDate(from);
  const end = parseDate(to);
  const currentYear = Number(today.slice(0, 4));
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (kind === 'month') {
    const name = MONTH_NAMES[start.getUTCMonth()];
    return startYear === currentYear ? name : `${name} ${startYear}`;
  }

  const shortDate = (date: Date) => `${date.getUTCDate()} ${MONTH_SHORT_NAMES[date.getUTCMonth()]}`;

  if (kind === 'day') {
    const text = `${WEEKDAY_SHORT_NAMES[start.getUTCDay()]} ${shortDate(start)}`;
    return startYear === currentYear ? text : `${text} ${startYear}`;
  }

  // Semana: mismo mes → «2 al 8 nov»; cruza de mes → «26 oct al 1 nov»; cruza de año → con ambos años.
  if (startYear !== endYear)
    return `${shortDate(start)} ${startYear} al ${shortDate(end)} ${endYear}`;
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const text = sameMonth
    ? `${start.getUTCDate()} al ${shortDate(end)}`
    : `${shortDate(start)} al ${shortDate(end)}`;
  return startYear === currentYear ? text : `${text} ${startYear}`;
}
