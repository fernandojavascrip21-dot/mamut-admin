import { clockTime, saleTimeLabel } from './cut-sale-time.rules';

describe('saleTimeLabel', () => {
  it('muestra la hora de México en 24 horas', () => {
    expect(saleTimeLabel('2026-11-04T18:42:00Z', false)).toBe('12:42');
  });

  it('con fecha agrega día y mes', () => {
    expect(saleTimeLabel('2026-11-04T18:42:00Z', true)).toBe('4 nov · 12:42');
  });

  it('usa el día de México aunque en UTC ya sea el siguiente', () => {
    expect(saleTimeLabel('2026-11-05T05:30:00Z', true)).toBe('4 nov · 23:30');
  });

  it('medianoche se muestra como 00:00', () => {
    expect(saleTimeLabel('2026-11-05T06:05:00Z', false)).toBe('00:05');
  });
});

describe('clockTime', () => {
  it('da la hora del dispositivo con dos dígitos', () => {
    expect(clockTime(new Date(2026, 10, 4, 18, 42))).toBe('18:42');
    expect(clockTime(new Date(2026, 10, 4, 7, 5))).toBe('07:05');
  });
});
