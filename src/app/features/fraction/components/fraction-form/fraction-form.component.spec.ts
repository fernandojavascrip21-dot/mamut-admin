import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { FractionOption } from '../../interfaces/fraction.models';
import { FractionFormComponent } from './fraction-form.component';
import type { FractionFormSubmit, FractionServerErrors } from './fraction-form.models';

const WITH_BAG: FractionOption = {
  productId: 10,
  name: 'Creatina 300 g',
  image: null,
  warehouseUnits: 3,
  unitCost: '450.0000',
  portionSize: '30 g',
  portionProduct: { id: 11, name: 'Creatina 300 g · bolsita 30 g', price: '95.00', active: true },
};
const NO_BAG: FractionOption = {
  productId: 12,
  name: 'Proteína 2 lb',
  image: null,
  warehouseUnits: 5,
  unitCost: '300.0000',
  portionSize: '50 g',
  portionProduct: null,
};
const EMPTY: FractionOption = {
  productId: 13,
  name: 'Glutamina',
  image: null,
  warehouseUnits: 0,
  unitCost: '200.0000',
  portionSize: '20 g',
  portionProduct: null,
};
const OPTIONS = [WITH_BAG, NO_BAG, EMPTY];

describe('FractionFormComponent', () => {
  let fixture: ComponentFixture<FractionFormComponent>;
  let submitted: FractionFormSubmit[];

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const render = async (inputs: { initialProductId?: number | null; saving?: boolean; serverErrors?: FractionServerErrors } = {}) => {
    fixture = TestBed.createComponent(FractionFormComponent);
    fixture.componentRef.setInput('options', OPTIONS);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    submitted = [];
    fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
    await settle();
  };
  const type = (selector: string, value: string) => {
    const input = root().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const submit = () => {
    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };
  const openSelect = async () => {
    root().querySelector<HTMLElement>('p-select')!.click();
    await settle();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FractionFormComponent] }).compileComponents();
  });

  it('muestra los tres campos con sus etiquetas', async () => {
    await render();
    expect(text()).toContain('Producto a abrir');
    expect(text()).toContain('Bolsitas que salieron');
    expect(text()).toContain('Precio de venta de la bolsita');
    expect(root().querySelector('#portions')).not.toBeNull();
    expect(root().querySelector('#price')!.getAttribute('inputmode')).toBe('decimal');
  });

  it('el entero con 0 piezas sale deshabilitado con «Sin piezas en bodega»', async () => {
    await render();
    await openSelect();
    const disabled = Array.from(root().querySelectorAll('li.p-select-option[aria-disabled="true"]'));
    expect(disabled).toHaveLength(1);
    expect(disabled[0].textContent).toContain('Glutamina');
    expect(disabled[0].textContent).toContain('Sin piezas en bodega');
  });

  it('con initialProductId deja ese entero elegido y muestra porción, piezas y costo de fábrica', async () => {
    await render({ initialProductId: 12 });
    expect(text()).toContain('Proteína 2 lb');
    expect(text()).toContain('50 g');
    expect(text()).toContain('5');
    expect(text()).toContain('$300.00');
  });

  it('con bolsita existente prellena el precio con el suyo y muestra su nombre', async () => {
    await render({ initialProductId: 10 });
    expect(root().querySelector<HTMLInputElement>('#price')!.value).toBe('95.00');
    expect(text()).toContain('Creatina 300 g · bolsita 30 g');
  });

  it('sin bolsita el precio empieza vacío y dice qué bolsita se creará', async () => {
    await render({ initialProductId: 12 });
    expect(root().querySelector<HTMLInputElement>('#price')!.value).toBe('');
    expect(text()).toContain('Se creará la bolsita «Proteína 2 lb · bolsita 50 g»');
  });

  it('con entero y bolsitas válidas muestra la vista previa sin dinero', async () => {
    await render({ initialProductId: 10 });
    type('#portions', '7');
    expect(text()).toContain('Baja 1 entero (3 → 2)');
    expect(text()).toContain('Suben 7 bolsitas');
  });

  it('sin bolsitas válidas no hay vista previa', async () => {
    await render({ initialProductId: 10 });
    type('#portions', '1');
    expect(text()).not.toContain('Baja 1 entero');
  });

  it('los errores salen al enviar y no al tocar el campo', async () => {
    await render({ initialProductId: 12 });
    const portions = root().querySelector<HTMLInputElement>('#portions')!;
    portions.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(root().querySelector('.field-error')).toBeNull();

    submit();
    expect(root().querySelectorAll('.field-error').length).toBe(2);
    expect(submitted).toEqual([]);
  });

  it('sin entero elegido, enviar marca el error del producto', async () => {
    await render();
    type('#portions', '7');
    type('#price', '85.00');
    submit();
    expect(root().querySelectorAll('.field-error').length).toBe(1);
    expect(submitted).toEqual([]);
  });

  it.each(['', '1', '1001', '2.5'])('bolsitas «%s» es error y no emite', async (value) => {
    await render({ initialProductId: 12 });
    type('#portions', value);
    type('#price', '85.00');
    submit();
    expect(root().querySelectorAll('.field-error').length).toBe(1);
    expect(submitted).toEqual([]);
  });

  it.each(['', '0', '85.123', 'abc'])('precio «%s» es error y no emite', async (value) => {
    await render({ initialProductId: 12 });
    type('#portions', '7');
    type('#price', value);
    submit();
    expect(root().querySelectorAll('.field-error').length).toBe(1);
    expect(submitted).toEqual([]);
  });

  it('un entero con 0 piezas elegido muestra «Sin piezas en bodega» al enviar', async () => {
    await render({ initialProductId: 13 });
    type('#portions', '7');
    type('#price', '85.00');
    submit();
    expect(root().querySelector('.field-error')!.textContent).toContain('Sin piezas en bodega');
    expect(submitted).toEqual([]);
  });

  it('con datos válidos emite submitted con el payload (bolsitas como número, precio tal cual)', async () => {
    await render({ initialProductId: 12 });
    type('#portions', '7');
    type('#price', '85.50');
    submit();
    expect(submitted).toEqual([{ productId: 12, portions: 7, price: '85.50', portionSize: '50 g' }]);
  });

  it('pinta los errores del servidor en el campo que toca', async () => {
    await render({
      initialProductId: 12,
      serverErrors: { product: 'Sin piezas en bodega', portions: 'Fuera de rango', price: 'Precio bajo el costo' },
    });
    const errors = Array.from(root().querySelectorAll('.field-error')).map((e) => e.textContent!.trim());
    expect(errors).toEqual(['Sin piezas en bodega', 'Fuera de rango', 'Precio bajo el costo']);
  });

  it('con saving el botón dice «Fraccionando…» y queda deshabilitado', async () => {
    await render({ initialProductId: 12, saving: true });
    const button = root().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.textContent).toContain('Fraccionando…');
    expect(button.disabled).toBe(true);
  });

  it('sin saving el botón dice «Fraccionar» y está habilitado', async () => {
    await render({ initialProductId: 12 });
    const button = root().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.textContent!.trim()).toBe('Fraccionar');
    expect(button.disabled).toBe(false);
  });
});
