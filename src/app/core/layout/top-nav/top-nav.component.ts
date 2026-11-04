import { Component, computed, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Menu } from 'primeng/menu';
import type { MenuPassThrough } from 'primeng/types/menu';
import { AuthService } from '@core/auth/services/auth.service';
import { CartService } from '@core/cart/cart.service';
import { initialsOf } from '@shared/utils/initials';
import { unitsLabel } from '@shared/utils/units-label';
import { SidebarService } from '../services/sidebar.service';
import { NavIconComponent } from '../nav-icon/nav-icon.component';
import { HIDE_SIDEBAR_LABEL, SHOW_SIDEBAR_LABEL, SIDEBAR_ID } from '../constants/sidebar.constants';
import {
  ACCOUNT_LABEL,
  AVATAR_BG_BY_ROLE,
  BRAND_NAME,
  CART_BADGE_MAX,
  MENU_GRID_CLASS_BY_COLUMNS,
  MENU_ITEM_CLASS,
  MENU_LIST_BASE_CLASS,
  MENU_ROOT_CLASS,
  ROLE_LABEL_BY_ROLE,
} from './top-nav.constants';
import type { CartLink, NavMenuItem } from './top-nav.models';
import { toNavMenuEntries } from './top-nav.utils';

// Navbar superior compartido entre admin-shell y seller-shell (reemplaza la cabecera + el
// menú inferior que antes se duplicaban en cada shell). Lee el usuario actual directamente de
// AuthService para no depender de que cada página le pase iniciales/color del avatar.
@Component({
  imports: [RouterLink, RouterLinkActive, NavIconComponent, ButtonDirective, Menu],
  selector: 'app-top-nav',
  templateUrl: './top-nav.component.html',
})
export class TopNavComponent {
  private readonly auth = inject(AuthService);
  private readonly cartState = inject(CartService);
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

  // Piezas en el carrito (HU-15). Con 0 el botón se ve como siempre; con piezas muestra un globo con el
  // número y su nombre accesible lo dice completo («Carrito, 3 piezas»), así que el globo va oculto
  // a lectores de pantalla. En el administrador el carrito está vacío hasta HU-17.
  readonly cartUnits = computed(() => this.cartState.totalUnits());
  readonly cartBadge = computed(() => {
    const units = this.cartUnits();
    return units > CART_BADGE_MAX ? `${CART_BADGE_MAX}+` : String(units);
  });
  readonly cartAriaLabel = computed(() => {
    const units = this.cartUnits();
    return units > 0 ? `${this.cart().label}, ${unitsLabel(units)}` : this.cart().label;
  });

  readonly menuEntries = computed(() => toNavMenuEntries(this.menu()));

  // Celdas en celular (3 o 4 columnas según cuántas opciones haya) y lista vertical en escritorio.
  // Las clases salen de constantes con el texto completo para que Tailwind v4 las detecte.
  readonly menuPassThrough = computed<MenuPassThrough>(() => ({
    root: { class: MENU_ROOT_CLASS },
    list: {
      class: `${MENU_LIST_BASE_CLASS} ${
        this.menu().length === 4 ? MENU_GRID_CLASS_BY_COLUMNS[4] : MENU_GRID_CLASS_BY_COLUMNS[3]
      }`,
    },
    item: { class: MENU_ITEM_CLASS },
  }));
}
