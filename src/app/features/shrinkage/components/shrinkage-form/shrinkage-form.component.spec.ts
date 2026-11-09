import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ShrinkageOptions } from '../../interfaces/shrinkage.models';
import { ShrinkageFormComponent } from './shrinkage-form.component';
import type { ShrinkageFormSubmit, ShrinkageServerErrors } from './shrinkage-form.models';

const OPTIONS: ShrinkageOptions = {
  holder: { id: 'v-1', fullName: 'Luis Prueba' },
  products: [
    { productId: 10, name: 'Creatina 300 g', image: null, units: 6 },
    { productId: 11, name: 'Proteína 2 lb', image: null, units: 1 },
  ],
  reasons: [
    { code: 'lost', label: 'Se perdió' },
    { code: 'damaged', label: 'Dañado' },
    { code: 'expired', label: 'Caducó' },
    { code: 'other', label: 'Otro' },
  ],
};

describe('ShrinkageFormComponent', () => {
  let fixture: ComponentFixture<ShrinkageFormComponent>;
  let submitted: ShrinkageFormSubmit[];

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const render = async (inputs: { saving?: boolean; serverErrors?: ShrinkageServerErrors; notice?: string | null } = {}) => {
    fixture = TestBed.createComponent(ShrinkageFormComponent);
    fixture.componentRef.setInput('options', OPTIONS);
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
  // Abre el p-select número `index` (0 = producto, 1 = motivo) y elige la opción con ese texto.
  const choose = async (index: number, label: string) => {
    root().querySelectorAll<HTMLElement>('p-select')[index].click();
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
    await TestBed.configureTestingModule({ imports: [ShrinkageFormComponent] }).compileComponents();
  });

  it('muestra los tres campos y «Piezas» con teclado numérico', async () => {
    await render();
    expect(text()).toContain('Producto');
    expect(text()).toContain('Piezas');
    expect(text()).toContain('Motivo');
    expect(root().querySelector('#qty')!.getAttribute('inputmode')).toBe('numeric');
    expect(root().querySelectorAll('p-select')).toHaveLength(2);
  });

  it('el motivo empieza sin valor y ofrece las etiquetas del backend en su orden', async () => {
    await render();
    root().querySelectorAll<HTMLElement>('p-select')[1].click();
    await settle();
    const labels = Array.from(root().querySelectorAll('li.p-select-option')).map((li) => li.textContent!.trim());
    expect(labels).toEqual(['Se perdió', 'Dañado', 'Caducó', 'Otro']);
  });

  it('al elegir un producto muestra «Tiene N piezas»', async () => {
    await render();
    await choose(0, 'Creatina 300 g');
    expect(text()).toContain('Tiene 6 piezas');
  });

  it('no muestra errores al tocar un campo, solo al enviar', async () => {
    await render();
    const qty = root().querySelector<HTMLInputElement>('#qty')!;
    qty.dispatchEvent(new Event('focus'));
    qty.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(root().querySelectorAll('.field-error')).toHaveLength(0);
    submit();
    expect(root().querySelectorAll('.field-error').length).toBeGreaterThan(0);
  });

  it('enviar vacío no emite y pide las piezas con «Escribe cuántas piezas»', async () => {
    await render();
    submit();
    expect(text()).toContain('Escribe cuántas piezas');
    expect(submitted).toEqual([]);
  });

  it('piezas decimales o 0 dicen «Debe ser un número entero mayor a 0»', async () => {
    await render();
    await choose(0, 'Creatina 300 g');
    await choose(1, 'Dañado');
    for (const value of ['2.5', '0']) {
      typeQty(value);
      submit();
      expect(text(), value).toContain('Debe ser un número entero mayor a 0');
    }
    expect(submitted).toEqual([]);
  });

  it('piezas por encima de las que tiene el titular dicen «Solo tiene N piezas»', async () => {
    await render();
    await choose(0, 'Creatina 300 g');
    await choose(1, 'Dañado');
    typeQty('7');
    submit();
    expect(text()).toContain('Solo tiene 6 piezas');
    expect(submitted).toEqual([]);
  });

  it('el error de piezas se borra al escribir de nuevo', async () => {
    await render();
    submit();
    expect(text()).toContain('Escribe cuántas piezas');
    typeQty('2');
    expect(text()).not.toContain('Escribe cuántas piezas');
  });

  it('con el formulario válido emite { productId, qty, reason } con qty numérico', async () => {
    await render();
    await choose(0, 'Creatina 300 g');
    typeQty(' 2 ');
    await choose(1, 'Dañado');
    submit();
    expect(submitted).toEqual([{ productId: 10, qty: 2, reason: 'damaged' }]);
  });

  it('sin producto o sin motivo no emite', async () => {
    await render();
    typeQty('1');
    submit();
    expect(submitted).toEqual([]);
    await choose(0, 'Proteína 2 lb');
    submit();
    expect(submitted).toEqual([]);
  });

  it('mientras guarda, «Registrar merma» está deshabilitado y un segundo envío no emite', async () => {
    await render({ saving: true });
    const button = root().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Registrar merma');
    submit();
    expect(submitted).toEqual([]);
  });

  it('pinta el error del servidor en el campo piezas y el aviso general', async () => {
    await render({ serverErrors: { qty: 'No hay piezas suficientes' }, notice: 'Esta merma ya se registró con otros datos.' });
    expect(root().querySelector('.field-error')!.textContent).toContain('No hay piezas suficientes');
    expect(root().querySelector('.alert-danger')!.textContent).toContain('Esta merma ya se registró con otros datos.');
  });

  it('«Cancelar» emite cancelled', async () => {
    await render();
    let cancelled = 0;
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Cancelar'))!.click();
    expect(cancelled).toBe(1);
  });
});
