import { ButtonDirective } from 'primeng/button';
import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FOCUSABLE_SELECTOR } from './modal-panel.constants';

// Marco de los pop-ups de «Dejar» y «Retirar» (spec T-16): título, botón de cerrar y el contenido
// proyectado, sobre un fondo que tapa la página. Quien lo usa lo muestra y recibe `closed` para
// quitarlo. Al abrir, el foco entra en el pop-up; Tab queda atrapado dentro, Escape cierra y, al
// cerrar, el foco regresa a donde estaba. Un clic en el fondo no cierra, para no perder lo escrito.
// A pantalla completa en celular y centrado desde `sm`; el contenido hace scroll dentro.
@Component({
  imports: [ButtonDirective],
  selector: 'app-modal-panel',
  templateUrl: './modal-panel.component.html',
  host: { '(document:keydown)': 'onOutsideKeydown($event)' },
})
export class ModalPanelComponent {
  readonly title = input.required<string>();
  // false mientras la página guarda: no hay X y Escape no cierra.
  readonly closable = input(true);
  readonly closed = output<void>();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');

  constructor() {
    const document = inject(DOCUMENT);
    // Guardar el elemento no requiere APIs globales del navegador: también se construye en SSR.
    const returnFocusTo = document.activeElement as HTMLElement | null;
    let unlockScroll = false;
    afterNextRender(() => {
      unlockScroll = !document.body.classList.contains('overflow-hidden');
      document.body.classList.add('overflow-hidden');
      this.panel().nativeElement.focus({ preventScroll: true });
    });
    inject(DestroyRef).onDestroy(() => {
      if (unlockScroll) document.body.classList.remove('overflow-hidden');
      if (returnFocusTo?.isConnected && typeof returnFocusTo.focus === 'function') {
        returnFocusTo.focus({ preventScroll: true });
      }
    });
  }

  // Elegir un producto quita el botón del buscador y puede dejar el foco en body. El siguiente
  // Tab vuelve al diálogo, sin alcanzar los controles de la página que está detrás.
  onOutsideKeydown(event: KeyboardEvent): void {
    if (!this.panel().nativeElement.contains(event.target as Node | null)) this.onKeydown(event);
  }

  // Escape cierra (si se puede) y Tab no sale del pop-up: del último pasa al primero y al revés.
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (!this.closable()) return;
      event.preventDefault();
      this.closed.emit();
      return;
    }
    if (event.key !== 'Tab') return;
    const panel = this.panel().nativeElement;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (item) => !item.hidden && !item.closest('[hidden], [inert]') && item.tabIndex >= 0,
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = panel.ownerDocument.activeElement;
    if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (active === last || active === panel || !panel.contains(active))
    ) {
      event.preventDefault();
      first.focus();
    }
  }
}
