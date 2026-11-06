import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/api-base-url';
import type { ViewingListStatus, ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import { ViewingService } from '@core/viewing/viewing.service';
import type { CashCut } from '../../interfaces/cash-cut.models';
import { CashCutService } from '../../services/cash-cut.service';
import { AdminCashCutPageComponent } from './admin-cash-cut-page.component';

const CUTS_URL = `${API_BASE_URL}/api/cuts`;
const LUIS: ViewingSeller = { id: '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b', fullName: 'Luis Pérez' };
const PRICES_HELP = 'Usa los precios y el costo con envío que le pusiste a cada vendedor.';
const HOME_HELP = 'Usa el costo de fábrica guardado en cada venta.';
const HOME_OPTION = 'Corte de casa';
const PRICES_OPTION = 'Corte del vendedor';

// Corte para casa de Luis en la semana del 2 al 8 nov: 2 piezas a $920, costo con envío $700 y de
// fábrica $600 (criterio 3). Trae solo las llaves del corte para casa, como T-22.
const HOME_CUT: CashCut = {
  holder: LUIS,
  period: { kind: 'week', from: '2026-11-02', to: '2026-11-08', timeZone: 'America/Mexico_City' },
  totals: {
    salesCount: 1,
    units: 2,
    total: '1840.00',
    factoryCost: '1200.0000',
    realProfit: '640.00',
    shippingCover: '200.00',
  },
  products: [
    {
      productId: 3,
      name: 'Proteína Whey',
      image: null,
      unitPrice: '920.00',
      units: 2,
      total: '1840.00',
      factoryCost: '1200.0000',
      realProfit: '640.00',
      shippingCover: '200.00',
    },
  ],
  sales: [
    {
      requestId: 'r-1',
      soldAt: '2026-11-04T18:00:00Z',
      registeredByAdmin: false,
      soldBy: LUIS,
      total: '1840.00',
      realProfit: '640.00',
      shippingCover: '200.00',
      lines: [
        {
          productId: 3,
          name: 'Proteína Whey',
          qty: 2,
          unitPrice: '920.00',
          subtotal: '1840.00',
          factoryUnitCost: '600.0000',
          realProfit: '640.00',
        },
      ],
    },
  ],
};
const WAREHOUSE_HOME_CUT: CashCut = {
  ...HOME_CUT,
  holder: null,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: { ...HOME_CUT.totals, shippingCover: '0.00' },
};
const BUSINESS_CUT: CashCut = {
  ...WAREHOUSE_HOME_CUT,
  holders: [
    {
      holder: null,
      salesCount: 1,
      units: 2,
      total: '1840.00',
      factoryCost: '1200.0000',
      realProfit: '640.00',
      shippingCover: '0.00',
    },
  ],
};
const SELLER_CUT: CashCut = {
  holder: null,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: { salesCount: 1, units: 2, total: '1840.00', cost: '1400.0000', profit: '440.00' },
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
  ],
  sales: [],
};
const EMPTY_HOME_CUT: CashCut = {
  holder: LUIS,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: {
    salesCount: 0,
    units: 0,
    total: '0.00',
    factoryCost: '0.0000',
    realProfit: '0.00',
    shippingCover: '0.00',
  },
  products: [],
  sales: [],
};

