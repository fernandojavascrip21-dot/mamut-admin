import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<LoginState>('form');
  readonly emailError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);

  private readonly emailInput = viewChild.required<ElementRef<HTMLInputElement>>('email');
  private readonly passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('password');

  private lastAttempt: { email: string; password: string } | null = null;

  // Valida los campos en el cliente antes de llamar al backend (criterio 4 de HU-01): si alguno
  // está vacío, marca el error puntual de ese campo y nunca llega a intentar el login.
  // El usuario (correo) se recorta antes de enviarlo: un espacio de más (p. ej. autocompletado
  // del navegador) hace que Supabase lo trate como un correo distinto y responda igual que una
  // contraseña incorrecta. La contraseña se manda tal cual se escribió, sin recortar.
  onSubmit(email: string, password: string): void {
    const trimmedEmail = email.trim();
    const isEmailEmpty = trimmedEmail === '';
    const isPasswordEmpty = password.trim() === '';
    this.emailError.set(isEmailEmpty ? 'Escribe tu usuario' : null);
    this.passwordError.set(isPasswordEmpty ? 'Escribe tu contraseña' : null);
    if (isEmailEmpty || isPasswordEmpty) {
      (isEmailEmpty ? this.emailInput() : this.passwordInput()).nativeElement.focus();
      return;
    }

    this.lastAttempt = { email: trimmedEmail, password };
    this.attempt(trimmedEmail, password);
  }

  // Botón "Reintentar" del estado sin conexión (criterio 5): reintenta con los mismos datos
  // que ya se habían escrito, sin pedirlos de nuevo.
  retry(): void {
    if (this.lastAttempt) this.attempt(this.lastAttempt.email, this.lastAttempt.password);
  }

  // Intento real de login contra el backend. Al resolver bien, manda a cada rol a su propia
  // home (ROLE_HOME, el mismo mapa que usa el guard); al fallar, distingue sin red de
  // credenciales incorrectas para mostrar el estado correcto (ver isOffline).
  private attempt(email: string, password: string): void {
    this.state.set('loading');
    this.auth.login(email, password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
