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
const HOME_OPTION = 'Ganancia real';
const PRICES_OPTION = 'Ganancia del vendedor';
const TOGGLE_LABEL = 'Incluir a mis vendedores';
const HELP_OFF = 'Solo lo que vendiste desde la bodega.';
const HELP_ON = 'Suma lo que vendieron tus vendedores.';

const PRODUCTS: CashCut['products'] = [
  {
    productId: 3,
    name: 'Proteína Whey',
    image: null,
    unitPrice: '250.00',
    units: 2,
    total: '500.00',
    factoryCost: '312.5000',
    realProfit: '187.50',
    shippingCover: '0.00',
  },
];
const SALES: CashCut['sales'] = [
  {
    requestId: 'r-1',
    soldAt: '2026-11-04T18:00:00Z',
    registeredByAdmin: true,
    soldBy: { id: 'a1b2c3d4-0000-4000-8000-000000000001', fullName: 'Admin Mammut' },
    total: '500.00',
    realProfit: '187.50',
    shippingCover: '0.00',
    lines: [
      {
        productId: 3,
        name: 'Proteína Whey',
        qty: 2,
        unitPrice: '250.00',
        subtotal: '500.00',
        factoryUnitCost: '156.2500',
        realProfit: '187.50',
      },
    ],
  },
];
// Ganancia real de la bodega sola (HU-21, interruptor apagado): $500 vendidos, sin `holders`.
const WAREHOUSE_HOME_CUT: CashCut = {
  holder: null,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: {
    salesCount: 1,
    units: 2,
    total: '500.00',
    factoryCost: '312.5000',
    realProfit: '187.50',
    shippingCover: '0.00',
  },
  products: PRODUCTS,
  sales: SALES,
};
// Resumen del negocio del día (interruptor encendido): bodega $500 y Luis $1,840 dan $2,340.
// Los totales ya vienen sumados por el backend. Trae `products` y `sales` a propósito: no se pintan.
const BUSINESS_DAY_CUT: CashCut = {
  holder: null,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: {
    salesCount: 4,
    units: 7,
    total: '2340.00',
    factoryCost: '1512.50',
    realProfit: '827.50',
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
  ],
  products: PRODUCTS,
  sales: SALES,
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
// Ganancia real de Luis solo (HU-21): sin `holders`.
const LUIS_HOME_CUT: CashCut = {
  holder: LUIS,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: {
    salesCount: 3,
    units: 5,
    total: '1840.00',
    factoryCost: '1200.0000',
    realProfit: '640.00',
    shippingCover: '200.00',
  },
  products: PRODUCTS,
  sales: SALES,
};
const WAREHOUSE_SELLER_CUT: CashCut = {
  holder: null,
  period: { kind: 'day', from: '2026-11-04', to: '2026-11-04', timeZone: 'America/Mexico_City' },
  totals: { salesCount: 1, units: 2, total: '500.00', cost: '400.0000', profit: '100.00' },
  products: [
    {
      productId: 3,
      name: 'Proteína Whey',
      image: null,
      unitPrice: '250.00',
      units: 2,
      total: '500.00',
      cost: '400.0000',
      profit: '100.00',
    },
  ],
  sales: [],
};

describe('AdminCashCutPageComponent · interruptor «Incluir a mis vendedores»', () => {
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
  const toggleField = () => el().querySelector('.sellers-toggle-field');
  const toggleInput = () =>
    el().querySelector<HTMLInputElement>('p-toggleswitch.sellers-toggle input');

  // «Tipo de corte» es un Select de PrimeNG: se abre con un clic y la lista se monta en body.
  async function pickCutType(label: string) {
    (el().querySelector('p-select.cut-type') as HTMLElement).click();
    await settle();
    cutTypeOptions()
      .find((o) => o.textContent?.trim().startsWith(label))
      ?.click();
    await settle();
  }
  // El interruptor (p-toggleswitch) se cambia con un clic sobre su control nativo; sirve para
  // encenderlo y para apagarlo.
  async function toggleSellers() {
    (el().querySelector('p-toggleswitch.sellers-toggle input') as HTMLElement).click();
    await settle();
  }
  // Igual que toggleSellers, sin esperar a whenStable: con una petición en vuelo nunca queda estable.
  function toggleSellersWhileLoading() {
    (el().querySelector('p-toggleswitch.sellers-toggle input') as HTMLElement).click();
    fixture.detectChanges();
  }
  // Responde la petición y devuelve sus parámetros: así ninguna queda abierta si falla una aserción.
  async function answer(req: TestRequest, cut: CashCut) {
    const params = req.request.params;
    req.flush({ cut });
    await settle();
    return params;
  }
  async function failRequest() {
    const failed = cutRequest();
    const params = failed.request.params;
    failed.error(new ProgressEvent('error'), { status: 0 });
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

  describe('cuándo aparece', () => {
    it('al entrar con «Yo · bodega» está elegido «Ganancia real» y el interruptor existe', () => {
      expect(el().querySelector('p-select.cut-type')).not.toBeNull();
      expect(text('p-select.cut-type')).toContain(HOME_OPTION);
      expect(toggleField()).not.toBeNull();
    });

    it('no existe al entrar con un vendedor en «Viendo» y «Ganancia del vendedor»', async () => {
      seller.set(LUIS);
      await settle();
      expect(text('p-select.cut-type')).toContain(PRICES_OPTION);
      expect(toggleField()).toBeNull();
      expect(el().querySelector('p-toggleswitch.sellers-toggle')).toBeNull();
    });

    it('aparece al elegir «Ganancia real» con «Yo · bodega»', async () => {
      await pickCutType(HOME_OPTION);

      expect(toggleField()).not.toBeNull();
      expect(toggleInput()).not.toBeNull();
      expect(text('.sellers-toggle-label')).toBe(TOGGLE_LABEL);
    });

    it('desaparece al elegir un vendedor, que vuelve a «Ganancia del vendedor»', async () => {
      await pickCutType(HOME_OPTION);
      expect(toggleField()).not.toBeNull();

      seller.set(LUIS);
      await settle();
      expect(text('p-select.cut-type')).toContain(PRICES_OPTION);
      expect(toggleField()).toBeNull();
    });

    it('no existe con un vendedor en «Viendo» aunque esté «Ganancia real»', async () => {
      await pickCutType(HOME_OPTION);
      expect(toggleField()).not.toBeNull();

      seller.set(LUIS);
      await settle();
      expect(toggleField()).toBeNull();
    });

    it('reaparece al volver a «Yo · bodega» con «Ganancia real»', async () => {
      seller.set(LUIS);
      await settle();
      await pickCutType(HOME_OPTION);
      expect(toggleField()).toBeNull();

      seller.set(null);
      await settle();
      expect(toggleField()).not.toBeNull();
    });
  });

  describe('valor inicial', () => {
    it('arranca apagado', async () => {
      await pickCutType(HOME_OPTION);

      const input = toggleInput();
      expect(input).not.toBeNull();
      expect(input?.checked).toBe(false);
      expect(input?.getAttribute('aria-checked')).toBe('false');
    });

    it('la ayuda dice «Solo lo que vendiste desde la bodega.»', async () => {
      await pickCutType(HOME_OPTION);

      expect(text('.sellers-toggle-help')).toBe(HELP_OFF);
    });

    it('al encenderlo la ayuda dice «Suma lo que vendieron tus vendedores.»', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();

      expect(toggleInput()?.checked).toBe(true);
      expect(text('.sellers-toggle-help')).toBe(HELP_ON);
    });
  });

  describe('apagado: corte para casa de la bodega sola', () => {
    it('«Generar corte» llama a getHome() sin scope ni holderId', async () => {
      await pickCutType(HOME_OPTION);
      expect(toggleField()).not.toBeNull();
      click('.generate');

      const params = await answer(cutRequest(), WAREHOUSE_HOME_CUT);
      expect(params.get('type')).toBe('home');
      expect(params.has('scope')).toBe(false);
      expect(params.has('holderId')).toBe(false);
      expect(params.get('period')).toBe('day');
      expect(params.get('date')).toBe('2026-11-04');
      expect(service.getHome).toHaveBeenCalled();
      expect(service.getBusiness).not.toHaveBeenCalled();
      expect(service.get).not.toHaveBeenCalled();
    });

    it('la leyenda dice «Mis ventas desde bodega», sin «Por titular», con productos y ventas', async () => {
      await pickCutType(HOME_OPTION);
      expect(toggleField()).not.toBeNull();
      click('.generate');
      await answer(cutRequest(), WAREHOUSE_HOME_CUT);

      expect(text('app-cut-summary .sold-caption')).toContain('Mis ventas desde bodega');
      expect(text('app-cut-summary .sold')).toBe('$500.00');
      expect(el().querySelector('.holders')).toBeNull();
      expect(el().querySelector('.products')).not.toBeNull();
      expect(el().querySelector('.sales')).not.toBeNull();
    });
  });

  describe('encendido: resumen del negocio', () => {
    it('«Generar corte» llama a getBusiness() con scope=business y sin holderId', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();
      click('.generate');

      const params = await answer(cutRequest(), BUSINESS_DAY_CUT);
      expect(params.get('type')).toBe('home');
      expect(params.get('scope')).toBe('business');
      expect(params.has('holderId')).toBe(false);
      expect(service.getBusiness).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'day', date: '2026-11-04' }),
      );
      expect(service.getHome).not.toHaveBeenCalled();
      expect(service.get).not.toHaveBeenCalled();
    });

    it('pinta «Todo el negocio» y «Por titular», sin productos ni ventas', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();
      click('.generate');
      await answer(cutRequest(), BUSINESS_DAY_CUT);

      expect(text('app-cut-summary .sold-caption')).toContain('Todo el negocio');
      expect(text('app-cut-summary .sold')).toBe('$2,340.00');
      expect(el().querySelector('.holders')).not.toBeNull();
      expect(text('.holders-title')).toBe('Por titular');
      expect(el().querySelector('.products')).toBeNull();
      expect(el().querySelector('.sales')).toBeNull();
      expect(text('.sellers-toggle-help')).toBe(HELP_ON);
    });
  });

  describe('cambiar el interruptor descarta el corte', () => {
    it('encenderlo con el corte de la bodega generado lo quita', async () => {
      await pickCutType(HOME_OPTION);
      expect(toggleField()).not.toBeNull();
      click('.generate');
      await answer(cutRequest(), WAREHOUSE_HOME_CUT);
      expect(el().querySelector('.result')).not.toBeNull();

      await toggleSellers();
      expect(el().querySelector('.result')).toBeNull();
      expect(el().querySelector('.idle')).not.toBeNull();
    });

    it('apagarlo con el resumen del negocio generado lo quita', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();
      click('.generate');
      await answer(cutRequest(), BUSINESS_DAY_CUT);
      expect(el().querySelector('.result')).not.toBeNull();

      await toggleSellers();
      expect(el().querySelector('.result')).toBeNull();
      expect(el().querySelector('.idle')).not.toBeNull();
    });

    it('una respuesta tardía no se muestra después de cambiar el interruptor', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();
      click('.generate');
      const late = cutRequest();
      const lateParams = late.request.params;

      toggleSellersWhileLoading();
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

  describe('volver a pedir el mismo corte', () => {
    it('apagado, «Generar de nuevo» repite getHome() sin scope', async () => {
      await pickCutType(HOME_OPTION);
      expect(toggleField()).not.toBeNull();
      click('.generate');
      await answer(cutRequest(), WAREHOUSE_HOME_CUT);

      click('.regenerate');
      fixture.detectChanges();
      const params = await answer(cutRequest(), WAREHOUSE_HOME_CUT);
      expect(params.get('type')).toBe('home');
      expect(params.has('scope')).toBe(false);
      expect(service.getHome).toHaveBeenCalledTimes(2);
      expect(service.getBusiness).not.toHaveBeenCalled();
    });

    it('encendido, «Generar de nuevo» repite getBusiness() con scope=business', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();
      click('.generate');
      await answer(cutRequest(), BUSINESS_DAY_CUT);

      click('.regenerate');
      fixture.detectChanges();
      const params = await answer(cutRequest(), BUSINESS_DAY_CUT);
      expect(params.get('scope')).toBe('business');
      expect(service.getBusiness).toHaveBeenCalledTimes(2);
      expect(service.getHome).not.toHaveBeenCalled();
    });

    it('apagado, «Reintentar» tras un error repite getHome() sin scope', async () => {
      await pickCutType(HOME_OPTION);
      expect(toggleField()).not.toBeNull();
      click('.generate');
      const failedParams = await failRequest();
      expect(failedParams.has('scope')).toBe(false);
      expect(text('.retry')).toBe('Reintentar');

      click('.retry');
      fixture.detectChanges();
      const params = await answer(cutRequest(), WAREHOUSE_HOME_CUT);
      expect(params.get('type')).toBe('home');
      expect(params.has('scope')).toBe(false);
      expect(service.getHome).toHaveBeenCalledTimes(2);
      expect(service.getBusiness).not.toHaveBeenCalled();
    });

    it('encendido, «Reintentar» tras un error repite getBusiness() con scope=business', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();
      click('.generate');
      const failedParams = await failRequest();
      expect(failedParams.get('scope')).toBe('business');
      expect(text('.retry')).toBe('Reintentar');

      click('.retry');
      fixture.detectChanges();
      const params = await answer(cutRequest(), BUSINESS_DAY_CUT);
      expect(params.get('scope')).toBe('business');
      expect(service.getBusiness).toHaveBeenCalledTimes(2);
      expect(service.getHome).not.toHaveBeenCalled();
    });
  });

  describe('si el interruptor desaparece encendido', () => {
    it('al elegir un vendedor vuelve a «Ganancia del vendedor», se oculta y se pide get() sin type ni scope', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();
      expect(toggleInput()?.checked).toBe(true);

      seller.set(LUIS);
      await settle();
      expect(toggleField()).toBeNull();
      click('.generate');

      const params = await answer(cutRequest(), WAREHOUSE_SELLER_CUT);
      expect(params.has('type')).toBe(false);
      expect(params.has('scope')).toBe(false);
      expect(params.get('holderId')).toBe(LUIS.id);
      expect(service.get).toHaveBeenCalled();
      expect(service.getBusiness).not.toHaveBeenCalled();
      expect(service.getHome).not.toHaveBeenCalled();
    });

    it('con un vendedor en «Viendo» y «Ganancia real» se pide getHome() con holderId y sin scope', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();
      expect(toggleInput()?.checked).toBe(true);

      seller.set(LUIS);
      await settle();
      await pickCutType(HOME_OPTION);
      expect(toggleField()).toBeNull();
      click('.generate');

      const params = await answer(cutRequest(), LUIS_HOME_CUT);
      expect(params.get('type')).toBe('home');
      expect(params.get('holderId')).toBe(LUIS.id);
      expect(params.has('scope')).toBe(false);
      expect(service.getHome).toHaveBeenCalledWith(
        expect.objectContaining({ holderId: LUIS.id, period: 'day', date: '2026-11-04' }),
      );
      expect(service.getBusiness).not.toHaveBeenCalled();
    });
  });

  describe('accesibilidad', () => {
    it('la etiqueta «Incluir a mis vendedores» está asociada al control', async () => {
      await pickCutType(HOME_OPTION);

      const label = el().querySelector<HTMLElement>('.sellers-toggle-label');
      const input = toggleInput();
      expect(label?.textContent?.trim()).toBe(TOGGLE_LABEL);
      expect(input).not.toBeNull();
      const byFor = !!label?.getAttribute('for') && label.getAttribute('for') === input?.id;
      const byLabelledBy = !!label?.id && input?.getAttribute('aria-labelledby') === label.id;
      expect(byFor || byLabelledBy).toBe(true);
    });

    it('es un único control con rol switch', async () => {
      await pickCutType(HOME_OPTION);

      const switches = el().querySelectorAll('.sellers-toggle-field [role="switch"]');
      expect(switches).toHaveLength(1);
      expect(switches[0]).toBe(toggleInput());
      expect(switches[0].getAttribute('aria-checked')).toBe('false');
    });
  });

  describe('estados con el interruptor encendido', () => {
    it('un periodo sin ventas muestra «No hay ventas en este periodo» sin «Por titular»', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();
      click('.generate');
      const params = await answer(cutRequest(), EMPTY_BUSINESS_CUT);

      expect(params.get('scope')).toBe('business');
      expect(text('.empty')).toContain('No hay ventas en este periodo');
      expect(el().querySelector('.holders')).toBeNull();
      expect(el().querySelector('.result')).toBeNull();
    });

    it('un error muestra «No se pudo generar el corte» con «Reintentar»', async () => {
      await pickCutType(HOME_OPTION);
      await toggleSellers();
      click('.generate');
      const params = await failRequest();

      expect(params.get('scope')).toBe('business');
      expect(text('.error')).toContain('No se pudo generar el corte');
      expect(text('.retry')).toBe('Reintentar');
      expect(el().querySelector('.result')).toBeNull();
    });
  });
});
