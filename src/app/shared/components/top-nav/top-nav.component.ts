import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { initialsOf } from '../../initials';
import type { CartLink, NavMenuItem } from './top-nav.models';

// Navbar superior compartido entre admin-page y vendedor-page (reemplaza la cabecera + el
// menú inferior que antes se duplicaban en cada shell). Lee el usuario actual directamente de
// AuthService para no depender de que cada página le pase iniciales/color del avatar.
@Component({
  imports: [RouterLink, RouterLinkActive],
  selector: 'app-top-nav',
  templateUrl: './top-nav.component.html',
})
export class TopNavComponent {
  private readonly auth = inject(AuthService);

  readonly menu = input.required<NavMenuItem[]>();
  readonly cart = input.required<CartLink>();
  readonly ariaLabel = input.required<string>();

  readonly initials = computed(() => initialsOf(this.auth.currentUser()?.fullName ?? ''));

  // El color del avatar distingue admin de vendedor (antes estaba fijo por página); al vivir
  // aquí el componente lo calcula del rol en vez de recibirlo como input.
  readonly avatarBg = computed(() => (this.auth.currentUser()?.role === 'admin' ? 'bg-ink' : 'bg-accent-2'));

  // Las dos cadenas deben quedar escritas tal cual (no construidas por interpolación) para que
  // el escaneo estático de Tailwind v4 las detecte y no las purgue del CSS final.
  readonly gridColsClass = computed(() => (this.menu().length === 4 ? 'grid-cols-4' : 'grid-cols-3'));
}
