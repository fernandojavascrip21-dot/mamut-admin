import { Component } from '@angular/core';
import { STOCK_BARS } from './login-background.constants';
import type { StockBar } from './login-background.models';

// Fondo animado del login: columnas segmentadas que suben y bajan despacio como niveles de
// stock, con los colores de la barra de reparto bodega/vendedores. Solo CSS (sin JS ni timers),
// así que no afecta el render de servidor; con «reducir movimiento» las columnas quedan quietas.
@Component({
  selector: 'app-login-background',
  templateUrl: './login-background.component.html',
})
export class LoginBackgroundComponent {
  readonly bars: readonly StockBar[] = STOCK_BARS;
}
