import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { ProductSaveService } from './product-save.service';
import { ProductPhotosService } from './product-photos.service';
import { API_BASE_URL } from '@core/api-base-url';
import type { Product, ProductFormValue, SaveResult } from '../interfaces/product.models';

const PRODUCTS_URL = `${API_BASE_URL}/api/products`;
const PRODUCT: Product = {
  id: 1, name: 'Creatina', categoryId: 7, stock: 10, active: true, price: '200.00',
  unitCost: '100.00', fractionable: false, portionSize: null, image: 'https://cdn.test/old.png',
};
const VALUE: ProductFormValue = {
  name: 'Creatina', categoryId: 7, price: '200', unitCost: '100', units: 10,
  fractionable: false, portionSize: null, photo: null, removePhoto: false,
};

describe('ProductSaveService', () => {
  let service: ProductSaveService;
  let httpMock: HttpTestingController;
  let uploadPhoto: ReturnType<typeof vi.fn>;
  let results: SaveResult[];

  beforeEach(() => {
    uploadPhoto = vi.fn().mockReturnValue(of('https://cdn.test/new.png'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), ProductSaveService,
        { provide: ProductPhotosService, useValue: { upload: uploadPhoto } },
      ],
    });
    service = TestBed.inject(ProductSaveService);
    httpMock = TestBed.inject(HttpTestingController);
    results = [];
  });

  afterEach(() => httpMock.verify());

  const collect = (result: SaveResult) => results.push(result);
  const photo = () => new File(['x'], 'foto.png', { type: 'image/png' });

  describe('create', () => {
    it('sin foto manda image null y las piezas como initialQty', () => {
      service.create(VALUE).subscribe(collect);
      const req = httpMock.expectOne(PRODUCTS_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        name: 'Creatina', categoryId: 7, price: '200', unitCost: '100', initialQty: 10,
        fractionable: false, portionSize: null, image: null,
      });
      req.flush(PRODUCT);
      expect(uploadPhoto).not.toHaveBeenCalled();
      expect(results).toEqual([{ ok: true, product: PRODUCT }]);
    });

    it('con foto la sube primero y manda su URL', () => {
      service.create({ ...VALUE, photo: photo() }).subscribe(collect);
      const req = httpMock.expectOne(PRODUCTS_URL);
      expect(req.request.body.image).toBe('https://cdn.test/new.png');
      req.flush(PRODUCT);
      expect(uploadPhoto).toHaveBeenCalledTimes(1);
    });

    it('Reintentar con la misma foto no la vuelve a subir; reset() sí la olvida', () => {
      const value = { ...VALUE, photo: photo() };
      service.create(value).subscribe(collect);
      httpMock.expectOne(PRODUCTS_URL).error(new ProgressEvent('error'));
      expect(results).toEqual([{ ok: false, reason: 'offline' }]);

      service.create(value).subscribe(collect);
      expect(httpMock.expectOne(PRODUCTS_URL).request.body.image).toBe('https://cdn.test/new.png');
      expect(uploadPhoto).toHaveBeenCalledTimes(1);

      service.reset();
      service.create(value).subscribe(collect);
      httpMock.expectOne(PRODUCTS_URL).flush(PRODUCT);
      expect(uploadPhoto).toHaveBeenCalledTimes(2);
    });

    it('si falla la subida de la foto, es offline y no llama a crear', () => {
      uploadPhoto.mockReturnValue(throwError(() => new Error('forbidden')));
      service.create({ ...VALUE, photo: photo() }).subscribe(collect);
      httpMock.expectNone(PRODUCTS_URL);
      expect(results).toEqual([{ ok: false, reason: 'offline' }]);
    });

    it.each<[number, string]>([
      [409, 'duplicate-name'],
      [422, 'category-missing'],
      [404, 'offline'],
      [500, 'offline'],
      [0, 'offline'],
    ])('un %s se traduce a %s', (status, reason) => {
      service.create(VALUE).subscribe(collect);
      const req = httpMock.expectOne(PRODUCTS_URL);
      if (status === 0) req.error(new ProgressEvent('error'));
      else req.flush({}, { status, statusText: 'x' });
      expect(results).toEqual([{ ok: false, reason }]);
    });
  });

  describe('update', () => {
    const url = `${PRODUCTS_URL}/1`;

    it('con la foto igual manda la que ya tenía, sin piezas', () => {
      service.update(PRODUCT, VALUE).subscribe(collect);
      const req = httpMock.expectOne(url);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({
        name: 'Creatina', categoryId: 7, price: '200', unitCost: '100',
        fractionable: false, portionSize: null, image: PRODUCT.image,
      });
      req.flush(PRODUCT);
      expect(results).toEqual([{ ok: true, product: PRODUCT }]);
    });

    it('con foto nueva la sube una vez, aun tras Reintentar', () => {
      const value = { ...VALUE, photo: photo() };
      service.update(PRODUCT, value).subscribe(collect);
      httpMock.expectOne(url).error(new ProgressEvent('error'));
      service.update(PRODUCT, value).subscribe(collect);
      const retry = httpMock.expectOne(url);
      expect(retry.request.body.image).toBe('https://cdn.test/new.png');
      retry.flush(PRODUCT);
      expect(uploadPhoto).toHaveBeenCalledTimes(1);
    });

    it('con la foto quitada manda image vacío sin subir nada', () => {
      service.update(PRODUCT, { ...VALUE, removePhoto: true }).subscribe(collect);
      expect(httpMock.expectOne(url).request.body.image).toBe('');
      expect(uploadPhoto).not.toHaveBeenCalled();
    });

    it('un 404 es «no disponible»', () => {
      service.update(PRODUCT, VALUE).subscribe(collect);
      httpMock.expectOne(url).flush({}, { status: 404, statusText: 'Not Found' });
      expect(results).toEqual([{ ok: false, reason: 'not-found' }]);
    });
  });
});
