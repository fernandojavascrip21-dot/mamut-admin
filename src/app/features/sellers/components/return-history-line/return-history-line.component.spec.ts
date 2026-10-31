import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ReturnHistoryItem } from '../../interfaces/seller.models';
import { ReturnHistoryLineComponent } from './return-history-line.component';

const ITEM: ReturnHistoryItem = {
  requestId: 'r-1',
  createdAt: '2026-10-31T18:21:07.000Z',
  productId: 10,
  name: 'Proteína Whey',
  image: null,
  qty: 2,
};

describe('ReturnHistoryLineComponent', () => {
  let fixture: ComponentFixture<ReturnHistoryLineComponent>;

  function render(item: ReturnHistoryItem) {
    fixture = TestBed.createComponent(ReturnHistoryLineComponent);
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('sellerId', 'v-1');
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReturnHistoryLineComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra el producto, las piezas con signo menos y la fecha', () => {
    render(ITEM);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.name')?.textContent?.trim()).toBe('Proteína Whey');
    expect(el.querySelector('.qty')?.textContent?.trim()).toBe('−2 piezas');
    expect(el.querySelector('.date')?.textContent).toMatch(/\d{2}\/\d{2}\/2026 \d{2}:\d{2}/);
  });

  it('con requestId es un enlace al resumen del retiro de ese vendedor', () => {
    render(ITEM);
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/admin/vendedores/v-1/retiros/r-1');
  });

  it('sin requestId (retiro hecho fuera de la app) se ve sin enlace', () => {
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
