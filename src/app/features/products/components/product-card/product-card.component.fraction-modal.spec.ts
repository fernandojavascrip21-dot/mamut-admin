import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { fractionModalLink } from '@shared/utils/modal-links';
import type { ProductSummary } from '../../interfaces/product.models';
import { ProductCardComponent } from './product-card.component';

const WHOLE: ProductSummary = {
  id: 7,
  name: 'Creatina 300 g',
  categoryId: null,
  price: '450.00',
  stock: 4,
  fractionable: true,
  image: '',
};

describe('ProductCardComponent · «Fraccionar» abre la ventana', () => {
  let fixture: ComponentFixture<ProductCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', WHOLE);
    fixture.componentRef.setInput('holderLabel', null);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('el enlace apunta al outlet «ventana» con el producto y no a /admin/fraccionar', () => {
    const link = (Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[]).find((a) =>
      a.textContent!.includes('Fraccionar'),
    )!;
    const router = TestBed.inject(Router);
    expect(link.getAttribute('href')).toBe(router.serializeUrl(router.createUrlTree(fractionModalLink({ productId: 7 }))));
    expect(link.getAttribute('href')).not.toContain('/admin/fraccionar');
  });
});
