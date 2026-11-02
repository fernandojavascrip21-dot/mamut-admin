import { ButtonDirective } from 'primeng/button';
import { Component, DestroyRef, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/services/auth.service';
import { initialsOf } from '@shared/utils/initials';
import { ROLE_HOME } from '@core/auth/constants/auth.constants';
import { ConfirmService } from '@core/confirm/confirm.service';
import { LOGOUT_CONFIRMATION } from '../../constants/account-page.constants';

// Pantalla 14/14b Mi cuenta (RF-01), compartida por administrador y vendedor. "Usuario" y
// "Último acceso" del mockup se omiten en M0: AuthContext no trae ni correo ni fecha de
// acceso (ver specs/M0-base/spec.md §8, pregunta 3).
@Component({
  imports: [ButtonDirective],
  selector: 'app-account-page',
  templateUrl: './account-page.component.html',
})
export class AccountPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = this.auth.currentUser;
  readonly initials = computed(() => initialsOf(this.user()?.fullName ?? ''));
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly passwordNote = computed(() =>
    this.isAdmin()
      ? 'Tú das de alta a los vendedores y les asignas su usuario y contraseña.'
      : 'Si olvidaste tu contraseña, pídela al administrador.',
  );

  // "Volver" regresa a la home del propio rol (el mismo mapa que usa el guard), no a un
  // historial de navegación: coincide con cómo llegó aquí desde cualquier shell.
  goBack(): void {
    const role = this.user()?.role;
    this.router.navigateByUrl((role && ROLE_HOME[role]) || '/login');
  }

  // Pide confirmar antes de cerrar la sesión; cancelar (o Escape) no toca nada.
  askLogout(): void {
    void this.confirm.ask(LOGOUT_CONFIRMATION).then((accepted) => {
      if (accepted) this.confirmLogout();
    });
  }

  // Confirma el cierre de sesión. AuthService.logout() ya limpia la sesión local aunque el
  // backend falle, así que aquí solo queda ir a /login.
  confirmLogout(): void {
    this.auth.logout().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.router.navigateByUrl('/login');
    });
  }
}
