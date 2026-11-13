import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import type { CreateProductFromLinePayload, PendingNewProduct } from '../../interfaces/receipt.models';
import { NewProductDialogComponent } from './new-product-dialog.component';

const ITEM: PendingNewProduct = {
  lineId: 5, receipt: { requestId: 'r-1', createdAt: '2026-11-10T18:00:00Z' }, suggestedName: 'Glutamina 500 g',
  qty: 3, unitCost: '10.5000',
};
const CATEGORIES = [{ id: 1, name: 'Proteínas' }];

describe('NewProductDialogComponent', () => {
  let fixture: ComponentFixture<NewProductDialogComponent>;
  let saved: CreateProductFromLinePayload[];

  const root = () => document.body;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const field = (name: 'name' | 'price' | 'cost') => root().querySelector<HTMLInputElement>(`input.receipt-${name}`)!;
  const type = (name: 'name' | 'price' | 'cost', value: string) => {
    field(name).value = value;
    field(name).dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const submit = () => {
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Dar de alta')!.click();
    fixture.detectChanges();
  };
  const render = (item: PendingNewProduct = ITEM, inputs: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(NewProductDialogComponent);
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('categories', CATEGORIES);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    saved = [];
    fixture.componentInstance.saved.subscribe((payload) => saved.push(payload));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NewProductDialogComponent] }).compileComponents();
  });

  it('va en un modal-panel con el título «Dar de alta producto»', () => {
    render();
    expect(fixture.debugElement.query(By.directive(ModalPanelComponent)).componentInstance.title()).toBe(
      'Dar de alta producto',
    );
  });

  it('prellena el nombre con el sugerido y el costo con el leído', () => {
    render();
    expect(field('name').value).toBe('Glutamina 500 g');
    expect(field('cost').value).toBe('10.5000');
  });

  it('explica que entran N piezas y que la foto se agrega después', () => {
    render();
    expect(text()).toContain('Entrarán 3 piezas a bodega. La foto se agrega después en Editar producto.');
  });

  it('sin precio no emite y marca el error', () => {
    render();
    submit();
    expect(saved).toEqual([]);
    expect(root().querySelector('.receipt-field-error')).not.toBeNull();
  });

  it('el precio con más de 2 decimales no emite', () => {
    render();
    type('price', '99.999');
    submit();
    expect(saved).toEqual([]);
  });

  it('un nombre vacío o de más de 200 caracteres no emite', () => {
    render();
    type('price', '99');
    type('name', '');
    submit();
    type('name', 'x'.repeat(201));
    submit();
    expect(saved).toEqual([]);
  });

  it('muestra en vivo «El precio es menor que el costo»', () => {
    render();
    type('price', '5');
    expect(text()).toContain('El precio es menor que el costo');
    type('price', '50');
    expect(text()).not.toContain('El precio es menor que el costo');
  });

  it('sin costo leído el costo es obligatorio', () => {
    render({ ...ITEM, unitCost: null });
    type('price', '50');
    submit();
    expect(saved).toEqual([]);
    type('cost', '8');
    submit();
    expect(saved).toEqual([{ name: 'Glutamina 500 g', price: '50', categoryId: null, unitCost: '8' }]);
  });

  it('emite el payload sin unitCost si el costo no cambió', () => {
    render();
    type('price', '50');
    submit();
    expect(saved).toEqual([{ name: 'Glutamina 500 g', price: '50', categoryId: null }]);
  });

  it('emite unitCost si el costo cambió respecto al leído', () => {
    render();
    type('price', '50');
    type('cost', '11');
    submit();
    expect(saved).toEqual([{ name: 'Glutamina 500 g', price: '50', categoryId: null, unitCost: '11' }]);
  });

  it('muestra el error de nombre repetido y el error general que manda la página', () => {
    render(ITEM, { nameError: 'Ya existe un producto con ese nombre.', formError: 'Falta el costo.' });
    expect(text()).toContain('Ya existe un producto con ese nombre.');
    expect(text()).toContain('Falta el costo.');
  });

  it('mientras guarda no se puede cerrar ni enviar de nuevo', () => {
    render(ITEM, { saving: true });
    expect(fixture.debugElement.query(By.directive(ModalPanelComponent)).componentInstance.closable()).toBe(false);
    const button = Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Dar de alta'))!;
    expect(button.disabled).toBe(true);
  });
});
