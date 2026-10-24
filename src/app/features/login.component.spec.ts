import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginComponent } from './login.component';
import { API_BASE_URL } from '../core/api-base-url';
import type { AuthContext, SessionResult } from '../core/auth/auth.models';

const ADMIN_USER: AuthContext = { userId: 'a1', role: 'admin', clientId: null, fullName: 'Ana' };
const ADMIN_SESSION: SessionResult = {
  accessToken: 't1',
  refreshToken: 'r1',
  expiresAt: null,
  user: ADMIN_USER,
};
const LOGIN_URL = `${API_BASE_URL}/api/auth/login`;

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    fixture = TestBed.createComponent(LoginComponent);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  const usuarioInput = () => fixture.nativeElement.querySelector('#usuario') as HTMLInputElement;
  const contrasenaInput = () =>
    fixture.nativeElement.querySelector('#contrasena') as HTMLInputElement;

  function fillAndSubmit(usuario: string, contrasena: string) {
    usuarioInput().value = usuario;
    contrasenaInput().value = contrasena;
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
    httpMock.expectNone(LOGIN_URL);
  });

  it('con credenciales correctas de administrador redirige a /admin', () => {
    fillAndSubmit('admin@mammut.local', 'secreta');
    expect(fixture.nativeElement.textContent).toContain('Entrando…');

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

    const retryButton = fixture.nativeElement.querySelector('.retry') as HTMLButtonElement;
    retryButton.click();

    httpMock.expectOne(LOGIN_URL).flush(ADMIN_SESSION);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });
});
