import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductFormComponent } from './product-form.component';
import type { Product, ProductFormValue } from '../../interfaces/product.models';

const MESSAGE = 'No pudimos cargar las categorías.';
const PRODUCT: Product = {
  id: 1, name: 'Creatina', categoryId: 3, stock: 10, active: true, price: '200.00',
  unitCost: '100.00', fractionable: false, portionSize: null, image: '',
};

describe('ProductFormComponent · categorías que no cargan', () => {
  let fixture: ComponentFixture<ProductFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProductFormComponent] });
    fixture = TestBed.createComponent(ProductFormComponent);
    document.body.appendChild(fixture.nativeElement);
  });

  afterEach(() => fixture.nativeElement.remove());

  const text = () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  function retryButton(): HTMLButtonElement | undefined {
    return Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (button) => button.textContent?.trim() === 'Reintentar',
    );
  }
  function render(mode: 'create' | 'edit', failed: boolean, initial: Product | null = null) {
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('categories', []);
    fixture.componentRef.setInput('initialValue', initial);
    fixture.componentRef.setInput('categoriesFailed', failed);
    fixture.detectChanges();
  }

  it('con categoriesFailed verdadero muestra el aviso con role alert y «Reintentar»', () => {
    render('create', true);
    expect(text()).toContain(MESSAGE);
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(MESSAGE);
    expect(retryButton()).toBeDefined();
  });

  it('con categoriesFailed falso no muestra el aviso ni «Reintentar»', () => {
    render('create', false);
    expect(text()).not.toContain(MESSAGE);
    expect(retryButton()).toBeUndefined();
  });

  it('clic en «Reintentar» emite categoriesRetried', () => {
    render('create', true);
    const retried = vi.fn();
    fixture.componentInstance.categoriesRetried.subscribe(retried);
    retryButton()?.click();
    expect(retried).toHaveBeenCalledTimes(1);
  });

  it('en edición con la falla, el payload conserva categoryId 3', () => {
    render('edit', true, PRODUCT);
    const emitted: ProductFormValue[] = [];
    fixture.componentInstance.submitted.subscribe((value) => emitted.push(value));
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].categoryId).toBe(3);
  });
});
