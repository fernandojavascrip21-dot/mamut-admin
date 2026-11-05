import { CUT_TIME_ZONE, MONTH_SHORT_NAMES } from '../constants/cash-cut.constants';

// Hora de una venta del corte en México («18:42»), o con fecha («4 nov · 18:42»). Se muestra en la zona
// del corte y no en la del dispositivo para que coincida con el periodo que agrupó la venta.
export function saleTimeLabel(soldAt: string, withDate: boolean): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CUT_TIME_ZONE,
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(soldAt));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const time = `${part('hour')}:${part('minute')}`;
  if (!withDate) return time;
  return `${part('day')} ${MONTH_SHORT_NAMES[Number(part('month')) - 1]} · ${time}`;
}
