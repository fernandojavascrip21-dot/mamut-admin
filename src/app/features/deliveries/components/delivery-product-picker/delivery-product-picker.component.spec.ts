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
];

describe('DeliveryProductPickerComponent', () => {
  let fixture: ComponentFixture<DeliveryProductPickerComponent>;

  const names = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.option .font-bold, .option span.flex-1')).map((el) =>
      (el as HTMLElement).textContent?.trim(),
    );
  const search = (text: string) => {
    const input = fixture.nativeElement.querySelector('#product-search') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DeliveryProductPickerComponent] }).compileComponents();
    fixture = TestBed.createComponent(DeliveryProductPickerComponent);
  });

  function render(products: DeliveryProductSummary[]) {
    fixture.componentRef.setInput('products', products);
    fixture.detectChanges();
  }

  it('lista solo los productos con piezas en la bodega', () => {
    render(PRODUCTS);
    const options = fixture.nativeElement.querySelectorAll('.option');
    expect(options).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Creatina Ñandú');
    expect(fixture.nativeElement.textContent).not.toContain('Whey Proteína');
    expect(options[0].textContent).toContain('5');
    expect(options[0].textContent).toContain('en bodega');
  });

  it('busca sin distinguir mayúsculas ni acentos', () => {
    render(PRODUCTS);
    search('PROTEINA');
    expect(fixture.nativeElement.querySelectorAll('.option')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Proteína Vegana');
    expect(names().length).toBeGreaterThan(0);
  });

  it('sin resultados lo dice, y sin productos con piezas también', () => {
    render(PRODUCTS);
    search('zzz');
    expect(fixture.nativeElement.querySelector('.empty').textContent).toContain('No hay productos con ese nombre');

    fixture = TestBed.createComponent(DeliveryProductPickerComponent);
    render([product(2, 'Whey', 0)]);
    expect(fixture.nativeElement.querySelector('.empty').textContent).toContain(
      'No hay productos con piezas en la bodega',
    );
  });

  it('emite el id del producto elegido', () => {
    render(PRODUCTS);
    const picked: number[] = [];
    fixture.componentInstance.picked.subscribe((id) => picked.push(id));
    (fixture.nativeElement.querySelectorAll('.option')[1] as HTMLButtonElement).click();
    expect(picked).toEqual([3]);
  });

  it('si la foto no carga cae a las iniciales', () => {
    render(PRODUCTS);
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('PV');
  });

  it('con invalid marca el buscador con el borde de error', () => {
    render(PRODUCTS);
    fixture.componentRef.setInput('invalid', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#product-search').getAttribute('aria-invalid')).toBe('true');
  });
});
