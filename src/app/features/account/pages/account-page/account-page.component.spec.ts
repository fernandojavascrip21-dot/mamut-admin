import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AccountPageComponent } from './account-page.component';
import { API_BASE_URL } from '@core/api-base-url';
import { ConfirmService } from '@core/confirm/confirm.service';
import type { AuthContext } from '@core/auth/interfaces/auth.models';

const ADMIN: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana López' };
const SELLER: AuthContext = { userId: 'v1', role: 'vendedor', clientId: null, fullName: 'Luis' };
const LOGOUT_URL = `${API_BASE_URL}/api/auth/logout`;
const ask = vi.fn<ConfirmService['ask']>();

function createFor(user: AuthContext) {
  localStorage.setItem('mamut.user', JSON.stringify(user));
  TestBed.configureTestingModule({
    imports: [AccountPageComponent],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ConfirmService, useValue: { ask } },
    ],
  });
  const fixture: ComponentFixture<AccountPageComponent> =
    TestBed.createComponent(AccountPageComponent);
  const router = TestBed.inject(Router);
  vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  fixture.detectChanges();
  return { fixture, router, httpMock: TestBed.inject(HttpTestingController) };
}

describe('AccountPageComponent', () => {
  beforeEach(() => ask.mockReset());

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

  it('"Cerrar sesión" pide confirmación con la pregunta de siempre, en tono de peligro', async () => {
    ask.mockResolvedValue(false);
    const { fixture, httpMock } = createFor(ADMIN);
    const logoutButton = fixture.nativeElement.querySelector(
      'button:not([aria-label])',
    ) as HTMLButtonElement;
    logoutButton.click();
    await fixture.whenStable();
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '¿Cerrar sesión?',
        confirmLabel: 'Cerrar sesión',
        cancelLabel: 'Cancelar',
        tone: 'danger',
      }),
    );
    httpMock.verify();
  });

  it('si cancela la confirmación, no toca la sesión', async () => {
    ask.mockResolvedValue(false);
    const { fixture, httpMock, router } = createFor(ADMIN);
    fixture.componentInstance.askLogout();
    await fixture.whenStable();
    httpMock.expectNone(LOGOUT_URL);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('al confirmar, llama a logout y navega a /login', async () => {
    ask.mockResolvedValue(true);
    const { fixture, httpMock, router } = createFor(ADMIN);
    fixture.componentInstance.askLogout();
    await fixture.whenStable();

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
