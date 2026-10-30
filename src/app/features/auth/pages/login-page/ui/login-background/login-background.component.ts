import { Component } from '@angular/core';
import { STOCK_BARS } from './login-background.constants';
import type { StockBar } from './login-background.models';

// Fondo animado del panel oscuro del login: columnas de stock en ámbar y café que crecen al
// entrar y luego suben y bajan despacio, con resplandor, haz de luz y grano. Solo CSS (sin JS ni
// timers), así que no afecta el render de servidor; con «reducir movimiento» todo queda quieto.
@Component({
  selector: 'app-login-background',
  templateUrl: './login-background.component.html',
})
export class LoginBackgroundComponent {
  readonly bars: readonly StockBar[] = STOCK_BARS;
}
