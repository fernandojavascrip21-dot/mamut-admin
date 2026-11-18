import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { closeModalLink } from '@shared/utils/modal-links';
import { SellerChangesService } from '../../services/seller-changes.service';
import { EditSellerPageComponent } from './edit-seller-page.component';
import type { SellerDetail } from '../../interfaces/seller.models';

const ID = '3f2c8a1e-0000-4000-8000-000000000001';
const URL = `${API_BASE_URL}/api/sellers/${ID}`;
const SELLER: SellerDetail = {
  id: ID,
  fullName: 'Víctor Vendedor',
  businessName: 'Gimnasio Fuerza Norte',
  email: 'victor@mammut.local',
  phone: '5512345678',
  active: true,
  createdAt: '2026-11-12T18:00:00.000Z',
  units: 6,
  stock: [],
};

describe('EditSellerPageComponent', () => {
  let fixture: ComponentFixture<EditSellerPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let toast: ToastService;
  let changes: SellerChangesService;
  let viewing: { reload: ReturnType<typeof vi.fn> };

  function setup() {
    viewing = { reload: vi.fn() };
    TestBed.configureTestingModule({
      imports: [EditSellerPageComponent],
      providers: [
        MessageService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ sellerId: ID }) } } },
        { provide: ViewingService, useValue: viewing },
      ],
    });
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    changes = TestBed.inject(SellerChangesService);
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EditSellerPageComponent);
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
  async function open() {
    setup();
    fixture.detectChanges();
    httpMock.expectOne(URL).flush(SELLER);
    await settle();
  }
  const conflict = (status: number, message: string) =>
    httpMock.expectOne(URL).flush({ error: { code: 'x', message } }, { status, statusText: 'Error' });

  afterEach(() => {
    httpMock.verify();
    document.body.querySelectorAll('.p-dialog-mask, p-dialog').forEach((node) => node.remove());
  });

  it('mientras carga muestra «Cargando vendedor…» con role status y el título «Editar datos»', async () => {
    setup();
    fixture.detectChanges();
    expect(text()).toContain('Editar datos');
    expect(text()).toContain('Cargando vendedor…');
    expect(el().querySelector('[role="status"]')).not.toBeNull();
    httpMock.expectOne(URL).flush(SELLER);
    await settle();
  });

  it('pide GET /api/sellers/:id y muestra el formulario con sus datos', async () => {
    await open();
    expect(field('Nombre').value).toBe('Víctor Vendedor');
    expect(field('Nombre del negocio').value).toBe('Gimnasio Fuerza Norte');
    expect(field('Teléfono').value).toBe('55 1234 5678');
    expect(field('Correo para entrar').value).toBe('victor@mammut.local');
  });

  it('con un 404 muestra «No encontramos a este vendedor» y «Cerrar» cierra el pop-up', async () => {
    setup();
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({}, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(text()).toContain('No encontramos a este vendedor');
    const close = Array.from(el().querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Cerrar');
    close!.click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('con otro error muestra «No pudimos cargar al vendedor» y «Reintentar» lo vuelve a pedir', async () => {
    setup();
    fixture.detectChanges();
    httpMock.expectOne(URL).error(new ProgressEvent('error'));
    await settle();
    expect(text()).toContain('No pudimos cargar al vendedor');
    expect(text()).toContain('Revisa tu conexión e inténtalo de nuevo.');

    button('Reintentar').click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    httpMock.expectOne(URL).flush(SELLER);
    await settle();
    expect(field('Nombre').value).toBe('Víctor Vendedor');
  });

  it('guarda con PUT, avisa con el nombre nuevo, notifica, recarga «Viendo» y cierra', async () => {
    await open();
    type('Nombre', 'Víctor Nuevo');
    type('Teléfono', '55 9876 5432');
    const before = changes.version();
    submit();

    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      fullName: 'Víctor Nuevo',
      businessName: 'Gimnasio Fuerza Norte',
      phone: '5598765432',
      email: 'victor@mammut.local',
    });
    req.flush({ ...SELLER, fullName: 'Víctor Nuevo', phone: '5598765432' });
    await settle();

    expect(toast.success).toHaveBeenCalledWith('Datos de «Víctor Nuevo» guardados');
    expect(changes.version()).toBe(before + 1);
    expect(viewing.reload).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('mientras guarda dice «Guardando…», no manda un segundo envío y no se puede salir', async () => {
    await open();
    type('Nombre', 'Víctor Nuevo');
    submit();
    submit();
    expect(httpMock.match(URL)).toHaveLength(1);
    await settle();
    expect(button('Guardando…').disabled).toBe(true);
    expect(fixture.componentInstance.saving()).toBe(true);
    conflict(409, 'Ya existe un acceso con ese correo');
    await settle();
  });

  it('con cambios sin guardar el guard puede preguntar y sin cambios no', async () => {
    await open();
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    type('Nombre', 'Otro nombre');
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
  });

  it('tras guardar con éxito ya no queda nada sin guardar', async () => {
    await open();
    type('Nombre', 'Víctor Nuevo');
    submit();
    httpMock.expectOne(URL).flush({ ...SELLER, fullName: 'Víctor Nuevo' });
    await settle();
    expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
  });

  it('un 409 muestra «Ya existe un acceso con ese correo» bajo el correo, enfoca el campo y no cierra', async () => {
    await open();
    type('Correo para entrar', 'vendedor1@mammut.local');
    submit();
    conflict(409, 'Ya existe un acceso con ese correo');
    await settle();

    expect(text()).toContain('Ya existe un acceso con ese correo');
    expect(toast.error).toHaveBeenCalledWith('Ya existe un acceso con ese correo');
    expect(document.activeElement).toBe(field('Correo para entrar'));
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('un 422 conocido se pinta bajo su campo y también en el aviso', async () => {
    await open();
    type('Teléfono', '5598765432');
    submit();
    conflict(422, 'El teléfono debe tener 10 dígitos');
    await settle();

    expect(text()).toContain('El teléfono debe tener 10 dígitos');
    expect(toast.error).toHaveBeenCalledWith('El teléfono debe tener 10 dígitos');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('un 422 desconocido solo sale en el aviso', async () => {
    await open();
    type('Nombre', 'Víctor Nuevo');
    submit();
    conflict(422, 'Algo que el formulario no conoce');
    await settle();

    expect(toast.error).toHaveBeenCalledWith('Algo que el formulario no conoce');
    expect(text()).not.toContain('Algo que el formulario no conoce');
  });

  it('un 404 al guardar avisa «Este vendedor ya no está disponible» y cierra', async () => {
    await open();
    type('Nombre', 'Víctor Nuevo');
    submit();
    conflict(404, 'No existe');
    await settle();

    expect(toast.error).toHaveBeenCalledWith('Este vendedor ya no está disponible');
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('sin red muestra «No se pudo guardar» y «Reintentar» reenvía el mismo payload', async () => {
    await open();
    type('Nombre', 'Víctor Nuevo');
    submit();
    const first = httpMock.expectOne(URL);
    const payload = first.request.body;
    first.error(new ProgressEvent('error'));
    await settle();
    expect(text()).toContain('No se pudo guardar');

    button('Reintentar').click();
    fixture.detectChanges();
    const retry = httpMock.expectOne(URL);
    expect(retry.request.method).toBe('PUT');
    expect(retry.request.body).toEqual(payload);
    retry.flush({ ...SELLER, fullName: 'Víctor Nuevo' });
    await settle();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });

  it('«Cancelar» cierra el pop-up', async () => {
    await open();
    button('Cancelar').click();
    expect(router.navigate).toHaveBeenCalledWith(closeModalLink());
  });
});
