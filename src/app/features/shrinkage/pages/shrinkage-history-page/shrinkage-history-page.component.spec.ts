import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import type { ViewingSeller } from '@core/viewing/interfaces/viewing.models';
import type { ShrinkageHistoryItem } from '../../interfaces/shrinkage.models';
import { ShrinkageHistoryPageComponent } from './shrinkage-history-page.component';

const URL = `${API_BASE_URL}/api/shrinkages`;
const LUIS: ViewingSeller = { id: 'luis-id', fullName: 'Luis Prueba' };

const item = (n: number, name: string, holder: ShrinkageHistoryItem['holder']): ShrinkageHistoryItem => ({
  requestId: `r-${n}`,
  createdAt: '2026-11-08T10:00:00Z',
  qty: n,
  reason: 'damaged',
  reasonLabel: 'Dañado',
  holder,
  product: { id: n, name, image: null },
});
const ITEMS = [
  item(2, 'Proteína Whey', null),
  item(1, 'Creatina 300 g', { id: 'luis-id', fullName: 'Luis Prueba' }),
];

describe('ShrinkageHistoryPageComponent', () => {
  let fixture: ComponentFixture<ShrinkageHistoryPageComponent>;
  let httpMock: HttpTestingController;
  let selected: ReturnType<typeof signal<ViewingSeller | null>>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const lines = () => el().querySelectorAll('app-shrinkage-history-line');
  const button = (label: string) =>
    Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === label);
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const request = () => httpMock.expectOne((r) => r.url === URL);
  const load = async (body: ShrinkageHistoryItem[] = ITEMS) => {
    fixture.detectChanges();
    request().flush(body);
    await settle();
  };
  const search = async (value: string) => {
    const input = el().querySelector<HTMLInputElement>('#shrinkage-search')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  beforeEach(() => {
    selected = signal<ViewingSeller | null>(null);
    TestBed.configureTestingModule({
      imports: [ShrinkageHistoryPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ViewingService, useValue: { selectedSeller: selected.asReadonly() } },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ShrinkageHistoryPageComponent);
  });

  afterEach(() => httpMock.verify());

  describe('con «Yo · bodega»', () => {
    it('pide GET /api/shrinkages sin sellerId y muestra esqueletos mientras carga', () => {
      fixture.detectChanges();
      expect(el().querySelector('p-skeleton')).not.toBeNull();
      expect(request().request.params.has('sellerId')).toBe(false);
    });

    it('el título es «Mermas» y hay un enlace «Stock general» hacia /admin/stock', async () => {
      await load();
      expect(el().querySelector('h1')!.textContent!.trim()).toBe('Mermas');
      const back = Array.from(el().querySelectorAll('a')).find((a) => a.textContent!.includes('Stock general'))!;
      expect(back.getAttribute('href')).toBe('/admin/stock');
    });

    it('muestra una fila por merma en el orden que llega, con el titular', async () => {
      await load();
      expect(lines()).toHaveLength(2);
      expect(lines()[0]!.textContent).toContain('Proteína Whey');
      expect(lines()[0]!.querySelector('.holder')!.textContent).toContain('Bodega');
      expect(lines()[1]!.querySelector('.holder')!.textContent).toContain('Luis Prueba');
    });

    it('sin mermas muestra «Aún no hay mermas»', async () => {
      await load([]);
      expect(text()).toContain('Aún no hay mermas');
      expect(lines()).toHaveLength(0);
    });

    it('error muestra «No pudimos cargar las mermas» y «Reintentar» vuelve a pedir', async () => {
      fixture.detectChanges();
      request().flush({}, { status: 500, statusText: 'Server Error' });
      await settle();
      expect(text()).toContain('No pudimos cargar las mermas');
      button('Reintentar')!.click();
      fixture.detectChanges();
      request().flush(ITEMS);
      await settle();
      expect(lines()).toHaveLength(2);
    });
  });

  describe('buscador', () => {
    it('filtra por el nombre del producto sin acentos ni mayúsculas', async () => {
      await load();
      await search('PROTEINA');
      expect(lines()).toHaveLength(1);
      expect(lines()[0]!.textContent).toContain('Proteína Whey');
    });

    it('sin coincidencias muestra «No hay mermas de ese producto» y «Limpiar búsqueda» devuelve la lista', async () => {
      await load();
      await search('zzz');
      expect(text()).toContain('No hay mermas de ese producto');
      expect(lines()).toHaveLength(0);
      button('Limpiar búsqueda')!.click();
      await settle();
      expect(lines()).toHaveLength(2);
      expect(el().querySelector<HTMLInputElement>('#shrinkage-search')!.value).toBe('');
    });
  });

  describe('con un vendedor en «Viendo»', () => {
    beforeEach(() => selected.set(LUIS));

    it('pide GET /api/shrinkages?sellerId=…', () => {
      fixture.detectChanges();
      expect(request().request.params.get('sellerId')).toBe('luis-id');
    });

    it('el título es «Mermas de <nombre>» y las filas no repiten el titular', async () => {
      fixture.detectChanges();
      request().flush([ITEMS[1]!]);
      await settle();
      expect(el().querySelector('h1')!.textContent!.trim()).toBe('Mermas de Luis Prueba');
      expect(lines()).toHaveLength(1);
      expect(el().querySelector('.holder')).toBeNull();
    });

    it('sin mermas muestra «<nombre> no tiene mermas»', async () => {
      fixture.detectChanges();
      request().flush([]);
      await settle();
      expect(text()).toContain('Luis Prueba no tiene mermas');
    });
  });

  describe('recargas', () => {
    it('cambiar «Viendo» con la página abierta vuelve a pedir la lista con el vendedor nuevo', async () => {
      await load();
      selected.set(LUIS);
      fixture.detectChanges();
      expect(request().request.params.get('sellerId')).toBe('luis-id');
      await settle();
    });

    it('volver a «Yo · bodega» pide la lista sin sellerId', async () => {
      selected.set(LUIS);
      fixture.detectChanges();
      request().flush([]);
      await settle();
      selected.set(null);
      fixture.detectChanges();
      expect(request().request.params.has('sellerId')).toBe(false);
      await settle();
    });

    it('al avisar StockChangesService.notify() vuelve a pedir la lista', async () => {
      await load();
      TestBed.inject(StockChangesService).notify();
      fixture.detectChanges();
      request().flush([ITEMS[0]!]);
      await settle();
      expect(lines()).toHaveLength(1);
    });
  });
});
