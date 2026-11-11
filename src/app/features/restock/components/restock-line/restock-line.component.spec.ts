import { FormControl, FormGroup } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { restockCustomName, restockQty, restockUnitCost } from '../../validators/restock-form.validators';
import type { RestockLineForm, RestockLineFormGroup } from '../restock-form/restock-form.models';
import type { RestockLineView } from './restock-line.models';
import { RestockLineComponent } from './restock-line.component';

const CATALOG_VIEW: RestockLineView = {
  kind: 'catalog', productId: 1, name: 'Creatina 300 g', image: null, units: 0, stockLevel: 'out', orderable: true,
};
const CUSTOM_VIEW: RestockLineView = {
  kind: 'custom', productId: null, name: 'Shaker', image: null, units: null, stockLevel: null, orderable: true,
};

function groupOf(value: RestockLineForm): RestockLineFormGroup {
  return new FormGroup({
    kind: new FormControl(value.kind, { nonNullable: true }),
    productId: new FormControl<number | null>(value.productId),
    name: new FormControl(value.name, { nonNullable: true, validators: value.kind === 'custom' ? [restockCustomName()] : [] }),
    qty: new FormControl(value.qty, { nonNullable: true, validators: [restockQty()] }),
    unitCost: new FormControl(value.unitCost, {
      nonNullable: true, validators: [restockUnitCost({ required: value.kind === 'catalog' })],
    }),
  });
}

