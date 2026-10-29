import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginPageComponent } from './login-page.component';
import { API_BASE_URL } from '@shared/api-base-url';
import type { AuthContext, SessionResult } from '@auth/interfaces/auth.models';

const ADMIN_USER: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana' };
const ADMIN_SESSION: SessionResult = {
  accessToken: 't1',
  refreshToken: 'r1',
  expiresAt: null,
  user: ADMIN_USER,
};
const LOGIN_URL = `${API_BASE_URL}/api/auth/login`;

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(LoginPageComponent);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  const emailInput = () => fixture.nativeElement.querySelector('#email') as HTMLInputElement;
  const passwordInput = () =>
    fixture.nativeElement.querySelector('#password') as HTMLInputElement;

  function fillAndSubmit(email: string, password: string) {
    emailInput().value = email;
    emailInput().dispatchEvent(new Event('input'));
    passwordInput().value = password;
    passwordInput().dispatchEvent(new Event('input'));
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  it('se crea', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('con campos vacíos muestra la validación y no llama al backend', () => {
    fillAndSubmit('', '');

    const errors = fixture.nativeElement.querySelectorAll('.field-error');
    expect(errors.length).toBe(2);
    expect(errors[0].textContent).toContain('Escribe tu usuario');
    expect(errors[1].textContent).toContain('Escribe tu contraseña');
    expect(emailInput().getAttribute('aria-invalid')).toBe('true');
    expect(emailInput().getAttribute('aria-describedby')).toBe('email-error');
    expect(passwordInput().getAttribute('aria-describedby')).toBe('password-error');
    expect(document.activeElement).toBe(emailInput());
    httpMock.expectNone(LOGIN_URL);
  });

  it('un envío inválido marca los dos campos como tocados', () => {
    fillAndSubmit('', 'secreta');
    expect(fixture.componentInstance.emailControl.touched).toBe(true);
    expect(fixture.componentInstance.passwordControl.touched).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.field-error').length).toBe(1);
    httpMock.expectNone(LOGIN_URL);
  });

  it('un segundo envío mientras revisa el login no manda otra petición', () => {
    fillAndSubmit('admin@mammut.local', 'secreta');
    fixture.componentInstance.retry();
    httpMock.expectOne(LOGIN_URL).flush(ADMIN_SESSION);
  });

  it('recorta espacios de más en el usuario antes de enviarlo (no la contraseña)', () => {
    fillAndSubmit('  admin@mammut.local  ', ' secreta ');

    const req = httpMock.expectOne(LOGIN_URL);
    expect(req.request.body).toEqual({ email: 'admin@mammut.local', password: ' secreta ' });
    req.flush(ADMIN_SESSION);
  });

  it('con credenciales correctas de administrador redirige a /admin', () => {
    fillAndSubmit('admin@mammut.local', 'secreta');
    expect(fixture.nativeElement.textContent).toContain('Entrando…');
    expect(emailInput().disabled).toBe(true);
    expect(passwordInput().disabled).toBe(true);

    httpMock.expectOne(LOGIN_URL).flush(ADMIN_SESSION);

    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('con credenciales incorrectas muestra el mensaje de error', () => {
    fillAndSubmit('admin@mammut.local', 'mala');

    httpMock
      .expectOne(LOGIN_URL)
      .flush(
        { error: { code: 'unauthorized', message: 'Correo o contraseña incorrectos' } },
        { status: 401, statusText: 'Unauthorized' },
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Usuario o contraseña incorrectos');
  });

  it('sin conexión muestra el aviso y "Reintentar" reintenta con los mismos datos', () => {
    fillAndSubmit('admin@mammut.local', 'secreta');

    httpMock.expectOne(LOGIN_URL).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay conexión a internet');

    expect(emailInput().disabled).toBe(false);
    const retryButton = fixture.nativeElement.querySelector('.retry') as HTMLButtonElement;
    retryButton.click();

    const retry = httpMock.expectOne(LOGIN_URL);
    expect(retry.request.body).toEqual({ email: 'admin@mammut.local', password: 'secreta' });
    retry.flush(ADMIN_SESSION);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });
});
