import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductoCardComponent } from './producto-card.component';
import { provideRouter } from '@angular/router';
import type { ProductoResumen } from '../../../../productos/interfaces/producto.models';

const PRODUCTO: ProductoResumen = {
  id: 1,
  name: 'CBUM Thavage',
  categoryId: null,
  price: '450.00',
  stock: 10,
  fractionable: false,
  image: '',
};

describe('ProductoCardComponent', () => {
  let fixture: ComponentFixture<ProductoCardComponent>;

  async function render(producto: ProductoResumen) {
    fixture = TestBed.createComponent(ProductoCardComponent);
    fixture.componentRef.setInput('producto', producto);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductoCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra el nombre, el precio en pesos y las piezas en bodega', async () => {
    await render(PRODUCTO);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('CBUM Thavage');
    expect(text).toContain('$450.00');
    expect(text).toContain('10');
    expect(text).toContain('en bodega');
  });

  it('toda la tarjeta enlaza a edición con nombre accesible', async () => {
    await render(PRODUCTO);
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/admin/productos/1/editar');
    expect(link.getAttribute('aria-label')).toBe('Editar CBUM Thavage');
  });

  it('muestra "Agotado" solo cuando stock es 0', async () => {
    await render({ ...PRODUCTO, stock: 0 });
    expect(fixture.nativeElement.textContent).toContain('Agotado');
  });

  it('no muestra "Agotado" con stock mayor a 0', async () => {
    await render({ ...PRODUCTO, stock: 5 });
    expect(fixture.nativeElement.textContent).not.toContain('Agotado');
  });

  it('muestra "Fraccionado" solo cuando fractionable es true', async () => {
    await render({ ...PRODUCTO, fractionable: true });
    expect(fixture.nativeElement.textContent).toContain('Fraccionado');
  });

  it('con stock 0 y fractionable true muestra las dos etiquetas, "Agotado" primero', async () => {
    await render({ ...PRODUCTO, stock: 0, fractionable: true });
    const etiquetas = Array.from(
      fixture.nativeElement.querySelectorAll('.absolute span'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(etiquetas).toEqual(['Agotado', 'Fraccionado']);
  });

  it('con image vacía muestra la inicial en vez de una foto', async () => {
    await render({ ...PRODUCTO, name: 'Creatina', image: '' });
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('CR');
  });

  it('si la foto falla al cargar, cae a la inicial', async () => {
    await render({ ...PRODUCTO, name: 'Creatina', image: 'https://cdn.test/rota.png' });
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('CR');
  });
});
