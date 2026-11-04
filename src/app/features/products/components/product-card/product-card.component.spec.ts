import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductCardComponent } from './product-card.component';
import { provideRouter } from '@angular/router';
import type { ProductSummary } from '../../interfaces/product.models';

const PRODUCT: ProductSummary = {
  id: 1,
  name: 'CBUM Thavage',
  categoryId: null,
  price: '450.00',
  stock: 10,
  fractionable: false,
  image: '',
};

describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;

  async function render(product: ProductSummary) {
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', product);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra el nombre, el precio en pesos y las piezas en bodega', async () => {
    await render(PRODUCT);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('CBUM Thavage');
    expect(text).toContain('$450.00');
    expect(text).toContain('10');
    expect(text).toContain('en bodega');
  });

  it('toda la tarjeta enlaza a edición con nombre accesible', async () => {
    await render(PRODUCT);
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/admin/productos/1/editar');
    expect(link.getAttribute('aria-label')).toBe('Editar CBUM Thavage');
  });

  it('muestra "Agotado" solo cuando stock es 0', async () => {
    await render({ ...PRODUCT, stock: 0 });
    expect(fixture.nativeElement.textContent).toContain('Agotado');
  });

  it('no muestra "Agotado" con stock mayor a 0', async () => {
    await render({ ...PRODUCT, stock: 5 });
    expect(fixture.nativeElement.textContent).not.toContain('Agotado');
  });

  it('muestra "Fraccionado" solo cuando fractionable es true', async () => {
    await render({ ...PRODUCT, fractionable: true });
    expect(fixture.nativeElement.textContent).toContain('Fraccionado');
  });

  it('con stock 0 y fractionable true muestra las dos etiquetas, "Agotado" primero', async () => {
    await render({ ...PRODUCT, stock: 0, fractionable: true });
    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.absolute span'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(labels).toEqual(['Agotado', 'Fraccionado']);
  });

  it('con image vacía muestra la inicial en vez de una foto', async () => {
    await render({ ...PRODUCT, name: 'Creatina', image: '' });
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('CR');
  });

  it('si la foto falla al cargar, cae a la inicial', async () => {
    await render({ ...PRODUCT, name: 'Creatina', image: 'https://cdn.test/rota.png' });
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(img).not.toBeNull();

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('CR');
  });

  describe('Dejar a vendedor (HU-11)', () => {
    const links = () => Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];

    it('con piezas en la bodega ofrece «Dejar a vendedor», como enlace hermano del de edición', async () => {
      await render(PRODUCT);
      const deliver = fixture.nativeElement.querySelector('a.deliver') as HTMLAnchorElement;
      expect(deliver.textContent?.trim()).toBe('Dejar a vendedor');
      expect(deliver.getAttribute('href')).toBe('/admin/(ventana:dejar;producto=1)');
      expect(deliver.getAttribute('aria-label')).toBe('Dejar CBUM Thavage a un vendedor');
      // Un enlace no puede ir dentro de otro: ninguno contiene al otro.
      expect(links()).toHaveLength(2);
      expect(links().some((a) => a.querySelector('a'))).toBe(false);
    });

    it('con un vendedor en «Viendo» lo manda fijo en la URL', async () => {
      fixture = TestBed.createComponent(ProductCardComponent);
      fixture.componentRef.setInput('product', PRODUCT);
      fixture.componentRef.setInput('sellerId', 'v-1');
      fixture.detectChanges();
      const deliver = fixture.nativeElement.querySelector('a.deliver') as HTMLAnchorElement;
      expect(deliver.getAttribute('href')).toBe('/admin/(ventana:dejar;vendedor=v-1;producto=1)');
    });

    it('sin piezas en la bodega no ofrece dejar el producto', async () => {
      await render({ ...PRODUCT, stock: 0 });
      expect(fixture.nativeElement.querySelector('a.deliver')).toBeNull();
      expect(links()).toHaveLength(1);
    });
  });

  describe('Agregar (HU-17)', () => {
    async function renderSell(inputs: { sellUnits: number | null; unitsInCart?: number; holderLabel?: string | null }) {
      fixture = TestBed.createComponent(ProductCardComponent);
      fixture.componentRef.setInput('product', PRODUCT);
      fixture.componentRef.setInput('sellUnits', inputs.sellUnits);
      fixture.componentRef.setInput('unitsInCart', inputs.unitsInCart ?? 0);
      fixture.componentRef.setInput('holderLabel', inputs.holderLabel ?? null);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }
    const el = () => fixture.nativeElement as HTMLElement;
    const click = (selector: string) => (el().querySelector(selector) as HTMLButtonElement).click();

    it('con piezas del titular ofrece «Agregar» y emite sellAdd', async () => {
      await renderSell({ sellUnits: 4 });
      const button = el().querySelector('button.sell') as HTMLButtonElement;
      expect(button.textContent!.trim()).toBe('Agregar');
      expect(button.getAttribute('aria-label')).toBe('Agregar CBUM Thavage al carrito');
      const added = vi.fn();
      fixture.componentInstance.sellAdd.subscribe(added);
      button.click();
      expect(added).toHaveBeenCalledOnce();
    });

    it.each([
      ['sin catálogo (null)', null],
      ['con 0 piezas', 0],
    ])('%s y fuera del carrito no ofrece «Agregar»', async (_label, sellUnits) => {
      await renderSell({ sellUnits });
      expect(el().querySelector('button.sell')).toBeNull();
    });

    it('con el producto en el carrito muestra − N + aunque ya no queden piezas, y emite sus output()', async () => {
      await renderSell({ sellUnits: 0, unitsInCart: 2 });
      expect(el().querySelector('button.sell')).toBeNull();
      expect(el().querySelector('.units')!.textContent).toBe('2');
      const inc = vi.fn();
      const dec = vi.fn();
      fixture.componentInstance.sellIncrement.subscribe(inc);
      fixture.componentInstance.sellDecrement.subscribe(dec);
      click('button.decrement');
      expect(dec).toHaveBeenCalledOnce();
      expect((el().querySelector('button.increment') as HTMLButtonElement).disabled).toBe(true);
      expect(inc).not.toHaveBeenCalled();
    });

    it('el «+» se habilita mientras haya piezas y emite sellIncrement', async () => {
      await renderSell({ sellUnits: 4, unitsInCart: 3 });
      const inc = vi.fn();
      fixture.componentInstance.sellIncrement.subscribe(inc);
      const plus = el().querySelector('button.increment') as HTMLButtonElement;
      expect(plus.disabled).toBe(false);
      plus.click();
      expect(inc).toHaveBeenCalledOnce();
    });

    it('con un vendedor muestra «Luis: N»; sin él no muestra la línea', async () => {
      await renderSell({ sellUnits: 6, holderLabel: 'Luis' });
      expect(el().querySelector('.holder-units')!.textContent!.trim()).toBe('Luis: 6');
      await renderSell({ sellUnits: 6 });
      expect(el().querySelector('.holder-units')).toBeNull();
    });

    it('«Dejar a vendedor» sigue saliendo junto a «Agregar»', async () => {
      await renderSell({ sellUnits: 4 });
      expect(el().querySelector('a.deliver')).not.toBeNull();
      expect(el().querySelector('button.sell')).not.toBeNull();
    });
  });
});
