import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { CONFIRM_ACCEPT_SEVERITY, CONFIRM_REJECT_SEVERITY } from './confirm.constants';
import type { ConfirmOptions } from './confirm.models';

// Pide una confirmación al usuario con el <p-confirmdialog> de app.html y devuelve una promesa.
// Resuelve true solo si acepta; cancelar, Escape y la X resuelven false (PrimeNG los reporta
// todos por el callback `reject`). El diálogo es único: si se pide otra confirmación con una
// abierta, PrimeNG reemplaza la visible sin avisar a la anterior, así que aquí se resuelve en
// false para que ninguna promesa quede colgada.
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly confirmation = inject(ConfirmationService);
  private settlePending: ((accepted: boolean) => void) | null = null;

  ask(options: ConfirmOptions): Promise<boolean> {
    this.settlePending?.(false);
    return new Promise<boolean>((resolve) => {
      const settle = (accepted: boolean): void => {
        if (this.settlePending === settle) this.settlePending = null;
        resolve(accepted);
      };
      this.settlePending = settle;
      this.confirmation.confirm({
        header: options.title,
        message: options.message,
        acceptLabel: options.confirmLabel,
        rejectLabel: options.cancelLabel,
        acceptButtonProps: { severity: CONFIRM_ACCEPT_SEVERITY[options.tone] },
        rejectButtonProps: { severity: CONFIRM_REJECT_SEVERITY },
        // El foco inicial va en la acción segura (cancelar). El fondo no cierra el diálogo.
        defaultFocus: 'reject',
        dismissableMask: false,
        accept: () => settle(true),
        reject: () => settle(false),
      });
    });
  }
}
