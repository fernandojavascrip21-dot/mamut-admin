import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ROLE_HOME } from '../../auth/guards/role.guard';
import { AuthService } from '../../auth/services/auth.service';

type LoginState = 'form' | 'loading' | 'error-credentials' | 'offline';

// Pantalla 01 Inicio de sesión (RF-01, RF-02, RNF-04). Estados: ver specs/M0-base/spec.md §3.1.
@Component({
  imports: [],
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly state = signal<LoginState>('form');
  readonly usuarioError = signal<string | null>(null);
  readonly contrasenaError = signal<string | null>(null);

  private lastAttempt: { usuario: string; contrasena: string } | null = null;

  // Valida los campos en el cliente antes de llamar al backend (criterio 4 de HU-01): si alguno
  // está vacío, marca el error puntual de ese campo y nunca llega a intentar el login.
  onSubmit(usuario: string, contrasena: string): void {
    const usuarioVacio = usuario.trim() === '';
    const contrasenaVacia = contrasena.trim() === '';
    this.usuarioError.set(usuarioVacio ? 'Escribe tu usuario' : null);
    this.contrasenaError.set(contrasenaVacia ? 'Escribe tu contraseña' : null);
    if (usuarioVacio || contrasenaVacia) return;

    this.lastAttempt = { usuario, contrasena };
    this.attempt(usuario, contrasena);
  }

  // Botón "Reintentar" del estado sin conexión (criterio 5): reintenta con los mismos datos
  // que ya se habían escrito, sin pedirlos de nuevo.
  retry(): void {
    if (this.lastAttempt) this.attempt(this.lastAttempt.usuario, this.lastAttempt.contrasena);
  }

  // Intento real de login contra el backend. Al resolver bien, manda a cada rol a su propia
  // home (ROLE_HOME, el mismo mapa que usa el guard); al fallar, distingue sin red de
  // credenciales incorrectas para mostrar el estado correcto (ver isOffline).
  private attempt(usuario: string, contrasena: string): void {
    this.state.set('loading');
    this.auth.login(usuario, contrasena).subscribe({
      next: (result) => {
        this.router.navigateByUrl(ROLE_HOME[result.user.role] ?? '/login');
      },
      error: (error: unknown) => {
        this.state.set(this.isOffline(error) ? 'offline' : 'error-credentials');
      },
    });
  }

  // Sin respuesta HTTP real del servidor (red caída, DNS, CORS bloqueado...): Angular lo
  // reporta como HttpErrorResponse con status 0, nunca como un 4xx/5xx del backend.
  private isOffline(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 0;
  }
}
