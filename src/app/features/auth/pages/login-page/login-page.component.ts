import { Component, DestroyRef, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ROLE_HOME } from '@core/auth/constants/auth.constants';
import { AuthService } from '@core/auth/services/auth.service';
import { isOffline } from '@shared/utils/http-errors';
import { notBlank } from '@shared/validators/validators';
import type { LoginFormGroup, LoginPayload, LoginState } from '../../models/login-page.models';

// Pantalla 01 Inicio de sesión (RF-01, RF-02, RNF-04). Estados: ver specs/M0-base/spec.md §3.1.
@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
})
export class LoginPageComponent implements OnInit {
  // --- Dependencias ---
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  // --- Formulario y estados ---
  form!: LoginFormGroup;
  readonly state = signal<LoginState>('form');
  readonly emailError = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);

  private readonly emailInput = viewChild.required<ElementRef<HTMLInputElement>>('emailInput');
  private readonly passwordInput = viewChild.required<ElementRef<HTMLInputElement>>('passwordInput');

  // --- Getters ---
  get emailControl() {
    return this.form.controls.email;
  }

  get passwordControl() {
    return this.form.controls.password;
  }

  // --- Ciclo de vida ---
  // El login empieza vacío: no hay datos que cargar después de crear el formulario.
  ngOnInit(): void {
    this.form = this.createEmptyForm();
  }

  private createEmptyForm(): LoginFormGroup {
    return this.formBuilder.group({
      email: this.formBuilder.control('', notBlank()),
      password: this.formBuilder.control('', notBlank()),
    });
  }

  // --- Validación, payload y envío ---
  // Valida los campos en el cliente antes de llamar al backend (criterio 4 de HU-01): si alguno
  // está vacío, marca el error puntual de ese campo y nunca llega a intentar el login.
  onSubmit(): void {
    this.emailError.set(this.emailControl.invalid ? 'Escribe tu usuario' : null);
    this.passwordError.set(this.passwordControl.invalid ? 'Escribe tu contraseña' : null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      (this.emailControl.invalid ? this.emailInput() : this.passwordInput()).nativeElement.focus();
      return;
    }
    this.attempt(this.prepareLoginPayload());
  }

  // Botón "Reintentar" del estado sin conexión (criterio 5): reenvía lo que sigue escrito en
  // el formulario, sin pedirlo de nuevo.
  retry(): void {
    this.attempt(this.prepareLoginPayload());
  }

  // El usuario (correo) se recorta: un espacio de más (p. ej. autocompletado del navegador)
  // hace que Supabase lo trate como un correo distinto y responda igual que una contraseña
  // incorrecta. La contraseña se manda tal cual se escribió.
  private prepareLoginPayload(): LoginPayload {
    const { email, password } = this.form.getRawValue();
    return { email: email.trim(), password };
  }

  // Intento real de login contra el backend; ignora un segundo envío mientras el primero sigue
  // en curso. Al resolver bien, manda a cada rol a su propia home (ROLE_HOME, el mismo mapa que
  // usa el guard); al fallar, distingue sin red de credenciales incorrectas.
  private attempt(payload: LoginPayload): void {
    if (this.state() === 'loading') return;
    this.startLoading();
    this.auth.login(payload.email, payload.password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      // Al navegar, la pantalla se destruye con «Entrando…»; si la navegación no ocurre, se
      // cierra la espera para no dejar el formulario bloqueado.
      next: (result) => {
        void this.router.navigateByUrl(ROLE_HOME[result.user.role] ?? '/login').then((navigated) => {
          if (!navigated) this.finishLoading('form');
        });
      },
      error: (error: unknown) => {
        this.finishLoading(isOffline(error) ? 'offline' : 'error-credentials');
      },
    });
  }

  // Los campos quedan deshabilitados mientras se revisa el login, y se habilitan al terminar
  // tanto si salió bien como si falló.
  private startLoading(): void {
    this.state.set('loading');
    this.form.disable({ emitEvent: false });
  }

  private finishLoading(state: Exclude<LoginState, 'loading'>): void {
    this.form.enable({ emitEvent: false });
    this.state.set(state);
  }
}
