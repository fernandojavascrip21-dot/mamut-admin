import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { ViewingService } from '@core/viewing/viewing.service';
import { SellersPageComponent } from './sellers-page.component';
import { API_BASE_URL } from '@core/api-base-url';
import type { SellerSummary } from '../../interfaces/seller.models';

const SELLERS_URL = `${API_BASE_URL}/api/sellers`;

const SELLERS: SellerSummary[] = [
  { id: 'b', fullName: 'Valeria Vendedora', units: 0 },
  { id: 'a', fullName: 'Ángel Ruiz', units: 6 },
];

describe('SellersPageComponent', () => {
  let fixture: ComponentFixture<SellersPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;
  const selectedSellerId = signal<string | null>(null);

  beforeEach(async () => {
    selectedSellerId.set(null);
    await TestBed.configureTestingModule({
      imports: [SellersPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ViewingService, useValue: { selectedSellerId } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(SellersPageComponent);
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

  async function load(sellers: SellerSummary[]) {
    fixture.detectChanges();
    httpMock.expectOne(SELLERS_URL).flush(sellers);
    await settle();
  }

  const text = () => fixture.nativeElement.textContent as string;

  it('mientras carga muestra «Cargando vendedores…» y filas esqueleto', () => {
    fixture.detectChanges();
    expect(text()).toContain('Cargando vendedores…');
    expect(fixture.nativeElement.querySelectorAll('app-seller-row-skeleton')).toHaveLength(3);
    httpMock.expectOne(SELLERS_URL).flush(SELLERS);
  });

  it('lista a los vendedores en orden alfabético, con sus piezas y el botón «Nuevo vendedor»', async () => {
    await load(SELLERS);

    expect(text()).toContain('Mis vendedores');
    const rows = Array.from(fixture.nativeElement.querySelectorAll('app-seller-row')) as HTMLElement[];
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Ángel Ruiz'),
      expect.stringContaining('Valeria Vendedora'),
    ]);
    expect(rows[0].textContent).toContain('6 piezas');
    expect(rows[1].textContent).toContain('0 piezas');

    const link = fixture.nativeElement.querySelector('.new-seller') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('Nuevo vendedor');
    expect(link.getAttribute('href')).toBe('/admin/vendedores/nuevo');
  });

  it('sin vendedores muestra el estado vacío con el botón de alta', async () => {
    await load([]);

    expect(text()).toContain('Aún no tienes vendedores');
    expect(text()).toContain('Da de alta a tu primer vendedor para dejarle producto.');
    const links = fixture.nativeElement.querySelectorAll('.new-seller') as NodeListOf<HTMLAnchorElement>;
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('/admin/vendedores/nuevo');
    expect(fixture.nativeElement.querySelector('app-seller-row')).toBeNull();
  });

  it('si la petición falla muestra el error, y «Reintentar» vuelve a pedir la lista', async () => {
    fixture.detectChanges();
    httpMock.expectOne(SELLERS_URL).error(new ProgressEvent('error'));
    await settle();

    expect(text()).toContain('No pudimos cargar a tus vendedores');

    (fixture.nativeElement.querySelector('.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(text()).toContain('Cargando vendedores…');
    httpMock.expectOne(SELLERS_URL).flush(SELLERS);
    await settle();

    expect(fixture.nativeElement.querySelectorAll('app-seller-row')).toHaveLength(2);
  });

  describe('con la barra «Viendo»', () => {
    it('con «Yo · bodega» se queda en la lista', async () => {
      await load(SELLERS);
      expect(router.navigateByUrl).not.toHaveBeenCalled();
    });

    it('con un vendedor elegido abre su detalle, reemplazando la URL', async () => {
      selectedSellerId.set('a');
      await load(SELLERS);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/vendedores/a', { replaceUrl: true });
    });

    it('si la barra confirma la selección más tarde, abre el detalle en ese momento', async () => {
      await load(SELLERS);
      selectedSellerId.set('b');
      await settle();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/vendedores/b', { replaceUrl: true });
    });
  });
});
