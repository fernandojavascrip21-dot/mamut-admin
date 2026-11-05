import { periodLabel, periodRange, shiftPeriod, todayInMexico } from './cash-cut-period.rules';

describe('todayInMexico', () => {
  it('23:59 en México (05:59 UTC del día siguiente) sigue siendo el mismo día', () => {
    expect(todayInMexico(new Date('2026-11-05T05:59:00Z'))).toBe('2026-11-04');
  });

  it('00:00 en México (06:00 UTC) ya es el día siguiente', () => {
    expect(todayInMexico(new Date('2026-11-05T06:00:00Z'))).toBe('2026-11-05');
  });

  it('18:42 en México es el mismo día en UTC-6', () => {
    expect(todayInMexico(new Date('2026-11-05T00:42:00Z'))).toBe('2026-11-04');
  });

  it('cruza de año con la hora de México', () => {
    expect(todayInMexico(new Date('2027-01-01T05:30:00Z'))).toBe('2026-12-31');
  });
});

describe('periodRange', () => {
  it('día: el propio día', () => {
    expect(periodRange('day', '2026-11-04')).toEqual({ from: '2026-11-04', to: '2026-11-04' });
  });

  it('semana: de lunes a domingo desde un miércoles', () => {
    expect(periodRange('week', '2026-11-04')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
  });

  it('semana: un domingo pertenece a la semana que termina en él', () => {
    expect(periodRange('week', '2026-11-08')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
  });

  it('semana: un lunes empieza la semana', () => {
    expect(periodRange('week', '2026-11-09')).toEqual({ from: '2026-11-09', to: '2026-11-15' });
  });

  it('semana que cruza de mes y de año', () => {
    expect(periodRange('week', '2025-12-31')).toEqual({ from: '2025-12-29', to: '2026-01-04' });
  });

  it('mes de 30 y 31 días', () => {
    expect(periodRange('month', '2026-11-15')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(periodRange('month', '2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('febrero de 28 días y bisiesto', () => {
    expect(periodRange('month', '2026-02-10').to).toBe('2026-02-28');
    expect(periodRange('month', '2028-02-10').to).toBe('2028-02-29');
  });
});

describe('shiftPeriod', () => {
  const today = '2026-11-04'; // miércoles

  it('offset 0 da la referencia del periodo actual', () => {
    expect(shiftPeriod('day', today, 0)).toBe('2026-11-04');
    expect(shiftPeriod('week', today, 0)).toBe('2026-11-02');
    expect(shiftPeriod('month', today, 0)).toBe('2026-11-01');
  });

  it('offset -1 retrocede un periodo', () => {
    expect(shiftPeriod('day', today, -1)).toBe('2026-11-03');
    expect(shiftPeriod('week', today, -1)).toBe('2026-10-26');
    expect(shiftPeriod('month', today, -1)).toBe('2026-10-01');
  });

  it('offset -12 retrocede doce periodos', () => {
    expect(shiftPeriod('day', today, -12)).toBe('2026-10-23');
    expect(shiftPeriod('week', today, -12)).toBe('2026-08-10');
    expect(shiftPeriod('month', today, -12)).toBe('2025-11-01');
  });

  it('un offset positivo se trata como el periodo actual', () => {
    expect(shiftPeriod('week', today, 2)).toBe('2026-11-02');
  });

  it('el mes anterior de enero es diciembre del año previo', () => {
    expect(shiftPeriod('month', '2026-01-15', -1)).toBe('2025-12-01');
  });
});

describe('periodLabel', () => {
  const today = '2026-11-04';

  it('día del año en curso', () => {
    expect(periodLabel('day', '2026-11-04', '2026-11-04', today)).toBe('mié 4 nov');
  });

  it('día de otro año lleva el año', () => {
    expect(periodLabel('day', '2025-12-31', '2025-12-31', today)).toBe('mié 31 dic 2025');
  });

  it('semana dentro de un mes', () => {
    expect(periodLabel('week', '2026-11-02', '2026-11-08', today)).toBe('2 al 8 nov');
  });

  it('semana que cruza de mes', () => {
    expect(periodLabel('week', '2026-10-26', '2026-11-01', today)).toBe('26 oct al 1 nov');
  });

  it('semana que cruza de año lleva ambos años', () => {
    expect(periodLabel('week', '2025-12-28', '2026-01-03', today)).toBe(
      '28 dic 2025 al 3 ene 2026',
    );
  });

  it('semana de otro año lleva el año al final', () => {
    expect(periodLabel('week', '2025-11-03', '2025-11-09', today)).toBe('3 al 9 nov 2025');
  });

  it('mes del año en curso y de otro año', () => {
    expect(periodLabel('month', '2026-11-01', '2026-11-30', today)).toBe('noviembre');
    expect(periodLabel('month', '2025-12-01', '2025-12-31', today)).toBe('diciembre 2025');
  });
});
