import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, viewChild } from '@angular/core';

// Diálogo de confirmación modal compartido («Cerrar sesión», «¿Descartar los cambios?»). Quien
// lo usa lo muestra con un @if y lo quita al recibir confirmed/cancelled. Al aparecer, el foco
// entra en «cancelar» (la acción segura); Tab queda atrapado entre los dos botones, Escape
// cancela, y al desaparecer el foco regresa a donde estaba antes de abrirlo.
@Component({
  imports: [],
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly confirmLabel = input.required<string>();
  readonly cancelLabel = input.required<string>();
  readonly tone = input<'danger' | 'default'>('default');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly confirmButton = viewChild.required<ElementRef<HTMLButtonElement>>('confirmButton');

  constructor() {
    const document = inject(DOCUMENT);
    const active = document.activeElement;
    const returnFocusTo = active instanceof HTMLElement ? active : null;
    afterNextRender(() => this.cancelButton().nativeElement.focus());
    inject(DestroyRef).onDestroy(() => returnFocusTo?.focus());
  }

  // Mantiene Tab dentro de las dos acciones y permite cerrar con Escape.
  onKeydown(event: KeyboardEvent): void {
    const first = this.cancelButton().nativeElement;
    const last = this.confirmButton().nativeElement;
    const active = (event.target as Node).ownerDocument?.activeElement;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancelled.emit();
    } else if (event.key === 'Tab') {
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
}
