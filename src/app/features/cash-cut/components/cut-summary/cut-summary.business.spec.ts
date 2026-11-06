import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CashCut, CutScope } from '../../interfaces/cash-cut.models';
import { CutSummaryComponent } from './cut-summary.component';

// Totales del negocio (HU-22): bodega $500 + Luis $1,840 = $2,340, ganancia real $827.50, 12 piezas.
const TOTALS: CashCut['totals'] = {
  salesCount: 4,
  units: 12,
  total: '2340.00',
  factoryCost: '1512.50',
  realProfit: '827.50',
  shippingCover: '200.00',
};

describe('CutSummaryComponent · resumen del negocio', () => {
  let fixture: ComponentFixture<CutSummaryComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const allText = () => el().textContent?.replace(/\s+/g, ' ') ?? '';

  function render(holderName: string | null, scope?: CutScope) {
    fixture = TestBed.createComponent(CutSummaryComponent);
    fixture.componentRef.setInput('totals', TOTALS);
    fixture.componentRef.setInput('holderName', holderName);
    fixture.componentRef.setInput('periodText', '2 al 8 nov');
    fixture.componentRef.setInput('cutType', 'home');
    fixture.componentRef.setInput('layout', 'overview');
    if (scope) fixture.componentRef.setInput('scope', scope);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutSummaryComponent] }));

  it('con alcance de todo el negocio la leyenda dice «Todo el negocio · 2 al 8 nov · 12 piezas»', () => {
    render(null, 'business');
    expect(text('.sold-caption')).toBe('Todo el negocio · 2 al 8 nov · 12 piezas');
    expect(allText()).not.toContain('Mis ventas desde bodega');
  });

  it('con alcance de todo el negocio muestra solo Vendido y Ganancia (la real)', () => {
    render(null, 'business');
    expect(text('.sold')).toBe('$2,340.00');
    expect(text('.profit-label')).toBe('Ganancia');
    expect(text('.profit')).toBe('$827.50');
  });

  it('con alcance de todo el negocio no muestra costos ni «Para cubrir envíos»', () => {
    render(null, 'business');
    expect(el().querySelector('.sold')).not.toBeNull();
    for (const selector of ['.cost', '.factory-cost', '.real-profit', '.shipping-cover']) {
      expect(el().querySelector(selector)).toBeNull();
    }
    for (const label of ['Costo con envío', 'Costo de fábrica', 'Para cubrir envíos']) {
      expect(allText()).not.toContain(label);
    }
    expect(allText()).not.toContain('$1,512.50');
  });

  it('sin alcance, con la bodega, sigue diciendo «Mis ventas desde bodega»', () => {
    render(null);
    expect(text('.sold-caption')).toBe('Mis ventas desde bodega · 2 al 8 nov · 12 piezas');
  });

  it('con alcance de un titular y la bodega sigue diciendo «Mis ventas desde bodega»', () => {
    render(null, 'holder');
    expect(text('.sold-caption')).toBe('Mis ventas desde bodega · 2 al 8 nov · 12 piezas');
  });

  it('con alcance de un titular y un vendedor sigue diciendo «Vendió Luis»', () => {
    render('Luis', 'holder');
    expect(text('.sold-caption')).toBe('Vendió Luis · 2 al 8 nov · 12 piezas');
  });
});