describe('AdminCashCutPageComponent · corte para casa', () => {
  let fixture: ComponentFixture<AdminCashCutPageComponent>;
  let httpMock: HttpTestingController;
  let service: CashCutService;
  // «Viendo» simulado: la página solo lee estas tres señales.
  const seller = signal<ViewingSeller | null>(null);
  const listStatus = signal<ViewingListStatus>('ready');
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const click = (selector: string) => {
    (el().querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const cutRequest = () => httpMock.expectOne((r) => r.url === CUTS_URL);
  const selectionText = () => text('section[aria-label="Selección del corte"]') ?? '';
  const cutTypeOptions = () =>
    Array.from(document.querySelectorAll<HTMLElement>('li.p-select-option'));

  // «Tipo de corte» es un Select de PrimeNG: se abre con un clic y la lista se monta en body.
  async function openCutType() {
    (el().querySelector('p-select.cut-type') as HTMLElement).click();
    await settle();
  }
  async function pickCutType(label: string) {
    await openCutType();
    cutTypeOptions()
      .find((o) => o.textContent?.trim().startsWith(label))
      ?.click();
    await settle();
  }
  // Igual que pickCutType, sin esperar a whenStable: con una petición en vuelo nunca queda estable.
  function pickCutTypeWhileLoading(label: string) {
    (el().querySelector('p-select.cut-type') as HTMLElement).click();
    fixture.detectChanges();
    cutTypeOptions()
      .find((o) => o.textContent?.trim().startsWith(label))
      ?.click();
    fixture.detectChanges();
  }
  async function pickWeek() {
    Array.from(el().querySelectorAll<HTMLElement>('p-togglebutton'))
      .find((o) => o.textContent?.trim() === 'Semana')
      ?.click();
    await settle();
  }
  // Responde la petición y devuelve sus parámetros: así ninguna queda abierta si falla una aserción.
  async function answer(req: TestRequest, cut: CashCut) {
    const params = req.request.params;
    req.flush({ cut });
    await settle();
    return params;
  }

  beforeEach(async () => {
    // jsdom no implementa scrollIntoView y el Select lo llama al reabrirse con una opción elegida.
    Element.prototype.scrollIntoView = vi.fn();
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
    service = TestBed.inject(CashCutService);
    vi.spyOn(service, 'get');
    vi.spyOn(service, 'getHome');
    fixture = TestBed.createComponent(AdminCashCutPageComponent);
    await settle();
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
    document.querySelectorAll('.p-select-overlay').forEach((node) => node.remove());
    httpMock.verify();
  });

  it('al entrar está elegido «Corte del vendedor» y «Corte de casa» se puede elegir', async () => {
    expect(text('p-select.cut-type')).toContain(PRICES_OPTION);
    expect(selectionText()).toContain(PRICES_HELP);

    await openCutType();
    const home = cutTypeOptions().find((o) => o.textContent?.includes(HOME_OPTION));
    expect(home).toBeDefined();
    expect(home?.textContent).not.toContain('Próximamente');
    expect(home?.getAttribute('aria-disabled')).not.toBe('true');
    expect(home?.classList.contains('p-disabled')).toBe(false);
  });

  it('la ayuda del selector cambia con el tipo de corte', async () => {
    await pickCutType(HOME_OPTION);
    expect(text('p-select.cut-type')).toContain(HOME_OPTION);
    expect(selectionText()).toContain(HOME_HELP);
    expect(selectionText()).not.toContain(PRICES_HELP);

    await pickCutType(PRICES_OPTION);
    expect(selectionText()).toContain(PRICES_HELP);
    expect(selectionText()).not.toContain(HOME_HELP);
  });

  it('con Luis, «Semana» y «Para casa» pide type=home y muestra título, resumen, desglose y ventas del corte para casa', async () => {
    seller.set(LUIS);
    await settle();
    await pickWeek();
    await pickCutType(HOME_OPTION);
    click('.generate');
    fixture.detectChanges();
    expect(text('.loading')).toContain('Calculando el corte…');

    const params = await answer(cutRequest(), HOME_CUT);
    expect(params.get('type')).toBe('home');
    expect(params.get('holderId')).toBe(LUIS.id);
    expect(params.get('period')).toBe('week');
    expect(params.get('date')).toBe('2026-11-02');
    expect(service.getHome).toHaveBeenCalledWith(
      expect.objectContaining({ holderId: LUIS.id, period: 'week', date: '2026-11-02' }),
    );
    expect(service.get).not.toHaveBeenCalled();

    expect(text('.result-title')).toBe('Corte para casa · Luis');
    expect(text('app-cut-summary .sold')).toBe('$1,840.00');
    expect(el().querySelector('app-cut-summary .factory-cost')).toBeNull();
    expect(text('app-cut-summary .profit')).toBe('$640.00');
    expect(el().querySelector('app-cut-summary .shipping-cover')).toBeNull();
    expect(el().querySelector('.products app-cut-product-line .factory-cost')).toBeNull();
    expect(text('.products app-cut-product-line .profit')).toBe('+$640.00');
    expect(text('.sales app-cut-sale-item .profit')).toBe('Ganancia $640.00');
    expect(text('.result')).not.toContain('Costo con envío');
  });

  it('con «Yo · bodega» y «Corte de casa» pide el resumen del negocio y no muestra «Para cubrir envíos»', async () => {
    await pickCutType(HOME_OPTION);
    click('.generate');

    const params = await answer(cutRequest(), BUSINESS_CUT);
    expect(params.get('type')).toBe('home');
    expect(params.get('scope')).toBe('business');
    expect(params.has('holderId')).toBe(false);
    expect(params.get('period')).toBe('day');
    expect(params.get('date')).toBe('2026-11-04');

    expect(text('.result-title')).toBe('Corte para casa');
    expect(text('app-cut-summary .sold-caption')).toContain('Todo el negocio');
    expect(text('app-cut-summary .profit')).toBe('$640.00');
    expect(el().querySelector('app-cut-summary .shipping-cover')).toBeNull();
  });

  it('cambiar el tipo de corte quita el resultado y al generar pide el nuevo tipo', async () => {
    click('.generate');
    const first = await answer(cutRequest(), SELLER_CUT);
    expect(first.has('type')).toBe(false);
    expect(el().querySelector('.result')).not.toBeNull();

    await pickCutType(HOME_OPTION);
    expect(el().querySelector('.result')).toBeNull();
    expect(el().querySelector('.idle')).not.toBeNull();

    click('.generate');
    const second = await answer(cutRequest(), WAREHOUSE_HOME_CUT);
    expect(second.get('type')).toBe('home');
  });

  it('una respuesta tardía del corte para casa no se muestra después de cambiar el tipo', async () => {
    await pickCutType(HOME_OPTION);
    click('.generate');
    const late = cutRequest();
    const lateParams = late.request.params;

    pickCutTypeWhileLoading(PRICES_OPTION);
    // Si la petición sigue en vuelo, su respuesta llega tarde y debe ignorarse; si ya se canceló, no llega.
    if (!late.cancelled) late.flush({ cut: WAREHOUSE_HOME_CUT });
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    expect(lateParams.get('type')).toBe('home');
    expect(el().querySelector('.result')).toBeNull();
    expect(el().querySelector('.idle')).not.toBeNull();
  });

  it('«Generar de nuevo» vuelve a pedir el corte para casa', async () => {
    await pickCutType(HOME_OPTION);
    click('.generate');
    await answer(cutRequest(), WAREHOUSE_HOME_CUT);

    click('.regenerate');
    fixture.detectChanges();
    const params = await answer(cutRequest(), WAREHOUSE_HOME_CUT);
    expect(params.get('type')).toBe('home');
    expect(params.get('date')).toBe('2026-11-04');
    expect(text('.result-title')).toBe('Corte para casa');
  });

  it('un error muestra «No se pudo generar el corte» y «Reintentar» vuelve a pedir el corte para casa', async () => {
    await pickCutType(HOME_OPTION);
    click('.generate');
    const failed = cutRequest();
    const failedParams = failed.request.params;
    failed.error(new ProgressEvent('error'), { status: 0 });
    await settle();
    expect(failedParams.get('type')).toBe('home');
    expect(text('.error')).toContain('No se pudo generar el corte');
    expect(text('.retry')).toBe('Reintentar');

    click('.retry');
    fixture.detectChanges();
    const params = await answer(cutRequest(), WAREHOUSE_HOME_CUT);
    expect(params.get('type')).toBe('home');
    expect(text('.result-title')).toBe('Corte para casa');
  });

  it('un periodo sin ventas del corte para casa muestra el estado vacío y no un corte en ceros', async () => {
    seller.set(LUIS);
    await settle();
    await pickCutType(HOME_OPTION);
    click('.generate');

    const params = await answer(cutRequest(), EMPTY_HOME_CUT);
    expect(params.get('type')).toBe('home');
    expect(text('.empty')).toContain('No hay ventas en este periodo');
    expect(el().querySelector('app-cut-summary')).toBeNull();
  });
});
