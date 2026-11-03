import { Injectable, inject } from '@angular/core';
import { ConfirmationService } from 'primeng/api';
import { CONFIRM_ACCEPT_SEVERITY, CONFIRM_REJECT_SEVERITY } from './confirm.constants';
import type { ConfirmOptions } from './confirm.models';

// Pide una confirmación al usuario con el <p-confirmdialog> (montado en diferido por
// ConfirmHostComponent) y devuelve una promesa. Si se pide antes de que el diálogo exista,
// espera a que avise con `markDialogReady()`; sin eso la petición se perdería.
// Resuelve true solo si acepta; cancelar, Escape y la X resuelven false (PrimeNG los reporta
// todos por el callback `reject`). El diálogo es único: si se pide otra confirmación con una
// abierta, PrimeNG reemplaza la visible sin avisar a la anterior, así que aquí se resuelve en
// false para que ninguna promesa quede colgada.
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly confirmation = inject(ConfirmationService);
  private settlePending: ((accepted: boolean) => void) | null = null;
  private markReady!: () => void;
  private readonly dialogReady = new Promise<void>((resolve) => (this.markReady = resolve));

  // Lo llama ConfirmHostComponent cuando el diálogo ya escucha las peticiones.
  markDialogReady(): void {
    this.markReady();
  }

  ask(options: ConfirmOptions): Promise<boolean> {
    this.settlePending?.(false);
    return new Promise<boolean>((resolve) => {
      const settle = (accepted: boolean): void => {
        if (this.settlePending === settle) this.settlePending = null;
        resolve(accepted);
      };
      this.settlePending = settle;
      void this.dialogReady.then(() => {
        // Si otra petición la reemplazó mientras esperaba, esta ya se resolvió en false.
        if (this.settlePending !== settle) return;
        this.showDialog(options, settle);
      });
    });
  }

  private showDialog(options: ConfirmOptions, settle: (accepted: boolean) => void): void {
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
  }
}
