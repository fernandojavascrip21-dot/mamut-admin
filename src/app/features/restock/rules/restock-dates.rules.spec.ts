import { formatRestockDate, restockDateStamp } from './restock-dates.rules';

describe('Fechas del pedido de resurtir (America/Mexico_City)', () => {
  it('formatRestockDate escribe «11 nov 2026»', () => {
    expect(formatRestockDate('2026-11-11T18:00:00Z')).toBe('11 nov 2026');
  });

  it('un cierre a las 23:30 del 11 en México sigue siendo el 11 aunque en UTC ya sea 12', () => {
    expect(formatRestockDate('2026-11-12T05:30:00Z')).toBe('11 nov 2026');
    expect(restockDateStamp('2026-11-12T05:30:00Z')).toBe('2026-11-11');
  });

  it('restockDateStamp devuelve AAAA-MM-DD con ceros a la izquierda', () => {
    expect(restockDateStamp('2026-01-05T18:00:00Z')).toBe('2026-01-05');
  });
});
