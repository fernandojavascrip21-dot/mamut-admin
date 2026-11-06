import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { DeliveryProduct, HoldingFormValue, SellerHolding } from '../../interfaces/delivery.models';
import { HoldingEditFormComponent } from './holding-edit-form.component';

const PRODUCT: DeliveryProduct = { id: 10, name: 'Proteína Whey', image: '', stock: 10, price: '450.00', unitCost: '300.0000' };
const HOLDING: SellerHolding = { units: 3, unitPrice: '500.00', unitCostWithShipping: '310.0000' };

describe('HoldingEditFormComponent', () => {
  let fixture: ComponentFixture<HoldingEditFormComponent>;
  let submitted: HoldingFormValue[];

  function render(setup: { holding?: SellerHolding; saving?: boolean; notEnoughUnits?: boolean } = {}) {
    fixture = TestBed.createComponent(HoldingEditFormComponent);
    fixture.componentRef.setInput('sellerName', 'Luis Pérez');
    fixture.componentRef.setInput('product', PRODUCT);
    fixture.componentRef.setInput('holding', setup.holding ?? HOLDING);
    fixture.componentRef.setInput('saving', setup.saving ?? false);
    fixture.componentRef.setInput('notEnoughUnits', setup.notEnoughUnits ?? false);
    submitted = [];
    fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const field = (selector: string) => el().querySelector(selector) as HTMLInputElement;
  function type(selector: string, value: string) {
    const input = field(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  const submit = () => {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };
  const saveButton = () => el().querySelector('button.save') as HTMLButtonElement;

  it('prellena piezas, precio y costo con lo que el vendedor ya tiene', () => {
    render();
    expect(field('#qty').value).toBe('3');
    expect(field('#unit-price').value).toBe('500.00');
    expect(field('#unit-cost').value).toBe('310.0000');
    expect(text()).toContain('Luis Pérez');
    expect(text()).toContain('Proteína Whey');
  });

  it('con precio y costo generales prellena vacío', () => {
    render({ holding: { units: 3, unitPrice: null, unitCostWithShipping: null } });
    expect(field('#unit-price').value).toBe('');
    expect(field('#unit-cost').value).toBe('');
  });

  it('sin cambios el botón está deshabilitado', () => {
    render();
    expect(saveButton().disabled).toBe(true);
    submit();
    expect(submitted).toEqual([]);
  });

  it('muestra la vista previa de saldos al cambiar las piezas', () => {
    render();
    type('#qty', '5');
    expect(el().querySelector('.preview-text')!.textContent!.replace(/\s+/g, ' ')).toContain(
      'Bodega: 10 → 8 · Luis Pérez: 3 → 5',
    );
    type('#qty', '0');
    expect(text()).toContain('Bodega: 10 → 13');
  });

  it('emite el total de piezas y los precios como texto, y vacío como null', () => {
    render();
    type('#qty', ' 5 ');
    type('#unit-price', '');
    type('#unit-cost', ' 315.25 ');
    submit();
    expect(submitted).toEqual([{ qty: 5, unitPrice: null, unitCostWithShipping: '315.25' }]);
  });

  it('permite dejar al vendedor en 0 piezas', () => {
    render();
    type('#qty', '0');
    submit();
    expect(submitted[0]!.qty).toBe(0);
  });

  it('no envía y muestra el error con piezas inválidas', () => {
    render();
    type('#qty', '1.5');
    submit();
    expect(submitted).toEqual([]);
    expect(text()).toContain('Las piezas deben ser un número entero de 0 o más');
  });

  it('no deja pasar más piezas que las del vendedor más las de la bodega', () => {
    render();
    type('#qty', '14');
    submit();
    expect(submitted).toEqual([]);
    expect(text()).toContain('No hay piezas suficientes');
    type('#qty', '13');
    submit();
    expect(submitted).toHaveLength(1);
  });

  it('rechaza decimales de más en precio y costo', () => {
    render();
    type('#unit-price', '10.999');
    type('#unit-cost', '1.12345');
    submit();
    expect(submitted).toEqual([]);
    expect(text()).toContain('El precio admite hasta 2 decimales');
    expect(text()).toContain('El costo admite hasta 4 decimales');
  });

  it('avisa en vivo si el precio es menor que el costo, sin bloquear el guardado', () => {
    render();
    type('#unit-price', '200');
    expect(el().querySelector('.below-cost')).not.toBeNull();
    expect(saveButton().textContent).toContain('Guardar de todos modos');
    submit();
    expect(submitted).toHaveLength(1);
  });

  it('muestra la ganancia por pieza con el precio y costo propios', () => {
    render();
    expect(el().querySelector('.profit')!.textContent).toContain('190.00');
  });

  it('muestra el error del servidor «No hay piezas suficientes» hasta que se escriba otra cantidad', () => {
    render({ notEnoughUnits: true });
    expect(text()).toContain('No hay piezas suficientes');
    type('#qty', '4');
    expect(el().querySelector('#qty-error')).toBeNull();
  });

  it('mientras guarda muestra «Guardando…» y bloquea el envío', () => {
    render({ saving: true });
    expect(saveButton().textContent).toContain('Guardando…');
    expect(saveButton().disabled).toBe(true);
  });

  it('«Cancelar» emite cancelled', () => {
    render();
    let cancelled = 0;
    fixture.componentInstance.cancelled.subscribe(() => cancelled++);
    (el().querySelector('button.cancel') as HTMLButtonElement).click();
    expect(cancelled).toBe(1);
  });
});
