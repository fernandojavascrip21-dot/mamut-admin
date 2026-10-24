import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { initialsOf } from '../core/initials';

interface MenuItem {
  path: string;
  label: string;
}

const MENU: MenuItem[] = [
  { path: 'mi-stock', label: 'Mi stock' },
  { path: 'vender', label: 'Vender' },
  { path: 'carrito', label: 'Carrito' },
  { path: 'mi-corte', label: 'Mi corte' },
];

// Shell del vendedor: cabecera + contenido de la ruta activa + menú inferior
// Mi stock · Vender · Carrito · Mi corte. Nunca muestra costos ni ganancia (RF-02, RNF-04).
@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-vendedor-shell',
  templateUrl: './vendedor-shell.component.html',
})
export class VendedorShellComponent {
  private readonly auth = inject(AuthService);

  readonly menu = MENU;
  readonly initials = computed(() => initialsOf(this.auth.currentUser()?.fullName ?? ''));
}
