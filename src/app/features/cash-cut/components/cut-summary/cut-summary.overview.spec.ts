import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CashCut, CutTypeValue } from '../../interfaces/cash-cut.models';
import { CutSummaryComponent } from './cut-summary.component';

// 2 piezas a $920, costo con envío $700 y de fábrica $600 (criterio 3 de HU-21). Trae las llaves de
// los dos tipos de corte para comprobar que cada tipo lee la suya.
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

// Anfitrión de prueba: proyecta un pie dentro del resumen, como hará la página del administrador.
@Component({
  imports: [CutSummaryComponent],
  template: `
    <app-cut-summary
      [totals]="totals"
      holderName="Luis"
      periodText="2 al 8 nov"
      cutType="home"
      layout="overview"
    >
      <p class="projected-footer">Generado hoy a las 12:00</p>
    </app-cut-summary>
  `,
})
class SummaryFooterHostComponent {
  readonly totals = TOTALS;
}

describe('CutSummaryComponent · layout overview', () => {
  let fixture: ComponentFixture<CutSummaryComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const allText = () => el().textContent?.replace(/\s+/g, ' ') ?? '';
  // true si `first` aparece antes que `second` en el documento.
  const comesBefore = (first: string, second: string) => {
    const a = el().querySelector(first);
    const b = el().querySelector(second);
    if (!a || !b) return false;
    return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  };

  function render(
    totals: CashCut['totals'],
    holderName: string | null,
    cutType: CutTypeValue,
    overview = true,
  ) {
    fixture = TestBed.createComponent(CutSummaryComponent);
    fixture.componentRef.setInput('totals', totals);
    fixture.componentRef.setInput('holderName', holderName);
    fixture.componentRef.setInput('periodText', '2 al 8 nov');
    fixture.componentRef.setInput('cutType', cutType);
    if (overview) fixture.componentRef.setInput('layout', 'overview');
    fixture.detectChanges();
  }

  function expectNoCosts() {
    for (const selector of [
      '.cost',
      '.cost-label',
      '.factory-cost',
      '.factory-cost-label',
      '.real-profit',
      '.real-profit-label',
      '.shipping-cover',
    ]) {
      expect(el().querySelector(selector)).toBeNull();
    }
    for (const label of [
      'Costo con envío',
      'Costo de fábrica',
      'Ganancia real',
      'Para cubrir envíos',
    ]) {
      expect(allText()).not.toContain(label);
    }
  }

  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [CutSummaryComponent, SummaryFooterHostComponent],
    }),
  );

  it('con «Ganancia del vendedor» y un vendedor muestra solo Vendido y Ganancia, sin costos', () => {
    render(TOTALS, 'Luis', 'seller');
    expect(text('.sold')).toBe('$1,840.00');
    expect(text('.sold-caption')).toBe('Vendió Luis · 2 al 8 nov · 2 piezas');
    expect(text('.profit-label')).toBe('Ganancia');
    expect(text('.profit')).toBe('$440.00');
    expect(el().querySelector('.profit')?.classList.contains('text-success-border')).toBe(true);
    expectNoCosts();
  });

  it('con «Ganancia real» y un vendedor la ganancia sale de totals.realProfit', () => {
    render(TOTALS, 'Luis', 'home');
    expect(text('.sold')).toBe('$1,840.00');
    expect(text('.sold-caption')).toBe('Vendió Luis · 2 al 8 nov · 2 piezas');
    expect(text('.profit-label')).toBe('Ganancia');
    expect(text('.profit')).toBe('$640.00');
    expect(el().querySelector('.profit')?.classList.contains('text-success-border')).toBe(true);
    expect(allText()).not.toContain('$440.00');
    expectNoCosts();
  });

  it('con «Ganancia del vendedor» y la bodega: «Mis ventas desde bodega» y Ganancia, sin costos', () => {
    render({ ...TOTALS, units: 1 }, null, 'seller');
    expect(text('.sold-caption')).toBe('Mis ventas desde bodega · 2 al 8 nov · 1 pieza');
    expect(text('.profit-label')).toBe('Ganancia');
    expect(text('.profit')).toBe('$440.00');
    expectNoCosts();
  });

  it('con «Ganancia real» y la bodega: «Mis ventas desde bodega» y la ganancia real, sin costos', () => {
    render({ ...TOTALS, shippingCover: '0.00' }, null, 'home');
    expect(text('.sold-caption')).toBe('Mis ventas desde bodega · 2 al 8 nov · 2 piezas');
    expect(text('.profit-label')).toBe('Ganancia');
    expect(text('.profit')).toBe('$640.00');
    expectNoCosts();
  });

  it('la franja con quién vendió, cuándo y cuántas piezas va arriba de las cifras', () => {
    render(TOTALS, 'Luis', 'seller');
    expect(comesBefore('.sold-caption', '.sold')).toBe(true);
    expect(comesBefore('.sold-caption', '.profit')).toBe(true);
  });

  it('con «Ganancia del vendedor» una ganancia negativa lleva signo menos y va en rojo', () => {
    render({ ...TOTALS, profit: '-40.00' }, 'Luis', 'seller');
    expect(text('.profit')).toBe('-$40.00');
    const profit = el().querySelector('.profit');
    expect(profit?.classList.contains('text-danger-border')).toBe(true);
    expect(profit?.classList.contains('text-success-border')).toBe(false);
  });

  it('con «Ganancia real» una ganancia real negativa lleva signo menos y va en rojo', () => {
    render({ ...TOTALS, realProfit: '-40.00' }, 'Luis', 'home');
    expect(text('.profit')).toBe('-$40.00');
    const profit = el().querySelector('.profit');
    expect(profit?.classList.contains('text-danger-border')).toBe(true);
    expect(profit?.classList.contains('text-success-border')).toBe(false);
  });

  it('el contenido proyectado se ve al pie de la tarjeta, después de las cifras', () => {
    const host = TestBed.createComponent(SummaryFooterHostComponent);
    host.detectChanges();
    const root = host.nativeElement as HTMLElement;
    const footer = root.querySelector('app-cut-summary p-card .projected-footer');
    expect(footer?.textContent?.trim()).toBe('Generado hoy a las 12:00');
    const profit = root.querySelector('app-cut-summary .profit');
    expect(profit).not.toBeNull();
    expect(
      footer !== null &&
        profit !== null &&
        (profit.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);
  });

  it('sin layout (classic, «Mi corte» y HU-19) conserva vendido, costo con envío y ganancia de hoy', () => {
    render(TOTALS, 'Luis', 'seller', false);
    expect(text('.sold')).toBe('$1,840.00');
    expect(text('.sold-caption')).toBe('Vendió Luis · 2 al 8 nov · 2 piezas');
    expect(text('.cost-label')).toBe('Costo con envío');
    expect(text('.cost')).toBe('$1,400.00');
    expect(text('.profit')).toBe('$440.00');
  });
});
