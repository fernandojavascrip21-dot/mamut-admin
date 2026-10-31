import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { DeliveryHistoryItem } from '../../interfaces/seller.models';
import { DeliveryHistoryLineComponent } from './delivery-history-line.component';

const ITEM: DeliveryHistoryItem = {
  requestId: 'r-1',
  createdAt: '2026-10-30T18:21:07.000Z',
  productId: 10,
  name: 'Proteína Whey',
  image: null,
  qty: 6,
};

describe('DeliveryHistoryLineComponent', () => {
  let fixture: ComponentFixture<DeliveryHistoryLineComponent>;

  function render(item: DeliveryHistoryItem) {
    fixture = TestBed.createComponent(DeliveryHistoryLineComponent);
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryHistoryLineComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra el producto, las piezas y la fecha', () => {
    render(ITEM);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.name')?.textContent?.trim()).toBe('Proteína Whey');
    expect(el.querySelector('.qty')?.textContent?.trim()).toBe('+6 piezas');
    expect(el.querySelector('.date')?.textContent).toMatch(/\d{2}\/\d{2}\/2026 \d{2}:\d{2}/);
  });

  it('con requestId es un enlace al resumen que regresa al detalle del vendedor', () => {
    render(ITEM);
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/admin/entregas/r-1?volver=vendedor');
  });

  it('sin requestId (entrega anterior) se ve sin enlace', () => {
    render({ ...ITEM, requestId: null });
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Proteína Whey');
  });

  it('sin foto, o si la foto no carga, muestra las iniciales', () => {
    render(ITEM);
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('PW');

    render({ ...ITEM, image: 'https://example.com/rota.jpg' });
    (fixture.nativeElement.querySelector('img') as HTMLImageElement).dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
  });
});
