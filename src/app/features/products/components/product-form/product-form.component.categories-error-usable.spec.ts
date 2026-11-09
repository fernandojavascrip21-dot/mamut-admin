import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductFormComponent } from './product-form.component';

const MESSAGE = 'No pudimos cargar las categorías.';
const MISSING = 'La categoría ya no existe. Actualiza la página e inténtalo otra vez.';

// Spec T-26 §3.2: con las categorías caídas el select sigue usable y el aviso convive con el 422.
describe('ProductFormComponent · categorías que no cargan (formulario usable)', () => {
  let fixture: ComponentFixture<ProductFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProductFormComponent] });
    fixture = TestBed.createComponent(ProductFormComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('categories', []);
    fixture.componentRef.setInput('categoriesFailed', true);
  });

  afterEach(() => fixture.nativeElement.remove());

  const text = () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  it('el select sigue habilitado y ofrece «Sin categoría»', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.categoryId.enabled).toBe(true);
    expect(fixture.componentInstance.categoryOptions()).toEqual([{ label: 'Sin categoría', value: '' }]);
  });

  it('el aviso y el error de categoría inexistente (422) se ven juntos', () => {
    fixture.componentRef.setInput('categoryMissing', true);
    fixture.detectChanges();
    expect(text()).toContain(MESSAGE);
    expect(text()).toContain(MISSING);
  });
});
