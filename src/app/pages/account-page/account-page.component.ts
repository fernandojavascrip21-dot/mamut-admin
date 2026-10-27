import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { initialsOf } from '../../shared/initials';
import { ROLE_HOME } from '../../auth/guards/role.guard';

// Pantalla 14/14b Mi cuenta (RF-01), compartida por administrador y vendedor. "Usuario" y
// "Último acceso" del mockup se omiten en M0: AuthContext no trae ni correo ni fecha de
// acceso (ver specs/M0-base/spec.md §8, pregunta 3).
@Component({
  imports: [],
  selector: 'app-account-page',
  templateUrl: './account-page.component.html',
})
export class AccountPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.currentUser;
  readonly initials = computed(() => initialsOf(this.user()?.fullName ?? ''));
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly passwordNote = computed(() =>
    this.isAdmin()
      ? 'Tú das de alta a los vendedores y les asignas su usuario y contraseña.'
      : 'Si olvidaste tu contraseña, pídela al administrador.',
  );

  readonly confirmingLogout = signal(false);
  private returnFocusTo: HTMLElement | null = null;
  private readonly cancelLogoutButton = viewChild<ElementRef<HTMLButtonElement>>('cancelLogoutButton');
  private readonly confirmLogoutButton =
    viewChild<ElementRef<HTMLButtonElement>>('confirmLogoutButton');

  // La consulta aparece al renderizar el diálogo: el foco entra entonces en su primera acción.
  constructor() {
    afterRenderEffect(() => {
      const button = this.cancelLogoutButton();
      if (button && this.confirmingLogout()) button.nativeElement.focus();
    });
  }

  // "Volver" regresa a la home del propio rol (el mismo mapa que usa el guard), no a un
  // historial de navegación: coincide con cómo llegó aquí desde cualquier shell.
  goBack(): void {
    const role = this.user()?.role;
    this.router.navigateByUrl((role && ROLE_HOME[role]) || '/login');
  }

  askLogout(): void {
    this.returnFocusTo =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.confirmingLogout.set(true);
  }

  cancelLogout(): void {
    this.confirmingLogout.set(false);
    this.returnFocusTo?.focus();
  }

  // Mantiene Tab dentro de las dos acciones y permite cerrar con Escape.
  onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelLogout();
    } else if (event.key === 'Tab' && this.confirmLogoutButton()) {
      const confirmButton = this.confirmLogoutButton()!.nativeElement;
      const first = (event.currentTarget as HTMLElement).querySelector<HTMLButtonElement>('button');
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        confirmButton.focus();
      } else if (!event.shiftKey && document.activeElement === confirmButton) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  // Confirma el cierre de sesión. Si la petición al backend falla (p. ej. sin red), limpia la
  // sesión local igual: quedarse adentro con un token que ya no se pudo invalidar es peor que
  // forzar la salida.
  confirmLogout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login'),
      error: () => {
        this.auth.clearSession();
        this.router.navigateByUrl('/login');
      },
    });
  }
}
