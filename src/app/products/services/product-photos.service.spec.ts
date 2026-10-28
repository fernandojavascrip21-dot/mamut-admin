import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProductoFotosService } from './producto-fotos.service';
import { API_BASE_URL } from '../../shared/api-base-url';

const PHOTO_URL = `${API_BASE_URL}/api/products/photo`;

describe('ProductoFotosService', () => {
  let service: ProductoFotosService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProductoFotosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('manda el archivo como multipart/form-data y devuelve la URL pública', async () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' });

    const promise = new Promise<string>((resolve, reject) => {
      service.subir(file).subscribe({ next: resolve, error: reject });
    });

    const req = httpMock.expectOne(PHOTO_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('file')).toBe(file);

    req.flush({ url: 'https://cdn.test/product-photos/foto.png' });

    expect(await promise).toBe('https://cdn.test/product-photos/foto.png');
  });
});
