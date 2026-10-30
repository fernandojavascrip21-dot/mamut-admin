import { Component, input } from '@angular/core';
import type { NavIcon } from '../top-nav/top-nav.models';

// Ícono de línea del navbar (menú y carrito). Vive aparte para que la plantilla del top-nav
// solo componga enlaces; hereda el color con currentColor.
@Component({
  selector: 'app-nav-icon',
  templateUrl: './nav-icon.component.html',
})
export class NavIconComponent {
  readonly name = input.required<NavIcon>();
}
