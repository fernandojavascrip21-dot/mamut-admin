import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ROLE_HOME } from '../core/auth/role.guard';
import { AuthService } from '../core/auth/auth.service';

type LoginState = 'form' | 'loading' | 'error-credentials' | 'offline';

// Pantalla 01 Inicio de sesión (RF-01, RF-02, RNF-04). Estados: ver specs/M0-base/spec.md §3.1.
@Component({
  imports: [],
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly state = signal<LoginState>('form');
  readonly usuarioError = signal<string | null>(null);
  readonly contrasenaError = signal<string | null>(null);

  private lastAttempt: { usuario: string; contrasena: string } | null = null;

  onSubmit(usuario: string, contrasena: string): void {
    const usuarioVacio = usuario.trim() === '';
    const contrasenaVacia = contrasena.trim() === '';
    this.usuarioError.set(usuarioVacio ? 'Escribe tu usuario' : null);
    this.contrasenaError.set(contrasenaVacia ? 'Escribe tu contraseña' : null);
    if (usuarioVacio || contrasenaVacia) return;

    this.lastAttempt = { usuario, contrasena };
    this.attempt(usuario, contrasena);
  }

  retry(): void {
    if (this.lastAttempt) this.attempt(this.lastAttempt.usuario, this.lastAttempt.contrasena);
  }

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
