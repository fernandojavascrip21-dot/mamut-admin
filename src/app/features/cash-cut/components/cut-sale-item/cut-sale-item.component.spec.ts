import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CutSale } from '../../interfaces/cash-cut.models';
import { CutSaleItemComponent } from './cut-sale-item.component';

const SALE: CutSale = {
  requestId: 'r-1',
  soldAt: '2026-11-04T18:42:00Z',
  registeredByAdmin: false,
  soldBy: { id: 'u-1', fullName: 'Luis Pérez' },
  total: '1840.00',
  profit: '440.00',
  lines: [
    {
      productId: 3,
      name: 'Proteína Demo Whey',
      qty: 2,
      unitPrice: '920.00',
      subtotal: '1840.00',
      unitCost: '700.00',
      profit: '440.00',
    },
  ],
};

describe('CutSaleItemComponent', () => {
  let fixture: ComponentFixture<CutSaleItemComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const toggle = () => el().querySelector('.toggle') as HTMLButtonElement;

  function render(sale: CutSale, showDate = false, perspective?: 'admin' | 'seller') {
    fixture = TestBed.createComponent(CutSaleItemComponent);
    fixture.componentRef.setInput('sale', sale);
    fixture.componentRef.setInput('showDate', showDate);
    if (perspective) fixture.componentRef.setInput('perspective', perspective);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutSaleItemComponent] }));

  it('llega plegada: hora, total y ganancia, sin renglones', () => {
    render(SALE);
    expect(text('.time')).toBe('12:42');
    expect(text('.total')).toBe('$1,840.00');
    expect(text('.profit')).toBe('Ganancia $440.00');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(el().querySelector('.lines')).toBeNull();
  });

  it('con Semana o Mes muestra fecha y hora', () => {
    render(SALE, true);
    expect(text('.time')).toBe('4 nov · 12:42');
  });

  it('al tocarla se despliega con sus productos y aria-expanded en true; al tocar otra vez se pliega', () => {
    render(SALE);
    toggle().click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(text('.line-name')).toBe('Proteína Demo Whey');
    expect(text('.line-detail')).toBe('2 × $920.00');
    expect(text('.line-subtotal')).toBe('$1,840.00');
    expect(text('.line-profit')).toBe('$440.00');

    toggle().click();
    fixture.detectChanges();
    expect(el().querySelector('.lines')).toBeNull();
  });

  it('«Registrada por ti» solo con registeredByAdmin', () => {
    render(SALE);
    expect(el().querySelector('.admin-tag')).toBeNull();
    render({ ...SALE, registeredByAdmin: true });
    expect(text('.admin-tag')).toBe('Registrada por ti');
  });

  it('sin ganancia no muestra esa cifra', () => {
    render({
      ...SALE,
      profit: undefined,
      lines: [{ ...SALE.lines[0], profit: undefined, unitCost: undefined }],
    });
    expect(el().querySelector('.profit')).toBeNull();
    toggle().click();
    fixture.detectChanges();
    expect(el().querySelector('.line-profit')).toBeNull();
  });

  it('la marca de una venta del administrador dice «Registrada por ti» o «Registrada por el administrador» según la perspectiva', () => {
    const adminSale = { ...SALE, registeredByAdmin: true };
    render(adminSale);
    expect(text('.admin-tag')).toBe('Registrada por ti');
    render(adminSale, false, 'seller');
    expect(text('.admin-tag')).toBe('Registrada por el administrador');
  });
});
