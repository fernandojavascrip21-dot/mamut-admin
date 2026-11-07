import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductFormComponent } from './product-form.component';

describe('ProductFormComponent · porción del producto', () => {
  let fixture: ComponentFixture<ProductFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProductFormComponent] });
    fixture = TestBed.createComponent(ProductFormComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('categories', []);
    fixture.componentRef.setInput('initialValue', null);
    fixture.detectChanges();
  });

  afterEach(() => fixture.nativeElement.remove());

  const el = <T extends Element>(selector: string) => fixture.nativeElement.querySelector(selector) as T;

  it('la casilla se llama «Producto para fraccionar»', () => {
    expect(el('label[for="fractionable"]').textContent).toContain('Producto para fraccionar');
    expect(fixture.nativeElement.textContent).not.toContain('Se fracciona en bolsitas');
  });

  it('la etiqueta dice «Porción del producto», explica qué es y se ve aun sin marcar la casilla', () => {
    expect(el('#portion-size').parentElement?.classList.contains('hidden')).toBe(false);
    expect(el('label[for="portion-size"]').textContent).toContain('Porción del producto');
    expect(el('#portion-size-hint').textContent).toContain('Cuánto trae una porción de este producto');
  });

  it('el campo se describe con la nota y, al fallar, también con el error', () => {
    expect(el('#portion-size').getAttribute('aria-describedby')).toBe('portion-size-hint');
    el<HTMLInputElement>('#fractionable').click();
    fixture.detectChanges();
    const form = fixture.componentInstance.form;
    form.patchValue({ name: 'Creatina', unitCost: '100', price: '200', units: 10 });
    el<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(el('#portion-size').getAttribute('aria-describedby')).toBe('portion-size-hint portion-size-error');
  });
});
