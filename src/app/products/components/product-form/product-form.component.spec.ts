import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductFormComponent } from './product-form.component';
import type { Category, Product, ProductFormValue } from '../../interfaces/product.models';

const CATEGORIES: Category[] = [{ id: 7, name: 'Proteína', slug: 'proteina' }];
const PRODUCT: Product = {
  id: 1, name: 'Creatina', categoryId: 7, stock: 10, active: true, price: '200.00',
  unitCost: '100.00', fractionable: true, portionSize: '30 g', image: 'https://cdn.test/old.png',
};

describe('ProductFormComponent', () => {
  let fixture: ComponentFixture<ProductFormComponent>;
  let submitted: ProductFormValue[];
  let dirty: boolean[];

  function create(mode: 'create' | 'edit', initialValue: Product | null = null) {
    TestBed.configureTestingModule({ imports: [ProductFormComponent] });
    fixture = TestBed.createComponent(ProductFormComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('categories', CATEGORIES);
    fixture.componentRef.setInput('initialValue', initialValue);
    submitted = [];
    dirty = [];
    fixture.componentInstance.submitted.subscribe((value) => submitted.push(value));
    fixture.componentInstance.dirtyChange.subscribe((value) => dirty.push(value));
    fixture.detectChanges();
  }

  afterEach(() => fixture.nativeElement.remove());

  function el<T extends Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  function type(selector: string, value: string) {
    const input = el<HTMLInputElement>(selector);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function setFractionable(checked: boolean) {
    const checkbox = el<HTMLInputElement>('input[type="checkbox"]');
    checkbox.checked = checked;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function fill(values: Partial<Record<'name' | 'unitCost' | 'price' | 'units', string>> = {}) {
    const all = { name: 'Creatina', unitCost: '100', price: '200', units: '10', ...values };
    type('#name', all.name);
    type('#unit-cost', all.unitCost);
    type('#price', all.price);
    type('#units', all.units);
  }

  function submit() {
    el<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  function attachFile(): File {
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(el<HTMLInputElement>('#photo'), 'files', { value: [file], configurable: true });
    el<HTMLInputElement>('#photo').dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return file;
  }

  const buttonWithText = (text: string) =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === text)!;

  describe('en alta', () => {
    beforeEach(() => create('create'));

    it('con campos vacíos marca el error de cada uno, enfoca el primero y no emite', () => {
      submit();
      expect(fixture.nativeElement.querySelectorAll('.field-error').length).toBe(4);
      expect(el<HTMLInputElement>('#name').getAttribute('aria-describedby')).toBe('name-error');
      expect(document.activeElement).toBe(el('#name'));
      expect(submitted).toEqual([]);
    });

    it('un envío inválido marca todos los controles como tocados', () => {
      submit();
      const { controls } = fixture.componentInstance.form;
      expect(Object.values(controls).every((control) => control.touched)).toBe(true);
      expect(submitted).toEqual([]);
    });

    it('piezas con decimales marca error y enfoca piezas', () => {
      fill({ units: '2.5' });
      submit();
      expect(fixture.nativeElement.textContent).toContain('número entero');
      expect(document.activeElement).toBe(el('#units'));
      expect(submitted).toEqual([]);
    });

    it('escribir en precio borra su error de campo', () => {
      fill({ price: '' });
      submit();
      expect(fixture.nativeElement.textContent).toContain('El precio debe ser mayor a 0');
      type('#price', '0');
      expect(fixture.nativeElement.textContent).not.toContain('El precio debe ser mayor a 0');
    });

    it('la porción está oculta sin fraccionar; al marcarlo aparece y es obligatoria', () => {
      expect(el('#portion-size').parentElement?.classList.contains('hidden')).toBe(true);
      fill();
      setFractionable(true);
      expect(el('#portion-size').parentElement?.classList.contains('hidden')).toBe(false);
      submit();
      expect(fixture.nativeElement.textContent).toContain('Escribe la porción');
      expect(document.activeElement).toBe(el('#portion-size'));
      setFractionable(false);
      expect(fixture.nativeElement.textContent).not.toContain('Escribe la porción');
    });

    it('precio menor que el costo muestra el error en vivo y deshabilita Guardar', () => {
      fill({ price: '50', unitCost: '100' });
      expect(fixture.nativeElement.textContent).toContain('El precio no puede ser menor que el costo');
      expect(el<HTMLInputElement>('#price').getAttribute('aria-describedby')).toBe('price-error');
      expect(buttonWithText('Guardar').disabled).toBe(true);
    });

    it('precio igual al costo emite el valor normalizado con la foto elegida', () => {
      fill({ name: '  Creatina ', price: '100', unitCost: '100' });
      const file = attachFile();
      expect(buttonWithText('Guardar').disabled).toBe(false);
      submit();
      expect(submitted).toEqual([{
        name: 'Creatina', categoryId: null, price: 100, unitCost: 100, units: 10,
        fractionable: false, portionSize: null, photo: file, removePhoto: false,
      }]);
    });

    it('busy deshabilita los campos y saving cambia el texto del botón', () => {
      fixture.componentRef.setInput('busy', true);
      fixture.componentRef.setInput('saving', true);
      fixture.detectChanges();
      expect(el<HTMLInputElement>('#name').disabled).toBe(true);
      expect(el<HTMLInputElement>('#photo').disabled).toBe(true);
      expect(buttonWithText('Guardando…').disabled).toBe(true);
    });

    it('nameTaken y categoryMissing muestran su aviso y enfocan el campo', async () => {
      fixture.componentRef.setInput('nameTaken', true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain('Ya existe un producto con ese nombre');
      expect(el<HTMLInputElement>('#name').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(el('#name'));

      fixture.componentRef.setInput('nameTaken', false);
      fixture.componentRef.setInput('categoryMissing', true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain('La categoría ya no existe');
      expect(el('#category').getAttribute('aria-describedby')).toBe('category-error');
      expect(document.activeElement).toBe(el('#category'));
    });
  });

  describe('en edición', () => {
    beforeEach(() => create('edit', PRODUCT));

    it('se llena con el producto y muestra las piezas como «N en bodega»', () => {
      expect(el<HTMLInputElement>('#name').value).toBe('Creatina');
      expect(el<HTMLSelectElement>('#category').value).toBe('7');
      expect(el<HTMLInputElement>('#unit-cost').value).toBe('100.00');
      expect(el<HTMLInputElement>('#price').value).toBe('200.00');
      expect(el<HTMLInputElement>('#portion-size').value).toBe('30 g');
      expect(el<HTMLInputElement>('input[type="checkbox"]').checked).toBe(true);
      expect(el('#units')).toBeNull();
      expect(fixture.nativeElement.textContent).toContain('en bodega');
      expect(fixture.nativeElement.textContent).toContain('Las piezas solo cambian con movimientos');
      expect(fixture.componentInstance.prepareSavePayload()).toEqual({
        name: 'Creatina', categoryId: 7, price: 200, unitCost: 100, units: null,
        fractionable: true, portionSize: '30 g', photo: null, removePhoto: false,
      });
    });

    it('cargar el producto no marca el formulario como modificado', () => {
      expect(fixture.componentInstance.form.pristine).toBe(true);
      expect(dirty).toEqual([]);
    });

    it('escribir marca el formulario como sucio (dirtyChange)', () => {
      type('#name', 'Creatina nueva');
      expect(dirty).toContain(true);
    });

    it('cambiar foto y quitar foto se reflejan en el valor emitido', () => {
      const readAsDataURL = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(() => undefined);
      const file = attachFile();
      expect(fixture.componentInstance.prepareSavePayload().photo).toBe(file);
      expect(dirty).toContain(true);

      buttonWithText('Quitar foto').click();
      fixture.detectChanges();
      submit();
      expect(submitted.at(-1)).toMatchObject({ photo: null, removePhoto: true });
      expect(el('img')).toBeNull();
      readAsDataURL.mockRestore();
    });
  });
});
