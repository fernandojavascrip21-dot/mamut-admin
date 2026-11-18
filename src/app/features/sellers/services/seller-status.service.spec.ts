import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { ViewingService } from '@core/viewing/viewing.service';
import { SellerChangesService } from './seller-changes.service';
import { SellerStatusService } from './seller-status.service';
import type { EmailStatus, Seller, SellerStatusResult } from '../interfaces/seller.models';

const ID = 'v-1';
const URL = `${API_BASE_URL}/api/sellers/${ID}`;
const SELLER: Seller = {
  id: ID,
  fullName: 'Víctor Vendedor',
  businessName: null,
  email: 'victor@mammut.local',
  phone: '5512345678',
  active: false,
  createdAt: '2026-11-12T18:00:00.000Z',
};

type Action = 'deactivate' | 'reactivate' | 'remove';
const PATHS: Record<Action, string> = { deactivate: `${URL}/deactivate`, reactivate: `${URL}/reactivate`, remove: URL };

describe('SellerStatusService', () => {
  let service: SellerStatusService;
  let httpMock: HttpTestingController;
  let viewing: { reload: ReturnType<typeof vi.fn> };
  let changes: { notify: ReturnType<typeof vi.fn> };
  let results: SellerStatusResult[];

  beforeEach(() => {
    viewing = { reload: vi.fn() };
    changes = { notify: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        SellerStatusService,
        { provide: ViewingService, useValue: viewing },
        { provide: SellerChangesService, useValue: changes },
      ],
    });
    service = TestBed.inject(SellerStatusService);
    httpMock = TestBed.inject(HttpTestingController);
    results = [];
  });

  afterEach(() => httpMock.verify());

  const run = (action: Action) => service[action](ID).subscribe((result) => results.push(result));
  const fail = (action: Action, status: number) =>
    httpMock.expectOne(PATHS[action]).flush({ error: { code: 'x', message: 'Mensaje' } }, { status, statusText: 'Error' });

  describe.each<Action>(['deactivate', 'reactivate'])('%s', (action) => {
    it.each<EmailStatus | null>(['sent', 'failed', 'skipped', null])(
      'con un 200 y emailStatus %s devuelve el vendedor y cómo salió el correo',
      (emailStatus) => {
        run(action);
        httpMock.expectOne(PATHS[action]).flush({ ...SELLER, emailStatus });
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject({ ok: true, emailStatus, seller: SELLER });
      },
    );

    it('un éxito recarga «Viendo» y avisa el cambio', () => {
      run(action);
      httpMock.expectOne(PATHS[action]).flush({ ...SELLER, emailStatus: 'sent' });
      expect(viewing.reload).toHaveBeenCalledTimes(1);
      expect(changes.notify).toHaveBeenCalledTimes(1);
    });
  });

  it('desactivar: un 409 es «has-units» (piezas a su cargo)', () => {
    run('deactivate');
    fail('deactivate', 409);
    expect(results).toEqual([{ ok: false, reason: 'has-units' }]);
  });

  it('eliminar: un 409 es «has-history»', () => {
    run('remove');
    fail('remove', 409);
    expect(results).toEqual([{ ok: false, reason: 'has-history' }]);
  });

  it('eliminar: un 204 devuelve ok sin vendedor ni correo', () => {
    run('remove');
    httpMock.expectOne(PATHS.remove).flush(null, { status: 204, statusText: 'No Content' });
    expect(results).toEqual([{ ok: true, seller: null, emailStatus: null }]);
  });

  it('eliminar recarga «Viendo» pero no avisa el cambio a la ficha', () => {
    run('remove');
    httpMock.expectOne(PATHS.remove).flush(null, { status: 204, statusText: 'No Content' });
    expect(viewing.reload).toHaveBeenCalledTimes(1);
    expect(changes.notify).not.toHaveBeenCalled();
  });

  describe.each<Action>(['deactivate', 'reactivate', 'remove'])('%s con error', (action) => {
    it('un 404 es «not-found»', () => {
      run(action);
      fail(action, 404);
      expect(results).toEqual([{ ok: false, reason: 'not-found' }]);
    });

    it('sin red es «offline»', () => {
      run(action);
      httpMock.expectOne(PATHS[action]).error(new ProgressEvent('error'), { status: 0 });
      expect(results).toEqual([{ ok: false, reason: 'offline' }]);
    });

    it('un 5xx es «offline»', () => {
      run(action);
      fail(action, 500);
      expect(results).toEqual([{ ok: false, reason: 'offline' }]);
    });

    it('un error no recarga «Viendo» ni avisa el cambio', () => {
      run(action);
      fail(action, 404);
      expect(viewing.reload).not.toHaveBeenCalled();
      expect(changes.notify).not.toHaveBeenCalled();
    });
  });
});
