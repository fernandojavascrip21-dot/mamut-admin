import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { TopNavComponent } from './top-nav.component';
import type { CartLink, NavMenuItem } from './top-nav.models';
import type { AuthContext } from '@core/auth/interfaces/auth.models';
import { CartService } from '@core/cart/cart.service';

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

  it('el enlace a la cuenta conserva sus iniciales para administrador y vendedor', async () => {
    await render(ADMIN, ADMIN_MENU, 'Menú del administrador');
    let account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.textContent?.trim()).toBe('AL');
    expect(account.getAttribute('aria-label')).toBe('Mi cuenta');

    await render(SELLER, ADMIN_MENU, 'Menú del vendedor');
    account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.textContent?.trim()).toBe('LU');
    expect(account.getAttribute('href')).toBe('/cuenta');
  });

  it('el avatar tiene el tamaño táctil mínimo de 44px (h-11 w-11)', async () => {
    await render(ADMIN, ADMIN_MENU, 'Menú del administrador');
    const account = fixture.nativeElement.querySelector('a[aria-label="Mi cuenta"]') as HTMLAnchorElement;
    expect(account.classList.contains('h-11')).toBe(true);
    expect(account.classList.contains('w-11')).toBe(true);
  });

  it('marca solo el item activo con aria-current al navegar', async () => {
    await render(ADMIN, ADMIN_MENU, 'Menú del administrador');
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/productos');
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('nav a')) as HTMLAnchorElement[];
    const activeLink = links.find((a) => a.textContent?.trim() === 'Productos')!;
    const inactiveLink = links.find((a) => a.textContent?.trim() === 'Stock')!;

    expect(activeLink.getAttribute('aria-current')).toBe('page');
    expect(inactiveLink.getAttribute('aria-current')).toBeNull();
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
    expect(cartLink.closest('nav')).toBeNull();
  });

  describe('contador del carrito (HU-15)', () => {
    const cartLink = () => fixture.nativeElement.querySelector('a[href="/carrito"]') as HTMLAnchorElement;
    const badge = () => fixture.nativeElement.querySelector('.cart-badge') as HTMLElement | null;

    // Con el carrito de la sesión ya guardado, para que CartService lo cargue al crearse.
    async function renderWithCart(user: AuthContext, lines: { productId: number; units: number }[]) {
      localStorage.setItem(`mamut.cart.${user.userId}`, JSON.stringify({ version: 1, lines }));
      await render(user, ADMIN_MENU, 'Menú');
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('con el carrito vacío no muestra el globo y el nombre accesible es solo «Carrito»', async () => {
      await render(SELLER, ADMIN_MENU, 'Menú del vendedor');
      expect(badge()).toBeNull();
      expect(cartLink().getAttribute('aria-label')).toBe('Carrito');
    });

    it('con piezas muestra el total y lo dice en el nombre accesible', async () => {
      await renderWithCart(SELLER, [{ productId: 10, units: 2 }, { productId: 12, units: 1 }]);
      expect(badge()?.textContent?.trim()).toBe('3');
      expect(badge()?.getAttribute('aria-hidden')).toBe('true');
      expect(cartLink().getAttribute('aria-label')).toBe('Carrito, 3 piezas');
    });

    it('con una pieza el nombre accesible dice «1 pieza»', async () => {
      await renderWithCart(SELLER, [{ productId: 10, units: 1 }]);
      expect(badge()?.textContent?.trim()).toBe('1');
      expect(cartLink().getAttribute('aria-label')).toBe('Carrito, 1 pieza');
    });

    it('con más de 99 piezas muestra «99+» y el nombre accesible conserva el número real', async () => {
      await renderWithCart(SELLER, [{ productId: 10, units: 120 }]);
      expect(badge()?.textContent?.trim()).toBe('99+');
      expect(cartLink().getAttribute('aria-label')).toBe('Carrito, 120 piezas');
    });

    it('se actualiza al cambiar el carrito y desaparece al vaciarlo', async () => {
      await renderWithCart(SELLER, [{ productId: 10, units: 2 }]);
      const cart = TestBed.inject(CartService);

      cart.setUnits(10, 5);
      fixture.detectChanges();
      expect(badge()?.textContent?.trim()).toBe('5');

      cart.remove(10);
      fixture.detectChanges();
      expect(badge()).toBeNull();
      expect(cartLink().getAttribute('aria-label')).toBe('Carrito');
    });
  });

  it('el menú es un p-menu con una opción por item y el botón de ocultar es pButton', async () => {
    await render(ADMIN, ADMIN_MENU, 'Menú del administrador');
    const menu = fixture.nativeElement.querySelector('nav p-menu') as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.querySelectorAll('li[role="menuitem"]').length).toBe(4);

    const hide = fixture.nativeElement.querySelector('button[aria-controls]') as HTMLButtonElement;
    expect(hide.classList.contains('p-button')).toBe(true);
    expect(hide.getAttribute('aria-expanded')).toBe('true');
  });
});
