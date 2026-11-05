import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { SaleLine } from '../../interfaces/sale.models';
import { SaleLineComponent } from './sale-line.component';

const LINE: SaleLine = {
  productId: 3,
  name: 'Proteína Demo Whey',
  image: null,
  qty: 2,
  unitPrice: '920.00',
  subtotal: '1840.00',
  stock: { before: 6, after: 4 }, stockLevel: 'ok',
};

describe('SaleLineComponent', () => {
  let fixture: ComponentFixture<SaleLineComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  function create(line: SaleLine = LINE) {
    TestBed.configureTestingModule({ imports: [SaleLineComponent] });
    fixture = TestBed.createComponent(SaleLineComponent);
    fixture.componentRef.setInput('line', line);
    fixture.detectChanges();
  }

  it('muestra nombre, piezas, precio c/u, subtotal y «Te quedan N»', () => {
    create();
    expect(text('.name')).toBe('Proteína Demo Whey');
    expect(text('.detail')).toBe('2 × $920.00 c/u');
    expect(text('.subtotal')).toBe('$1,840.00');
    expect(text('.stock-left')).toBe('Te quedan 4');
  });

  it('sin foto muestra las iniciales; con foto muestra la imagen y, si falla, vuelve a las iniciales', () => {
    create();
    expect(el().querySelector('img')).toBeNull();
    expect(el().textContent).toContain('PD');

    TestBed.resetTestingModule();
    create({ ...LINE, image: 'https://example.test/p.jpg' });
    const img = el().querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.test/p.jpg');
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el().querySelector('img')).toBeNull();
  });

  it('no muestra costo ni ganancia', () => {
    create();
    expect(el().textContent!.toLowerCase()).not.toMatch(/costo|ganancia/);
  });

  describe('vista del administrador (con titular)', () => {
    const ADMIN_LINE: SaleLine = { ...LINE, stock: { before: 4, after: 2 }, stockLevel: 'low' };

    function createAdmin(line: SaleLine, holderLabel: string, profitText: string | null = '619.00') {
      TestBed.configureTestingModule({ imports: [SaleLineComponent] });
      fixture = TestBed.createComponent(SaleLineComponent);
      fixture.componentRef.setInput('line', line);
      fixture.componentRef.setInput('holderLabel', holderLabel);
      fixture.componentRef.setInput('profitText', profitText);
      fixture.detectChanges();
    }

    it('muestra «Bodega: 4 → 2», la ganancia del renglón y no «Te quedan N»', () => {
      createAdmin(ADMIN_LINE, 'Bodega');
      expect(text('.stock-change')).toBe('Bodega: 4 → 2');
      expect(text('.profit')).toBe('Ganancia $619.00');
      expect(el().querySelector('.stock-left')).toBeNull();
    });

    it('con un vendedor muestra «Luis: 6 → 4» y «ok» no lleva etiqueta', () => {
      createAdmin({ ...ADMIN_LINE, stock: { before: 6, after: 4 }, stockLevel: 'ok' }, 'Luis');
      expect(text('.stock-change')).toBe('Luis: 6 → 4');
      expect(el().querySelector('.level')).toBeNull();
    });

    it('«low» y «out» muestran su etiqueta', () => {
      createAdmin(ADMIN_LINE, 'Bodega');
      expect(text('.level')).toBe('Baja existencia');
      TestBed.resetTestingModule();
      createAdmin({ ...ADMIN_LINE, stock: { before: 3, after: 0 }, stockLevel: 'out' }, 'Luis');
      expect(text('.level')).toBe('Agotado');
    });

    it('sin profitText (vista del vendedor) no muestra ganancia ni costo', () => {
      createAdmin(ADMIN_LINE, 'Bodega', null);
      expect(el().querySelector('.profit')).toBeNull();
      expect(el().textContent).not.toContain('610');
    });
  });
});
