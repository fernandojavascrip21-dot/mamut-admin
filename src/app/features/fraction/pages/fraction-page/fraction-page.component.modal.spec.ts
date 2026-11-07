import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { closeModalLink } from '@shared/utils/modal-links';
import type { Fraction, FractionOption } from '../../interfaces/fraction.models';
import { FractionPageComponent } from './fraction-page.component';

const OPTIONS_URL = `${API_BASE_URL}/api/fractions/options`;
const CREATE_URL = `${API_BASE_URL}/api/fractions`;
const WHOLE: FractionOption = {
  productId: 10,
  name: 'Creatina 300 g',
  image: null,
  warehouseUnits: 3,
  unitCost: '450.0000',
  portionSize: '30 g',
  portionProduct: null,
};
const FRACTION = {
  id: 1,
  requestId: 'r-1',
  portions: 7,
  wholeUnitCost: '450.0000',
  portionUnitCost: '64.2857',
  createdAt: '2026-11-07T10:00:00Z',
  product: { id: 10, name: 'Creatina 300 g', stock: 2 },
  portionProduct: { id: 11, name: 'Creatina 300 g · bolsita 30 g', created: true, price: '85.00', stock: 7 },
} as Fraction;

describe('FractionPageComponent · ventana «Fraccionar»', () => {
  let fixture: ComponentFixture<FractionPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  // El diálogo de PrimeNG se monta en body: el contenido ya no cuelga del fixture.
  const el = () => document.body;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = (selector: string, value: string) => {
    const input = el().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const open = async (params: Record<string, string> = { producto: '10' }) => {
    TestBed.configureTestingModule({
      imports: [FractionPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(params) } } },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FractionPageComponent);
    fixture.detectChanges();
    httpMock.expectOne(OPTIONS_URL).flush({ products: [WHOLE] });
    await settle();
  };

  afterEach(() => httpMock.verify());

  it('se muestra como ventana modal con el título «Fraccionar»', async () => {
    await open();
    expect(el().querySelector('[role="dialog"]')).not.toBeNull();
    expect(text()).toContain('Fraccionar');
  });

  it('lee el producto del parámetro matricial y lo deja elegido', async () => {
    await open({ producto: '10' });
    expect(text()).toContain('Se creará la bolsita');
  });

  it('sin parámetro «producto» no hay entero elegido', async () => {
    await open({});
    expect(text()).not.toContain('Se creará la bolsita');
  });

  it('la X cierra la ventana con closeModalLink', async () => {
    await open();
    el().querySelector<HTMLButtonElement>('.p-dialog-close-button')!.click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('Escape cierra la ventana con closeModalLink', async () => {
    await open();
    el().querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('al fraccionar manda portionSize y avisa a StockChangesService', async () => {
    await open();
    type('#portions', '7');
    type('#price', '85.00');
    el().querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    const req = httpMock.expectOne(CREATE_URL);
    expect(req.request.body).toMatchObject({ productId: 10, portions: 7, price: '85.00', portionSize: '30 g' });
    req.flush({ fraction: FRACTION, replayed: false }, { status: 201, statusText: 'Created' });
    await settle();
    expect(TestBed.inject(StockChangesService).version()).toBe(1);
  });
});
