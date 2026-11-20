import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { ConfirmService } from '@core/confirm/confirm.service';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { closeModalLink, returnModalLink } from '@shared/utils/modal-links';
import { SellerChangesService } from '../../services/seller-changes.service';
import { EditSellerPageComponent } from './edit-seller-page.component';
import type { EmailStatus, SellerDetail } from '../../interfaces/seller.models';

const ID = '3f2c8a1e-0000-4000-8000-000000000001';
const URL = `${API_BASE_URL}/api/sellers/${ID}`;
const GET_URL = `${URL}?status=any`;
const ACTIVE: SellerDetail = {
  id: ID,
  fullName: 'Víctor Vendedor',
  businessName: 'Gimnasio Fuerza Norte',
  email: 'victor@mammut.local',
  phone: '5512345678',
  active: true,
  createdAt: '2026-11-12T18:00:00.000Z',
  units: 0,
  stock: [],
};
const INACTIVE: SellerDetail = { ...ACTIVE, active: false };

const DEACTIVATE_MESSAGE =
  'Ya no podrá entrar a la app ni aparecerá en «Viendo» ni en «Dejar». Sus ventas y cortes se conservan, puedes reactivarlo cuando quieras y le mandaremos un aviso por correo.';
const REMOVE_MESSAGE =
  'Se eliminará a Víctor Vendedor. Si tiene historial, solo se archiva: sus ventas y cortes se conservan, no podrá recuperarse desde la app y su correo quedará libre para un alta nueva.';
const UNSAVED_LINE = 'Los cambios sin guardar se pierden.';

