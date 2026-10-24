import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { initialsOf } from '../../shared/initials';

interface MenuItem {
  path: string;
  label: string;
}

const MENU: MenuItem[] = [
  { path: 'stock', label: 'Stock' },
  { path: 'productos', label: 'Productos' },
  { path: 'carrito', label: 'Carrito' },
  { path: 'corte', label: 'Corte' },
  { path: 'vendedores', label: 'Vendedores' },
];

// Página del administrador: cabecera + contenido de la ruta activa + menú inferior
// Stock · Productos · Carrito · Corte · Vendedores (RF-01, mockup pantalla 02 y siguientes).
@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  selector: 'app-admin-page',
  templateUrl: './admin-page.component.html',
})
export class AdminPageComponent {
  private readonly auth = inject(AuthService);

  readonly menu = MENU;
  readonly initials = computed(() => initialsOf(this.auth.currentUser()?.fullName ?? ''));
}
