import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type {
  DeliveryFormValue, DeliveryProduct, DeliveryProductSummary, SellerHolding,
} from '../../interfaces/delivery.models';
import { DeliveryFormComponent } from './delivery-form.component';
import type { HoldingStatus } from './delivery-form.models';

const SELLERS = [
  { id: 'v-1', fullName: 'Luis Pérez' },
  { id: 'v-2', fullName: 'Valeria Vendedora' },
];
const PRODUCT: DeliveryProduct = { id: 10, name: 'Proteína Whey', image: '', stock: 10, price: '450.00', unitCost: '300.0000' };
const SUMMARIES: DeliveryProductSummary[] = [
  { id: 10, name: 'Proteína Whey', image: '', stock: 10, price: '450.00' },
  { id: 11, name: 'Creatina', image: '', stock: 4, price: '300.00' },
];
const EMPTY_HOLDING: SellerHolding = { units: 0, unitPrice: null, unitCostWithShipping: null };

describe('DeliveryFormComponent', () => {
  let fixture: ComponentFixture<DeliveryFormComponent>;
  let submitted: DeliveryFormValue[];

  interface Setup {
    fixedSellerId?: string | null;
    fixedProduct?: boolean;
    product?: DeliveryProduct | null;
    holding?: SellerHolding | null;
    holdingStatus?: HoldingStatus;
    saving?: boolean;
    notEnoughUnits?: boolean;
  }

  function render(setup: Setup = {}) {
    fixture = TestBed.createComponent(DeliveryFormComponent);
    const inputs: Record<string, unknown> = {
      sellers: SELLERS,
      fixedSellerId: setup.fixedSellerId ?? null,
      products: SUMMARIES,
      fixedProduct: setup.fixedProduct ?? false,
      product: setup.product === undefined ? PRODUCT : setup.product,
      holding: setup.holding === undefined ? EMPTY_HOLDING : setup.holding,
      holdingStatus: setup.holdingStatus ?? 'ready',
      saving: setup.saving ?? false,
      notEnoughUnits: setup.notEnoughUnits ?? false,
      cancelUrl: '/admin/productos',
    };
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    submitted = [];
    fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  function type(selector: string, value: string) {
    const input = el().querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  function pickSeller(id: string) {
    const select = el().querySelector('#seller') as HTMLSelectElement;
    select.value = id;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }
  const submit = () => {
    (el().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  };
  const errors = () => Array.from(el().querySelectorAll('.field-error')).map((e) => e.textContent!.trim());
  const button = () => el().querySelector('button[type="submit"]') as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliveryFormComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra el costo de fábrica y el precio general del producto, y sus piezas en bodega', () => {
    render();
    expect(el().querySelector('.factory-cost')!.textContent!.trim()).toBe('$300.00');
    expect(el().querySelector('.general-price')!.textContent!.trim()).toBe('$450.00');
    expect(text()).toContain('10 en bodega');
  });

  it('con vendedor fijo muestra su nombre y no hay selector', () => {
    render({ fixedSellerId: 'v-1' });
    expect(el().querySelector('.seller-fixed')!.textContent!.trim()).toBe('Luis Pérez');
    expect(el().querySelector('select#seller')).toBeNull();
  });

  it('sin vendedor fijo lo elige en el selector y avisa a la página', () => {
    render();
    const picked: string[] = [];
    fixture.componentInstance.sellerPicked.subscribe((id) => picked.push(id));
    pickSeller('v-2');
    expect(picked).toEqual(['v-2']);
  });

  it('sin producto muestra el buscador; con «fixedProduct» no ofrece «Cambiar»', () => {
    render({ product: null, holding: null, holdingStatus: 'idle' });
    expect(el().querySelector('app-delivery-product-picker')).not.toBeNull();

    render({ fixedProduct: true });
    expect(el().querySelector('app-delivery-product-picker')).toBeNull();
    expect(text()).not.toContain('Cambiar');

    render({ fixedProduct: false });
    expect(text()).toContain('Cambiar');
  });

  it('elegir un producto del buscador avisa a la página, y «Cambiar» lo suelta', () => {
    render({ product: null, holding: null, holdingStatus: 'idle' });
    const picked: number[] = [];
    fixture.componentInstance.productPicked.subscribe((id) => picked.push(id));
    (el().querySelector('.option') as HTMLButtonElement).click();
    expect(picked).toEqual([10]);

    render();
    let cleared = 0;
    fixture.componentInstance.productCleared.subscribe(() => cleared++);
    const change = Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.includes('Cambiar'))!;
    change.click();
    expect(cleared).toBe(1);
  });

  it('prellena el precio y el costo con los propios del vendedor, y vacío significa el general', () => {
    render({ holding: { units: 2, unitPrice: '500.00', unitCostWithShipping: '310.5000' } });
    expect((el().querySelector('#unit-price') as HTMLInputElement).value).toBe('500.00');
    expect((el().querySelector('#unit-cost') as HTMLInputElement).value).toBe('310.5000');

    render({ holding: EMPTY_HOLDING });
    expect((el().querySelector('#unit-price') as HTMLInputElement).value).toBe('');
    expect((el().querySelector('#unit-cost') as HTMLInputElement).value).toBe('');
  });

  it('la vista previa muestra bodega y vendedor antes → después y que el total no cambia', () => {
    render({ fixedSellerId: 'v-1' });
    type('#qty', '6');
    expect(el().querySelector('.preview-text')!.textContent!.replace(/\s+/g, ' ')).toContain(
      'Bodega: 10 → 4 · Luis Pérez: 0 → 6. El total del negocio no cambia.',
    );
    expect(el().querySelector('.balance-warehouse')!.textContent).toContain('4');
  });

  it('suma al saldo que el vendedor ya tiene', () => {
    render({ fixedSellerId: 'v-1', holding: { units: 4, unitPrice: null, unitCostWithShipping: null } });
    type('#qty', '3');
    expect(el().querySelector('.preview-text')!.textContent!.replace(/\s+/g, ' ')).toContain('Luis Pérez: 4 → 7');
  });

  it('sin piezas válidas, o más que la bodega, no hay vista previa', () => {
    render({ fixedSellerId: 'v-1' });
    expect(el().querySelector('.preview-text')).toBeNull();
    type('#qty', '11');
    expect(el().querySelector('.preview-text')).toBeNull();
    type('#qty', 'abc');
    expect(el().querySelector('.preview-text')).toBeNull();
  });

  it('calcula la ganancia por pieza con los generales y con los propios', () => {
    render({ fixedSellerId: 'v-1' });
    expect(el().querySelector('.profit')!.textContent!.trim()).toBe('$150.00');
    type('#unit-price', '520');
    type('#unit-cost', '310.5');
    expect(el().querySelector('.profit')!.textContent!.trim()).toBe('$209.50');
  });

  it('precio menor que el costo avisa en vivo, cambia el botón y deja confirmar', () => {
    render({ fixedSellerId: 'v-1' });
    expect(el().querySelector('.below-cost')).toBeNull();
    expect(button().textContent!.trim()).toBe('Dejar a vendedor');

    type('#unit-price', '250');
    expect(el().querySelector('.below-cost')!.textContent!.trim()).toBe('El precio es menor que el costo');
    expect(button().textContent!.trim()).toBe('Dejar de todos modos');

    type('#qty', '2');
    submit();
    expect(submitted).toEqual([{ sellerId: 'v-1', productId: 10, qty: 2, unitPrice: '250', unitCostWithShipping: null }]);

    type('#unit-price', '350');
    expect(el().querySelector('.below-cost')).toBeNull();
    expect(button().textContent!.trim()).toBe('Dejar a vendedor');
  });

  it('emite el payload con piezas como número y precio y costo vacíos como null', () => {
    render({ fixedSellerId: 'v-1' });
    type('#qty', ' 6 ');
    submit();
    expect(submitted).toEqual([{ sellerId: 'v-1', productId: 10, qty: 6, unitPrice: null, unitCostWithShipping: null }]);
  });

  it('con precio y costo escritos los manda sin espacios', () => {
    render({ fixedSellerId: 'v-1' });
    type('#qty', '1');
    type('#unit-price', ' 520.50 ');
    type('#unit-cost', '310.5');
    submit();
    expect(submitted[0]).toMatchObject({ unitPrice: '520.50', unitCostWithShipping: '310.5' });
  });

  it('los errores aparecen al enviar y no al escribir', () => {
    render({ fixedSellerId: 'v-1' });
    type('#qty', '1');
    type('#unit-price', '10.123');
    expect(errors()).toEqual([]);

    submit();
    expect(errors()).toEqual(['El precio admite hasta 2 decimales']);
    expect(submitted).toEqual([]);
  });

  it('sin piezas válidas el botón queda deshabilitado y no envía', () => {
    render({ fixedSellerId: 'v-1' });
    expect(button().disabled).toBe(true);
    submit();
    expect(submitted).toEqual([]);

    for (const value of ['0', '-2', '1.5', 'abc', '  ']) {
      type('#qty', value);
      expect(button().disabled, value).toBe(true);
    }

    type('#qty', '2');
    expect(button().disabled).toBe(false);
    type('#qty', '');
    expect(button().disabled).toBe(true);
  });

  it('muestra el mensaje de cada campo de dinero: mayor a 0, decimales y monto grande', () => {
    render({ fixedSellerId: 'v-1' });
    type('#qty', '1');
    type('#unit-cost', '0');
    type('#unit-price', '100000000');
    submit();
    expect(errors()).toEqual(['El costo debe ser mayor a 0', 'El precio es demasiado grande']);

    type('#unit-cost', '1.23456');
    submit();
    expect(errors()[0]).toBe('El costo admite hasta 4 decimales');
  });

  it('más piezas que la bodega da «No hay piezas suficientes» sin enviar, y se limpia al escribir', () => {
    render({ fixedSellerId: 'v-1' });
    type('#qty', '11');
    submit();
    expect(errors()).toEqual(['No hay piezas suficientes']);
    expect(submitted).toEqual([]);

    type('#qty', '10');
    expect(errors()).toEqual([]);
  });

  it('sin vendedor elegido el botón sigue activo y al enviar pide elegirlo', () => {
    render({ holding: null, holdingStatus: 'idle' });
    expect(button().disabled).toBe(true);
    type('#qty', '1');
    expect(button().disabled).toBe(false);
    submit();
    expect(errors()).toEqual(['Elige a quién se las dejas']);
    expect(submitted).toEqual([]);
  });

  it('muestra el 409 del servidor en las piezas hasta que se escribe otra cantidad', () => {
    render({ fixedSellerId: 'v-1', notEnoughUnits: true });
    expect(errors()).toEqual(['No hay piezas suficientes']);
    type('#qty', '2');
    expect(errors()).toEqual([]);

    fixture.componentRef.setInput('notEnoughUnits', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('notEnoughUnits', true);
    fixture.detectChanges();
    expect(errors()).toEqual(['No hay piezas suficientes']);
  });

  it('mientras guarda dice «Dejando…», deshabilita el botón y no envía', () => {
    render({ fixedSellerId: 'v-1', saving: true });
    expect(button().textContent!.trim()).toBe('Dejando…');
    expect(button().disabled).toBe(true);
    submit();
    expect(submitted).toEqual([]);
  });

  it('mientras carga lo que ya tiene el vendedor no deja enviar, y con error ofrece «Reintentar»', () => {
    render({ fixedSellerId: 'v-1', holding: null, holdingStatus: 'loading' });
    type('#qty', '1');
    expect(button().disabled).toBe(true);

    render({ fixedSellerId: 'v-1', holding: null, holdingStatus: 'error' });
    expect(el().querySelector('.holding-error')).not.toBeNull();
    let retried = 0;
    fixture.componentInstance.holdingRetried.subscribe(() => retried++);
    (el().querySelector('.holding-error button') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });

  it('«Cancelar» enlaza a la URL de regreso', () => {
    render();
    const cancel = Array.from(el().querySelectorAll('a')).find((a) => a.textContent!.includes('Cancelar'))!;
    expect(cancel.getAttribute('href')).toBe('/admin/productos');
  });
});