describe('EditSellerPageComponent: estado del vendedor (HU-44)', () => {
  let fixture: ComponentFixture<EditSellerPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let toast: ToastService;
  let confirm: ConfirmService;
  let changes: SellerChangesService;
  let viewing: { reload: ReturnType<typeof vi.fn> };

  function setup() {
    viewing = { reload: vi.fn() };
    TestBed.configureTestingModule({
      imports: [EditSellerPageComponent],
      providers: [
        MessageService,
        ConfirmationService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ sellerId: ID }) } } },
        { provide: ViewingService, useValue: viewing },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    vi.spyOn(toast, 'warn');
    confirm = TestBed.inject(ConfirmService);
    vi.spyOn(confirm, 'ask').mockResolvedValue(true);
    changes = TestBed.inject(SellerChangesService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EditSellerPageComponent);
  }

  const el = () => document.body;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  // Deja correr las promesas (la confirmación) sin esperar a peticiones abiertas.
  async function tick() {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement;
  function type(label: string, value: string) {
    const labelEl = Array.from(el().querySelectorAll('label')).find((l) => l.textContent?.trim() === label);
    const input = el().querySelector(`#${labelEl!.htmlFor}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  async function open(seller: SellerDetail) {
    setup();
    fixture.detectChanges();
    httpMock.expectOne(GET_URL).flush(seller);
    await settle();
  }
  // Pulsa un botón de estado y deja pasar la confirmación; deja la petición abierta.
  async function press(label: string) {
    button(label).click();
    fixture.detectChanges();
    await tick();
  }
  const fail = (path: string, status: number) =>
    httpMock.expectOne(`${URL}${path}`).flush({ error: { code: 'x', message: 'Mensaje' } }, { status, statusText: 'Error' });
  const askedWith = () => vi.mocked(confirm.ask).mock.calls[0]![0];
  // Dirección de cada navegación pedida, sea con navigate o con navigateByUrl.
  const visited = (): string[] => [
    ...vi.mocked(router.navigate).mock.calls.map(([commands, extras]) =>
      router.serializeUrl(router.createUrlTree(commands, extras)),
    ),
    ...vi.mocked(router.navigateByUrl).mock.calls.map(([target]) =>
      typeof target === 'string' ? target : router.serializeUrl(target),
    ),
  ];

  afterEach(() => {
    httpMock.match(() => true);
    document.body.querySelectorAll('.p-dialog-mask, p-dialog').forEach((node) => node.remove());
  });

  describe('carga', () => {
    it('pide el vendedor con ?status=any y abre también a un desactivado', async () => {
      await open(INACTIVE);
      expect(text()).toContain('Estado del vendedor');
      expect(button('Reactivar vendedor')).toBeDefined();
      expect(button('Desactivar vendedor')).toBeUndefined();
      expect(button('Eliminar vendedor')).toBeDefined();
    });

    it('con un activo muestra «Desactivar vendedor» y «Eliminar vendedor» bajo los botones del formulario', async () => {
      await open(ACTIVE);
      expect(button('Desactivar vendedor')).toBeDefined();
      expect(button('Reactivar vendedor')).toBeUndefined();
      expect(button('Guardar cambios')).toBeDefined();
    });
  });

  describe('desactivar', () => {
    it('pide confirmación con su título, mensaje y botones', async () => {
      await open(ACTIVE);
      await press('Desactivar vendedor');
      expect(confirm.ask).toHaveBeenCalledTimes(1);
      expect(askedWith()).toMatchObject({
        title: '¿Desactivar a «Víctor Vendedor»?',
        confirmLabel: 'Desactivar',
        cancelLabel: 'Cancelar',
      });
      expect(askedWith().message).toContain(DEACTIVATE_MESSAGE);
      expect(askedWith().message).not.toContain(UNSAVED_LINE);
    });

    it('con cambios sin guardar el mensaje suma «Los cambios sin guardar se pierden.»', async () => {
      await open(ACTIVE);
      type('Nombre', 'Otro nombre');
      await press('Desactivar vendedor');
      expect(askedWith().message).toContain(DEACTIVATE_MESSAGE);
      expect(askedWith().message).toContain(UNSAVED_LINE);
    });

    it('si cancela la confirmación no manda ninguna petición', async () => {
      await open(ACTIVE);
      vi.mocked(confirm.ask).mockResolvedValue(false);
      await press('Desactivar vendedor');
      httpMock.expectNone(`${URL}/deactivate`);
      expect(toast.success).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('con 200 avisa «desactivado», recarga «Viendo», notifica, cierra sin preguntar y no deja cambios pendientes', async () => {
      await open(ACTIVE);
      type('Nombre', 'Otro nombre');
      const before = changes.version();
      await press('Desactivar vendedor');
      const req = httpMock.expectOne(`${URL}/deactivate`);
      expect(req.request.method).toBe('POST');
      req.flush({ ...INACTIVE, emailStatus: 'sent' });
      await settle();

      expect(toast.success).toHaveBeenCalledWith('«Víctor Vendedor» desactivado');
      expect(toast.warn).not.toHaveBeenCalled();
      expect(viewing.reload).toHaveBeenCalledTimes(1);
      expect(changes.version()).toBe(before + 1);
      expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
      expect(confirm.ask).toHaveBeenCalledTimes(1);
    });

    it.each<EmailStatus>(['failed', 'skipped'])(
      'con emailStatus «%s» suma «Se desactivó, pero no se pudo avisarle por correo»',
      async (emailStatus) => {
        await open(ACTIVE);
        await press('Desactivar vendedor');
        httpMock.expectOne(`${URL}/deactivate`).flush({ ...INACTIVE, emailStatus });
        await settle();
        expect(toast.success).toHaveBeenCalledWith('«Víctor Vendedor» desactivado');
        expect(toast.warn).toHaveBeenCalledWith('Se desactivó, pero no se pudo avisarle por correo');
      },
    );

    it('con 409 (piezas a su cargo) muestra la alerta con «Retirar producto» y no cambia nada', async () => {
      await open(ACTIVE);
      await press('Desactivar vendedor');
      fail('/deactivate', 409);
      await settle();

      const alert = el().querySelector('[role="alert"].alert-warning') as HTMLElement;
      expect(alert.textContent).toContain('Retírale sus piezas antes de desactivarlo');
      expect(button('Retirar producto')).toBeDefined();
      expect(viewing.reload).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('«Retirar producto» abre el pop-up de retiro del vendedor', async () => {
      await open(ACTIVE);
      await press('Desactivar vendedor');
      fail('/deactivate', 409);
      await settle();
      button('Retirar producto').click();
      expect(router.navigate).toHaveBeenCalledWith(returnModalLink(ID));
    });

    it('la alerta de 409 se quita al empezar otra acción', async () => {
      await open(ACTIVE);
      await press('Desactivar vendedor');
      fail('/deactivate', 409);
      await settle();
      await press('Desactivar vendedor');
      expect(text()).not.toContain('Retírale sus piezas antes de desactivarlo');
      httpMock.expectOne(`${URL}/deactivate`).flush({ ...INACTIVE, emailStatus: null });
      await settle();
    });

    it('la alerta de 409 se quita al guardar el formulario', async () => {
      await open(ACTIVE);
      await press('Desactivar vendedor');
      fail('/deactivate', 409);
      await settle();
      type('Nombre', 'Otro nombre');
      el().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      fixture.detectChanges();
      expect(text()).not.toContain('Retírale sus piezas antes de desactivarlo');
      httpMock.expectOne(URL).flush({ ...ACTIVE, fullName: 'Otro nombre' });
      await settle();
    });

    it('con 404 avisa «Este vendedor ya no está disponible» y cierra', async () => {
      await open(ACTIVE);
      await press('Desactivar vendedor');
      fail('/deactivate', 404);
      await settle();
      expect(toast.error).toHaveBeenCalledWith('Este vendedor ya no está disponible');
      expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
    });

    it.each([0, 500])('con fallo %i avisa que no se pudo desactivar y el pop-up sigue abierto', async (status) => {
      await open(ACTIVE);
      await press('Desactivar vendedor');
      const req = httpMock.expectOne(`${URL}/deactivate`);
      if (status === 0) req.error(new ProgressEvent('error'), { status });
      else req.flush({}, { status, statusText: 'Error' });
      await settle();
      expect(toast.error).toHaveBeenCalledWith('No se pudo desactivar. Revisa tu conexión e inténtalo de nuevo.');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(button('Desactivar vendedor').disabled).toBe(false);
      expect(viewing.reload).not.toHaveBeenCalled();
    });
  });

  describe('reactivar', () => {
    it('no pide confirmación: manda POST /reactivate, avisa «reactivado», recarga, notifica y cierra sin preguntar', async () => {
      await open(INACTIVE);
      type('Nombre', 'Otro nombre');
      const before = changes.version();
      await press('Reactivar vendedor');
      expect(confirm.ask).not.toHaveBeenCalled();
      const req = httpMock.expectOne(`${URL}/reactivate`);
      expect(req.request.method).toBe('POST');
      req.flush({ ...ACTIVE, emailStatus: 'sent' });
      await settle();

      expect(toast.success).toHaveBeenCalledWith('«Víctor Vendedor» reactivado');
      expect(viewing.reload).toHaveBeenCalledTimes(1);
      expect(changes.version()).toBe(before + 1);
      expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it.each<EmailStatus>(['failed', 'skipped'])(
      'con emailStatus «%s» suma «Se reactivó, pero no se pudo avisarle por correo»',
      async (emailStatus) => {
        await open(INACTIVE);
        await press('Reactivar vendedor');
        httpMock.expectOne(`${URL}/reactivate`).flush({ ...ACTIVE, emailStatus });
        await settle();
        expect(toast.warn).toHaveBeenCalledWith('Se reactivó, pero no se pudo avisarle por correo');
      },
    );

    it('con 404 avisa «Este vendedor ya no está disponible» y cierra', async () => {
      await open(INACTIVE);
      await press('Reactivar vendedor');
      fail('/reactivate', 404);
      await settle();
      expect(toast.error).toHaveBeenCalledWith('Este vendedor ya no está disponible');
      expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
    });

    it('sin red avisa que no se pudo reactivar y el pop-up sigue abierto', async () => {
      await open(INACTIVE);
      await press('Reactivar vendedor');
      httpMock.expectOne(`${URL}/reactivate`).error(new ProgressEvent('error'), { status: 0 });
      await settle();
      expect(toast.error).toHaveBeenCalledWith('No se pudo reactivar. Revisa tu conexión e inténtalo de nuevo.');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(button('Reactivar vendedor').disabled).toBe(false);
    });
  });

  describe('eliminar', () => {
    it('pide confirmación de peligro con su título, mensaje y botones', async () => {
      await open(ACTIVE);
      await press('Eliminar vendedor');
      expect(askedWith()).toMatchObject({
        title: '¿Eliminar a «Víctor Vendedor»?',
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      });
      expect(askedWith().message).toContain(REMOVE_MESSAGE);
      expect(askedWith().message).not.toContain(UNSAVED_LINE);
      httpMock.expectOne(URL).flush(null, { status: 204, statusText: 'No Content' });
      await settle();
    });

    it('con cambios sin guardar suma «Los cambios sin guardar se pierden.»', async () => {
      await open(ACTIVE);
      type('Nombre', 'Otro nombre');
      await press('Eliminar vendedor');
      expect(askedWith().message).toContain(UNSAVED_LINE);
      httpMock.expectOne(URL).flush(null, { status: 204, statusText: 'No Content' });
      await settle();
    });

    it('si cancela no manda ninguna petición', async () => {
      await open(ACTIVE);
      vi.mocked(confirm.ask).mockResolvedValue(false);
      await press('Eliminar vendedor');
      httpMock.expectNone(URL);
    });

    it('con 204 de un activo avisa «eliminado», recarga «Viendo» sin notificar y va a «Mis vendedores» en una sola navegación', async () => {
      await open(ACTIVE);
      const before = changes.version();
      await press('Eliminar vendedor');
      const req = httpMock.expectOne(URL);
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(toast.success).toHaveBeenCalledWith('«Víctor Vendedor» eliminado');
      expect(viewing.reload).toHaveBeenCalledTimes(1);
      expect(changes.version()).toBe(before);
      expect(visited()).toEqual(['/admin/vendedores']);
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('con 204 de un desactivado vuelve a «Mis vendedores» con ?estado=desactivados', async () => {
      await open(INACTIVE);
      await press('Eliminar vendedor');
      httpMock.expectOne(URL).flush(null, { status: 204, statusText: 'No Content' });
      await settle();
      expect(visited()).toEqual(['/admin/vendedores?estado=desactivados']);
    });

    it('con 409 (piezas a su cargo) muestra la alerta con «Retirar producto», sin «Tiene historial», y no cierra', async () => {
      await open(ACTIVE);
      await press('Eliminar vendedor');
      fail('', 409);
      await settle();
      const alert = el().querySelector('[role="alert"].alert-warning') as HTMLElement;
      expect(alert.textContent).toContain('Retírale sus piezas antes de desactivarlo');
      expect(alert.textContent).not.toContain('Tiene historial');
      expect(button('Retirar producto')).toBeDefined();
      expect(visited()).toEqual([]);
      expect(viewing.reload).not.toHaveBeenCalled();
    });

    it('con 409 de carrera (movimientos recién aparecidos) muestra una alerta genérica, sin «Retírale sus piezas»', async () => {
      await open(ACTIVE);
      await press('Eliminar vendedor');
      httpMock
        .expectOne(URL)
        .flush(
          { error: { code: 'conflict', message: 'El vendedor acaba de tener movimientos: intenta de nuevo' } },
          { status: 409, statusText: 'Conflict' },
        );
      await settle();
      const alert = el().querySelector('[role="alert"].alert-warning') as HTMLElement;
      expect(alert.textContent).toContain('El vendedor acaba de tener movimientos: intenta de nuevo');
      expect(alert.textContent).not.toContain('Retírale sus piezas');
      expect(visited()).toEqual([]);
    });

    it('con 404 avisa «Este vendedor ya no está disponible», cierra y va a «Mis vendedores»', async () => {
      await open(ACTIVE);
      await press('Eliminar vendedor');
      fail('', 404);
      await settle();
      expect(toast.error).toHaveBeenCalledWith('Este vendedor ya no está disponible');
      expect(visited().some((url) => url.startsWith('/admin/vendedores'))).toBe(true);
    });

    it('sin red avisa que no se pudo eliminar y el pop-up sigue abierto', async () => {
      await open(ACTIVE);
      await press('Eliminar vendedor');
      httpMock.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });
      await settle();
      expect(toast.error).toHaveBeenCalledWith('No se pudo eliminar. Revisa tu conexión e inténtalo de nuevo.');
      expect(visited()).toEqual([]);
      expect(button('Eliminar vendedor').disabled).toBe(false);
    });
  });

  describe('mientras corre una acción de estado', () => {
    it('saving() es true, el botón dice «Desactivando…», todos quedan deshabilitados y no hay segundo envío', async () => {
      await open(ACTIVE);
      await press('Desactivar vendedor');
      expect(fixture.componentInstance.saving()).toBe(true);
      expect(button('Desactivando…').disabled).toBe(true);
      expect(button('Eliminar vendedor').disabled).toBe(true);

      button('Desactivando…').click();
      button('Eliminar vendedor').click();
      await tick();
      expect(httpMock.match(`${URL}/deactivate`)).toHaveLength(1);
      httpMock.expectNone(URL);
      expect(confirm.ask).toHaveBeenCalledTimes(1);
    });

    it('al terminar con error saving() vuelve a ser false', async () => {
      await open(ACTIVE);
      await press('Desactivar vendedor');
      fail('/deactivate', 409);
      await settle();
      expect(fixture.componentInstance.saving()).toBe(false);
    });

    it('«Reactivando…» y «Eliminando…» se ven en su botón', async () => {
      await open(INACTIVE);
      await press('Reactivar vendedor');
      expect(button('Reactivando…').disabled).toBe(true);
      fail('/reactivate', 500);
      await settle();
      await press('Eliminar vendedor');
      expect(button('Eliminando…').disabled).toBe(true);
      httpMock.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });
      await settle();
    });

    it('mientras guarda el formulario los botones de estado quedan deshabilitados', async () => {
      await open(ACTIVE);
      type('Nombre', 'Otro nombre');
      el().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      fixture.detectChanges();
      await settle();
      expect(button('Desactivar vendedor').disabled).toBe(true);
      expect(button('Eliminar vendedor').disabled).toBe(true);
      httpMock.expectOne(URL).flush({ ...ACTIVE, fullName: 'Otro nombre' });
      await settle();
    });
  });
});
