import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { API_BASE_URL } from '@core/api-base-url';
import type { ViewingListStatus, ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import { ViewingService } from '@core/viewing/viewing.service';
import type { CashCut } from '../../interfaces/cash-cut.models';
import { CutProductLineComponent } from '../../components/cut-product-line/cut-product-line.component';
import { CutSaleItemComponent } from '../../components/cut-sale-item/cut-sale-item.component';
import { CutSummaryComponent } from '../../components/cut-summary/cut-summary.component';
import { CashCutService } from '../../services/cash-cut.service';
import { AdminCashCutPageComponent } from './admin-cash-cut-page.component';

const CUTS_URL = `${API_BASE_URL}/api/cuts`;
const LUIS: ViewingSeller = { id: '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b', fullName: 'Luis Pérez' };
const PRICES_HELP = 'Con el costo con envío que le pusiste a cada vendedor.';
const HOME_HELP = 'Con el costo de fábrica de cada venta.';
const HOME_OPTION = 'Ganancia real';
const GENERATED_AT = /^Generado hoy a las \d{2}:\d{2}$/;

// Ganancia del vendedor de Luis en el día: 2 piezas a $920 con costo con envío $700.
const SELLER_CUT: CashCut = {
  holder: LUIS,
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
  sales: [
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
// Ganancia real de Luis en el día: la misma venta con costo de fábrica $600 (criterio 3).
const HOME_CUT: CashCut = {
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

// Lo único que esta prueba lee de cada componente hijo: el valor de su input `layout`.
type LayoutReader = { layout?: () => string };
type CutChild =
  typeof CutSummaryComponent | typeof CutProductLineComponent | typeof CutSaleItemComponent;

describe('AdminCashCutPageComponent · layout overview', () => {
  let fixture: ComponentFixture<AdminCashCutPageComponent>;
  let httpMock: HttpTestingController;
  let service: CashCutService;
  // «Viendo» simulado: la página solo lee estas tres señales.
  const seller = signal<ViewingSeller | null>(null);
  const listStatus = signal<ViewingListStatus>('ready');
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const allText = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ') ?? '';
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
  // Layout que la página le pasó a cada instancia de un componente hijo.
  const layoutsOf = (component: CutChild) =>
    fixture.debugElement
      .queryAll(By.directive(component))
      .map((node) => (node.componentInstance as LayoutReader).layout?.());
  // true si `first` aparece antes que `second` en el documento.
  const comesBefore = (first: string, second: string) => {
    const a = el().querySelector(first);
    const b = el().querySelector(second);
    if (!a || !b) return false;
    return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  };

  // «Tipo de corte» es un Select de PrimeNG: se abre con un clic y la lista se monta en body.
  async function pickCutType(label: string) {
    (el().querySelector('p-select.cut-type') as HTMLElement).click();
    await settle();
    cutTypeOptions()
      .find((o) => o.textContent?.trim().startsWith(label))
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
  async function generateFor(cutType: 'seller' | 'home') {
    seller.set(LUIS);
    await settle();
    if (cutType === 'home') await pickCutType(HOME_OPTION);
    click('.generate');
    return answer(cutRequest(), cutType === 'home' ? HOME_CUT : SELLER_CUT);
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

  it('con «Ganancia del vendedor» pasa layout="overview" al resumen, al desglose y a las ventas', async () => {
    await generateFor('seller');
    expect(layoutsOf(CutSummaryComponent)).toEqual(['overview']);
    expect(layoutsOf(CutProductLineComponent)).toEqual(['overview']);
    expect(layoutsOf(CutSaleItemComponent)).toEqual(['overview']);
  });

  it('con «Ganancia real» pasa layout="overview" al resumen, al desglose y a las ventas', async () => {
    await generateFor('home');
    expect(layoutsOf(CutSummaryComponent)).toEqual(['overview']);
    expect(layoutsOf(CutProductLineComponent)).toEqual(['overview']);
    expect(layoutsOf(CutSaleItemComponent)).toEqual(['overview']);
  });

  it('con «Ganancia del vendedor» el resultado muestra solo Vendido y Ganancia, sin costos', async () => {
    await generateFor('seller');
    expect(text('app-cut-summary .sold')).toBe('$1,840.00');
    expect(text('app-cut-summary .sold-caption')).toBe('Vendió Luis · mié 4 nov · 2 piezas');
    expect(text('app-cut-summary .profit-label')).toBe('Ganancia');
    expect(text('app-cut-summary .profit')).toBe('$440.00');
    expect(el().querySelector('app-cut-summary .cost')).toBeNull();
    expect(el().querySelector('app-cut-summary .cost-label')).toBeNull();
    expect(el().querySelector('.products app-cut-product-line .cost')).toBeNull();
    expect(text('.products app-cut-product-line .profit')).toBe('+$440.00');
    expect(text('.sales app-cut-sale-item .profit')).toBe('Ganancia $440.00');
    expect(allText('.result')).not.toContain('Costo con envío');
    expect(allText('.result')).not.toContain('costo con envío');
  });

  it('con «Ganancia real» el resultado muestra solo Vendido y la ganancia real como «Ganancia», sin costos', async () => {
    await generateFor('home');
    expect(text('app-cut-summary .sold')).toBe('$1,840.00');
    expect(text('app-cut-summary .profit-label')).toBe('Ganancia');
    expect(text('app-cut-summary .profit')).toBe('$640.00');
    expect(el().querySelector('app-cut-summary .factory-cost')).toBeNull();
    expect(el().querySelector('app-cut-summary .real-profit')).toBeNull();
    expect(el().querySelector('.products app-cut-product-line .factory-cost')).toBeNull();
    expect(el().querySelector('.products app-cut-product-line .real-profit')).toBeNull();
    expect(text('.products app-cut-product-line .profit')).toBe('+$640.00');
    expect(text('.sales app-cut-sale-item .profit')).toBe('Ganancia $640.00');
    expect(allText('.result')).not.toContain('Costo de fábrica');
    expect(allText('app-cut-summary')).not.toContain('Ganancia real');
  });

  it('con «Ganancia del vendedor» «Generado…» y «Generar de nuevo» van al pie de la tarjeta del resumen, debajo del título', async () => {
    await generateFor('seller');
    expect(el().querySelectorAll('.generated-at')).toHaveLength(1);
    expect(el().querySelectorAll('.regenerate')).toHaveLength(1);
    expect(text('app-cut-summary .generated-at') ?? '').toMatch(GENERATED_AT);
    expect(text('app-cut-summary .regenerate')).toBe('Generar de nuevo');
    expect(comesBefore('.result-title', '.generated-at')).toBe(true);
    expect(comesBefore('app-cut-summary .profit', 'app-cut-summary .generated-at')).toBe(true);
  });

  it('con «Ganancia real» «Generado…» y «Generar de nuevo» van al pie de la tarjeta del resumen, debajo del título', async () => {
    await generateFor('home');
    expect(el().querySelectorAll('.generated-at')).toHaveLength(1);
    expect(el().querySelectorAll('.regenerate')).toHaveLength(1);
    expect(text('app-cut-summary .generated-at') ?? '').toMatch(GENERATED_AT);
    expect(text('app-cut-summary .regenerate')).toBe('Generar de nuevo');
    expect(comesBefore('.result-title', '.generated-at')).toBe(true);
    expect(comesBefore('app-cut-summary .profit', 'app-cut-summary .generated-at')).toBe(true);
  });

  it('«Generar de nuevo» del pie del resumen vuelve a pedir el corte del vendedor', async () => {
    await generateFor('seller');
    expect(el().querySelector('app-cut-summary .regenerate')).not.toBeNull();

    click('app-cut-summary .regenerate');
    const params = await answer(cutRequest(), SELLER_CUT);
    expect(params.has('type')).toBe(false);
    expect(params.get('holderId')).toBe(LUIS.id);
    expect(params.get('date')).toBe('2026-11-04');
    expect(service.get).toHaveBeenCalledTimes(2);
    expect(service.getHome).not.toHaveBeenCalled();
  });

  it('«Generar de nuevo» del pie del resumen vuelve a pedir el corte de casa', async () => {
    await generateFor('home');
    expect(el().querySelector('app-cut-summary .regenerate')).not.toBeNull();

    click('app-cut-summary .regenerate');
    const params = await answer(cutRequest(), HOME_CUT);
    expect(params.get('type')).toBe('home');
    expect(params.get('holderId')).toBe(LUIS.id);
    expect(params.get('date')).toBe('2026-11-04');
    expect(service.getHome).toHaveBeenCalledTimes(2);
    expect(service.get).not.toHaveBeenCalled();
  });

  it('el título del resultado y la ayuda del selector no cambian con el layout nuevo', async () => {
    await generateFor('seller');
    expect(text('.result-title')).toBe('Ganancia del vendedor · Luis');
    expect(selectionText()).toContain(PRICES_HELP);

    await pickCutType(HOME_OPTION);
    click('.generate');
    await answer(cutRequest(), HOME_CUT);
    expect(text('.result-title')).toBe('Ganancia real · Luis');
    expect(selectionText()).toContain(HOME_HELP);
  });
});
