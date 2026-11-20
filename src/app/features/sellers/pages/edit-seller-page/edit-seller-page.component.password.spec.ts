import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService, MessageService } from 'primeng/api';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { ConfirmService } from '@core/confirm/confirm.service';
import { ToastService } from '@core/toast/toast.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { sellerPasswordModalLink } from '@shared/utils/modal-links';
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

describe('EditSellerPageComponent: «Cambiar contraseña» (HU-45)', () => {
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

  it('un activo muestra «Cambiar contraseña» en «Estado del vendedor»', async () => {
    await open(ACTIVE);
    expect(button('Cambiar contraseña')).toBeDefined();
  });

  it('un desactivado no muestra «Cambiar contraseña»', async () => {
    await open(INACTIVE);
    expect(button('Cambiar contraseña')).toBeUndefined();
  });

  it('al pulsarlo navega al pop-up de contraseña y no manda ninguna petición', async () => {
    await open(ACTIVE);
    button('Cambiar contraseña').click();
    fixture.detectChanges();
    await tick();
    const expected = router.serializeUrl(router.createUrlTree(sellerPasswordModalLink(ID)));
    expect(visited()).toContain(expected);
    expect(confirm.ask).not.toHaveBeenCalled();
    httpMock.expectNone((req) => req.method !== 'GET');
  });
});
