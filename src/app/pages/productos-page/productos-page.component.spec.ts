import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProductosPageComponent } from './productos-page.component';
import { API_BASE_URL } from '../../shared/api-base-url';
import type { ProductoResumen } from '../../productos/interfaces/producto.models';

const PRODUCTS_URL = `${API_BASE_URL}/api/products`;

const PRODUCTOS: ProductoResumen[] = [
  { id: 1, name: 'CBUM Thavage', categoryId: null, price: '450.00', stock: 10, fractionable: false, image: '' },
  { id: 2, name: 'Creatina', categoryId: null, price: '300.00', stock: 0, fractionable: true, image: '' },
];

describe('ProductosPageComponent', () => {
  let fixture: ComponentFixture<ProductosPageComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductosPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductosPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('mientras carga muestra "Cargando productos…" y tarjetas esqueleto', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando productos…');
    expect(fixture.nativeElement.querySelectorAll('app-producto-card-skeleton')).toHaveLength(3);
    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTOS);
  });

  it('pinta una tarjeta por producto', () => {
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTOS);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('app-producto-card')).toHaveLength(2);
  });

  it('con 0 productos muestra el estado vacío con el botón de alta', () => {
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Aún no tienes productos');
    const enlaces = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(enlaces.some((a) => a.textContent?.includes('Dar de alta mi primer producto'))).toBe(true);
  });

  it('si la petición falla muestra "Reintentar", y al tocarlo vuelve a pedir la lista', () => {
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los productos');

    (fixture.nativeElement.querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cargando productos…');
    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTOS);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('app-producto-card')).toHaveLength(2);
  });
});
