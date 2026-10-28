import { Component, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ROLE_HOME } from '../../auth/guards/role.guard';
import { AuthService } from '../../auth/services/auth.service';
import { isOffline } from '../../shared/http-errors';
import { notBlank } from '../../shared/validators';

type LoginState = 'form' | 'loading' | 'error-credentials' | 'offline';

// Pantalla 01 Inicio de sesión (RF-01, RF-02, RNF-04). Estados: ver specs/M0-base/spec.md §3.1.
@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: notBlank() }),
    password: new FormControl('', { nonNullable: true, validators: notBlank() }),
  });

  readonly state = signal<LoginState>('form');
  readonly emailError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);

  private readonly emailInput = viewChild.required<ElementRef<HTMLInputElement>>('emailInput');
  private readonly passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  // Los campos quedan deshabilitados mientras se revisa el login.
  constructor() {
    effect(() => {
      if (this.state() === 'loading') this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });
  }

  // Valida los campos en el cliente antes de llamar al backend (criterio 4 de HU-01): si alguno
  // está vacío, marca el error puntual de ese campo y nunca llega a intentar el login.
  onSubmit(): void {
    const { email, password } = this.form.controls;
    this.emailError.set(email.invalid ? 'Escribe tu usuario' : null);
    this.passwordError.set(password.invalid ? 'Escribe tu contraseña' : null);
    if (email.invalid || password.invalid) {
      (email.invalid ? this.emailInput() : this.passwordInput()).nativeElement.focus();
      return;
    }
    this.attempt();
  }

  // Botón "Reintentar" del estado sin conexión (criterio 5): reenvía lo que sigue escrito en
  // el formulario, sin pedirlo de nuevo.
  retry(): void {
    this.attempt();
  }

  // Intento real de login contra el backend. El usuario (correo) se recorta antes de enviarlo:
  // un espacio de más (p. ej. autocompletado del navegador) hace que Supabase lo trate como un
  // correo distinto y responda igual que una contraseña incorrecta. La contraseña se manda tal
  // cual se escribió. Al resolver bien, manda a cada rol a su propia home (ROLE_HOME, el mismo
  // mapa que usa el guard); al fallar, distingue sin red de credenciales incorrectas.
  private attempt(): void {
    const { email, password } = this.form.getRawValue();
    this.state.set('loading');
    this.auth.login(email.trim(), password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.router.navigateByUrl(ROLE_HOME[result.user.role] ?? '/login');
      },
      error: (error: unknown) => {
        this.state.set(isOffline(error) ? 'offline' : 'error-credentials');
      },
    });
  }
}
