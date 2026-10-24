import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { VendedorShellComponent } from './vendedor-shell.component';
import type { AuthContext } from '../core/auth/auth.models';

const VENDEDOR: AuthContext = { userId: 'v1', role: 'vendedor', clientId: null, fullName: 'Luis' };

describe('VendedorShellComponent', () => {
  let fixture: ComponentFixture<VendedorShellComponent>;

  beforeEach(() => {
    localStorage.setItem('mamut.user', JSON.stringify(VENDEDOR));
    TestBed.configureTestingModule({
      imports: [VendedorShellComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(VendedorShellComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('se crea', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra el menú del vendedor: Mi stock, Vender, Carrito, Mi corte (sin costos ni ganancia)', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('nav a')).map((a) =>
      (a as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['Mi stock', 'Vender', 'Carrito', 'Mi corte']);
    expect(fixture.nativeElement.textContent).not.toMatch(/costo|ganancia/i);
  });

  it('muestra las iniciales del usuario y enlaza a /cuenta', () => {
    const account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.textContent?.trim()).toBe('LU');
    expect(account.getAttribute('href')).toBe('/cuenta');
  });
});
