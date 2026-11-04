import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CartBarComponent } from './cart-bar.component';

describe('CartBarComponent', () => {
  let fixture: ComponentFixture<CartBarComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  async function render(units: number, total: string, cartUrl = '/vendedor/carrito') {
    fixture = TestBed.createComponent(CartBarComponent);
    fixture.componentRef.setInput('units', units);
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('cartUrl', cartUrl);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartBarComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra «Carrito · N piezas» y el total en pesos', async () => {
    await render(3, '1950.80');
    expect(el().querySelector('.summary')!.textContent!.trim()).toBe('Carrito · 3 piezas');
    expect(el().querySelector('.total')!.textContent!.trim()).toBe('$1,950.80');
  });

  it('con una pieza dice «1 pieza»', async () => {
    await render(1, '750.00');
    expect(el().querySelector('.summary')!.textContent!.trim()).toBe('Carrito · 1 pieza');
  });

  it('«Ver carrito» enlaza a la URL del input() cartUrl', async () => {
    await render(2, '10.00', '/admin/carrito');
    const link = el().querySelector('a.view-cart') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/admin/carrito');
    expect(link.textContent).toContain('Ver carrito');
  });

  it('con /vendedor/carrito enlaza al carrito del vendedor', async () => {
    await render(2, '10.00', '/vendedor/carrito');
    expect(el().querySelector('a.view-cart')!.getAttribute('href')).toBe('/vendedor/carrito');
  });
});
