import { ConfirmationService, MessageService } from 'primeng/api';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { Product } from '../../interfaces/product.models';
import { EditProductPageComponent } from './edit-product-page.component';

const CATEGORIES_URL = `${API_BASE_URL}/api/categories`;
const PRODUCT_URL = `${API_BASE_URL}/api/products/1`;
const MESSAGE = 'No pudimos cargar las categorías.';
const PRODUCT: Product = {
  id: 1, name: 'Creatina', categoryId: 7, stock: 10, active: true, price: '200.00',
  unitCost: '100.00', fractionable: false, portionSize: null, image: '',
};

describe('EditProductPageComponent · categorías que no cargan', () => {
  let fixture: ComponentFixture<EditProductPageComponent>;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EditProductPageComponent],
      providers: [
        MessageService, ConfirmationService,
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
      ],
    });
    fixture = TestBed.createComponent(EditProductPageComponent);
    document.body.appendChild(fixture.nativeElement);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    fixture.nativeElement.remove();
  });

  const text = () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  async function settle() {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }
  function retryButton(): HTMLButtonElement | undefined {
    return Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (button) => button.textContent?.trim() === 'Reintentar',
    );
  }
  async function failFirstLoad() {
    fixture.detectChanges();
    httpMock.expectOne(CATEGORIES_URL).flush('error', { status: 500, statusText: 'Server Error' });
    httpMock.expectOne(PRODUCT_URL).flush(PRODUCT);
    await settle();
  }

  it('si el GET de categorías responde 500, muestra el aviso', async () => {
    await failFirstLoad();
    expect(text()).toContain(MESSAGE);
  });

  it('«Reintentar» repite la petición y, con 200, el aviso desaparece y el select muestra las categorías', async () => {
    await failFirstLoad();
    retryButton()?.click();
    fixture.detectChanges();
    httpMock.expectOne(CATEGORIES_URL).flush([{ id: 7, name: 'Proteína', slug: 'proteina' }]);
    await settle();
    expect(text()).not.toContain(MESSAGE);
    (fixture.nativeElement.querySelector('#category') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const options = fixture.nativeElement.querySelectorAll('p-select [role="option"]') as NodeListOf<Element>;
    expect(Array.from(options, (option) => option.textContent?.trim())).toEqual(['Sin categoría', 'Proteína']);
  });
});
