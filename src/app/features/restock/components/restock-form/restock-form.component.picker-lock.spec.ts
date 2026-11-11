import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { RestockProduct } from '../../interfaces/restock.models';
import { RestockFormComponent } from './restock-form.component';

const PRODUCTS: RestockProduct[] = [
  { productId: 1, name: 'Creatina 300 g', image: null, units: 0, stockLevel: 'out', unitCost: '120.0000' },
  { productId: 3, name: 'Barra de avena', image: null, units: 40, stockLevel: 'ok', unitCost: '10.0000' },
];

describe('RestockFormComponent · selector «Agregar producto» mientras se escribe un producto', () => {
  let fixture: ComponentFixture<RestockFormComponent>;

  const root = () => fixture.nativeElement as HTMLElement;
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;
  const click = async (label: string) => {
    button(label).click();
    await settle();
  };
  const type = (selector: string, value: string) => {
    const input = root().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  // El selector de PrimeNG marca su disparador con aria-disabled y la clase p-disabled.
  const pickerDisabled = () => {
    const select = root().querySelector('p-select')!;
    return (
      select.querySelector('.p-select')?.classList.contains('p-disabled') === true ||
      select.querySelector('[aria-disabled="true"]') !== null
    );
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RestockFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(RestockFormComponent);
    fixture.componentRef.setInput('products', PRODUCTS);
    fixture.componentRef.setInput('suggestions', []);
    fixture.componentRef.setInput('initialLines', []);
    await settle();
  });

  it('está habilitado al abrir la lista', () => {
    expect(pickerDisabled()).toBe(false);
  });

  it('se deshabilita al pulsar «Escribir un producto»', async () => {
    await click('Escribir un producto');
    expect(pickerDisabled()).toBe(true);
    expect(fixture.componentInstance.pickerControl.disabled).toBe(true);
  });

  it('se vuelve a habilitar al pulsar «Cancelar»', async () => {
    await click('Escribir un producto');
    await click('Cancelar');
    expect(pickerDisabled()).toBe(false);
    expect(fixture.componentInstance.pickerControl.enabled).toBe(true);
  });

  it('se vuelve a habilitar después de agregar el producto escrito', async () => {
    await click('Escribir un producto');
    type('input.restock-custom-name', 'Shaker Mammut');
    await click('Agregar');
    expect(root().querySelectorAll('app-restock-line')).toHaveLength(1);
    expect(pickerDisabled()).toBe(false);
  });

  it('sigue deshabilitado si «Agregar» falla por falta de nombre', async () => {
    await click('Escribir un producto');
    await click('Agregar');
    expect(root().querySelectorAll('app-restock-line')).toHaveLength(0);
    expect(pickerDisabled()).toBe(true);
  });
});
