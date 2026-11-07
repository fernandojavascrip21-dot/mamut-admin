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
const LUIS: ViewingSeller = {
  id: '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b',
  fullName: 'Luis Vendedor',
};
const ANA_ID = '7a2b3c4d-5e6f-4a70-8b9c-0d1e2f3a4b5c';
const HOME_OPTION = 'Ganancia real';
const PRICES_OPTION = 'Ganancia del vendedor';

// Resumen del negocio del 2 al 8 nov (HU-22): bodega $500, Luis $1,840 y Ana (desactivada) $500.
// Los totales ya vienen sumados por el backend; la pantalla solo los pinta. Trae `products` y `sales`
// a propósito: el resumen no debe pintarlos.
const BUSINESS_CUT: CashCut = {
  holder: null,
  period: { kind: 'week', from: '2026-11-02', to: '2026-11-08', timeZone: 'America/Mexico_City' },
  totals: {
    salesCount: 5,
    units: 9,
    total: '2840.00',
    factoryCost: '1812.50',
    realProfit: '1027.50',
    shippingCover: '200.00',
  },
  holders: [
    {
      holder: null,
      salesCount: 1,
      units: 2,
      total: '500.00',
      factoryCost: '312.50',
      realProfit: '187.50',
      shippingCover: '0.00',
    },
    {
      holder: { id: LUIS.id, fullName: 'Luis Vendedor', active: true },
      salesCount: 3,
      units: 5,
      total: '1840.00',
      factoryCost: '1200.00',
      realProfit: '640.00',
      shippingCover: '200.00',
    },
    {
      holder: { id: ANA_ID, fullName: 'Ana Desactivada', active: false },
      salesCount: 1,
      units: 2,
      total: '500.00',
      factoryCost: '300.00',
      realProfit: '200.00',
      shippingCover: '0.00',
    },
  ],
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
// El mismo resumen con el periodo de «Día» (la selección al entrar).
const BUSINESS_DAY_CUT: CashCut = {
  ...BUSINESS_CUT,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
};
// Una respuesta sin la llave `holders`: el desglose no debe romper la pantalla.
const BUSINESS_WITHOUT_HOLDERS: CashCut = {
  holder: BUSINESS_DAY_CUT.holder,
  period: BUSINESS_DAY_CUT.period,
  totals: BUSINESS_DAY_CUT.totals,
  products: BUSINESS_DAY_CUT.products,
  sales: BUSINESS_DAY_CUT.sales,
};
const EMPTY_BUSINESS_CUT: CashCut = {
  holder: null,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: {
    salesCount: 0,
    units: 0,
    total: '0.00',
    factoryCost: '0.00',
    realProfit: '0.00',
    shippingCover: '0.00',
  },
  holders: [],
  products: [],
  sales: [],
};
// Ganancia real de Luis solo (HU-21): con desglose por producto y ventas, sin `holders`.
const LUIS_HOME_CUT: CashCut = {
  holder: LUIS,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: {
    salesCount: 1,
    units: 2,
    total: '1840.00',
    factoryCost: '1200.0000',
    realProfit: '640.00',
    shippingCover: '200.00',
  },
  products: BUSINESS_CUT.products,
  sales: BUSINESS_CUT.sales,
};
const WAREHOUSE_SELLER_CUT: CashCut = {
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

describe('AdminCashCutPageComponent · resumen del negocio', () => {
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
  const cutTypeOptions = () =>
    Array.from(document.querySelectorAll<HTMLElement>('li.p-select-option'));
  const holderNames = () =>
    Array.from(el().querySelectorAll('.holders app-cut-holder-line .holder-name')).map((node) =>
      node.textContent?.replace(/\s+/g, ' ').trim(),
    );

  // «Tipo de corte» es un Select de PrimeNG: se abre con un clic y la lista se monta en body.
  async function pickCutType(label: string) {
    (el().querySelector('p-select.cut-type') as HTMLElement).click();
    await settle();
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
  // El interruptor «Incluir a mis vendedores» (p-toggleswitch): solo existe con «Yo · bodega» y
  // «Ganancia real», así que se enciende después de elegir ese tipo.
  async function turnOnSellers() {
    (el().querySelector('p-toggleswitch.sellers-toggle input') as HTMLElement).click();
    await settle();
  }
  // «Yo · bodega» + «Ganancia real» + interruptor encendido + «Generar corte», respondido con `cut`.
  async function generateBusiness(cut: CashCut) {
    await pickCutType(HOME_OPTION);
    await turnOnSellers();
    click('.generate');
    return answer(cutRequest(), cut);
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
    vi.spyOn(service, 'getBusiness');
    fixture = TestBed.createComponent(AdminCashCutPageComponent);
    await settle();
  });

  afterEach(() => {
    vi.useRealTimers();
    fixture.destroy();
    document.querySelectorAll('.p-select-overlay').forEach((node) => node.remove());
    httpMock.verify();
  });

  describe('qué corte se pide', () => {
    it('con «Yo · bodega» y «Ganancia real» llama a getBusiness() y no a getHome() ni a get()', async () => {
      await pickWeek();
      await pickCutType(HOME_OPTION);
      await turnOnSellers();
      click('.generate');

      const params = await answer(cutRequest(), BUSINESS_CUT);
      expect(params.get('type')).toBe('home');
      expect(params.get('scope')).toBe('business');
      expect(params.get('period')).toBe('week');
      expect(params.get('date')).toBe('2026-11-02');
      expect(params.has('holderId')).toBe(false);
      expect(service.getBusiness).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'week', date: '2026-11-02' }),
      );
      expect(service.getHome).not.toHaveBeenCalled();
      expect(service.get).not.toHaveBeenCalled();
    });

    it('con un vendedor en «Viendo» y «Ganancia real» llama a getHome() con holderId y sin scope', async () => {
      seller.set(LUIS);
      await settle();
      await pickCutType(HOME_OPTION);
      click('.generate');

      const params = await answer(cutRequest(), LUIS_HOME_CUT);
      expect(params.get('type')).toBe('home');
      expect(params.get('holderId')).toBe(LUIS.id);
      expect(params.has('scope')).toBe(false);
      expect(service.getHome).toHaveBeenCalledWith(
        expect.objectContaining({ holderId: LUIS.id, period: 'day', date: '2026-11-04' }),
      );
      expect(service.getBusiness).not.toHaveBeenCalled();
      expect(service.get).not.toHaveBeenCalled();
    });

    it('con «Yo · bodega» «Ganancia del vendedor» no se puede elegir y «Generar corte» llama a getHome() sin scope', async () => {
      await pickCutType(PRICES_OPTION);
      click('.generate');

      const params = await answer(cutRequest(), LUIS_HOME_CUT);
      expect(params.get('type')).toBe('home');
      expect(params.has('scope')).toBe(false);
      expect(params.has('holderId')).toBe(false);
      expect(service.getHome).toHaveBeenCalledWith(
        expect.objectContaining({ holderId: null, period: 'day', date: '2026-11-04' }),
      );
      expect(service.getBusiness).not.toHaveBeenCalled();
      expect(service.get).not.toHaveBeenCalled();
    });
  });

  describe('resultado del resumen', () => {
    it('muestra «Ganancia real», «Todo el negocio» y los totales del negocio sin costos ni envíos', async () => {
      await generateBusiness(BUSINESS_DAY_CUT);

      expect(text('.result-title')).toBe('Ganancia real');
      expect(text('app-cut-summary .sold-caption')).toContain('Todo el negocio');
      expect(text('app-cut-summary .sold')).toBe('$2,840.00');
      expect(text('app-cut-summary .profit')).toBe('$1,027.50');
      expect(el().querySelector('app-cut-summary .shipping-cover')).toBeNull();
      expect(el().querySelector('app-cut-summary .factory-cost')).toBeNull();
      expect(text('.result')).not.toContain('Para cubrir envíos');
      expect(text('.result')).not.toContain('Costo de fábrica');
    });

    it('pinta «Por titular» con un renglón por titular en el orden de la respuesta', async () => {
      await generateBusiness(BUSINESS_DAY_CUT);

      expect(el().querySelector('.holders')).not.toBeNull();
      expect(text('.holders-title')).toBe('Por titular');
      expect(el().querySelectorAll('.holders app-cut-holder-line')).toHaveLength(3);
      expect(holderNames()).toEqual(['Bodega', 'Luis Vendedor', 'Ana Desactivada']);
    });

    it('un vendedor desactivado lleva «Desactivado» y los demás no', async () => {
      await generateBusiness(BUSINESS_DAY_CUT);

      const lines = Array.from(el().querySelectorAll('.holders app-cut-holder-line'));
      expect(lines).toHaveLength(3);
      expect(lines[0].querySelector('.inactive-tag')).toBeNull();
      expect(lines[1].querySelector('.inactive-tag')).toBeNull();
      expect(lines[2].querySelector('.inactive-tag')?.textContent?.trim()).toBe('Desactivado');
    });

    it('cada renglón pinta el vendido y la ganancia que llegan del backend', async () => {
      await generateBusiness(BUSINESS_DAY_CUT);

      const lines = Array.from(el().querySelectorAll('.holders app-cut-holder-line'));
      expect(lines).toHaveLength(3);
      expect(lines[1].querySelector('.sold')?.textContent?.trim()).toBe('$1,840.00');
      expect(lines[1].querySelector('.profit')?.textContent?.trim()).toBe('+$640.00');
    });

    it('no pinta el desglose por producto ni las ventas aunque la respuesta los traiga', async () => {
      await generateBusiness(BUSINESS_DAY_CUT);

      expect(el().querySelector('.result')).not.toBeNull();
      expect(el().querySelector('.holders')).not.toBeNull();
      expect(el().querySelector('.products')).toBeNull();
      expect(el().querySelector('.sales')).toBeNull();
      expect(el().querySelector('app-cut-product-line')).toBeNull();
      expect(el().querySelector('app-cut-sale-item')).toBeNull();
    });

    it('el corte para casa de un vendedor sí pinta productos y ventas, y no «Por titular»', async () => {
      seller.set(LUIS);
      await settle();
      await pickCutType(HOME_OPTION);
      click('.generate');
      await answer(cutRequest(), LUIS_HOME_CUT);

      expect(text('.result-title')).toBe('Ganancia real · Luis');
      expect(el().querySelector('.products app-cut-product-line')).not.toBeNull();
      expect(el().querySelector('.sales app-cut-sale-item')).not.toBeNull();
      expect(el().querySelector('.holders')).toBeNull();
    });

    it('los renglones de «Por titular» no se pueden tocar: sin botones ni enlaces', async () => {
      await generateBusiness(BUSINESS_DAY_CUT);

      const holders = el().querySelector('.holders');
      expect(holders).not.toBeNull();
      expect(holders?.querySelector('button')).toBeNull();
      expect(holders?.querySelector('a')).toBeNull();
    });

    it('una respuesta sin holders no rompe la pantalla y no pinta renglones', async () => {
      const params = await generateBusiness(BUSINESS_WITHOUT_HOLDERS);

      expect(params.get('scope')).toBe('business');
      expect(text('.result-title')).toBe('Ganancia real');
      expect(text('app-cut-summary .sold')).toBe('$2,840.00');
      expect(el().querySelector('app-cut-holder-line')).toBeNull();
      expect(el().querySelector('.products')).toBeNull();
    });
  });

  describe('descartar el resultado', () => {
    it('con «Yo · bodega» elegir «Ganancia del vendedor» no cambia nada y el resumen se conserva', async () => {
      const params = await generateBusiness(BUSINESS_DAY_CUT);
      expect(params.get('scope')).toBe('business');
      expect(el().querySelector('.result')).not.toBeNull();

      await pickCutType(PRICES_OPTION);
      expect(el().querySelector('.result')).not.toBeNull();
      expect(el().querySelector('.idle')).toBeNull();
    });

    it('cambiar el periodo a «Semana» quita el resumen', async () => {
      const params = await generateBusiness(BUSINESS_DAY_CUT);
      expect(params.get('scope')).toBe('business');
      expect(el().querySelector('.result')).not.toBeNull();

      await pickWeek();
      expect(el().querySelector('.result')).toBeNull();
      expect(el().querySelector('.idle')).not.toBeNull();
    });

    it('cambiar el titular de «Viendo» quita el resumen', async () => {
      const params = await generateBusiness(BUSINESS_DAY_CUT);
      expect(params.get('scope')).toBe('business');
      expect(el().querySelector('.result')).not.toBeNull();

      seller.set(LUIS);
      await settle();
      expect(el().querySelector('.result')).toBeNull();
      expect(el().querySelector('.idle')).not.toBeNull();
    });

    it('una respuesta tardía del resumen no se muestra después de cambiar el titular', async () => {
      await pickCutType(HOME_OPTION);
      await turnOnSellers();
      click('.generate');
      const late = cutRequest();
      const lateParams = late.request.params;

      seller.set(LUIS);
      fixture.detectChanges();
      // Si la petición sigue en vuelo, su respuesta llega tarde y debe ignorarse; si ya se canceló, no llega.
      if (!late.cancelled) late.flush({ cut: BUSINESS_DAY_CUT });
      await new Promise((resolve) => setTimeout(resolve));
      fixture.detectChanges();
      expect(lateParams.get('scope')).toBe('business');
      expect(el().querySelector('.result')).toBeNull();
      expect(el().querySelector('.holders')).toBeNull();
      expect(el().querySelector('.idle')).not.toBeNull();
    });
  });

  describe('volver a pedir', () => {
    it('«Generar de nuevo» vuelve a pedir el resumen del negocio', async () => {
      await generateBusiness(BUSINESS_DAY_CUT);

      click('.regenerate');
      fixture.detectChanges();
      const params = await answer(cutRequest(), BUSINESS_DAY_CUT);
      expect(params.get('type')).toBe('home');
      expect(params.get('scope')).toBe('business');
      expect(params.has('holderId')).toBe(false);
      expect(service.getBusiness).toHaveBeenCalledTimes(2);
      expect(service.getHome).not.toHaveBeenCalled();
      expect(text('.holders-title')).toBe('Por titular');
    });

    it('«Reintentar» tras un error vuelve a pedir el resumen del negocio', async () => {
      await pickCutType(HOME_OPTION);
      await turnOnSellers();
      click('.generate');
      const failed = cutRequest();
      const failedParams = failed.request.params;
      failed.error(new ProgressEvent('error'), { status: 0 });
      await settle();
      expect(failedParams.get('scope')).toBe('business');
      expect(text('.retry')).toBe('Reintentar');

      click('.retry');
      fixture.detectChanges();
      const params = await answer(cutRequest(), BUSINESS_DAY_CUT);
      expect(params.get('scope')).toBe('business');
      expect(service.getBusiness).toHaveBeenCalledTimes(2);
      expect(service.getHome).not.toHaveBeenCalled();
      expect(text('.holders-title')).toBe('Por titular');
    });
  });

  describe('estados', () => {
    it('mientras carga muestra «Calculando el corte…»', async () => {
      await pickCutType(HOME_OPTION);
      await turnOnSellers();
      click('.generate');
      fixture.detectChanges();
      expect(text('.loading')).toContain('Calculando el corte…');

      const params = await answer(cutRequest(), BUSINESS_DAY_CUT);
      expect(params.get('scope')).toBe('business');
      expect(el().querySelector('.loading')).toBeNull();
    });

    it('sin conexión muestra «No se pudo generar el corte» con «Reintentar»', async () => {
      await pickCutType(HOME_OPTION);
      await turnOnSellers();
      click('.generate');
      const failed = cutRequest();
      const failedParams = failed.request.params;
      failed.error(new ProgressEvent('error'), { status: 0 });
      await settle();

      expect(failedParams.get('scope')).toBe('business');
      expect(text('.error')).toContain('No se pudo generar el corte');
      expect(text('.retry')).toBe('Reintentar');
      expect(el().querySelector('.result')).toBeNull();
    });

    it('un error del servidor muestra «No se pudo generar el corte» con «Reintentar»', async () => {
      await pickCutType(HOME_OPTION);
      await turnOnSellers();
      click('.generate');
      const failed = cutRequest();
      const failedParams = failed.request.params;
      failed.flush(
        { error: { code: 'INTERNAL', message: 'Error interno' } },
        { status: 500, statusText: 'Internal Server Error' },
      );
      await settle();

      expect(failedParams.get('scope')).toBe('business');
      expect(text('.error')).toContain('No se pudo generar el corte');
      expect(text('.retry')).toBe('Reintentar');
      expect(el().querySelector('.result')).toBeNull();
    });

    it('un periodo sin ventas muestra el estado vacío y no un resumen en ceros', async () => {
      const params = await generateBusiness(EMPTY_BUSINESS_CUT);

      expect(params.get('scope')).toBe('business');
      expect(text('.empty')).toContain('No hay ventas en este periodo');
      expect(el().querySelector('.result')).toBeNull();
      expect(el().querySelector('app-cut-summary')).toBeNull();
      expect(el().querySelector('.holders')).toBeNull();
    });
  });
});
