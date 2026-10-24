import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AdminPageComponent } from './admin-page.component';
import type { AuthContext } from '../../auth/interfaces/auth.models';

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana López' };

describe('AdminPageComponent', () => {
  let fixture: ComponentFixture<AdminPageComponent>;

  beforeEach(() => {
    localStorage.setItem('mamut.user', JSON.stringify(ADMIN));
    TestBed.configureTestingModule({
      imports: [AdminPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(AdminPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('se crea', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('muestra el menú del administrador: Stock, Productos, Carrito, Corte, Vendedores', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('nav a')).map((a) =>
      (a as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['Stock', 'Productos', 'Carrito', 'Corte', 'Vendedores']);
  });

  it('muestra las iniciales del usuario y enlaza a /cuenta', () => {
    const account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.textContent?.trim()).toBe('AL');
    expect(account.getAttribute('href')).toBe('/cuenta');
  });
});
