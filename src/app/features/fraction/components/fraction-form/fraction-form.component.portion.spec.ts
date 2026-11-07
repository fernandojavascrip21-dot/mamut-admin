import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { FractionOption } from '../../interfaces/fraction.models';
import { FractionFormComponent } from './fraction-form.component';
import type { FractionFormSubmit } from './fraction-form.models';

const NO_BAG: FractionOption = {
  productId: 12,
  name: 'Proteína 2 lb',
  image: null,
  warehouseUnits: 5,
  unitCost: '300.0000',
  portionSize: '50 g',
  portionProduct: null,
};
const WITH_BAG = {
  productId: 10,
  name: 'Creatina 300 g',
  image: null,
  warehouseUnits: 3,
  unitCost: '450.0000',
  portionSize: '30 g',
  portionProduct: { id: 11, name: 'Creatina 300 g · bolsita 45 g', price: '95.00', active: true, portionSize: '45 g' },
} as FractionOption;

describe('FractionFormComponent · Gramos de cada bolsita', () => {
  let fixture: ComponentFixture<FractionFormComponent>;
  let submitted: Record<string, unknown>[];

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const portionSize = () => root().querySelector<HTMLInputElement>('#portion-size');
  const render = async (initialProductId: number) => {
    fixture = TestBed.createComponent(FractionFormComponent);
    fixture.componentRef.setInput('options', [NO_BAG, WITH_BAG]);
    fixture.componentRef.setInput('initialProductId', initialProductId);
    submitted = [];
    fixture.componentInstance.submitted.subscribe((value: FractionFormSubmit) => submitted.push({ ...value }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = (selector: string, value: string) => {
    const input = root().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FractionFormComponent] }).compileComponents();
  });

  it('muestra el campo «Gramos de cada bolsita»', async () => {
    await render(12);
    expect(text()).toContain('Gramos de cada bolsita');
    expect(portionSize()).not.toBeNull();
  });

  it('sin bolsita lo prellena con la porción del entero y se puede editar', async () => {
    await render(12);
    expect(portionSize()!.value).toBe('50 g');
    expect(portionSize()!.readOnly).toBe(false);
  });

  it('con bolsita muestra la porción de la bolsita y es de solo lectura', async () => {
    await render(10);
    expect(portionSize()!.value).toBe('45 g');
    expect(portionSize()!.readOnly).toBe(true);
  });

  it('al enviar sin bolsita emite el portionSize editado', async () => {
    await render(12);
    type('#portion-size', '35 g');
    type('#portions', '7');
    type('#price', '85.00');
    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(submitted).toEqual([{ productId: 12, portions: 7, price: '85.00', portionSize: '35 g' }]);
  });
});
