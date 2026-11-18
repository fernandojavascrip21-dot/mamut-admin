import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_BASE_URL } from '@core/api-base-url';
import { ViewingService } from '@core/viewing/viewing.service';
import { SellersPageComponent } from './sellers-page.component';
import type { SellerSummary } from '../../interfaces/seller.models';

const ACTIVE_URL = `${API_BASE_URL}/api/sellers`;
const INACTIVE_URL = `${ACTIVE_URL}?status=inactive`;
const LIST_PATH = '/admin/vendedores';

const ACTIVE: SellerSummary[] = [{ id: 'a', fullName: 'Ángel Ruiz', businessName: null, units: 6 }];
const INACTIVE: SellerSummary[] = [
  { id: 'z', fullName: 'Zoe Zapata', businessName: null, units: 0 },
  { id: 'v', fullName: 'Víctor Vendedor', businessName: 'Gimnasio Fuerza Norte', units: 0 },
];

describe('SellersPageComponent: filtro Activos | Desactivados (HU-44)', () => {
  let harness: RouterTestingHarness;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'admin/vendedores', component: SellersPageComponent }]),
        { provide: ViewingService, useValue: { selectedSellerId: signal<string | null>(null) } },
      ],
    });
    router = TestBed.inject(Router);
    httpMock = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  // Vacía lo pendiente en lugar de verify(): un fallo aquí dejaría roto el TestBed de las pruebas siguientes.
  afterEach(() => httpMock.match(() => true));

  const el = () => harness.routeNativeElement as HTMLElement;
  const text = () => el().textContent as string;
  async function tick() {
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();
  }
  const options = () => Array.from(el().querySelectorAll('p-selectbutton p-togglebutton')) as HTMLElement[];
  const optionLabels = () => options().map((option) => option.textContent!.trim());
  const pressed = () =>
    options().filter((option) => option.getAttribute('aria-pressed') === 'true').map((option) => option.textContent!.trim());
  const option = (label: string) => options().find((candidate) => candidate.textContent!.trim() === label)!;
  const rowNames = () =>
    (Array.from(el().querySelectorAll('app-seller-row')) as HTMLElement[]).map((row) => row.textContent);

  async function open(url: string, reply: string, rows: SellerSummary[]) {
    await harness.navigateByUrl(url, SellersPageComponent);
    httpMock.expectOne(reply).flush(rows);
    await tick();
  }

  it('sin parámetro pide los activos con la URL de siempre y elige «Activos»', async () => {
    await open(LIST_PATH, ACTIVE_URL, ACTIVE);
    expect(optionLabels()).toEqual(['Activos', 'Desactivados']);
    expect(pressed()).toEqual(['Activos']);
    expect(rowNames()).toHaveLength(1);
  });

  it('con otro valor en `estado` también pide los activos', async () => {
    await open(`${LIST_PATH}?estado=otra-cosa`, ACTIVE_URL, ACTIVE);
    expect(pressed()).toEqual(['Activos']);
  });

  it('?estado=desactivados pide los inactivos y elige «Desactivados»', async () => {
    await open(`${LIST_PATH}?estado=desactivados`, INACTIVE_URL, INACTIVE);
    expect(pressed()).toEqual(['Desactivados']);
  });

  it('los desactivados salen en orden por nombre, con la etiqueta «Desactivado» y sin piezas', async () => {
    await open(`${LIST_PATH}?estado=desactivados`, INACTIVE_URL, INACTIVE);
    expect(rowNames()).toEqual([expect.stringContaining('Víctor Vendedor'), expect.stringContaining('Zoe Zapata')]);
    expect(el().querySelectorAll('app-seller-row p-tag')).toHaveLength(2);
    expect(el().querySelector('app-seller-row .units')).toBeNull();
  });

  it('el filtro se ve también con la lista vacía', async () => {
    await open(LIST_PATH, ACTIVE_URL, []);
    expect(text()).toContain('Aún no tienes vendedores');
    expect(optionLabels()).toEqual(['Activos', 'Desactivados']);
  });

  it('sin desactivados muestra «No tienes vendedores desactivados» y no ofrece otro botón de alta', async () => {
    await open(`${LIST_PATH}?estado=desactivados`, INACTIVE_URL, []);
    expect(text()).toContain('No tienes vendedores desactivados');
    expect(text()).toContain('Aquí aparecen los vendedores que desactives.');
    expect(text()).not.toContain('Aún no tienes vendedores');
    expect(el().querySelectorAll('.new-seller')).toHaveLength(1);
    expect(el().querySelector('.empty a, .empty button')).toBeNull();
  });

  it('«Nuevo vendedor» se ve con los dos filtros', async () => {
    await open(`${LIST_PATH}?estado=desactivados`, INACTIVE_URL, INACTIVE);
    expect(el().querySelector('.new-seller')?.textContent?.trim()).toBe('Nuevo vendedor');
  });

  it('elegir «Desactivados» navega con ?estado=desactivados y replaceUrl, y pasa por «Cargando vendedores…»', async () => {
    await open(LIST_PATH, ACTIVE_URL, ACTIVE);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    option('Desactivados').click();
    await tick();

    expect(navigate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ replaceUrl: true }));
    expect(router.url).toBe(`${LIST_PATH}?estado=desactivados`);
    expect(text()).toContain('Cargando vendedores…');
    httpMock.expectOne(INACTIVE_URL).flush(INACTIVE);
    await tick();
    expect(pressed()).toEqual(['Desactivados']);
    expect(rowNames()).toHaveLength(2);
  });

  it('volver a «Activos» quita el parámetro, usa replaceUrl y pide los activos', async () => {
    await open(`${LIST_PATH}?estado=desactivados`, INACTIVE_URL, INACTIVE);
    const navigate = vi.spyOn(router, 'navigateByUrl');
    option('Activos').click();
    await tick();

    expect(navigate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ replaceUrl: true }));
    expect(router.url).not.toContain('desactivados');
    httpMock.expectOne(ACTIVE_URL).flush(ACTIVE);
    await tick();
    expect(pressed()).toEqual(['Activos']);
  });

  it('con error de carga muestra el mismo aviso y «Reintentar» vuelve a pedir la lista del filtro', async () => {
    await harness.navigateByUrl(`${LIST_PATH}?estado=desactivados`, SellersPageComponent);
    httpMock.expectOne(INACTIVE_URL).error(new ProgressEvent('error'));
    await tick();
    expect(text()).toContain('No pudimos cargar a tus vendedores');
    expect(optionLabels()).toEqual(['Activos', 'Desactivados']);

    (el().querySelector('.retry') as HTMLButtonElement).click();
    await tick();
    expect(text()).toContain('Cargando vendedores…');
    httpMock.expectOne(INACTIVE_URL).flush(INACTIVE);
    await tick();
    expect(rowNames()).toHaveLength(2);
  });
});
