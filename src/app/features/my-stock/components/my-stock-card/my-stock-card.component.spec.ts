import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { MyStockProduct } from '../../interfaces/my-stock.models';
import { MyStockCardComponent } from './my-stock-card.component';

const PRODUCT: MyStockProduct = {
  productId: 10,
  name: 'Proteína Whey',
  image: null,
  units: 6,
  price: '480.00',
};

describe('MyStockCardComponent', () => {
  let fixture: ComponentFixture<MyStockCardComponent>;

  async function render(product: MyStockProduct) {
    fixture = TestBed.createComponent(MyStockCardComponent);
    fixture.componentRef.setInput('product', product);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = () => fixture.nativeElement.textContent as string;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MyStockCardComponent] }).compileComponents();
  });

  it('muestra el nombre, «Me quedan N» y el precio en pesos', async () => {
    await render(PRODUCT);
    expect(text()).toContain('Proteína Whey');
    expect(text()).toContain('Me quedan 6');
    expect(text()).toContain('$480.00');
  });

  it('con una pieza dice «Me queda 1»', async () => {
    await render({ ...PRODUCT, units: 1 });
    expect(text()).toContain('Me queda 1');
    expect(text()).not.toContain('Me quedan');
  });

  it('muestra el precio que recibe, sea el propio o el general', async () => {
    await render({ ...PRODUCT, price: '500.00' });
    expect(text()).toContain('$500.00');
    expect(text()).not.toContain('$480.00');
  });

  it('con foto la muestra con su texto alternativo', async () => {
    await render({ ...PRODUCT, image: 'https://cdn.test/whey.png' });
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.test/whey.png');
    expect(img.getAttribute('alt')).toBe('Proteína Whey');
  });

  it('sin foto muestra las iniciales en vez de una imagen', async () => {
    await render({ ...PRODUCT, name: 'Creatina' });
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(text()).toContain('CR');
  });

  it('si la foto falla al cargar, cae a las iniciales', async () => {
    await render({ ...PRODUCT, name: 'Creatina', image: 'https://cdn.test/rota.png' });
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(text()).toContain('CR');
  });

  it('no muestra costos ni ganancia', async () => {
    await render(PRODUCT);
    expect(text().toLowerCase()).not.toMatch(/costo|ganancia/);
  });
});
