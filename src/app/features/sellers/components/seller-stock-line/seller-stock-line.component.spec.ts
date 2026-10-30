import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SellerStockLineComponent } from './seller-stock-line.component';

describe('SellerStockLineComponent', () => {
  let fixture: ComponentFixture<SellerStockLineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SellerStockLineComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SellerStockLineComponent);
  });

  it('con foto muestra la imagen, el nombre y las piezas', () => {
    fixture.componentRef.setInput('line', { productId: 1, name: 'Proteína Whey', image: 'https://example.com/w.jpg', units: 4 });
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/w.jpg');
    expect(img.getAttribute('alt')).toBe('Proteína Whey');
    expect(fixture.nativeElement.querySelector('.units').textContent.trim()).toBe('4 piezas');
  });

  it('sin foto, o si la foto no carga, muestra las iniciales', () => {
    fixture.componentRef.setInput('line', { productId: 1, name: 'Creatina Mono', image: null, units: 1 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('CM');
    expect(fixture.nativeElement.querySelector('.units').textContent.trim()).toBe('1 pieza');

    fixture.componentRef.setInput('line', { productId: 2, name: 'Whey Gold', image: 'https://example.com/rota.jpg', units: 2 });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('WG');
  });
});
