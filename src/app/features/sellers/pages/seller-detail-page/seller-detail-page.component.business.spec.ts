import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { ViewingService } from '@core/viewing/viewing.service';
import { SellerChangesService } from '../../services/seller-changes.service';
import { SellerDetailPageComponent } from './seller-detail-page.component';
import { API_BASE_URL } from '@core/api-base-url';
import type { SellerDetail } from '../../interfaces/seller.models';

const ID = '3f2c8a1e-0000-4000-8000-000000000001';
const SELLER_URL = `${API_BASE_URL}/api/sellers/${ID}`;

const SELLER: SellerDetail = {
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

@Component({ template: '' })
class ProbeComponent {}

describe('SellerDetailPageComponent · ficha con negocio (HU-43)', () => {
  let fixture: ComponentFixture<SellerDetailPageComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SellerDetailPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: ProbeComponent }]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: ID }) },
            paramMap: new BehaviorSubject(convertToParamMap({ id: ID })).asObservable(),
          },
        },
        { provide: ViewingService, useValue: { picked: new Subject<string | null>(), select: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SellerDetailPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  async function tick() {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }
  // Responde el detalle y los tres historiales que se piden después.
  async function answer(seller: SellerDetail) {
    httpMock.expectOne(SELLER_URL).flush(seller);
    await tick();
    httpMock.expectOne(`${SELLER_URL}/deliveries`).flush([]);
    httpMock.expectOne(`${SELLER_URL}/returns`).flush([]);
    httpMock.expectOne(`${SELLER_URL}/shrinkages`).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
  }
  async function load(seller: SellerDetail) {
    fixture.detectChanges();
    await answer(seller);
  }
  const text = () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');

  it('muestra el negocio, el Tag «Activo» y «Alta 12/11/2026»', async () => {
    await load(SELLER);
    expect(text()).toContain('Gimnasio Fuerza Norte');
    expect(text()).toContain('Activo');
    expect(text()).toContain('Alta 12/11/2026');
    expect(fixture.nativeElement.querySelector('p-tag')).not.toBeNull();
  });

  it('sin negocio muestra «Sin negocio»', async () => {
    await load({ ...SELLER, businessName: null });
    expect(text()).toContain('Sin negocio');
  });

  it('un vendedor desactivado muestra el Tag «Desactivado»', async () => {
    await load({ ...SELLER, active: false });
    expect(text()).toContain('Desactivado');
    expect(text()).not.toContain('Activo');
  });

  it('«Editar datos» es un enlace que abre la ventana del vendedor', async () => {
    await load(SELLER);
    const link = (Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[]).find(
      (a) => a.textContent?.trim() === 'Editar datos',
    );
    expect(link).toBeDefined();
    expect(link!.getAttribute('href')).toBe(`/admin/(ventana:vendedor/${ID})`);
  });

  it('cuando el pop-up guarda, la ficha vuelve a pedir al vendedor sin pasar por «cargando»', async () => {
    await load(SELLER);
    TestBed.inject(SellerChangesService).notify();
    fixture.detectChanges();
    await tick();

    expect(text()).not.toContain('Cargando vendedor…');
    expect(text()).toContain('Gimnasio Fuerza Norte');
    httpMock.expectOne(SELLER_URL).flush({ ...SELLER, businessName: 'Café Centro' });
    await tick();
    httpMock.match(`${SELLER_URL}/deliveries`).forEach((req) => req.flush([]));
    httpMock.match(`${SELLER_URL}/returns`).forEach((req) => req.flush([]));
    httpMock.match(`${SELLER_URL}/shrinkages`).forEach((req) => req.flush([]));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text()).toContain('Café Centro');
  });
});
