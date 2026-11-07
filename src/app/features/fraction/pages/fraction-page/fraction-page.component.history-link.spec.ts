import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
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

describe('FractionPageComponent · enlace «Ver fraccionados» (HU-24)', () => {
  let fixture: ComponentFixture<FractionPageComponent>;
  let httpMock: HttpTestingController;

  // El diálogo de PrimeNG se monta en body.
  const historyLinks = () =>
    Array.from(document.body.querySelectorAll('a')).filter((a) => a.textContent!.trim() === 'Ver fraccionados');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const type = (selector: string, value: string) => {
    const input = document.body.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [FractionPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ producto: '10' }) } } },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FractionPageComponent);
    fixture.detectChanges();
    httpMock.expectOne(OPTIONS_URL).flush({ products: [WHOLE] });
    await settle();
  });

  afterEach(() => httpMock.verify());

  it('el formulario trae un solo enlace «Ver fraccionados» hacia /admin/fraccionados', () => {
    expect(historyLinks()).toHaveLength(1);
    expect(historyLinks()[0]!.getAttribute('href')).toBe('/admin/fraccionados');
  });

  it('el resultado también trae el enlace «Ver fraccionados» hacia /admin/fraccionados', async () => {
    type('#portions', '7');
    type('#price', '85.00');
    document.body.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    httpMock.expectOne(CREATE_URL).flush({ fraction: FRACTION, replayed: false }, { status: 201, statusText: 'Created' });
    await settle();
    expect(document.body.querySelector('form')).toBeNull();
    expect(historyLinks()).toHaveLength(1);
    expect(historyLinks()[0]!.getAttribute('href')).toBe('/admin/fraccionados');
  });
});
