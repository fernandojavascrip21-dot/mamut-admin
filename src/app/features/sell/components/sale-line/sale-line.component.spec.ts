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
  stock: { before: 6, after: 4 },
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
});