describe('RestockLineComponent', () => {
  let fixture: ComponentFixture<RestockLineComponent>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const field = (name: 'qty' | 'cost' | 'name') => root().querySelector<HTMLInputElement>(`input.restock-${name}`);
  const render = (
    view: RestockLineView,
    value: RestockLineForm,
    extras: { showErrors?: boolean; existsInCatalog?: boolean; duplicateName?: boolean } = {},
  ) => {
    fixture = TestBed.createComponent(RestockLineComponent);
    fixture.componentRef.setInput('view', view);
    fixture.componentRef.setInput('group', groupOf(value));
    for (const [key, extra] of Object.entries(extras)) fixture.componentRef.setInput(key, extra);
    fixture.detectChanges();
  };
  const catalogValue: RestockLineForm = { kind: 'catalog', productId: 1, name: 'Creatina 300 g', qty: '4', unitCost: '120.0000' };
  const customValue: RestockLineForm = { kind: 'custom', productId: null, name: 'Shaker', qty: '2', unitCost: '' };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RestockLineComponent] }).compileComponents();
  });

  describe('de catálogo', () => {
    it('muestra nombre, piezas en bodega y la etiqueta «Agotado»', () => {
      render(CATALOG_VIEW, catalogValue);
      expect(text()).toContain('Creatina 300 g');
      expect(text()).toContain('0 piezas en bodega');
      expect(text()).toContain('Agotado');
    });

    it('con nivel low muestra «Baja existencia» y con ok solo las piezas, sin etiqueta', () => {
      render({ ...CATALOG_VIEW, units: 2, stockLevel: 'low' }, catalogValue);
      expect(text()).toContain('2 piezas en bodega');
      expect(text()).toContain('Baja existencia');
      render({ ...CATALOG_VIEW, units: 40, stockLevel: 'ok' }, catalogValue);
      expect(text()).toContain('40 piezas en bodega');
      expect(text()).not.toContain('Baja existencia');
      expect(text()).not.toContain('Agotado');
    });

    it('pinta Piezas y Costo unitario con teclado numérico y decimal, y la ayuda «Solo para este pedido»', () => {
      render(CATALOG_VIEW, catalogValue);
      expect(text()).toContain('Piezas');
      expect(text()).toContain('Costo unitario');
      expect(text()).toContain('Solo para este pedido');
      expect(field('qty')!.value).toBe('4');
      expect(field('qty')!.getAttribute('inputmode')).toBe('numeric');
      expect(field('cost')!.value).toBe('120.0000');
      expect(field('cost')!.getAttribute('inputmode')).toBe('decimal');
      expect(field('cost')!.getAttribute('type')).toBe('text');
    });

    it('escribir en Piezas actualiza el control del formulario', () => {
      render(CATALOG_VIEW, catalogValue);
      field('qty')!.value = '9';
      field('qty')!.dispatchEvent(new Event('input'));
      expect(fixture.componentInstance.group().controls.qty.value).toBe('9');
    });

    it('«Quitar» emite removed', () => {
      render(CATALOG_VIEW, catalogValue);
      const removed = vi.fn();
      fixture.componentInstance.removed.subscribe(removed);
      Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Quitar'))!.click();
      expect(removed).toHaveBeenCalledTimes(1);
    });

    it('no pedible: «Ya no se puede pedir», sin campos editables y con «Quitar»', () => {
      render({ ...CATALOG_VIEW, units: null, stockLevel: null, orderable: false }, catalogValue);
      expect(text()).toContain('Ya no se puede pedir');
      expect(root().querySelector('.alert-warning')).not.toBeNull();
      expect(field('qty')).toBeNull();
      expect(field('cost')).toBeNull();
      expect(text()).toContain('Quitar');
    });

    it('un renglón pedible no muestra «Ya no se puede pedir» ni «Escrito a mano»', () => {
      render(CATALOG_VIEW, catalogValue);
      expect(text()).not.toContain('Ya no se puede pedir');
      expect(text()).not.toContain('Escrito a mano');
    });
  });

  describe('escrito a mano', () => {
    it('muestra la etiqueta «Escrito a mano» y el nombre como texto, y deja editar piezas y costo', () => {
      render(CUSTOM_VIEW, customValue);
      expect(text()).toContain('Escrito a mano');
      expect(text()).toContain('Shaker');
      expect(field('name')).toBeNull();
      expect(field('qty')!.value).toBe('2');
      expect(field('cost')!.value).toBe('');
      expect(text()).toContain('Costo unitario');
    });

    it('no muestra piezas en bodega, nivel ni «Ya no se puede pedir»', () => {
      render(CUSTOM_VIEW, customValue);
      expect(text()).not.toContain('en bodega');
      expect(text()).not.toContain('Agotado');
      expect(text()).not.toContain('Ya no se puede pedir');
    });

    it('con existsInCatalog muestra el aviso no bloqueante', () => {
      render(CUSTOM_VIEW, customValue, { existsInCatalog: true });
      expect(text()).toContain('Ya existe en el catálogo: elígelo de la lista');
      expect(root().querySelector('.alert-warning')).not.toBeNull();
    });

    it('sin existsInCatalog no muestra el aviso', () => {
      render(CUSTOM_VIEW, customValue);
      expect(text()).not.toContain('Ya existe en el catálogo');
    });

    it('«Quitar» emite removed', () => {
      render(CUSTOM_VIEW, customValue);
      const removed = vi.fn();
      fixture.componentInstance.removed.subscribe(removed);
      Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Quitar'))!.click();
      expect(removed).toHaveBeenCalledTimes(1);
    });
  });

  describe('errores de campo', () => {
    it('no se muestran mientras no se intenta enviar', () => {
      render(CATALOG_VIEW, { ...catalogValue, qty: '', unitCost: 'abc' });
      expect(text()).not.toContain('Escribe cuántas piezas');
      expect(text()).not.toContain('Escribe un costo válido');
    });

    it('con showErrors pintan los textos de piezas y costo', () => {
      render(CATALOG_VIEW, { ...catalogValue, qty: '', unitCost: 'abc' }, { showErrors: true });
      expect(text()).toContain('Escribe cuántas piezas');
      expect(text()).toContain('Escribe un costo válido (hasta 4 decimales)');
    });

    it('piezas decimales o cero → «Debe ser un número entero mayor a 0» y sobre el tope → «Es demasiado»', () => {
      render(CATALOG_VIEW, { ...catalogValue, qty: '1.5' }, { showErrors: true });
      expect(text()).toContain('Debe ser un número entero mayor a 0');
      render(CATALOG_VIEW, { ...catalogValue, qty: '2147483648' }, { showErrors: true });
      expect(text()).toContain('Es demasiado');
    });

    it('un nombre escrito repetido pinta su error bajo el nombre, que ya no es un campo', () => {
      render(CUSTOM_VIEW, customValue, { showErrors: true, duplicateName: true });
      expect(field('name')).toBeNull();
      expect(text()).toContain('Ya escribiste este producto');
    });
  });
});
