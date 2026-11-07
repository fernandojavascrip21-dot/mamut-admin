import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { FractionOption } from '../../interfaces/fraction.models';
import { FractionFormComponent } from './fraction-form.component';
import type { FractionFormSubmit } from './fraction-form.models';

// Bolsita existente sin porción guardada (cadena vacía): el campo debe mostrar la del entero.
const WITH_EMPTY_BAG_SIZE = {
  productId: 20,
  name: 'Omega 120 cápsulas',
  image: null,
  warehouseUnits: 4,
  unitCost: '200.0000',
  portionSize: '50 g',
  portionProduct: { id: 21, name: 'Omega 120 cápsulas · bolsita 50 g', price: '60.00', active: true, portionSize: '' },
} as FractionOption;

describe('FractionFormComponent · bolsita existente sin porción guardada', () => {
  let fixture: ComponentFixture<FractionFormComponent>;
  let submitted: FractionFormSubmit[];

  const root = () => fixture.nativeElement as HTMLElement;
  const portionSize = () => root().querySelector<HTMLInputElement>('#portion-size')!;
  const type = (selector: string, value: string) => {
    const input = root().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FractionFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(FractionFormComponent);
    fixture.componentRef.setInput('options', [WITH_EMPTY_BAG_SIZE]);
    fixture.componentRef.setInput('initialProductId', 20);
    submitted = [];
    fixture.componentInstance.submitted.subscribe((value) => submitted.push({ ...value }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('muestra la porción del entero, no un campo vacío', () => {
    expect(portionSize().value).toBe('50 g');
  });

  it('es de solo lectura', () => {
    expect(portionSize().readOnly).toBe(true);
  });

  it('enviar emite sin portionSize y sin marcar error de porción', () => {
    type('#portions', '7');
    type('#price', '85.00');
    root().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(root().querySelector('#portion-size-error')).toBeNull();
    expect(submitted).toEqual([{ productId: 20, portions: 7, price: '85.00' }]);
  });
});
