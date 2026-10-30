import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/api-base-url';
import { AdminShellComponent } from './admin-shell.component';
import type { AuthContext } from '@core/auth/interfaces/auth.models';

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana López' };

describe('AdminShellComponent', () => {
  let fixture: ComponentFixture<AdminShellComponent>;

  beforeEach(() => {
    localStorage.setItem('mamut.user', JSON.stringify(ADMIN));
    TestBed.configureTestingModule({
      imports: [AdminShellComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
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

  it('muestra la barra «Viendo» y pide la lista de vendedores una vez', () => {
    const httpMock = TestBed.inject(HttpTestingController);
    httpMock.expectOne(`${API_BASE_URL}/api/sellers`).flush([{ id: 'v-1', fullName: 'Víctor Vendedor', units: 6 }]);
    fixture.detectChanges();

    const bar = fixture.nativeElement.querySelector('app-viewing-bar') as HTMLElement;
    expect(bar).not.toBeNull();
    const options = Array.from(bar.querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(options).toEqual(['Yo · bodega', 'Víctor Vendedor']);
    httpMock.verify();
  });
});
