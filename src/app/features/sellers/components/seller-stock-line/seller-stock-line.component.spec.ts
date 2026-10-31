import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SellerStockLineComponent } from './seller-stock-line.component';

// Los precios generales y propios llegan en toda línea (HU-11); estas pruebas solo cambian lo que miran.
const PRICES = { price: '450.00', unitCost: '300.0000', unitPrice: null, unitCostWithShipping: null };

describe('SellerStockLineComponent', () => {
  let fixture: ComponentFixture<SellerStockLineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SellerStockLineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SellerStockLineComponent);
  });

  it('con foto muestra la imagen, el nombre y las piezas', () => {
    fixture.componentRef.setInput('line', { productId: 1, name: 'Proteína Whey', image: 'https://example.com/w.jpg', units: 4, ...PRICES });
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/w.jpg');
    expect(img.getAttribute('alt')).toBe('Proteína Whey');
    expect(fixture.nativeElement.querySelector('.units').textContent.trim()).toBe('4 piezas');
  });

  it('sin foto, o si la foto no carga, muestra las iniciales', () => {
    fixture.componentRef.setInput('line', { productId: 1, name: 'Creatina Mono', image: null, units: 1, ...PRICES });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('CM');
    expect(fixture.nativeElement.querySelector('.units').textContent.trim()).toBe('1 pieza');

    fixture.componentRef.setInput('line', { productId: 2, name: 'Whey Gold', image: 'https://example.com/rota.jpg', units: 2, ...PRICES });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('WG');
  });

  it('sin precio ni costo propios muestra los generales y ninguna marca «propio»', () => {
    fixture.componentRef.setInput('line', { productId: 1, name: 'Whey', image: null, units: 2, ...PRICES });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.price').textContent.trim()).toBe('$450.00');
    expect(fixture.nativeElement.querySelector('.cost').textContent.trim()).toBe('$300.00');
    expect(fixture.nativeElement.querySelector('.own-price')).toBeNull();
    expect(fixture.nativeElement.querySelector('.own-cost')).toBeNull();
  });

  it('con precio y costo propios muestra los del vendedor con la marca «propio»', () => {
    fixture.componentRef.setInput('line', {
      productId: 1, name: 'Whey', image: null, units: 2, ...PRICES,
      unitPrice: '520.00', unitCostWithShipping: '310.5000',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.price').textContent.trim()).toBe('$520.00');
    expect(fixture.nativeElement.querySelector('.cost').textContent.trim()).toBe('$310.50');
    expect(fixture.nativeElement.querySelector('.own-price').textContent.trim()).toBe('propio');
    expect(fixture.nativeElement.querySelector('.own-cost').textContent.trim()).toBe('propio');
  });

  it('con solo uno propio marca solo ese', () => {
    fixture.componentRef.setInput('line', {
      productId: 1, name: 'Whey', image: null, units: 2, ...PRICES, unitPrice: '520.00',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.own-price')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.own-cost')).toBeNull();
  });
});
