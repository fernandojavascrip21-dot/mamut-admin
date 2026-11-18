import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { closeModalLink } from '@shared/utils/modal-links';
import { SellerPasswordPageComponent } from './seller-password-page.component';
import type { EmailStatus, SellerDetail } from '../../interfaces/seller.models';

const ID = '3f2c8a1e-0000-4000-8000-000000000001';
const URL = `${API_BASE_URL}/api/sellers/${ID}`;
const GET_URL = `${URL}?status=any`;
const PUT_URL = `${URL}/password`;
const PASSWORD = 'Clave-Nueva-1';
const SELLER: SellerDetail = {
  id: ID,
  fullName: 'Ana López',
  businessName: null,
  email: 'ana@mammut.local',
  phone: '5512345678',
  active: true,
  createdAt: '2026-11-12T18:00:00.000Z',
  units: 0,
  stock: [],
};

describe('SellerPasswordPageComponent', () => {
  let fixture: ComponentFixture<SellerPasswordPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let toast: ToastService;

  function setup() {
    TestBed.configureTestingModule({
      imports: [SellerPasswordPageComponent],
      providers: [
        MessageService,
        ConfirmationService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ sellerId: ID }) } } },
        { provide: ViewingService, useValue: { reload: vi.fn() } },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'warn');
    vi.spyOn(toast, 'error');
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SellerPasswordPageComponent);
  }

  // El pop-up (p-dialog) se monta en body: el contenido ya no cuelga del fixture.
  const el = () => document.body;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }
  function field(label: string): HTMLInputElement {
    const labelEl = Array.from(el().querySelectorAll('label')).find((l) => l.textContent?.trim() === label);
    return el().querySelector(`#${labelEl!.htmlFor}`) as HTMLInputElement;
  }
  function type(label: string, value: string) {
    const input = field(label);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement;
  function submit() {
    el().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }
  async function open(seller: SellerDetail = SELLER) {
    setup();
    fixture.detectChanges();
    httpMock.expectOne(GET_URL).flush(seller);
    await settle();
  }
  async function fillAndSubmit() {
    type('Contraseña temporal', PASSWORD);
    type('Confirmar contraseña', PASSWORD);
    submit();
    await settle();
  }
  const putFail = (status: number, message = 'x') =>
    httpMock.expectOne(PUT_URL).flush({ error: { code: 'x', message } }, { status, statusText: 'Error' });

  afterEach(() => {
    httpMock.verify();
    document.body.querySelectorAll('.p-dialog-mask, p-dialog').forEach((node) => node.remove());
    localStorage.clear();
    sessionStorage.clear();
  });

  it('mientras carga muestra el título «Cambiar contraseña» y «Cargando vendedor…» con role status', async () => {
    setup();
    fixture.detectChanges();
    expect(text()).toContain('Cambiar contraseña');
    expect(text()).toContain('Cargando vendedor…');
    expect(el().querySelector('[role="status"]')).not.toBeNull();
    httpMock.expectOne(GET_URL).flush(SELLER);
    await settle();
  });

  it('pide GET /api/sellers/:id?status=any y muestra «Para Ana López» con el formulario', async () => {
    await open();
    expect(text()).toContain('Para Ana López');
    expect(field('Contraseña temporal')).not.toBeNull();
    expect(field('Confirmar contraseña')).not.toBeNull();
  });

  it('con error de red muestra «No pudimos cargar al vendedor» y «Reintentar» lo vuelve a pedir', async () => {
    setup();
    fixture.detectChanges();
    httpMock.expectOne(GET_URL).error(new ProgressEvent('error'));
    await settle();
    expect(text()).toContain('No pudimos cargar al vendedor');
    button('Reintentar').click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    httpMock.expectOne(GET_URL).flush(SELLER);
    await settle();
    expect(text()).toContain('Para Ana López');
  });

  it('con un 5xx también muestra «No pudimos cargar al vendedor» con «Reintentar»', async () => {
    setup();
    fixture.detectChanges();
    httpMock.expectOne(GET_URL).flush({}, { status: 500, statusText: 'Error' });
    await settle();
    expect(text()).toContain('No pudimos cargar al vendedor');
    expect(button('Reintentar')).toBeDefined();
  });

  it('con un 404 muestra «Este vendedor ya no existe» y «Cerrar» cierra el pop-up', async () => {
    setup();
    fixture.detectChanges();
    httpMock.expectOne(GET_URL).flush({}, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(text()).toContain('Este vendedor ya no existe');
    button('Cerrar').click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('un desactivado muestra «Está desactivado. Reactívalo para cambiarle la contraseña.» sin formulario', async () => {
    await open({ ...SELLER, active: false });
    expect(text()).toContain('Está desactivado. Reactívalo para cambiarle la contraseña.');
    expect(el().querySelector('form')).toBeNull();
    button('Cerrar').click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('un formulario inválido no manda petición y muestra los errores', async () => {
    await open();
    submit();
    await settle();
    expect(text()).toContain('Escribe la contraseña temporal');
    httpMock.expectNone(PUT_URL);
  });

  it('contraseñas distintas no mandan petición', async () => {
    await open();
    type('Contraseña temporal', PASSWORD);
    type('Confirmar contraseña', 'Otra-Clave-22');
    submit();
    await settle();
    expect(text()).toContain('Las contraseñas no coinciden');
    httpMock.expectNone(PUT_URL);
  });

  it('el envío manda PUT con { password } sin la confirmación', async () => {
    await open();
    await fillAndSubmit();
    const req = httpMock.expectOne(PUT_URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ password: PASSWORD });
    req.flush({ emailStatus: 'sent' });
    await settle();
  });

  it('con emailStatus «sent» avisa con un toast de éxito y cierra', async () => {
    await open();
    await fillAndSubmit();
    httpMock.expectOne(PUT_URL).flush({ emailStatus: 'sent' });
    await settle();
    expect(toast.success).toHaveBeenCalledWith('Se cambió la contraseña de Ana López. Compártesela en persona.');
    expect(toast.warn).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it.each<EmailStatus>(['failed', 'skipped'])('con emailStatus «%s» avisa con warn y cierra', async (emailStatus) => {
    await open();
    await fillAndSubmit();
    httpMock.expectOne(PUT_URL).flush({ emailStatus });
    await settle();
    expect(toast.warn).toHaveBeenCalledWith('Se cambió la contraseña, pero no se pudo avisarle por correo');
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('mientras guarda el botón dice «Cambiando…» y un segundo envío no manda otra petición', async () => {
    await open();
    await fillAndSubmit();
    expect(button('Cambiando…').disabled).toBe(true);
    submit();
    await settle();
    expect(httpMock.match(PUT_URL)).toHaveLength(1);
  });

  it('un 422 pone el mensaje del backend en «Contraseña temporal»', async () => {
    await open();
    await fillAndSubmit();
    putFail(422, 'Usa al menos 8 caracteres');
    await settle();
    expect(text()).toContain('Usa al menos 8 caracteres');
    expect(field('Contraseña temporal').getAttribute('aria-invalid')).toBe('true');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('un 404 al guardar muestra «Este vendedor ya no existe» con «Cerrar»', async () => {
    await open();
    await fillAndSubmit();
    putFail(404);
    await settle();
    expect(text()).toContain('Este vendedor ya no existe');
    expect(button('Cerrar')).toBeDefined();
  });

  it('sin red muestra «No se pudo cambiar la contraseña», conserva lo escrito y «Reintentar» reenvía', async () => {
    await open();
    await fillAndSubmit();
    httpMock.expectOne(PUT_URL).error(new ProgressEvent('error'));
    await settle();
    expect(text()).toContain('No se pudo cambiar la contraseña');
    expect(field('Contraseña temporal').value).toBe(PASSWORD);
    button('Reintentar').click();
    fixture.detectChanges();
    const retry = httpMock.expectOne(PUT_URL);
    expect(retry.request.body).toEqual({ password: PASSWORD });
    retry.flush({ emailStatus: 'sent' });
    await settle();
    expect(toast.success).toHaveBeenCalled();
  });

  it('un 5xx al guardar también muestra «No se pudo cambiar la contraseña» con «Reintentar»', async () => {
    await open();
    await fillAndSubmit();
    putFail(500);
    await settle();
    expect(text()).toContain('No se pudo cambiar la contraseña');
    expect(button('Reintentar')).toBeDefined();
  });

  it('la contraseña no llega a localStorage ni a sessionStorage, ni a ningún toast', async () => {
    await open();
    await fillAndSubmit();
    httpMock.expectOne(PUT_URL).flush({ emailStatus: 'sent' });
    await settle();
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain(PASSWORD);
    const toasts = JSON.stringify([
      vi.mocked(toast.success).mock.calls,
      vi.mocked(toast.warn).mock.calls,
      vi.mocked(toast.error).mock.calls,
    ]);
    expect(toasts).not.toContain(PASSWORD);
  });
});
