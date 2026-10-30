import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TopNavComponent } from './top-nav.component';
import type { CartLink, NavMenuItem } from './top-nav.models';
import type { AuthContext } from '@core/auth/interfaces/auth.models';

@Component({ template: '' })
class DummyRouteComponent {}

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana López' };
const SELLER: AuthContext = { userId: 'v1', role: 'vendedor', clientId: null, fullName: 'Luis' };

const ADMIN_MENU: NavMenuItem[] = [
  { path: 'stock', label: 'Stock', icon: 'package' },
  { path: 'productos', label: 'Productos', icon: 'tag' },
  { path: 'corte', label: 'Corte', icon: 'receipt' },
  { path: 'vendedores', label: 'Vendedores', icon: 'users' },
];

const CART: CartLink = { path: 'carrito', label: 'Carrito' };

describe('TopNavComponent', () => {
  let fixture: ComponentFixture<TopNavComponent>;

  async function render(user: AuthContext, menu: NavMenuItem[], ariaLabel: string) {
    localStorage.setItem('mamut.user', JSON.stringify(user));
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [TopNavComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(
          [...ADMIN_MENU, CART].map((item) => ({ path: item.path, component: DummyRouteComponent })),
        ),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TopNavComponent);
    fixture.componentRef.setInput('menu', menu);
    fixture.componentRef.setInput('cart', CART);
    fixture.componentRef.setInput('ariaLabel', ariaLabel);
    fixture.detectChanges();
  }

  afterEach(() => {
    localStorage.clear();
  });

  it('pinta un enlace por item del menú con su etiqueta visible', async () => {
    await render(ADMIN, ADMIN_MENU, 'Menú del administrador');
    const labels = Array.from(fixture.nativeElement.querySelectorAll('nav a')).map((a) =>
      (a as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['Stock', 'Productos', 'Corte', 'Vendedores']);
  });

  it('muestra las iniciales del usuario y enlaza a /cuenta', async () => {
    await render(ADMIN, ADMIN_MENU, 'Menú del administrador');
    const account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.textContent?.trim()).toBe('AL');
    expect(account.getAttribute('href')).toBe('/cuenta');
  });

  it('el avatar usa bg-ink para admin y bg-accent-2 para vendedor', async () => {
    await render(ADMIN, ADMIN_MENU, 'Menú del administrador');
    let account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.classList.contains('bg-ink')).toBe(true);

    await render(SELLER, ADMIN_MENU, 'Menú del vendedor');
    account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.classList.contains('bg-accent-2')).toBe(true);
  });

  it('el avatar tiene el tamaño táctil mínimo de 44px (h-11 w-11)', async () => {
    await render(ADMIN, ADMIN_MENU, 'Menú del administrador');
    const account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.classList.contains('h-11')).toBe(true);
    expect(account.classList.contains('w-11')).toBe(true);
  });

  it('marca el item activo con aria-current y la pastilla de fondo al navegar', async () => {
    await render(ADMIN, ADMIN_MENU, 'Menú del administrador');
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/productos');
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('nav a')) as HTMLAnchorElement[];
    const activeLink = links.find((a) => a.textContent?.trim() === 'Productos')!;
    const inactiveLink = links.find((a) => a.textContent?.trim() === 'Stock')!;

    expect(activeLink.getAttribute('aria-current')).toBe('page');
    expect(activeLink.querySelector('span')?.classList.contains('bg-accent-2-bg')).toBe(true);
    expect(inactiveLink.getAttribute('aria-current')).toBeNull();
    expect(inactiveLink.querySelector('span')?.classList.contains('bg-accent-2-bg')).toBe(false);
  });

  it('el ícono de carrito vive en la cabecera, aparte del menú, y marca activo al navegar', async () => {
    await render(ADMIN, ADMIN_MENU, 'Menú del administrador');
    const cartLink = fixture.nativeElement.querySelector('a[aria-label="Carrito"]') as HTMLAnchorElement;
    expect(cartLink.getAttribute('href')).toBe('/carrito');
    expect(cartLink.getAttribute('aria-current')).toBeNull();
    expect(cartLink.classList.contains('h-11')).toBe(true);
    expect(cartLink.classList.contains('w-11')).toBe(true);

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/carrito');
    fixture.detectChanges();

    expect(cartLink.getAttribute('aria-current')).toBe('page');
    expect(cartLink.classList.contains('bg-accent-2-bg')).toBe(true);
  });
});
