import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '@core/auth/services/auth.service';
import { initialsOf } from '@shared/utils/initials';
import { SidebarService } from '../services/sidebar.service';
import { NavIconComponent } from '../nav-icon/nav-icon.component';
import { HIDE_SIDEBAR_LABEL, SHOW_SIDEBAR_LABEL, SIDEBAR_ID } from '../constants/sidebar.constants';
import { ACCOUNT_LABEL, AVATAR_BG_BY_ROLE, BRAND_NAME, ROLE_LABEL_BY_ROLE } from './top-nav.constants';
import type { CartLink, NavMenuItem } from './top-nav.models';

// Navbar superior compartido entre admin-shell y seller-shell (reemplaza la cabecera + el
// menú inferior que antes se duplicaban en cada shell). Lee el usuario actual directamente de
// AuthService para no depender de que cada página le pase iniciales/color del avatar.
@Component({
  imports: [RouterLink, RouterLinkActive, NavIconComponent],
  selector: 'app-top-nav',
  templateUrl: './top-nav.component.html',
})
export class TopNavComponent {
  private readonly auth = inject(AuthService);
  protected readonly sidebar = inject(SidebarService);

  readonly menu = input.required<NavMenuItem[]>();
  readonly cart = input.required<CartLink>();
  readonly ariaLabel = input.required<string>();

  readonly brandName = BRAND_NAME;
  readonly accountLabel = ACCOUNT_LABEL;
  readonly sidebarId = SIDEBAR_ID;
  readonly hideSidebarLabel = HIDE_SIDEBAR_LABEL;
  readonly showSidebarLabel = SHOW_SIDEBAR_LABEL;

  readonly initials = computed(() => initialsOf(this.auth.currentUser()?.fullName ?? ''));

  readonly roleLabel = computed(() =>
    this.auth.currentUser()?.role === 'admin' ? ROLE_LABEL_BY_ROLE.admin : ROLE_LABEL_BY_ROLE.vendedor,
  );

  // El color del avatar distingue admin de vendedor; se calcula del rol en vez de recibirlo
  // como input, así ninguna página tiene que conocerlo.
  readonly avatarBg = computed(() =>
    this.auth.currentUser()?.role === 'admin' ? AVATAR_BG_BY_ROLE.admin : AVATAR_BG_BY_ROLE.vendedor,
  );

  // Las dos cadenas deben quedar escritas tal cual (no construidas por interpolación) para que
  // el escaneo estático de Tailwind v4 las detecte y no las purgue del CSS final.
  readonly gridColsClass = computed(() => (this.menu().length === 4 ? 'grid-cols-4' : 'grid-cols-3'));
}
