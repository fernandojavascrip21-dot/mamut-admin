import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CashCut } from '../../interfaces/cash-cut.models';
import { CutSummaryComponent } from './cut-summary.component';

describe('CutSummaryComponent · corte para casa', () => {
  let fixture: ComponentFixture<CutSummaryComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const allText = () => el().textContent?.replace(/\s+/g, ' ') ?? '';

  // 2 piezas a $920, costo con envío $700 y de fábrica $600 (criterio 3).
  const TOTALS: CashCut['totals'] = {
    salesCount: 1,
    units: 2,
    total: '1840.00',
    cost: '1400.0000',
    profit: '440.00',
    factoryCost: '1200.0000',
    realProfit: '640.00',
    shippingCover: '200.00',
  };

  function render(totals: CashCut['totals'], holderName: string | null, home = true) {
    fixture = TestBed.createComponent(CutSummaryComponent);
    fixture.componentRef.setInput('totals', totals);
    fixture.componentRef.setInput('holderName', holderName);
    fixture.componentRef.setInput('periodText', '2 al 8 nov');
    if (home) fixture.componentRef.setInput('cutType', 'home');
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutSummaryComponent] }));

  it('con un vendedor muestra las cuatro cifras del backend con sus etiquetas', () => {
    render(TOTALS, 'Luis');
    expect(text('.sold')).toBe('$1,840.00');
    expect(text('.sold-caption')).toBe('Vendió Luis · 2 al 8 nov · 2 piezas');
    expect(text('.factory-cost-label')).toBe('Costo de fábrica');
    expect(text('.factory-cost')).toBe('$1,200.00');
    expect(text('.real-profit-label')).toBe('Ganancia real');
    expect(text('.real-profit')).toBe('$640.00');
    expect(text('.shipping-cover-label')).toBe('Para cubrir envíos');
    expect(text('.shipping-cover')).toBe('$200.00');
  });

  it('no muestra «costo con envío» ni las cifras del corte con precios', () => {
    render(TOTALS, 'Luis');
    expect(allText()).not.toContain('Costo con envío');
    expect(el().querySelector('.cost')).toBeNull();
    expect(el().querySelector('.profit')).toBeNull();
    expect(allText()).not.toContain('$1,400.00');
    expect(allText()).not.toContain('$440.00');
  });

  it('con la bodega oculta «Para cubrir envíos» y conserva las otras tres cifras', () => {
    render({ ...TOTALS, shippingCover: '0.00' }, null);
    expect(text('.sold-caption')).toBe('Mis ventas desde bodega · 2 al 8 nov · 2 piezas');
    expect(text('.factory-cost')).toBe('$1,200.00');
    expect(text('.real-profit')).toBe('$640.00');
    expect(el().querySelector('.shipping-cover')).toBeNull();
    expect(allText()).not.toContain('Para cubrir envíos');
  });

  it('una ganancia real negativa se muestra con signo menos', () => {
    render({ ...TOTALS, realProfit: '-40.00' }, 'Luis');
    expect(text('.real-profit')).toBe('-$40.00');
    expect(el().querySelector('.real-profit')?.classList.contains('text-danger-border')).toBe(true);
  });

  it('un «para cubrir envíos» negativo se muestra con signo menos', () => {
    render({ ...TOTALS, shippingCover: '-15.00' }, 'Luis');
    expect(text('.shipping-cover')).toBe('-$15.00');
  });

  it('sin cutType (corte con precios) ignora las llaves del corte para casa', () => {
    render(TOTALS, 'Luis', false);
    expect(text('.cost')).toBe('$1,400.00');
    expect(text('.profit')).toBe('$440.00');
    expect(el().querySelector('.factory-cost')).toBeNull();
    expect(el().querySelector('.real-profit')).toBeNull();
    expect(el().querySelector('.shipping-cover')).toBeNull();
  });
});
