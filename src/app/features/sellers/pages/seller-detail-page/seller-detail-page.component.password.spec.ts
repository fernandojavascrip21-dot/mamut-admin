import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { BehaviorSubject, Subject } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import { ViewingService } from '@core/viewing/viewing.service';
import { SellerDetailPageComponent } from './seller-detail-page.component';
import type { SellerDetail } from '../../interfaces/seller.models';

const ID = '3f2c8a1e-0000-4000-8000-000000000001';
const SELLER_URL = `${API_BASE_URL}/api/sellers/${ID}`;
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

describe('SellerDetailPageComponent: «Cambiar contraseña» (HU-45)', () => {
  let fixture: ComponentFixture<SellerDetailPageComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    const viewing = { picked: new Subject<string | null>(), select: vi.fn(), reload: vi.fn() };
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
    fixture = TestBed.createComponent(SellerDetailPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.match(() => true));

  async function tick() {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }
  async function load(seller: SellerDetail) {
    fixture.detectChanges();
    httpMock.expectOne(`${SELLER_URL}?status=any`).flush(seller);
    await tick();
    if (seller.active) {
      httpMock.expectOne(`${SELLER_URL}/deliveries`).flush([]);
      httpMock.expectOne(`${SELLER_URL}/returns`).flush([]);
      httpMock.expectOne(`${SELLER_URL}/shrinkages`).flush([]);
      await tick();
    }
  }
  const control = (label: string) =>
    (Array.from(fixture.nativeElement.querySelectorAll('button, a')) as HTMLElement[]).find(
      (node) => node.textContent!.trim() === label,
    );

  it('la ficha de un activo no muestra «Cambiar contraseña» (ahora vive en «Editar datos»)', async () => {
    await load(ACTIVE);
    expect(control('Cambiar contraseña')).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.change-password')).toBeNull();
    expect(control('Editar datos')).toBeDefined();
  });

  it('la ficha de un desactivado tampoco muestra «Cambiar contraseña»', async () => {
    await load(INACTIVE);
    expect(control('Cambiar contraseña')).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.change-password')).toBeNull();
    expect(control('Editar datos')).toBeDefined();
  });
});
