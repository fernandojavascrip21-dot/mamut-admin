import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ReturnFormValue, SellerStockLine } from '../../interfaces/seller.models';
import { ReturnFormComponent } from './return-form.component';

const STOCK: SellerStockLine[] = [
  {
    productId: 10, name: 'Proteína Whey 2 lb', image: null, units: 6, warehouseUnits: 4,
    price: '450.00', unitCost: '300.0000', unitPrice: null, unitCostWithShipping: null,
  },
  {
    productId: 11, name: 'Creatina 300 g', image: null, units: 1, warehouseUnits: 0,
    price: '300.00', unitCost: '200.0000', unitPrice: null, unitCostWithShipping: null,
  },
];

describe('ReturnFormComponent', () => {
  let fixture: ComponentFixture<ReturnFormComponent>;
  let submitted: ReturnFormValue[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReturnFormComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ReturnFormComponent);
    fixture.componentRef.setInput('sellerName', 'Luis');
    fixture.componentRef.setInput('stock', STOCK);
    fixture.componentRef.setInput('cancelUrl', '/admin/vendedores/v-1');
    submitted = [];
    fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const type = (value: string) => {
    const input = root().querySelector<HTMLInputElement>('#qty')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const pick = (productId: number | null) => {
    fixture.componentInstance.form.controls.productId.setValue(productId);
    fixture.detectChanges();
  };
  const submit = () => {
    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };

  it('el vendedor va fijo y la lista solo ofrece lo que tiene, con sus piezas', () => {
    expect(root().querySelector('.seller-fixed')!.textContent).toContain('Luis');
    const options = Array.from(root().querySelectorAll('#product option')).map((o) => o.textContent!.trim());
    expect(options).toEqual(['Elige un producto', 'Proteína Whey 2 lb · 6 piezas', 'Creatina 300 g · 1 pieza']);
  });

  it('sin producto no hay tarjeta ni vista previa', () => {
    expect(root().querySelector('.product-card')).toBeNull();
    expect(root().querySelector('.balance-seller')).toBeNull();
  });

  it('al elegir un producto muestra su tarjeta y los saldos actuales', () => {
    pick(10);
    expect(root().querySelector('.product-card')!.textContent).toContain('Proteína Whey 2 lb');
    expect(root().querySelector('.balance-warehouse')!.textContent).toContain('4');
    expect(root().querySelector('.balance-seller')!.textContent).toContain('6');
    expect(root().querySelector('.preview-text')).toBeNull();
  });

  it('con piezas válidas muestra la vista previa en vivo y el total sin cambio', () => {
    pick(10);
    type('2');
    expect(root().querySelector('.preview-text')!.textContent!.replace(/\s+/g, ' ')).toContain(
      'Luis: 6 → 4 · Bodega: 4 → 6. El total del negocio no cambia.',
    );
    type('7');
    expect(root().querySelector('.preview-text')).toBeNull();
  });

  it('los errores salen al enviar y no al tocar el campo', () => {
    root().querySelector<HTMLInputElement>('#qty')!.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(root().querySelector('.field-error')).toBeNull();

    submit();
    const errors = Array.from(root().querySelectorAll('.field-error')).map((e) => e.textContent!.trim());
    expect(errors).toEqual(['Elige un producto', 'Escribe un número entero mayor a 0']);
    expect(submitted).toEqual([]);
  });

  it('piezas en 0, negativas, decimales o con texto dan el error del campo', () => {
    pick(10);
    for (const value of ['0', '-1', '1.5', 'dos']) {
      type(value);
      submit();
      expect(root().querySelector('#qty-error')!.textContent!.trim(), value).toBe(
        'Escribe un número entero mayor a 0',
      );
    }
    expect(submitted).toEqual([]);
  });

  it('más piezas que las del vendedor da «No hay piezas suficientes» y no envía', () => {
    pick(10);
    type('7');
    submit();
    expect(root().querySelector('#qty-error')!.textContent!.trim()).toBe('No hay piezas suficientes');
    expect(submitted).toEqual([]);
  });

  it('escribir otra cantidad borra el error de las piezas', () => {
    pick(10);
    type('0');
    submit();
    expect(root().querySelector('#qty-error')).not.toBeNull();
    type('2');
    expect(root().querySelector('#qty-error')).toBeNull();
  });

  it('cambiar de producto valida las piezas ya escritas contra el nuevo', () => {
    pick(10);
    type('3');
    pick(11); // solo tiene 1
    submit();
    expect(root().querySelector('#qty-error')!.textContent!.trim()).toBe('No hay piezas suficientes');
  });

  it('con datos válidos emite el producto y las piezas como números', () => {
    pick(10);
    type(' 2 ');
    submit();
    expect(submitted).toEqual([{ productId: 10, qty: 2 }]);
  });

  it('un 409 del servidor muestra el error en el campo hasta que se escribe otra cantidad', () => {
    pick(10);
    type('2');
    fixture.componentRef.setInput('notEnoughUnits', true);
    fixture.detectChanges();
    expect(root().querySelector('#qty-error')!.textContent!.trim()).toBe('No hay piezas suficientes');
    type('1');
    expect(root().querySelector('#qty-error')).toBeNull();
  });

  it('mientras guarda el botón dice «Retirando…» y está deshabilitado', () => {
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    const button = root().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.textContent!.trim()).toBe('Retirando…');
    expect(button.disabled).toBe(true);
    expect(text()).not.toContain('Dejar');
  });

  it('el botón no se deshabilita por piezas inválidas: así se ven los errores', () => {
    const button = root().querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.textContent!.trim()).toBe('Retirar');
    expect(button.disabled).toBe(false);
  });

  it('«Cancelar» vuelve al detalle del vendedor', () => {
    const cancel = Array.from(root().querySelectorAll('a')).find((a) => a.textContent!.trim() === 'Cancelar')!;
    expect(cancel.getAttribute('href')).toBe('/admin/vendedores/v-1');
  });
});
