import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { deliveryModalLink, editHoldingModalLink, fractionModalLink, returnModalLink, shrinkageModalLink } from '@shared/utils/modal-links';
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
    sessionStorage.clear();
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

    it('ofrece los seis movimientos rápidos con sus destinos', () => {
      expect(actionLabels()).toEqual(['Entrada a bodega', 'Dejar a vendedor', 'Vender', 'Registrar merma', 'Fraccionar', 'Nuevo producto']);
      expect(actionHrefs()).toEqual([
        '/admin/entrada',
        hrefOf(deliveryModalLink()),
        '/admin/productos',
         hrefOf(shrinkageModalLink()),
        hrefOf(fractionModalLink()),
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

  describe('tarjeta ámbar con X (HU-18)', () => {
    const card = () => el().querySelector('.low-stock');
    const close = () => {
      (el().querySelector('.low-stock button.dismiss') as HTMLButtonElement).click();
      fixture.detectChanges();
    };

    it('sale con su X al iniciar sesión', async () => {
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      expect(card()).not.toBeNull();
      expect(el().querySelector('.low-stock button.dismiss')?.getAttribute('aria-label')).toBe(
        'Cerrar aviso de baja existencia',
      );
    });

    it('al cerrarla desaparece, el botón «Baja existencia» sigue con su globo y recibe el foco', async () => {
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      close();
      expect(card()).toBeNull();
      expect(el().querySelector('.low-filter-badge')?.textContent?.trim()).toBe('1');
      expect(document.activeElement).toBe(el().querySelector('button.low-filter'));
    });

    it('cerrada no vuelve al cambiar de vendedor en «Viendo»', async () => {
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      close();
      selected.set({ id: LUIS, fullName: 'Luis' });
      fixture.detectChanges();
      expect(card()).toBeNull();
    });

    it('cerrada tampoco vuelve en una página nueva (navegar o recargar): sigue cerrada en la sesión', async () => {
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      close();
      fixture.destroy();
      fixture = TestBed.createComponent(StockPageComponent);
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      expect(card()).toBeNull();
    });

    it('con la sesión nueva (sin nada guardado) vuelve a salir', async () => {
      sessionStorage.clear();
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      expect(card()).not.toBeNull();
    });
  });

  describe('botón y pop-up «Baja existencia» (HU-18)', () => {
    const button = () => el().querySelector('button.low-filter') as HTMLButtonElement;
    const badge = () => text('.low-filter-badge');
    const popup = () => document.body.querySelector('.low-popup');
    const popupTitle = () => document.body.querySelector('.p-dialog h2')?.textContent?.trim();
    const popupRows = () =>
      Array.from(document.body.querySelectorAll('.low-popup .rows li')).map((li) =>
        ['.name', '.units', '.out'].map((part) => li.querySelector(part)?.textContent?.trim()).filter(Boolean).join(' | '),
      );

    async function open() {
      button().click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    afterEach(() => {
      fixture.destroy();
      document.body.querySelectorAll('.p-dialog-mask').forEach((node) => node.remove());
    });

    it('el botón lleva el globo con los productos bajos de la bodega y un nombre accesible con el número', async () => {
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      expect(badge()).toBe('1');
      expect(button().getAttribute('aria-label')).toBe('Baja existencia, 1 producto');
      expect(button().getAttribute('aria-haspopup')).toBe('dialog');
    });

    it('sin avisos no hay globo y el nombre accesible es solo «Baja existencia»', async () => {
      await load();
      expect(el().querySelector('.low-filter-badge')).toBeNull();
      expect(button().getAttribute('aria-label')).toBe('Baja existencia');
    });

    it('el pop-up no está abierto hasta presionar el botón, y la lista de la pantalla no cambia', async () => {
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      expect(popup()).toBeNull();
      await open();
      expect(popup()).not.toBeNull();
      expect(rowNames()).toEqual(['Creatina', 'Proteína Whey']);
    });

    it('con «Yo · bodega» el pop-up muestra solo los de la bodega, con «Agotado» en texto cuando es 0', async () => {
      await load({
        ...OVERVIEW,
        lowStock: [{ productId: 3, name: 'Omega', image: null, holder: null, units: 0, stockLevel: 'out' }, ...LOW_ALERTS],
      });
      await open();
      expect(popupRows()).toEqual(['Omega | 0 piezas | Agotado', 'Creatina | 1 pieza']);
      expect(popupTitle()).toBe('Baja existencia');
      expect(document.body.querySelector('.low-popup .summary')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Bodega · 2 productos',
      );
    });

    it('sin avisos el pop-up dice que no hay productos con baja existencia', async () => {
      await load();
      await open();
      expect(document.body.querySelector('.low-popup .empty')?.textContent).toContain('Sin productos con baja existencia');
      expect(document.body.querySelector('.low-popup .empty')?.textContent).toContain('Nada por resurtir en la bodega por ahora.');
    });

    it('con un vendedor en «Viendo» el globo y el pop-up son solo los suyos, y el título lleva su nombre', async () => {
      selected.set({ id: LUIS, fullName: 'Luis' });
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      expect(badge()).toBe('1');
      await open();
      expect(popupRows()).toEqual(['Proteína Whey | 0 piezas | Agotado']);
      expect(popupTitle()).toBe('Baja existencia de Luis');
    });

    it('cambiar de vendedor con el pop-up abierto actualiza la lista sin pedir datos de nuevo', async () => {
      selected.set({ id: LUIS, fullName: 'Luis' });
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      await open();
      selected.set({ id: 'valeria-id', fullName: 'Valeria' });
      fixture.detectChanges();
      httpMock.expectNone(STOCK_URL);
      expect(popupRows()).toEqual(['Creatina | 2 piezas']);
    });

    it('Escape o la X cierran el pop-up y la tarjeta ámbar sigue en la pantalla', async () => {
      await load({ ...OVERVIEW, lowStock: LOW_ALERTS });
      await open();
      (document.body.querySelector('.p-dialog-close-button') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(popup()).toBeNull();
      expect(el().querySelector('.low-stock')).not.toBeNull();
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

    it('tocar una fila abre el pop-up para editar lo de ese producto del vendedor', () => {
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      const row = el().querySelector('.rows li app-stock-product-row > div') as HTMLElement;
      expect(row.getAttribute('role')).toBe('button');
      row.click();
      expect(navigate).toHaveBeenCalledWith(editHoldingModalLink(LUIS, 2));
    });

    it('ofrece «Dejar más a Luis», «Retirarle producto» y «Registrar su merma» con él fijo', () => {
      expect(actionLabels()).toEqual(['Dejar más a Luis', 'Retirarle producto', 'Registrar su merma']);
      expect(actionHrefs()).toEqual([
        hrefOf(deliveryModalLink({ sellerId: LUIS })),
        hrefOf(returnModalLink(LUIS)),
        hrefOf(shrinkageModalLink({ sellerId: LUIS })),
      ]);
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
      expect(actionLabels()).toEqual(['Dejar más a Valeria', 'Retirarle producto', 'Registrar su merma']);
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
