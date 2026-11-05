import { describe, expect, it } from 'vitest'
import { resolveCutPeriod } from '@cuts'

// México no tiene horario de verano: UTC-6 todo el año (spec T-20 §8).
describe('Corte: periodo (T-20)', () => {
  it('día: de 00:00 local a 00:00 del día siguiente', async () => {
    const period = await resolveCutPeriod('day', '2026-11-04')
    expect(period).toMatchObject({
      kind: 'day',
      from: '2026-11-04',
      to: '2026-11-04',
      timeZone: 'America/Mexico_City',
      startsAt: '2026-11-04T06:00:00.000Z',
      endsAt: '2026-11-05T06:00:00.000Z',
    })
  })

  it('semana: de lunes a domingo, con un domingo y un lunes como referencia', async () => {
    const sunday = await resolveCutPeriod('week', '2026-11-08')
    const monday = await resolveCutPeriod('week', '2026-11-09')
    expect([sunday.from, sunday.to]).toEqual(['2026-11-02', '2026-11-08'])
    expect(sunday.endsAt).toBe('2026-11-09T06:00:00.000Z')
    expect([monday.from, monday.to]).toEqual(['2026-11-09', '2026-11-15'])
  })

  it('mes: del 1 al último día, también en febrero y diciembre', async () => {
    const november = await resolveCutPeriod('month', '2026-11-15')
    const february = await resolveCutPeriod('month', '2028-02-10')
    const december = await resolveCutPeriod('month', '2026-12-31')
    expect([november.from, november.to]).toEqual(['2026-11-01', '2026-11-30'])
    expect([february.from, february.to]).toEqual(['2028-02-01', '2028-02-29'])
    expect([december.from, december.to]).toEqual(['2026-12-01', '2026-12-31'])
    expect(december.endsAt).toBe('2027-01-01T06:00:00.000Z')
  })

  it('sin date usa hoy en México: el periodo del día contiene el instante actual', async () => {
    const period = await resolveCutPeriod('day', undefined)
    const now = Date.now()
    expect(Date.parse(period.startsAt)).toBeLessThanOrEqual(now)
    expect(Date.parse(period.endsAt)).toBeGreaterThan(now)
  })

  it('rechaza un periodo o una fecha inválidos con 422', async () => {
    await expect(resolveCutPeriod('year', '2026-11-04')).rejects.toMatchObject({ status: 422 })
    for (const date of ['2026-13-01', '2026-02-30', '04/11/2026', '2026-1-4', '']) {
      await expect(resolveCutPeriod('day', date)).rejects.toMatchObject({ status: 422 })
    }
  })
})
