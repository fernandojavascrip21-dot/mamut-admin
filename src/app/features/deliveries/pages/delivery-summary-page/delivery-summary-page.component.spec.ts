import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { Delivery } from '../../interfaces/delivery.models';
import { DeliverySummaryPageComponent } from './delivery-summary-page.component';

const URL = `${API_BASE_URL}/api/deliveries/r-1`;
const DELIVERY: Delivery = {
  requestId: 'r-1',
  createdAt: '2026-10-30T18:21:07.000Z',
  qty: 6,
  seller: { id: 'v-1', fullName: 'Luis Pérez' },
  product: { id: 10, name: 'Proteína Whey 2 lb', image: null, price: '450.00', unitCost: '300.0000' },
  unitPrice: null,
  unitCostWithShipping: null,
  warehouse: { before: 10, after: 4 },
  sellerStock: { before: 0, after: 6 },
};

describe('DeliverySummaryPageComponent', () => {
  let fixture: ComponentFixture<DeliverySummaryPageComponent>;
  let httpMock: HttpTestingController;

  function setup(volver: string | null) {
    TestBed.configureTestingModule({
      imports: [DeliverySummaryPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ requestId: 'r-1' }),
              queryParamMap: convertToParamMap(volver ? { volver } : {}),
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(DeliverySummaryPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  }

  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => httpMock.verify());

  it('mientras carga muestra «Cargando la entrega…»', async () => {
    setup(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando la entrega…');
    httpMock.expectOne(URL).flush(DELIVERY);
    await settle();
  });

  it('pide la entrega por su requestId y muestra su resumen', async () => {
    setup('vendedor');
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(DELIVERY);
    await settle();

    expect(fixture.nativeElement.querySelector('app-delivery-summary')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Le dejaste 6 piezas');
    expect(fixture.nativeElement.querySelector('a.done').getAttribute('href')).toBe('/admin/vendedores/v-1');
    expect(fixture.nativeElement.querySelector('a.another').getAttribute('href')).toBe(
      '/admin/entregas/nueva?volver=vendedor&vendedor=v-1',
    );
  });

  it('con un volver desconocido «Listo» regresa a Productos', async () => {
    setup('https://malo.test');
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(DELIVERY);
    await settle();
    expect(fixture.nativeElement.querySelector('a.done').getAttribute('href')).toBe('/admin/productos');
  });

  it('con un 404 muestra «No encontramos esta entrega»', async () => {
    setup(null);
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({}, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(fixture.nativeElement.textContent).toContain('No encontramos esta entrega');
    expect(fixture.nativeElement.querySelector('.retry')).toBeNull();
  });

  it('si falla la carga muestra el error, y «Reintentar» vuelve a pedirla', async () => {
    setup(null);
    fixture.detectChanges();
    httpMock.expectOne(URL).error(new ProgressEvent('error'));
    await settle();
    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar la entrega');

    (fixture.nativeElement.querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(DELIVERY);
    await settle();
    expect(fixture.nativeElement.querySelector('app-delivery-summary')).not.toBeNull();
  });
});
