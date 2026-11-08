import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import type { FractionHistoryItem } from '../../interfaces/fraction.models';
import { FractionHistoryPageComponent } from './fraction-history-page.component';

const URL = `${API_BASE_URL}/api/fractions`;

const item = (id: number, whole: string, bag: string): FractionHistoryItem => ({
  id,
  requestId: `r-${id}`,
  createdAt: '2026-11-07T16:00:00Z',
  portions: 7,
  wholeUnitCost: '450.0000',
  portionUnitCost: '64.2857',
  portionPrice: '85.00',
  product: { id: id * 10, name: whole },
  portionProduct: { id: id * 10 + 1, name: bag },
  createdBy: { id: 'a-1', name: 'Ana Admin' },
});
const ITEMS = [
  item(2, 'Proteína Whey', 'Proteína Whey · bolsita 40 g'),
  item(1, 'Creatina 300 g', 'Creatina 300 g · bolsita 30 g'),
];

describe('FractionHistoryPageComponent', () => {
  let fixture: ComponentFixture<FractionHistoryPageComponent>;
  let httpMock: HttpTestingController;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent!.replace(/\s+/g, ' ');
  const lines = () => el().querySelectorAll('app-fraction-history-line');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const load = async (body: FractionHistoryItem[] = ITEMS) => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({ fractions: body });
    await settle();
  };
  const search = async (value: string) => {
    const input = el().querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FractionHistoryPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FractionHistoryPageComponent);
  });

  afterEach(() => httpMock.verify());

  it('pide GET /api/fractions y muestra esqueletos mientras carga', () => {
    fixture.detectChanges();
    expect(el().querySelector('p-skeleton')).not.toBeNull();
    httpMock.expectOne(URL);
  });

  it('muestra una fila por fraccionado en el orden que llega', async () => {
    await load();
    expect(lines()).toHaveLength(2);
    expect(lines()[0]!.textContent).toContain('Proteína Whey');
    expect(lines()[1]!.textContent).toContain('Creatina 300 g');
  });

  it('error muestra «No pudimos cargar los fraccionados» y «Reintentar» vuelve a pedir', async () => {
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({}, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(text()).toContain('No pudimos cargar los fraccionados');
    const retry = Array.from(el().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Reintentar')!;
    retry.click();
    fixture.detectChanges();
    httpMock.expectOne(URL).flush({ fractions: ITEMS });
    await settle();
    expect(lines()).toHaveLength(2);
  });

  it('sin fraccionados muestra «Todavía no hay fraccionados»', async () => {
    await load([]);
    expect(text()).toContain('Todavía no hay fraccionados');
    expect(lines()).toHaveLength(0);
  });

  it('el buscador filtra por el nombre del entero sin acentos ni mayúsculas', async () => {
    await load();
    await search('PROTEINA');
    expect(lines()).toHaveLength(1);
    expect(lines()[0]!.textContent).toContain('Proteína Whey');
  });

  it('el buscador filtra por el nombre de la bolsita', async () => {
    await load();
    await search('bolsita 30');
    expect(lines()).toHaveLength(1);
    expect(lines()[0]!.textContent).toContain('Creatina 300 g');
  });

  it('una búsqueda sin coincidencias muestra «Ningún fraccionado coincide»', async () => {
    await load();
    await search('zzz');
    expect(text()).toContain('Ningún fraccionado coincide');
    expect(lines()).toHaveLength(0);
  });
});
