import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { ViewingListStatus, ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import { ViewingService } from '@core/viewing/viewing.service';
import type { CashCut } from '../../interfaces/cash-cut.models';
import { AdminCashCutPageComponent } from './admin-cash-cut-page.component';

const CUTS_URL = `${API_BASE_URL}/api/cuts`;
const LUIS: ViewingSeller = { id: '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b', fullName: 'Luis Pérez' };

const SELLER_CUT: CashCut = {
  holder: LUIS,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: { salesCount: 2, units: 3, total: '2300.00', cost: '1750.0000', profit: '550.00' },
  products: [
    {
      productId: 3,
      name: 'Proteína Whey',
      image: null,
      unitPrice: '920.00',
      units: 2,
      total: '1840.00',
      cost: '1400.0000',
      profit: '440.00',
    },
    {
      productId: 4,
      name: 'Creatina',
      image: null,
      unitPrice: '460.00',
      units: 1,
      total: '460.00',
      cost: '350.0000',
      profit: '110.00',
    },
  ],
  sales: [
    {
      requestId: 'r-2',
      soldAt: '2026-11-04T20:00:00Z',
      registeredByAdmin: true,
      soldBy: { id: 'a-1', fullName: 'Ana' },
      total: '460.00',
      profit: '110.00',
      lines: [
        {
          productId: 4,
          name: 'Creatina',
          qty: 1,
          unitPrice: '460.00',
          subtotal: '460.00',
          unitCost: '350.0000',
          profit: '110.00',
        },
      ],
    },
    {
      requestId: 'r-1',
      soldAt: '2026-11-04T18:00:00Z',
      registeredByAdmin: false,
      soldBy: LUIS,
      total: '1840.00',
      profit: '440.00',
      lines: [
        {
          productId: 3,
          name: 'Proteína Whey',
          qty: 2,
          unitPrice: '920.00',
          subtotal: '1840.00',
          unitCost: '700.0000',
          profit: '440.00',
        },
      ],
    },
  ],
};
const WAREHOUSE_CUT: CashCut = { ...SELLER_CUT, holder: null };
const EMPTY_CUT: CashCut = {
  holder: LUIS,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: { salesCount: 0, units: 0, total: '0.00', cost: '0.0000', profit: '0.00' },
  products: [],
  sales: [],
};

describe('AdminCashCutPageComponent', () => {
  let fixture: ComponentFixture<AdminCashCutPageComponent>;
  let httpMock: HttpTestingController;
  // «Viendo» simulado: la página solo lee estas tres señales.
  const seller = signal<ViewingSeller | null>(null);
  const listStatus = signal<ViewingListStatus>('ready');
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  // Toca y deja correr la detección de cambios: los efectos de rxResource piden el corte ahí.
  const click = (selector: string) => {
    (el().querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const cutRequests = () => httpMock.match((r) => r.url === CUTS_URL);

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T18:00:00Z')); // miércoles 4 nov en México
    seller.set(null);
    listStatus.set('ready');
    TestBed.configureTestingModule({
      imports: [AdminCashCutPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ViewingService,
          useValue: {
            selectedSeller: seller,
            selectedSellerId: () => seller()?.id ?? null,
            listStatus,
          },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminCashCutPageComponent);
    await settle();
  });

  afterEach(() => {
    vi.useRealTimers();
    httpMock.verify();
  });

  it('antes de generar muestra la tarjeta con el titular y el periodo, sin pedir nada', () => {
    seller.set(LUIS);
    fixture.detectChanges();
    expect(text('.idle-title')).toBe('Corte de Luis · mié 4 nov');
    expect(text('.idle')).toContain('El corte se calcula cuando lo generes.');
    expect(text('.generate')).toBe('Generar corte');
    expect(cutRequests()).toHaveLength(0);
  });

  it('con la bodega dice «Corte de mis ventas»', () => {
    expect(text('.idle-title')).toBe('Corte de mis ventas · mié 4 nov');
  });

  it('«Generar corte» está deshabilitado mientras carga «Viendo»', async () => {
    listStatus.set('loading');
    await settle();
    const button = el().querySelector('.generate') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    button.click();
    expect(cutRequests()).toHaveLength(0);
  });

  it('el tipo de corte «para casa» está habilitado y «para vendedor» es el elegido', () => {
    const options = fixture.componentInstance.cutTypeOptions;
    expect(options.find((o) => o.value === 'seller')?.disabled).toBe(false);
    expect(options.find((o) => o.value === 'home')).toMatchObject({ disabled: false });
    expect(options.find((o) => o.value === 'home')?.label).not.toContain('Próximamente');
    expect(fixture.componentInstance.cutType()).toBe('seller');
  });

  it('pide el corte de un vendedor con holderId, period y date, y muestra resumen, desglose y ventas', async () => {
    seller.set(LUIS);
    await settle();
    click('.generate');
    fixture.detectChanges();
    expect(text('.loading')).toContain('Calculando el corte…');

    const req = httpMock.expectOne((r) => r.url === CUTS_URL);
    expect(req.request.params.get('holderId')).toBe(LUIS.id);
    expect(req.request.params.get('period')).toBe('day');
    expect(req.request.params.get('date')).toBe('2026-11-04');
    req.flush({ cut: SELLER_CUT });
    await settle();

    expect(text('.result-title')).toBe('Corte con precios · Luis');
    expect(text('.generated-at')).toMatch(/^Generado hoy a las \d{2}:\d{2}$/);
    expect(text('app-cut-summary .sold')).toBe('$2,300.00');
    expect(text('app-cut-summary .cost-label')).toBe('Costo con envío');
    expect(text('.products-title')).toBe('Lo que vendió Luis');
    expect(el().querySelectorAll('.products app-cut-product-line')).toHaveLength(2);
    expect(text('.sales-title')).toBe('Ventas (2)');
    expect(el().querySelectorAll('.sales app-cut-sale-item')).toHaveLength(2);
    expect(text('.sales .admin-tag')).toBe('Registrada por ti');
  });

  it('con la bodega no manda holderId y usa los textos de «mis ventas»', async () => {
    click('.generate');
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url === CUTS_URL);
    expect(req.request.params.has('holderId')).toBe(false);
    req.flush({ cut: WAREHOUSE_CUT });
    await settle();

    expect(text('.result-title')).toBe('Corte con precios');
    expect(text('.products-title')).toBe('Lo que vendí');
    expect(text('app-cut-summary .sold-caption')).toContain('Mis ventas desde bodega');
    expect(text('app-cut-summary .cost-label')).toBe('Costo');
  });

  it('un periodo sin ventas muestra el estado vacío y no un corte en ceros', async () => {
    seller.set(LUIS);
    await settle();
    click('.generate');
    httpMock.expectOne((r) => r.url === CUTS_URL).flush({ cut: EMPTY_CUT });
    await settle();

    expect(text('.empty')).toContain('No hay ventas en este periodo');
    expect(text('.empty')).toContain('Cambia el periodo o el vendedor para ver otro corte.');
    expect(el().querySelector('app-cut-summary')).toBeNull();
  });

  it('un error muestra el mensaje y «Reintentar» vuelve a pedir el corte', async () => {
    click('.generate');
    httpMock.expectOne((r) => r.url === CUTS_URL).error(new ProgressEvent('error'), { status: 0 });
    await settle();

    expect(text('.error')).toContain('No se pudo generar el corte');
    expect(text('.error-message')).toBe('Revisa tu conexión e inténtalo de nuevo.');

    click('.retry');
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === CUTS_URL).flush({ cut: SELLER_CUT });
    await settle();
    expect(el().querySelector('.result')).not.toBeNull();
  });

  it('un error del backend muestra su mensaje', async () => {
    click('.generate');
    httpMock
      .expectOne((r) => r.url === CUTS_URL)
      .flush(
        { error: { code: 'not_found', message: 'El vendedor ya no existe' } },
        { status: 404, statusText: 'Not Found' },
      );
    await settle();
    expect(text('.error-message')).toBe('El vendedor ya no existe');
  });

  it('«Generar de nuevo» vuelve a pedir el mismo corte', async () => {
    click('.generate');
    httpMock.expectOne((r) => r.url === CUTS_URL).flush({ cut: SELLER_CUT });
    await settle();

    click('.regenerate');
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url === CUTS_URL);
    expect(req.request.params.get('date')).toBe('2026-11-04');
    req.flush({ cut: SELLER_CUT });
    await settle();
    expect(el().querySelector('.result')).not.toBeNull();
  });

  it('la flecha «Anterior» quita el resultado, cambia el texto y pide la fecha anterior al generar', async () => {
    click('.generate');
    httpMock.expectOne((r) => r.url === CUTS_URL).flush({ cut: SELLER_CUT });
    await settle();

    click('.previous');
    await settle();
    expect(el().querySelector('.result')).toBeNull();
    expect(text('.idle-title')).toBe('Corte de mis ventas · mar 3 nov');

    click('.generate');
    const req = httpMock.expectOne((r) => r.url === CUTS_URL);
    expect(req.request.params.get('date')).toBe('2026-11-03');
    req.flush({ cut: EMPTY_CUT });
  });

  it('cambiar a Semana quita el resultado y pide el lunes de la semana', async () => {
    click('.generate');
    httpMock.expectOne((r) => r.url === CUTS_URL).flush({ cut: SELLER_CUT });
    await settle();

    const week = Array.from(el().querySelectorAll<HTMLElement>('p-togglebutton')).find(
      (o) => o.textContent?.trim() === 'Semana',
    )!;
    week.click();
    await settle();
    expect(el().querySelector('.result')).toBeNull();
    expect(text('.idle-title')).toBe('Corte de mis ventas · 2 al 8 nov');

    click('.generate');
    const req = httpMock.expectOne((r) => r.url === CUTS_URL);
    expect(req.request.params.get('period')).toBe('week');
    expect(req.request.params.get('date')).toBe('2026-11-02');
    req.flush({ cut: EMPTY_CUT });
  });

  it('cambiar el titular en «Viendo» quita el resultado', async () => {
    click('.generate');
    httpMock.expectOne((r) => r.url === CUTS_URL).flush({ cut: WAREHOUSE_CUT });
    await settle();
    expect(el().querySelector('.result')).not.toBeNull();

    seller.set(LUIS);
    await settle();
    expect(el().querySelector('.result')).toBeNull();
    expect(text('.idle-title')).toBe('Corte de Luis · mié 4 nov');
  });

  it('una respuesta tardía de otra selección no se muestra', async () => {
    click('.generate');
    const late = httpMock.expectOne((r) => r.url === CUTS_URL);

    click('.previous');
    // Si la petición sigue en vuelo, su respuesta llega tarde y debe ignorarse; si ya se canceló, no llega.
    if (!late.cancelled) late.flush({ cut: SELLER_CUT });
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    expect(el().querySelector('.result')).toBeNull();
    expect(el().querySelector('.idle')).not.toBeNull();
  });
});
