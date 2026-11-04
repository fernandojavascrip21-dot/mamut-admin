import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { deliveryModalLink, returnModalLink } from '@shared/utils/modal-links';
import type { ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import type { StockOverview } from '../../interfaces/stock-overview.models';
import { StockPageComponent } from './stock-page.component';

const STOCK_URL = `${API_BASE_URL}/api/stock`;
const LUIS = 'luis-id';

const LOW_ALERTS: StockOverview['lowStock'] = [
  { productId: 2, name: 'Proteína Whey', image: null, holder: { id: LUIS, fullName: 'Luis' }, units: 0, stockLevel: 'out' },
  { productId: 1, name: 'Creatina', image: null, holder: null, units: 1, stockLevel: 'low' },
  { productId: 1, name: 'Creatina', image: null, holder: { id: 'valeria-id', fullName: 'Valeria' }, units: 2, stockLevel: 'low' },
];

const OVERVIEW: StockOverview = {
  warehouse: 12,
  sellers: [
    { id: LUIS, fullName: 'Luis', units: 6 },
    { id: 'valeria-id', fullName: 'Valeria', units: 0 },
  ],
  inactiveSellers: 0,
  total: 18,
  products: [
    { productId: 1, name: 'Creatina', image: null, warehouse: 8, warehouseLevel: 'ok', sellers: [], inactiveSellers: 0, total: 8 },
    {
      productId: 2, name: 'Proteína Whey', image: null, warehouse: 4, warehouseLevel: 'ok',
      sellers: [{ sellerId: LUIS, units: 6, stockLevel: 'ok' }], inactiveSellers: 0, total: 10,
    },
  ],
  lowStock: [],
};

describe('StockPageComponent', () => {
  let fixture: ComponentFixture<StockPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  let selected: ReturnType<typeof signal<ViewingSeller | null>>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const hrefOf = (link: unknown[]) => router.serializeUrl(router.createUrlTree(link));

  beforeEach(async () => {
    selected = signal<ViewingSeller | null>(null);
    await TestBed.configureTestingModule({
      imports: [StockPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ViewingService, useValue: { selectedSeller: selected.asReadonly() } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(StockPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  // rxResource aplica la respuesta en una microtarea: hay que esperar antes de volver a pintar.
  async function settle() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function load(overview: StockOverview = OVERVIEW) {
    fixture.detectChanges();
    httpMock.expectOne(STOCK_URL).flush(overview);
    await settle();
  }

  function search(query: string) {
    const input = el().querySelector('#stock-search') as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const rowNames = () => Array.from(el().querySelectorAll('.rows .name')).map((n) => n.textContent?.trim());
  const actionLabels = () => Array.from(el().querySelectorAll('a.quick-action')).map((a) => a.textContent?.trim());
  const actionHrefs = () => Array.from(el().querySelectorAll('a.quick-action')).map((a) => a.getAttribute('href'));

  describe('estados', () => {
    it('cargando muestra el aviso y los esqueletos', () => {
      fixture.detectChanges();
      expect(el().querySelector('[role="status"]')?.textContent).toContain('Cargando el stock…');
      expect(el().textContent).toContain('Bodega y vendedores.');
      expect(el().querySelectorAll('app-stock-product-row-skeleton')).toHaveLength(3);
      httpMock.expectOne(STOCK_URL);
    });

    it('vacío muestra el texto y el botón «Nuevo producto»', async () => {
      await load({ warehouse: 0, sellers: [], inactiveSellers: 0, total: 0, products: [], lowStock: [] });
      expect(text('.empty')).toContain('Aún no hay productos');
      expect(text('.empty')).toContain('Agrega tu primer producto para ver aquí el stock.');
      const button = el().querySelector('.empty a') as HTMLAnchorElement;
      expect(button.textContent?.trim()).toBe('Nuevo producto');
      expect(button.getAttribute('href')).toBe('/admin/productos/nuevo');
    });

    it('error muestra el aviso y «Reintentar» vuelve a pedir el stock', async () => {
      fixture.detectChanges();
      httpMock.expectOne(STOCK_URL).flush({}, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(el().querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar el stock');
      expect(el().textContent).toContain('Revisa tu conexión e inténtalo de nuevo.');

      (el().querySelector('.retry') as HTMLButtonElement).click();
      fixture.detectChanges();
      httpMock.expectOne(STOCK_URL).flush(OVERVIEW);
      await settle();
      expect(el().querySelector('[role="alert"]')).toBeNull();
      expect(rowNames()).toHaveLength(2);
    });
  });

  describe('con «Yo · bodega»', () => {
    beforeEach(() => load());

    it('muestra «Stock general», el total del negocio, la barra y la leyenda', () => {
      expect(text('h1')).toBe('Stock general');
      expect(text('.business-card .total')).toBe('18 piezas');
      expect(el().querySelector('app-stock-split-bar')).not.toBeNull();
      const legend = Array.from(el().querySelectorAll('.legend li')).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
      expect(legend).toEqual(['Bodega 12', 'Luis 6', 'Valeria 0']);
    });

    it('lista cada producto con su total y el reparto: «Bodega 4 · Luis 6» y «10 piezas»', () => {
      expect(rowNames()).toEqual(['Creatina', 'Proteína Whey']);
      const whey = el().querySelectorAll('.rows li')[1];
      expect(whey.querySelector('.units')?.textContent?.trim()).toBe('10 piezas');
      expect(whey.querySelector('.breakdown')?.textContent?.trim()).toBe('Bodega 4 · Luis 6');
    });

    it('ofrece los cuatro movimientos rápidos con sus destinos', () => {
      expect(actionLabels()).toEqual(['Entrada a bodega', 'Dejar a vendedor', 'Vender', 'Nuevo producto']);
      expect(actionHrefs()).toEqual([
        '/admin/entrada',
        hrefOf(deliveryModalLink()),
        '/admin/productos',
        '/admin/productos/nuevo',
      ]);
    });

    it('el buscador filtra la lista sin acentos y no cambia el total ni la barra', () => {
      search('proteina');
      expect(rowNames()).toEqual(['Proteína Whey']);
      expect(text('.business-card .total')).toBe('18 piezas');
      expect(el().querySelectorAll('.legend li')).toHaveLength(3);
    });

    it('un buscador sin resultados lo dice y «Limpiar búsqueda» vuelve a la lista', () => {
      search('zzz');
      expect(text('.no-match')).toContain('No hay productos con ese nombre');
      expect(text('.no-match')).toContain('Revisa cómo lo escribiste.');
      (el().querySelector('.no-match button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(rowNames()).toHaveLength(2);
    });
  });

  describe('avisos de baja existencia (HU-18)', () => {
    const alertRows = () => Array.from(el().querySelectorAll('.low-stock .item')).map((row) =>
      ['.name', '.holder', '.units', '.out']
        .map((part) => row.querySelector(part)?.textContent?.replace(/^\s*·\s*/, '').trim())
        .filter(Boolean)
        .join(' | '),
    );

    it('con «Yo · bodega» la tarjeta lista todos los avisos con su titular', async () => {
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      expect(text('.low-stock .title')).toBe('3 productos con baja existencia');
      expect(alertRows()).toEqual([
        'Proteína Whey | Luis | 0 | Agotado',
        'Creatina | Bodega | 1',
        'Creatina | Valeria | 2',
      ]);
    });

    it('con un solo aviso el título va en singular', async () => {
      await load({ ...OVERVIEW, lowStock: [LOW_ALERTS[1]] });
      expect(text('.low-stock .title')).toBe('1 producto con baja existencia');
    });

    it('con un vendedor en «Viendo» solo salen los suyos, como «por terminarse»', async () => {
      selected.set({ id: LUIS, fullName: 'Luis' });
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      expect(text('.low-stock .title')).toBe('1 producto por terminarse');
      expect(alertRows()).toEqual(['Proteína Whey | Luis | 0 | Agotado']);
    });

    it('sin avisos la tarjeta no sale, también con un vendedor que no tiene', async () => {
      await load();
      expect(el().querySelector('.low-stock')).toBeNull();
    });

    it('un vendedor sin avisos propios no ve la tarjeta aunque haya avisos de otros', async () => {
      selected.set({ id: 'otro-id', fullName: 'Otro' });
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      expect(el().querySelector('.low-stock')).toBeNull();
    });
  });

  describe('con un vendedor en «Viendo»', () => {
    beforeEach(async () => {
      selected.set({ id: LUIS, fullName: 'Luis' });
      await load();
    });

    it('muestra «Resumen de Luis» y su stock con su total, sin barra', () => {
      expect(text('h1')).toBe('Resumen de Luis');
      expect(text('.seller-card')).toContain('Stock de Luis');
      expect(text('.seller-card .total')).toBe('6 piezas');
      expect(el().querySelector('app-stock-split-bar')).toBeNull();
    });

    it('lista solo sus productos, con sus piezas y sin reparto', () => {
      expect(rowNames()).toEqual(['Proteína Whey']);
      const row = el().querySelector('.rows li')!;
      expect(row.querySelector('.units')?.textContent?.trim()).toBe('6 piezas');
      expect(row.querySelector('.breakdown')).toBeNull();
    });

    it('ofrece «Dejar más a Luis» y «Retirarle producto» con él fijo', () => {
      expect(actionLabels()).toEqual(['Dejar más a Luis', 'Retirarle producto']);
      expect(actionHrefs()).toEqual([hrefOf(deliveryModalLink({ sellerId: LUIS })), hrefOf(returnModalLink(LUIS))]);
    });

    it('cambiar de vendedor en la barra no vuelve a pedir datos', () => {
      selected.set({ id: 'valeria-id', fullName: 'Valeria' });
      fixture.detectChanges();
      httpMock.expectNone(STOCK_URL);
      expect(text('h1')).toBe('Resumen de Valeria');
    });

    it('un vendedor sin producto dice «Todavía no tiene producto.» y conserva sus acciones', () => {
      selected.set({ id: 'valeria-id', fullName: 'Valeria' });
      fixture.detectChanges();
      expect(text('.seller-empty')).toBe('Todavía no tiene producto.');
      expect(text('.seller-card .total')).toBe('0 piezas');
      expect(el().querySelector('#stock-search')).toBeNull();
      expect(actionLabels()).toEqual(['Dejar más a Valeria', 'Retirarle producto']);
    });
  });

  it('al cambiar StockChangesService.version vuelve a pedir el stock sin mostrar «cargando»', async () => {
    await load();
    TestBed.inject(StockChangesService).notify();
    fixture.detectChanges();

    const request = httpMock.expectOne(STOCK_URL);
    expect(el().querySelector('[role="status"]')).toBeNull();
    expect(rowNames()).toHaveLength(2);

    request.flush({ ...OVERVIEW, warehouse: 20, total: 26, products: [{ ...OVERVIEW.products[0], warehouse: 16, total: 16 }, OVERVIEW.products[1]] });
    await settle();
    expect(text('.business-card .total')).toBe('26 piezas');
  });

  it('la versión con la que nace la página no la vuelve a pedir', async () => {
    TestBed.inject(StockChangesService).notify();
    await load();
    httpMock.expectNone(STOCK_URL);
  });
});
