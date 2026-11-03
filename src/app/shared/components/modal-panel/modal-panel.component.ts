import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Dialog } from 'primeng/dialog';
import {
  FOCUSABLE_SELECTOR,
  MODAL_PANEL_MOTION_OPTIONS,
  MODAL_PANEL_STYLE_CLASS,
} from './modal-panel.constants';

// Marco de los pop-ups de «Dejar» y «Retirar» (spec T-16 y M3-t04): un `p-dialog` modal con el
// título y el contenido proyectado. Quien lo usa lo muestra y recibe `closed` para quitarlo. Al
// abrir, el foco entra en el diálogo; Tab queda atrapado dentro, Escape y la X cierran y, al
// cerrar, el foco regresa a donde estaba. Un clic en el fondo no cierra, para no perder lo escrito.
@Component({
  imports: [Dialog],
  selector: 'app-modal-panel',
  templateUrl: './modal-panel.component.html',
  host: { '(document:keydown)': 'onOutsideKeydown($event)' },
})
export class ModalPanelComponent {
  readonly title = input.required<string>();
  // false mientras la página guarda: no hay X y Escape no cierra.
  readonly closable = input(true);
  readonly closed = output<void>();

  readonly visible = signal(true);
  readonly motionOptions = MODAL_PANEL_MOTION_OPTIONS;
  readonly styleClass = MODAL_PANEL_STYLE_CLASS;

  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Guardar el elemento no requiere APIs globales del navegador: también se construye en SSR.
    const returnFocusTo = this.document.activeElement as HTMLElement | null;
    inject(DestroyRef).onDestroy(() => {
      if (returnFocusTo?.isConnected && typeof returnFocusTo.focus === 'function') {
        returnFocusTo.focus({ preventScroll: true });
      }
    });
  }

  // El diálogo pide ocultarse solo al pulsar la X o Escape; la página lo quita al recibir `closed`.
  onVisibleChange(visible: boolean): void {
    this.visible.set(visible);
    if (!visible) this.closed.emit();
  }

  // Elegir un producto quita el botón del buscador y puede dejar el foco en body. El siguiente
  // Tab vuelve al diálogo, sin alcanzar los controles de la página que está detrás.
  onOutsideKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const dialog = this.document.querySelector<HTMLElement>(`.${MODAL_PANEL_STYLE_CLASS}`);
    if (!dialog || dialog.contains(event.target as Node | null)) return;
    // El selector abierto de un p-select vive en body: Tab dentro de su lista no se redirige.
    if ((event.target as HTMLElement | null)?.closest?.('.p-select-overlay')) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (item) => !item.hidden && !item.closest('[hidden], [inert]') && item.tabIndex >= 0,
    );
    const target = event.shiftKey ? items[items.length - 1] : items[0];
    if (!target) return;
    event.preventDefault();
    target.focus();
  }
}
