import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SellerShellComponent } from './seller-shell.component';
import type { AuthContext } from '@core/auth/interfaces/auth.models';

const SELLER: AuthContext = { userId: 'v1', role: 'vendedor', clientId: null, fullName: 'Luis' };

describe('SellerShellComponent', () => {
  let fixture: ComponentFixture<SellerShellComponent>;

  beforeEach(() => {
    localStorage.setItem('mamut.user', JSON.stringify(SELLER));
    TestBed.configureTestingModule({
      imports: [SellerShellComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(SellerShellComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('se crea', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra el menú del vendedor: Mi stock, Vender, Mi corte (sin costos ni ganancia)', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('nav a')).map((a) =>
      (a as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['Mi stock', 'Vender', 'Mi corte']);
    expect(fixture.nativeElement.textContent).not.toMatch(/costo|ganancia/i);
  });

  it('muestra las iniciales del usuario y enlaza a /cuenta', () => {
    const account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.textContent?.trim()).toBe('LU');
    expect(account.getAttribute('href')).toBe('/cuenta');
  });

  it('muestra el carrito como ícono aparte en la cabecera', () => {
    const cart = fixture.nativeElement.querySelector('a[aria-label="Carrito"]') as HTMLAnchorElement;
    expect(cart.getAttribute('href')).toBe('/carrito');
  });

  it('no muestra la barra «Viendo» ni pide la lista de vendedores', () => {
    expect(fixture.nativeElement.querySelector('app-viewing-bar')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Viendo');
    TestBed.inject(HttpTestingController).verify();
  });
});
