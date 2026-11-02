import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { DeliveryProductSummary } from '../../interfaces/delivery.models';
import { DeliveryProductPickerComponent } from './delivery-product-picker.component';

const product = (id: number, name: string, stock: number, image = ''): DeliveryProductSummary => ({
  id, name, image, stock, price: '450.00',
});
const PRODUCTS = [
  product(1, 'Creatina Ñandú', 5),
  product(2, 'Whey Proteína', 0),
  product(3, 'Proteína Vegana', 3, 'https://example.com/v.jpg'),
  product(4, 'BCAA 2lb', 8),
];

describe('DeliveryProductPickerComponent', () => {
  let fixture: ComponentFixture<DeliveryProductPickerComponent>;

  const root = () => fixture.nativeElement as HTMLElement;
  const options = () => Array.from(root().querySelectorAll<HTMLElement>('.option'));
  const optionNames = () =>
    options().map((option) => option.querySelector('span.flex-1')?.textContent?.trim());

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(products: DeliveryProductSummary[]) {
    fixture.componentRef.setInput('products', products);
    await settle();
  }

  // Abre la lista del Select como lo hace el usuario: un clic en el control.
  async function open() {
    root().querySelector<HTMLElement>('.p-select')?.click();
    await settle();
  }

  // Escribe en el buscador del Select, igual que el usuario.
  async function search(text: string) {
    const input = root().querySelector<HTMLInputElement>('input.p-select-filter')!;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DeliveryProductPickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(DeliveryProductPickerComponent);
  });

  it('es un Select de PrimeNG con la etiqueta «Producto»', async () => {
    await render(PRODUCTS);
    expect(root().querySelector('p-select')).not.toBeNull();
    expect(root().querySelector('label')?.textContent?.trim()).toBe('Producto');
  });

  it('lista solo los productos con piezas en la bodega', async () => {
    await render(PRODUCTS);
    await open();
    expect(optionNames()).toEqual(['Creatina Ñandú', 'Proteína Vegana', 'BCAA 2lb']);
    expect(options()[0].textContent).toContain('5');
    expect(options()[0].textContent).toContain('en bodega');
  });

  it('buscar «bcaa» encuentra «BCAA 2lb»', async () => {
    await render(PRODUCTS);
    await open();
    await search('bcaa');
    expect(optionNames()).toEqual(['BCAA 2lb']);
  });

  it('busca sin distinguir mayúsculas ni acentos, teclee o no la tilde', async () => {
    await render(PRODUCTS);
    await open();
    for (const query of ['PROTEINA', 'proteína', 'Proteína']) {
      await search(query);
      expect(optionNames(), query).toEqual(['Proteína Vegana']);
    }
    for (const query of ['nandu', 'ÑANDÚ', 'ñandu']) {
      await search(query);
      expect(optionNames(), query).toEqual(['Creatina Ñandú']);
    }
  });

  it('sin resultados lo dice', async () => {
    await render(PRODUCTS);
    await open();
    await search('zzz');
    expect(options()).toHaveLength(0);
    expect(root().querySelector('.empty')?.textContent).toContain('No hay productos con ese nombre');
  });

  it('sin productos con piezas en la bodega lo dice y no muestra el Select', async () => {
    await render([product(2, 'Whey', 0)]);
    expect(root().querySelector('p-select')).toBeNull();
    expect(root().querySelector('.empty')?.textContent).toContain('No hay productos con piezas en la bodega');
  });

  it('emite el id del producto elegido', async () => {
    await render(PRODUCTS);
    const picked: number[] = [];
    fixture.componentInstance.picked.subscribe((id) => picked.push(id));
    await open();
    root().querySelectorAll<HTMLElement>('li.p-select-option')[1].click();
    await settle();
    expect(picked).toEqual([3]);
  });

  it('si la foto no carga cae a las iniciales', async () => {
    await render(PRODUCTS);
    await open();
    root().querySelector('img')!.dispatchEvent(new Event('error'));
    await settle();
    expect(root().querySelector('img')).toBeNull();
    expect(root().textContent).toContain('PV');
  });

  it('con invalid marca el selector con el borde de error', async () => {
    await render(PRODUCTS);
    fixture.componentRef.setInput('invalid', true);
    await settle();
    expect(root().querySelector('.p-select')?.classList).toContain('p-invalid');
  });
});
