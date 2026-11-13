import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import type { ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import { ViewingService } from '@core/viewing/viewing.service';
import type { StockOverview } from '../../interfaces/stock-overview.models';
import type { FractionHistoryItem, ShrinkageHistoryItem } from '../../interfaces/stock-history.models';
import { StockPageComponent } from './stock-page.component';

const STOCK_URL = `${API_BASE_URL}/api/stock`;
const SHRINKAGES_URL = `${API_BASE_URL}/api/shrinkages`;
const FRACTIONS_URL = `${API_BASE_URL}/api/fractions`;
const LUIS: ViewingSeller = { id: 'luis-id', fullName: 'Luis' };

const OVERVIEW: StockOverview = {
  warehouse: 8,
  sellers: [{ id: LUIS.id, fullName: 'Luis', units: 6 }],
  inactiveSellers: 0,
  total: 14,
  products: [
    { productId: 1, name: 'Creatina', image: null, warehouse: 8, warehouseLevel: 'ok', sellers: [], inactiveSellers: 0, total: 8 },
    {
      productId: 2, name: 'Proteína Whey', image: null, warehouse: 0, warehouseLevel: 'out',
      sellers: [{ sellerId: LUIS.id, units: 6, stockLevel: 'ok' }], inactiveSellers: 0, total: 6,
    },
  ],
  lowStock: [],
};

const shrinkage = (id: number, name: string, holder: ShrinkageHistoryItem['holder']): ShrinkageHistoryItem => ({
  requestId: `s-${id}`,
  createdAt: '2026-11-08T10:00:00Z',
  qty: id,
  reason: 'damaged',
  reasonLabel: 'Dañado',
  holder,
  product: { id, name, image: null },
});
const SHRINKAGES = [shrinkage(1, 'Creatina 300 g', null), shrinkage(2, 'Proteína Whey', LUIS)];

const fraction = (id: number, whole: string, bag: string): FractionHistoryItem => ({
  id,
  requestId: `f-${id}`,
  createdAt: '2026-11-07T16:00:00Z',
  portions: 7,
  wholeUnitCost: '450.0000',
  portionUnitCost: '64.2857',
  portionPrice: '85.00',
  product: { id: id * 10, name: whole },
  portionProduct: { id: id * 10 + 1, name: bag },
  createdBy: { id: 'a-1', name: 'Ana Admin' },
});
const FRACTIONS = [
  fraction(1, 'Creatina 300 g', 'Creatina 300 g · bolsita 30 g'),
  fraction(2, 'Proteína Whey', 'Proteína Whey · bolsita 40 g'),
];

describe('StockPageComponent · selector de vista «Productos | Mermas | Fraccionados» (HU-26 §12)', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;
  let router: Router;
  let selected: ReturnType<typeof signal<ViewingSeller | null>>;
  const el = () => harness.fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const options = () => Array.from(el().querySelectorAll('p-selectbutton p-togglebutton'));
  const optionLabels = () => options().map((option) => option.textContent!.trim());
  const option = (label: string) => options().find((o) => o.textContent!.trim() === label) as HTMLElement;
  const pressed = () => options().filter((o) => o.getAttribute('aria-pressed') === 'true').map((o) => o.textContent!.trim());
  const settle = async () => {
    harness.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  };
  const shrinkageRequest = (): TestRequest => httpMock.expectOne((r) => r.url === SHRINKAGES_URL);
  const choose = async (label: string) => {
    option(label).click();
    await settle();
  };
  const search = async (value: string) => {
    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const lines = (selector: string) => Array.from(el().querySelectorAll(selector));

  async function open(url = '/admin/stock') {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, StockPageComponent);
    harness.detectChanges();
    httpMock.expectOne(STOCK_URL).flush(OVERVIEW);
    await settle();
  }

  beforeEach(() => {
    selected = signal<ViewingSeller | null>(null);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/stock', component: StockPageComponent }]),
        { provide: ViewingService, useValue: { selectedSeller: selected.asReadonly() } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
    sessionStorage.clear();
  });

  describe('selector y URL', () => {
    it('con «Yo · bodega» ofrece Productos, Mermas y Fraccionados, con «Productos» elegido por omisión', async () => {
      await open();
      expect(optionLabels()).toEqual(['Productos', 'Mermas', 'Fraccionados']);
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(pressed()).toEqual(['Productos']);
      expect(lines('app-stock-product-row')).toHaveLength(2);
    });

    it('el selector va después de la fila de movimientos rápidos y antes del buscador', async () => {
      await open();
      const select = el().querySelector('p-selectbutton')!;
      const quick = el().querySelector('app-stock-quick-actions')!;
      const searchInput = el().querySelector('input[type="search"]')!;
      expect(quick.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(select.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('sin vista o con una desconocida cae en «Productos» y no pide mermas ni fraccionados', async () => {
      await open('/admin/stock?vista=otra');
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(pressed()).toEqual(['Productos']);
      expect(lines('app-stock-product-row')).toHaveLength(2);
    });

    it('elegir «Mermas» deja ?vista=mermas en la URL y pide la lista solo entonces', async () => {
      await open();
      await choose('Mermas');
      expect(router.url).toBe('/admin/stock?vista=mermas');
      shrinkageRequest().flush(SHRINKAGES);
      await settle();
      expect(pressed()).toEqual(['Mermas']);
      expect(lines('app-shrinkage-history-line')).toHaveLength(2);
      expect(lines('app-stock-product-row')).toHaveLength(0);
    });

    it('elegir «Fraccionados» deja ?vista=fraccionados y pinta sus filas', async () => {
      await open();
      await choose('Fraccionados');
      expect(router.url).toBe('/admin/stock?vista=fraccionados');
      httpMock.expectOne(FRACTIONS_URL).flush({ fractions: FRACTIONS });
      await settle();
      expect(pressed()).toEqual(['Fraccionados']);
      expect(lines('app-fraction-history-line')).toHaveLength(2);
    });

    it('entrar con ?vista=mermas abre directo la vista de mermas', async () => {
      await open('/admin/stock?vista=mermas');
      shrinkageRequest().flush(SHRINKAGES);
      await settle();
      expect(pressed()).toEqual(['Mermas']);
      expect(lines('app-shrinkage-history-line')).toHaveLength(2);
    });

    it('entrar con ?vista=fraccionados abre directo la vista de fraccionados', async () => {
      await open('/admin/stock?vista=fraccionados');
      httpMock.expectOne(FRACTIONS_URL).flush({ fractions: FRACTIONS });
      await settle();
      expect(pressed()).toEqual(['Fraccionados']);
      expect(lines('app-fraction-history-line')).toHaveLength(2);
    });

    it('volver a «Productos» muestra la lista de productos otra vez', async () => {
      await open('/admin/stock?vista=mermas');
      shrinkageRequest().flush(SHRINKAGES);
      await settle();
      await choose('Productos');
      expect(pressed()).toEqual(['Productos']);
      expect(lines('app-stock-product-row')).toHaveLength(2);
      expect(lines('app-shrinkage-history-line')).toHaveLength(0);
    });

    it('sigue habiendo ocho movimientos rápidos y ningún enlace «Ver mermas» ni «Ver fraccionados»', async () => {
      await open();
      const labels = Array.from(el().querySelectorAll('a')).map((a) => a.textContent!.trim());
      expect(lines('a.quick-action')).toHaveLength(8);
      expect(labels).not.toContain('Ver mermas');
      expect(labels).not.toContain('Ver fraccionados');
    });
  });

  describe('con un vendedor en «Viendo»', () => {
    it('el selector ofrece «Fraccionados»', async () => {
      selected.set(LUIS);
      await open();
      expect(optionLabels()).toEqual(['Productos', 'Mermas', 'Fraccionados']);
      expect(lines('a.quick-action')).toHaveLength(3);
    });

    it('con ?vista=fraccionados abre las bolsitas del vendedor sin pedir el historial', async () => {
      selected.set(LUIS);
      await open('/admin/stock?vista=fraccionados');
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(pressed()).toEqual(['Fraccionados']);
      expect(text()).toContain('Bolsitas en stock');
      expect(lines('app-fraction-history-line')).toHaveLength(0);
    });

    it('si estaba en «Fraccionados» y se elige un vendedor, se queda en «Fraccionados» con las bolsitas del vendedor', async () => {
      await open('/admin/stock?vista=fraccionados');
      httpMock.expectOne(FRACTIONS_URL).flush({ fractions: FRACTIONS });
      await settle();
      selected.set(LUIS);
      await settle();
      await harness.fixture.whenStable();
      harness.detectChanges();
      expect(pressed()).toEqual(['Fraccionados']);
      expect(optionLabels()).toContain('Fraccionados');
      expect(lines('app-fraction-history-line')).toHaveLength(0);
    });

    it('«Mermas» pide solo las del vendedor (?sellerId=) y no pinta el titular en la fila', async () => {
      selected.set(LUIS);
      await open('/admin/stock?vista=mermas');
      const req = shrinkageRequest();
      expect(req.request.params.get('sellerId')).toBe(LUIS.id);
      req.flush([SHRINKAGES[1]!]);
      await settle();
      expect(lines('app-shrinkage-history-line')).toHaveLength(1);
      expect(lines('app-shrinkage-history-line .holder')).toHaveLength(0);
    });

    it('cambiar «Viendo» con «Mermas» abierta vuelve a pedir la lista', async () => {
      await open('/admin/stock?vista=mermas');
      shrinkageRequest().flush(SHRINKAGES);
      await settle();
      selected.set(LUIS);
      await settle();
      const req = shrinkageRequest();
      expect(req.request.params.get('sellerId')).toBe(LUIS.id);
      req.flush([SHRINKAGES[1]!]);
    });
  });

  describe('mermas con «Yo · bodega»', () => {
    it('muestra todas con su titular en la fila', async () => {
      await open('/admin/stock?vista=mermas');
      const req = shrinkageRequest();
      expect(req.request.params.keys()).toEqual([]);
      req.flush(SHRINKAGES);
      await settle();
      const holders = lines('app-shrinkage-history-line .holder').map((p) => p.textContent!.trim());
      expect(holders).toEqual(['Bodega', 'Luis']);
    });

    it('se vuelve a pedir cuando StockChangesService avisa un cambio', async () => {
      await open('/admin/stock?vista=mermas');
      shrinkageRequest().flush(SHRINKAGES);
      await settle();
      TestBed.inject(StockChangesService).notify();
      await settle();
      httpMock.expectOne(STOCK_URL).flush(OVERVIEW);
      shrinkageRequest().flush(SHRINKAGES);
    });
  });

  describe('buscador por vista', () => {
    it('en «Mermas» filtra por producto sin mayúsculas ni acentos', async () => {
      await open('/admin/stock?vista=mermas');
      shrinkageRequest().flush(SHRINKAGES);
      await settle();
      await search('PROTEINA');
      expect(lines('app-shrinkage-history-line')).toHaveLength(1);
      expect(text()).toContain('Proteína Whey');
      expect(text()).not.toContain('Creatina 300 g');
    });

    it('en «Fraccionados» filtra por el entero o por la bolsita', async () => {
      await open('/admin/stock?vista=fraccionados');
      httpMock.expectOne(FRACTIONS_URL).flush({ fractions: FRACTIONS });
      await settle();
      await search('bolsita 30');
      expect(lines('app-fraction-history-line')).toHaveLength(1);
      expect(text()).toContain('Creatina 300 g');
    });

    it('en «Productos» sigue filtrando productos', async () => {
      await open();
      await search('creatina');
      expect(lines('app-stock-product-row')).toHaveLength(1);
    });
  });

  describe('estados de «Mermas»', () => {
    it('cargando muestra esqueletos y ninguna fila', async () => {
      await open('/admin/stock?vista=mermas');
      expect(lines('p-skeleton').length).toBeGreaterThan(0);
      expect(lines('app-shrinkage-history-line')).toHaveLength(0);
      shrinkageRequest().flush(SHRINKAGES);
    });

    it('con error muestra el mensaje y «Reintentar» vuelve a pedir', async () => {
      await open('/admin/stock?vista=mermas');
      shrinkageRequest().flush({}, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(text()).toContain('No pudimos cargar las mermas');
      const retry = Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Reintentar')!;
      retry.click();
      await settle();
      shrinkageRequest().flush(SHRINKAGES);
      await settle();
      expect(lines('app-shrinkage-history-line')).toHaveLength(2);
    });

    it('vacío con «Yo · bodega» dice «Aún no hay mermas»', async () => {
      await open('/admin/stock?vista=mermas');
      shrinkageRequest().flush([]);
      await settle();
      expect(text()).toContain('Aún no hay mermas');
    });

    it('vacío con un vendedor dice «Luis no tiene mermas»', async () => {
      selected.set(LUIS);
      await open('/admin/stock?vista=mermas');
      shrinkageRequest().flush([]);
      await settle();
      expect(text()).toContain('Luis no tiene mermas');
    });

    it('sin coincidencias muestra «No hay mermas de ese producto» y «Limpiar búsqueda» restaura la lista', async () => {
      await open('/admin/stock?vista=mermas');
      shrinkageRequest().flush(SHRINKAGES);
      await settle();
      await search('zzz');
      expect(text()).toContain('No hay mermas de ese producto');
      const clear = Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Limpiar búsqueda')!;
      clear.click();
      await settle();
      expect(lines('app-shrinkage-history-line')).toHaveLength(2);
    });
  });

  describe('estados de «Fraccionados»', () => {
    it('cargando muestra esqueletos y ninguna fila', async () => {
      await open('/admin/stock?vista=fraccionados');
      expect(lines('p-skeleton').length).toBeGreaterThan(0);
      expect(lines('app-fraction-history-line')).toHaveLength(0);
      httpMock.expectOne(FRACTIONS_URL).flush({ fractions: FRACTIONS });
    });

    it('con error muestra el mensaje y «Reintentar» vuelve a pedir', async () => {
      await open('/admin/stock?vista=fraccionados');
      httpMock.expectOne(FRACTIONS_URL).flush({}, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(text()).toContain('No pudimos cargar los fraccionados');
      const retry = Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Reintentar')!;
      retry.click();
      await settle();
      httpMock.expectOne(FRACTIONS_URL).flush({ fractions: FRACTIONS });
      await settle();
      expect(lines('app-fraction-history-line')).toHaveLength(2);
    });

    it('vacío dice «Aún no hay fraccionados»', async () => {
      await open('/admin/stock?vista=fraccionados');
      httpMock.expectOne(FRACTIONS_URL).flush({ fractions: [] });
      await settle();
      expect(text()).toContain('Aún no hay fraccionados');
    });

    it('sin coincidencias muestra «Ningún fraccionado coincide» y «Limpiar búsqueda» restaura la lista', async () => {
      await open('/admin/stock?vista=fraccionados');
      httpMock.expectOne(FRACTIONS_URL).flush({ fractions: FRACTIONS });
      await settle();
      await search('zzz');
      expect(text()).toContain('Ningún fraccionado coincide');
      const clear = Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Limpiar búsqueda')!;
      clear.click();
      await settle();
      expect(lines('app-fraction-history-line')).toHaveLength(2);
    });
  });

  describe('«Baja existencia» en la fila de movimientos rápidos', () => {
    const lowButton = () => el().querySelector<HTMLButtonElement>('app-stock-quick-actions button.low-filter');

    it('con «Yo · bodega» está dentro de app-stock-quick-actions, después de todos los enlaces', async () => {
      await open();
      expect(lowButton()).not.toBeNull();
      expect(lowButton()!.getAttribute('aria-haspopup')).toBe('dialog');
      const lastLink = lines('a.quick-action').at(-1)!;
      expect(lastLink.compareDocumentPosition(lowButton()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(lines('a.quick-action')).toHaveLength(8);
    });

    it('con un vendedor también aparece ahí y los enlaces siguen siendo 3', async () => {
      selected.set(LUIS);
      await open();
      expect(lowButton()).not.toBeNull();
      expect(lines('a.quick-action')).toHaveLength(3);
    });

    it('ya no hay un botón «Baja existencia» fuera de la fila de movimientos rápidos', async () => {
      await open();
      expect(lines('button.low-filter')).toHaveLength(1);
    });

    it('sigue abriendo su pop-up', async () => {
      await open();
      lowButton()!.click();
      await settle();
      expect(document.body.querySelector('.low-popup')).not.toBeNull();
    });
  });
});
