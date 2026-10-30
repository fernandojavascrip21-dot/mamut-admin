import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AccountPageComponent } from './account-page.component';
import { API_BASE_URL } from '@core/api-base-url';
import type { AuthContext } from '@core/auth/interfaces/auth.models';

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana López' };
const SELLER: AuthContext = { userId: 'v1', role: 'vendedor', clientId: null, fullName: 'Luis' };
const LOGOUT_URL = `${API_BASE_URL}/api/auth/logout`;

function createFor(user: AuthContext) {
  localStorage.setItem('mamut.user', JSON.stringify(user));
  TestBed.configureTestingModule({
    imports: [AccountPageComponent],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture: ComponentFixture<AccountPageComponent> =
    TestBed.createComponent(AccountPageComponent);
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  fixture.detectChanges();
  return { fixture, router, httpMock: TestBed.inject(HttpTestingController) };
}

describe('AccountPageComponent', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('se crea', () => {
    const { fixture } = createFor(ADMIN);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('administrador: muestra su nombre, el badge "Administrador" y la nota sobre dar de alta vendedores', () => {
    const { fixture, httpMock } = createFor(ADMIN);
    expect(fixture.nativeElement.textContent).toContain('Ana López');
    expect(fixture.nativeElement.textContent).toContain('Administrador');
    expect(fixture.nativeElement.textContent).toContain('Tú das de alta a los vendedores');
    httpMock.verify();
  });

  it('vendedor: muestra el badge "Vendedor" y la nota de pedirle la contraseña al administrador', () => {
    const { fixture, httpMock } = createFor(SELLER);
    expect(fixture.nativeElement.textContent).toContain('Vendedor');
    expect(fixture.nativeElement.textContent).toContain('pídela al administrador');
    httpMock.verify();
  });

  it('"Cerrar sesión" pide confirmación, y "Cancelar" la descarta sin tocar la sesión', () => {
    const { fixture, httpMock } = createFor(ADMIN);
    const logoutButton = fixture.nativeElement.querySelector(
      'button:not([aria-label])',
    ) as HTMLButtonElement;
    logoutButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeTruthy();

    const cancelButton = fixture.nativeElement.querySelector(
      '[role="alertdialog"] button',
    ) as HTMLButtonElement;
    cancelButton.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeFalsy();
    httpMock.verify();
  });

  it('el diálogo recibe el foco, retiene Tab y devuelve el foco al cerrarse con Escape', () => {
    const { fixture, httpMock } = createFor(ADMIN);
    const logoutButton = fixture.nativeElement.querySelector(
      'button:not([aria-label])',
    ) as HTMLButtonElement;
    logoutButton.focus();
    logoutButton.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="alertdialog"]') as HTMLElement;
    const [cancel, confirm] = Array.from(dialog.querySelectorAll('button')) as HTMLButtonElement[];
    expect(document.activeElement).toBe(cancel);

    cancel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    );
    expect(document.activeElement).toBe(confirm);
    confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(cancel);

    cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeFalsy();
    expect(document.activeElement).toBe(logoutButton);
    httpMock.verify();
  });

  it('al confirmar, llama a logout y navega a /login', () => {
    const { fixture, httpMock, router } = createFor(ADMIN);
    fixture.componentInstance.askLogout();
    fixture.componentInstance.confirmLogout();

    httpMock.expectOne(LOGOUT_URL).flush(null, { status: 204, statusText: 'No Content' });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('si logout falla (sin red), igual limpia la sesión local y navega a /login', () => {
    const { fixture, httpMock, router } = createFor(ADMIN);
    fixture.componentInstance.confirmLogout();

    httpMock.expectOne(LOGOUT_URL).error(new ProgressEvent('error'));

    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem('mamut.user')).toBeNull();
  });

  it('"Volver" regresa a la home del propio rol', () => {
    const { fixture, httpMock, router } = createFor(SELLER);
    fixture.componentInstance.goBack();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/vendedor');
    httpMock.verify();
  });
});
