import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, UrlTree, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BehaviorSubject, Subject } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { SellerDetailPageComponent } from './seller-detail-page.component';
import type { EmailStatus, SellerDetail } from '../../interfaces/seller.models';

const ID = '3f2c8a1e-0000-4000-8000-000000000001';
const SELLER_URL = `${API_BASE_URL}/api/sellers/${ID}`;
const GET_URL = `${SELLER_URL}?status=any`;

const INACTIVE: SellerDetail = {
  id: ID,
  fullName: 'Víctor Vendedor',
  businessName: 'Gimnasio Fuerza Norte',
  email: 'victor@mammut.local',
  phone: '5512345678',
  active: false,
  createdAt: '2026-11-12T18:00:00.000Z',
  units: 0,
  stock: [],
};
const ACTIVE: SellerDetail = { ...INACTIVE, active: true };

describe('SellerDetailPageComponent: vendedor desactivado (HU-44)', () => {
  let fixture: ComponentFixture<SellerDetailPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let toast: ToastService;
  let viewing: { picked: Subject<string | null>; select: ReturnType<typeof vi.fn>; reload: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    viewing = { picked: new Subject<string | null>(), select: vi.fn(), reload: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [SellerDetailPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: ID }) },
            paramMap: new BehaviorSubject(convertToParamMap({ id: ID })).asObservable(),
          },
        },
        { provide: ViewingService, useValue: viewing },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    vi.spyOn(toast, 'warn');
    fixture = TestBed.createComponent(SellerDetailPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  // Vacía lo pendiente en lugar de verify(): un fallo aquí dejaría roto el TestBed de las pruebas siguientes.
  afterEach(() => httpMock.match(() => true));

  async function tick() {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }
  const text = () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button, a')) as HTMLElement[];
  const control = (label: string) => buttons().find((b) => b.textContent!.trim() === label) as HTMLButtonElement | undefined;
  const navigatedTo = () =>
    vi.mocked(router.navigateByUrl).mock.calls.map(([target]) =>
      target instanceof UrlTree ? router.serializeUrl(target) : target,
    );

  async function loadInactive() {
    fixture.detectChanges();
    httpMock.expectOne(GET_URL).flush(INACTIVE);
    await tick();
  }

  // Vendedor activo cargado con sus tres historiales vacíos.
  async function flushActive() {
    httpMock.expectOne(GET_URL).flush(ACTIVE);
    await tick();
    httpMock.expectOne(`${SELLER_URL}/deliveries`).flush([]);
    httpMock.expectOne(`${SELLER_URL}/returns`).flush([]);
    httpMock.expectOne(`${SELLER_URL}/shrinkages`).flush([]);
    await tick();
  }

  describe('la ficha de un desactivado', () => {
    it('se pide con ?status=any', async () => {
      fixture.detectChanges();
      const req = httpMock.expectOne(GET_URL);
      expect(req.request.method).toBe('GET');
      req.flush(INACTIVE);
      await tick();
    });

    it('conserva la cabecera: iniciales, nombre, «Desactivado», negocio, teléfono, correo y alta', async () => {
      await loadInactive();
      expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Víctor Vendedor');
      expect(fixture.nativeElement.querySelector('p-tag').textContent.trim()).toBe('Desactivado');
      expect(fixture.nativeElement.querySelector('.business').textContent.trim()).toBe('Gimnasio Fuerza Norte');
      expect(fixture.nativeElement.querySelector('.phone').textContent.trim()).toBe('55 1234 5678');
      expect(text()).toContain('victor@mammut.local');
      expect(text()).toContain('Alta 12/11/2026');
    });

    it('tiene «Reactivar» y «Editar datos», y no «Dejar producto» ni «Retirar producto»', async () => {
      await loadInactive();
      expect(control('Reactivar')).toBeDefined();
      expect(control('Editar datos')).toBeDefined();
      expect(control('Dejar producto')).toBeUndefined();
      expect(control('Retirar producto')).toBeUndefined();
    });

    it('en lugar del grid muestra el aviso «Está desactivado»', async () => {
      await loadInactive();
      expect(fixture.nativeElement.querySelector('app-data-grid')).toBeNull();
      expect(text()).toContain('Está desactivado');
      expect(text()).toContain(
        'No puede entrar a la app ni recibir producto. Sus ventas y cortes se conservan. Reactívalo para dejarle producto o ver sus movimientos.',
      );
    });

    it('no pide entregas, retiros ni mermas', async () => {
      await loadInactive();
      httpMock.expectNone(`${SELLER_URL}/deliveries`);
      httpMock.expectNone(`${SELLER_URL}/returns`);
      httpMock.expectNone(`${SELLER_URL}/shrinkages`);
    });

    it('«‹ Vendedores» lleva a /admin/vendedores?estado=desactivados', async () => {
      await loadInactive();
      const back = control('‹ Vendedores') as unknown as HTMLAnchorElement;
      expect(back.getAttribute('href')).toBe('/admin/vendedores?estado=desactivados');
    });

    it('no lo fija en «Viendo»: llama a viewing.select(null)', async () => {
      await loadInactive();
      expect(viewing.select).toHaveBeenCalledWith(null);
      expect(viewing.select).not.toHaveBeenCalledWith(ID);
    });
  });

  describe('la ficha de un activo', () => {
    it('«‹ Vendedores» lleva a la lista de activos y lo fija en «Viendo»', async () => {
      fixture.detectChanges();
      await flushActive();
      const back = control('‹ Vendedores') as unknown as HTMLAnchorElement;
      expect(back.getAttribute('href')).toBe('/admin/vendedores');
      expect(viewing.select).toHaveBeenCalledWith(ID);
      expect(control('Reactivar')).toBeUndefined();
    });
  });

  describe('«Reactivar»', () => {
    const click = async () => {
      control('Reactivar')!.click();
      fixture.detectChanges();
    };

    it('manda POST /reactivate y mientras responde dice «Reactivando…», deshabilitado y sin segundo envío', async () => {
      await loadInactive();
      await click();
      control('Reactivando…')!.click();
      const pending = httpMock.match(`${SELLER_URL}/reactivate`);
      expect(pending).toHaveLength(1);
      expect(pending[0]!.request.method).toBe('POST');
      expect((control('Reactivando…') as HTMLButtonElement).disabled).toBe(true);
      pending[0]!.flush({ ...ACTIVE, emailStatus: null });
      await tick();
      httpMock.expectOne(GET_URL).flush(ACTIVE);
      await tick();
      httpMock.match(`${SELLER_URL}/deliveries`).forEach((req) => req.flush([]));
      httpMock.match(`${SELLER_URL}/returns`).forEach((req) => req.flush([]));
      httpMock.match(`${SELLER_URL}/shrinkages`).forEach((req) => req.flush([]));
    });

    it('con 200 avisa «reactivado», recarga «Viendo» y la ficha, sin pasar por «cargando», y queda activa', async () => {
      await loadInactive();
      await click();
      httpMock.expectOne(`${SELLER_URL}/reactivate`).flush({ ...ACTIVE, emailStatus: 'sent' });
      await tick();

      expect(toast.success).toHaveBeenCalledWith('«Víctor Vendedor» reactivado');
      expect(viewing.reload).toHaveBeenCalledTimes(1);
      const reload = httpMock.expectOne(GET_URL);
      expect(text()).not.toContain('Cargando vendedor…');
      expect(text()).toContain('Víctor Vendedor');
      reload.flush(ACTIVE);
      await tick();
      httpMock.expectOne(`${SELLER_URL}/deliveries`).flush([]);
      httpMock.expectOne(`${SELLER_URL}/returns`).flush([]);
      httpMock.expectOne(`${SELLER_URL}/shrinkages`).flush([]);
      await tick();

      expect(control('Dejar producto')).toBeDefined();
      expect(control('Reactivar')).toBeUndefined();
      expect(fixture.nativeElement.querySelector('app-data-grid')).not.toBeNull();
      expect(viewing.select).toHaveBeenCalledWith(ID);
    });

    it.each<EmailStatus>(['failed', 'skipped'])(
      'con emailStatus «%s» suma el aviso «Se reactivó, pero no se pudo avisarle por correo»',
      async (emailStatus) => {
        await loadInactive();
        await click();
        httpMock.expectOne(`${SELLER_URL}/reactivate`).flush({ ...ACTIVE, emailStatus });
        await tick();
        expect(toast.success).toHaveBeenCalledWith('«Víctor Vendedor» reactivado');
        expect(toast.warn).toHaveBeenCalledWith('Se reactivó, pero no se pudo avisarle por correo');
        httpMock.expectOne(GET_URL).flush(ACTIVE);
        await tick();
        httpMock.match(`${SELLER_URL}/deliveries`).forEach((req) => req.flush([]));
        httpMock.match(`${SELLER_URL}/returns`).forEach((req) => req.flush([]));
        httpMock.match(`${SELLER_URL}/shrinkages`).forEach((req) => req.flush([]));
      },
    );

    it.each<EmailStatus | null>(['sent', null])('con emailStatus %s no avisa del correo', async (emailStatus) => {
      await loadInactive();
      await click();
      httpMock.expectOne(`${SELLER_URL}/reactivate`).flush({ ...ACTIVE, emailStatus });
      await tick();
      expect(toast.warn).not.toHaveBeenCalled();
      httpMock.expectOne(GET_URL).flush(ACTIVE);
      await tick();
      httpMock.match(`${SELLER_URL}/deliveries`).forEach((req) => req.flush([]));
      httpMock.match(`${SELLER_URL}/returns`).forEach((req) => req.flush([]));
      httpMock.match(`${SELLER_URL}/shrinkages`).forEach((req) => req.flush([]));
    });

    it('con 404 avisa «Este vendedor ya no está disponible» y va a «Mis vendedores»', async () => {
      await loadInactive();
      await click();
      httpMock.expectOne(`${SELLER_URL}/reactivate`).flush({}, { status: 404, statusText: 'Not Found' });
      await tick();
      expect(toast.error).toHaveBeenCalledWith('Este vendedor ya no está disponible');
      expect(navigatedTo()).toContain('/admin/vendedores');
      expect(toast.success).not.toHaveBeenCalled();
    });

    it.each([0, 500])('con fallo %i avisa que no se pudo reactivar y el botón vuelve a estar activo', async (status) => {
      await loadInactive();
      await click();
      const req = httpMock.expectOne(`${SELLER_URL}/reactivate`);
      if (status === 0) req.error(new ProgressEvent('error'), { status });
      else req.flush({}, { status, statusText: 'Error' });
      await tick();
      expect(toast.error).toHaveBeenCalledWith('No se pudo reactivar. Revisa tu conexión e inténtalo de nuevo.');
      const retry = control('Reactivar') as HTMLButtonElement;
      expect(retry.disabled).toBe(false);
      expect(viewing.reload).not.toHaveBeenCalled();
      expect(text()).toContain('Está desactivado');
    });
  });
});
