import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { CartService } from '@core/cart/cart.service';
import { ConfirmService } from '@core/confirm/confirm.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { AdminShellComponent } from './admin-shell.component';
import type { AuthContext } from '@core/auth/interfaces/auth.models';

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana López' };

describe('AdminShellComponent', () => {
  let fixture: ComponentFixture<AdminShellComponent>;
  const ask = vi.fn<(options: { title: string; message: string }) => Promise<boolean>>();

  beforeEach(() => {
    localStorage.setItem('mamut.user', JSON.stringify(ADMIN));
    TestBed.configureTestingModule({
      imports: [AdminShellComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ConfirmService, useValue: { ask } },
      ],
    });
    ask.mockReset();
    fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('se crea', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra el menú del administrador: Stock, Productos, Corte, Vendedores', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('nav a')).map((a) =>
      (a as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['Stock', 'Productos', 'Corte', 'Vendedores']);
  });

  it('muestra las iniciales del usuario y enlaza a /cuenta', () => {
    const account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.textContent?.trim()).toBe('AL');
    expect(account.getAttribute('href')).toBe('/cuenta');
  });

  it('muestra el carrito como ícono aparte en la cabecera', () => {
    const cart = fixture.nativeElement.querySelector('a[aria-label="Carrito"]') as HTMLAnchorElement;
    expect(cart.getAttribute('href')).toBe('/carrito');
  });

  it('muestra la barra «Viendo» y pide la lista de vendedores una vez', async () => {
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(`${API_BASE_URL}/api/sellers`).flush([{ id: 'v-1', fullName: 'Víctor Vendedor', units: 6 }]);
    fixture.detectChanges();

    const bar = fixture.nativeElement.querySelector('app-viewing-bar') as HTMLElement;
    expect(bar).not.toBeNull();
    await fixture.whenStable(); // ngModel quita el estado deshabilitado en un microtask
    fixture.detectChanges();
    bar.querySelector<HTMLElement>('p-select')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const options = Array.from(document.querySelectorAll('li.p-select-option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(options).toEqual(['Yo · bodega', 'Víctor Vendedor']);
    httpMock.verify();
  });

  describe('cambiar de «Viendo» con carrito (HU-17)', () => {
    const LUIS_ID = '9f1c2b3a-4d5e-4f60-8a7b-1c2d3e4f5a6b';
    let cart: CartService;
    let viewing: ViewingService;
    let pick: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      TestBed.inject(HttpTestingController)
        .expectOne(`${API_BASE_URL}/api/sellers`)
        .flush([{ id: LUIS_ID, fullName: 'Luis Vendedor' }]);
      cart = TestBed.inject(CartService);
      TestBed.tick();
      viewing = TestBed.inject(ViewingService);
      pick = vi.spyOn(viewing, 'pick');
    });

    it('con el carrito vacío cambia sin preguntar', async () => {
      await fixture.componentInstance.onViewingChange(LUIS_ID);
      expect(ask).not.toHaveBeenCalled();
      expect(pick).toHaveBeenCalledWith(LUIS_ID);
    });

    it('con renglones del mismo titular cambia sin preguntar', async () => {
      cart.setUnits(10, 2);
      await fixture.componentInstance.onViewingChange(null);
      expect(ask).not.toHaveBeenCalled();
      expect(pick).toHaveBeenCalledWith(null);
      expect(cart.totalUnits()).toBe(2);
    });

    it('con renglones de otro titular pregunta «¿Vaciar el carrito?» con los nombres', async () => {
      cart.setUnits(10, 2);
      ask.mockResolvedValue(false);
      await fixture.componentInstance.onViewingChange(LUIS_ID);
      expect(ask).toHaveBeenCalledOnce();
      expect(ask.mock.calls[0]![0]).toMatchObject({
        title: '¿Vaciar el carrito?',
        message: 'Tu carrito es de la bodega. Si cambias a Luis Vendedor, se vacía.',
        confirmLabel: 'Vaciar y cambiar',
        cancelLabel: 'Cancelar',
      });
    });

    it('cancelar no llama a pick, conserva el carrito y avisa a la barra para volver al titular anterior', async () => {
      cart.setUnits(10, 2);
      ask.mockResolvedValue(false);
      const before = fixture.componentInstance.barResetKey();
      await fixture.componentInstance.onViewingChange(LUIS_ID);
      expect(pick).not.toHaveBeenCalled();
      expect(cart.totalUnits()).toBe(2);
      expect(fixture.componentInstance.barResetKey()).toBe(before + 1);
    });

    it('aceptar vacía el carrito y cambia', async () => {
      cart.setUnits(10, 2);
      ask.mockResolvedValue(true);
      await fixture.componentInstance.onViewingChange(LUIS_ID);
      expect(cart.lines()).toEqual([]);
      expect(pick).toHaveBeenCalledWith(LUIS_ID);
    });
  });
});
