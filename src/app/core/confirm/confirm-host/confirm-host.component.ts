import { Component, afterNextRender, inject } from '@angular/core';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { CONFIRM_DIALOG_BREAKPOINTS, CONFIRM_DIALOG_STYLE } from '../confirm.constants';
import { ConfirmService } from '../confirm.service';

// Monta el <p-confirmdialog> único de la app. `App` lo carga con @defer para que PrimeNG
// ConfirmDialog no entre al bundle inicial. Al terminar su primer render avisa al servicio:
// el diálogo ya escucha las peticiones, así que `ask()` puede pedir la confirmación sin que se
// pierda (ConfirmationService no repite lo emitido antes de que alguien escuche).
@Component({
  imports: [ConfirmDialog],
  selector: 'app-confirm-host',
  templateUrl: './confirm-host.component.html',
})
export class ConfirmHostComponent {
  private readonly confirm = inject(ConfirmService);
  protected readonly confirmStyle = CONFIRM_DIALOG_STYLE;
  protected readonly confirmBreakpoints = CONFIRM_DIALOG_BREAKPOINTS;

  constructor() {
    afterNextRender(() => this.confirm.markDialogReady());
  }
}
