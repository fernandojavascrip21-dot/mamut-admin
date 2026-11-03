import { Component, afterNextRender, inject } from '@angular/core';
import { Toast } from 'primeng/toast';
import { TOAST_BREAKPOINTS } from '../constants/toast.constants';
import { ToastService } from '../toast.service';

// Monta el <p-toast> único de la app. `App` lo carga con @defer para que PrimeNG Toast no entre
// al bundle inicial. Al terminar su primer render avisa al servicio: el toast ya escucha a
// MessageService, que no repite lo emitido antes, así que el servicio entrega entonces el aviso
// que haya quedado en espera.
@Component({
  imports: [Toast],
  selector: 'app-toast-host',
  templateUrl: './toast-host.component.html',
})
export class ToastHostComponent {
  private readonly toast = inject(ToastService);
  protected readonly toastBreakpoints = TOAST_BREAKPOINTS;

  constructor() {
    afterNextRender(() => this.toast.markToastReady());
  }
}
