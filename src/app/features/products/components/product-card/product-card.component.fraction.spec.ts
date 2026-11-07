import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { ProductSummary } from '../../interfaces/product.models';
import { ProductCardComponent } from './product-card.component';
import { fractionModalLink } from '@shared/utils/modal-links';

const WHOLE: ProductSummary = {
  id: 7,
  name: 'Creatina 300 g',
  categoryId: null,
  price: '450.00',
  stock: 4,
  fractionable: true,
  image: '',
};

describe('ProductCardComponent · Fraccionar (HU-23)', () => {
  let fixture: ComponentFixture<ProductCardComponent>;

  const render = async (product: ProductSummary, holderLabel: string | null = null) => {
    fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', product);
    fixture.componentRef.setInput('holderLabel', holderLabel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const fractionLink = () =>
    Array.from(fixture.nativeElement.querySelectorAll('a')).find((a) =>
      (a as HTMLElement).textContent!.includes('Fraccionar'),
    ) as HTMLAnchorElement | undefined;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('con «Yo» y un entero fraccionable muestra «Fraccionar» hacia /admin/fraccionar?producto=<id>', async () => {
    await render(WHOLE);
    const router = TestBed.inject(Router);
    expect(fractionLink()!.getAttribute('href')).toBe(
      router.serializeUrl(router.createUrlTree(fractionModalLink({ productId: 7 }))),
    );

  });

  it('aparece aunque el entero tenga 0 piezas', async () => {
    await render({ ...WHOLE, stock: 0 });
    expect(fractionLink()).toBeDefined();
  });

  it('no aparece si el producto no es fraccionable', async () => {
    await render({ ...WHOLE, fractionable: false });
    expect(fractionLink()).toBeUndefined();
  });

  it('no aparece con un vendedor en «Viendo»', async () => {
    await render(WHOLE, 'Luis');
    expect(fractionLink()).toBeUndefined();
  });
});
