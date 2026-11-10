import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PurchaseProduct } from '../../interfaces/purchase.models';
import { PurchaseFormComponent } from './purchase-form.component';
import type { PurchaseFormSubmit, PurchaseServerErrors } from './purchase-form.models';

const PRODUCTS: PurchaseProduct[] = [
  { id: 10, name: 'Creatina 300 g', image: null, stock: 3, parentProductId: null },
  { id: 11, name: 'Bolsita creatina', image: null, stock: 1, parentProductId: 10 },
];

describe('PurchaseFormComponent', () => {
  let fixture: ComponentFixture<PurchaseFormComponent>;
  let submitted: PurchaseFormSubmit[];

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const render = async (inputs: { saving?: boolean; serverErrors?: PurchaseServerErrors; notice?: string | null } = {}) => {
    fixture = TestBed.createComponent(PurchaseFormComponent);
    fixture.componentRef.setInput('products', PRODUCTS);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    submitted = [];
    fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
    await settle();
  };
  const typeQty = (value: string) => {
    const input = root().querySelector<HTMLInputElement>('#qty')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const choose = async (label: string) => {
    root().querySelector<HTMLElement>('p-select')!.click();
    await settle();
    Array.from(root().querySelectorAll<HTMLElement>('li.p-select-option'))
      .find((li) => li.textContent!.includes(label))!.click();
    await settle();
  };
  const submit = () => {
    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PurchaseFormComponent] }).compileComponents();
  });

  it('muestra producto y piezas con teclado numérico', async () => {
    await render();
    expect(text()).toContain('Producto');
    expect(text()).toContain('Piezas que entran');
    expect(root().querySelector('#qty')!.getAttribute('inputmode')).toBe('numeric');
    expect(root().querySelectorAll('p-select')).toHaveLength(1);
  });

  it('al elegir un producto muestra sus piezas actuales y, al escribir piezas, cómo quedan', async () => {
    await render();
    await choose('Creatina 300 g');
    expect(text()).toContain('Piezas actuales en bodega: 3 piezas');
    expect(text()).not.toContain('Quedarán');
    typeQty('5');
    expect(text()).toContain('Quedarán: 8 piezas');
  });

  it('también deja elegir una bolsita', async () => {
    await render();
    await choose('Bolsita creatina');
    expect(text()).toContain('Piezas actuales en bodega: 1 pieza');
  });

  it('enviar vacío muestra los errores, no emite y no los muestra antes de enviar', async () => {
    await render();
    expect(text()).not.toContain('Elige el producto');
    submit();
    expect(text()).toContain('Elige el producto');
    expect(text()).toContain('Escribe cuántas piezas entran');
    expect(submitted).toEqual([]);
  });

  it('piezas en 0, negativas o decimales dan error y no emiten', async () => {
    await render();
    await choose('Creatina 300 g');
    for (const value of ['0', '-1', '2.5']) {
      typeQty(value);
      submit();
      expect(text()).toContain('Debe ser un número entero mayor a 0');
    }
    expect(submitted).toEqual([]);
  });

  it('con datos válidos emite { productId, qty } con qty numérico', async () => {
    await render();
    await choose('Creatina 300 g');
    typeQty(' 5 ');
    submit();
    expect(submitted).toEqual([{ productId: 10, qty: 5 }]);
  });

  it('mientras guarda no emite un segundo envío', async () => {
    await render({ saving: true });
    await choose('Creatina 300 g');
    typeQty('5');
    submit();
    expect(submitted).toEqual([]);
  });

  it('pinta el error del servidor en piezas y lo borra al escribir', async () => {
    await render({ serverErrors: { qty: 'El campo qty es demasiado grande' } });
    expect(text()).toContain('El campo qty es demasiado grande');
    typeQty('4');
    expect(text()).not.toContain('El campo qty es demasiado grande');
  });

  it('«Cancelar» emite cancelled', async () => {
    await render();
    let cancelled = 0;
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Cancelar'))!.click();
    expect(cancelled).toBe(1);
  });
});
