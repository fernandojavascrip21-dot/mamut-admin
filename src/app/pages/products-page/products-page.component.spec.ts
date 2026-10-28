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

  // rxResource aplica la respuesta en una microtarea: hay que esperar antes de volver a pintar.
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function cargar(productos: ProductoResumen[]) {
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).flush(productos);
    await settle();
  }

  function buscar(texto: string) {
    const input = fixture.nativeElement.querySelector('#buscador') as HTMLInputElement;
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('mientras carga muestra "Cargando productos…" y tarjetas esqueleto', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando productos…');
    expect(fixture.nativeElement.querySelectorAll('app-producto-card-skeleton')).toHaveLength(3);
    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTOS);
  });

  it('pinta una tarjeta por producto', async () => {
    await cargar(PRODUCTOS);

    expect(fixture.nativeElement.querySelectorAll('app-producto-card')).toHaveLength(2);
  });

  it('con 0 productos muestra el estado vacío con el botón de alta', async () => {
    await cargar([]);

    expect(fixture.nativeElement.textContent).toContain('Aún no tienes productos');
    const enlaces = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(enlaces.some((a) => a.textContent?.includes('Dar de alta mi primer producto'))).toBe(true);
    expect(fixture.nativeElement.querySelector('#buscador')).toBeNull();
  });

  it('filtrar con "CBUM" y con "cbúm" deja solo el que coincide, sin importar mayúsculas ni acentos', async () => {
    await cargar(PRODUCTOS);

    buscar('CBUM');
    expect(fixture.nativeElement.querySelectorAll('app-producto-card')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('CBUM Thavage');
    expect(fixture.nativeElement.textContent).not.toContain('Creatina');

    buscar('cbúm');
    expect(fixture.nativeElement.querySelectorAll('app-producto-card')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('CBUM Thavage');
  });

  it('sin coincidencias muestra el aviso y "Limpiar búsqueda" restaura la lista completa', async () => {
    await cargar(PRODUCTOS);

    buscar('no existe');
    expect(fixture.nativeElement.textContent).toContain('No hay productos con ese nombre');
    expect(fixture.nativeElement.querySelectorAll('app-producto-card')).toHaveLength(0);

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#buscador').value).toBe('');
    expect(fixture.nativeElement.querySelectorAll('app-producto-card')).toHaveLength(2);
  });

  it('si la petición falla muestra "Reintentar", y al tocarlo vuelve a pedir la lista', async () => {
    fixture.detectChanges();
    httpMock.expectOne(PRODUCTS_URL).error(new ProgressEvent('error'));
    await settle();

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los productos');

    (fixture.nativeElement.querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cargando productos…');
    httpMock.expectOne(PRODUCTS_URL).flush(PRODUCTOS);
    await settle();

    expect(fixture.nativeElement.querySelectorAll('app-producto-card')).toHaveLength(2);
  });
});
