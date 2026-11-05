import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CashCut } from '../../interfaces/cash-cut.models';
import { CutSummaryComponent } from './cut-summary.component';

describe('CutSummaryComponent', () => {
  let fixture: ComponentFixture<CutSummaryComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  const TOTALS: CashCut['totals'] = {
    salesCount: 1,
    units: 5,
    total: '1840.00',
    cost: '1400.0000',
    profit: '440.00',
  };

  function render(
    totals: CashCut['totals'],
    holderName: string | null,
    perspective?: 'admin' | 'seller',
  ) {
    fixture = TestBed.createComponent(CutSummaryComponent);
    fixture.componentRef.setInput('totals', totals);
    fixture.componentRef.setInput('holderName', holderName);
    fixture.componentRef.setInput('periodText', '2 al 8 nov');
    if (perspective) fixture.componentRef.setInput('perspective', perspective);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutSummaryComponent] }));

  it('muestra vendido, costo y ganancia con formato de moneda', () => {
    render(TOTALS, 'Luis');
    expect(text('.sold')).toBe('$1,840.00');
    expect(text('.cost')).toBe('$1,400.00');
    expect(text('.profit')).toBe('$440.00');
  });

  it('con un vendedor: «Vendió Luis · 2 al 8 nov · 5 piezas» y «Costo con envío»', () => {
    render(TOTALS, 'Luis');
    expect(text('.sold-caption')).toBe('Vendió Luis · 2 al 8 nov · 5 piezas');
    expect(text('.cost-label')).toBe('Costo con envío');
  });

  it('con la bodega: «Mis ventas desde bodega» y «Costo»', () => {
    render({ ...TOTALS, units: 1 }, null);
    expect(text('.sold-caption')).toBe('Mis ventas desde bodega · 2 al 8 nov · 1 pieza');
    expect(text('.cost-label')).toBe('Costo');
  });

  it('con perspective «seller»: «Vendí · 2 al 8 nov · 5 piezas» y «Total a entregar»', () => {
    render(TOTALS, null, 'seller');
    expect(text('.sold-caption')).toBe('Vendí · 2 al 8 nov · 5 piezas');
    expect(text('.cost-label')).toBe('Total a entregar');
    expect(text('.cost')).toBe('$1,400.00');
    expect(text('.profit')).toBe('$440.00');
  });

  it('con perspective «admin» los textos de HU-19 no cambian', () => {
    render(TOTALS, 'Luis', 'admin');
    expect(text('.sold-caption')).toBe('Vendió Luis · 2 al 8 nov · 5 piezas');
    expect(text('.cost-label')).toBe('Costo con envío');
  });

  it('una ganancia negativa se muestra con signo menos', () => {
    render({ ...TOTALS, profit: '-40.00' }, 'Luis');
    expect(text('.profit')).toBe('-$40.00');
    expect(el().querySelector('.profit')?.classList.contains('text-danger-border')).toBe(true);
  });

  it('sin costo ni ganancia no muestra esas cifras', () => {
    render({ salesCount: 1, units: 5, total: '1840.00' }, 'Luis');
    expect(text('.sold')).toBe('$1,840.00');
    expect(el().querySelector('.cost')).toBeNull();
    expect(el().querySelector('.profit')).toBeNull();
  });
});
