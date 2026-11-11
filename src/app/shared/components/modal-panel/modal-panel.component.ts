import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { ButtonDirective } from 'primeng/button';
import {
  FOCUSABLE_SELECTOR,
  MODAL_PANEL_CLOSE_LABEL,
  MODAL_PANEL_MOTION_OPTIONS,
  MODAL_PANEL_STYLE_CLASS,
  MODAL_PANEL_WIDE_CLASS,
} from './modal-panel.constants';

// Marco de los pop-ups (spec T-16, M3-t04 y HU-31): un `p-dialog` modal con el título y el contenido
// proyectado. El diálogo no se oculta solo: la X y Escape solo emiten `closed`, y quien lo usa decide
// si lo quita (por ejemplo, tras una navegación confirmada). Así un guard que cancela («Seguir
// editando») deja el pop-up visible. Al abrir, el foco entra en el diálogo; Tab queda atrapado dentro
// y, al cerrarse, el foco regresa a donde estaba. Un clic en el fondo no cierra, para no perder lo escrito.
@Component({
  imports: [Dialog, ButtonDirective],
  selector: 'app-modal-panel',
  templateUrl: './modal-panel.component.html',
  host: { '(document:keydown)': 'onOutsideKeydown($event)' },
})
export class ModalPanelComponent {
  readonly title = input.required<string>();
  // false mientras la página guarda: no hay X y Escape no cierra.
  readonly closable = input(true);
  // true para pop-ups de tabla (ancho ~1100 px y alto casi completo); por omisión, el ancho normal.
  readonly wide = input(false);
  readonly closed = output<void>();

  readonly motionOptions = MODAL_PANEL_MOTION_OPTIONS;
  readonly closeLabel = MODAL_PANEL_CLOSE_LABEL;
  readonly dialogClass = computed(() =>
    this.wide() ? `${MODAL_PANEL_STYLE_CLASS} ${MODAL_PANEL_WIDE_CLASS}` : MODAL_PANEL_STYLE_CLASS,
  );

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

  // Pedir el cierre: la X y Escape solo avisan; el diálogo sigue visible hasta que la página lo quite.
  requestClose(): void {
    if (this.closable()) this.closed.emit();
  }

  // Elegir un producto quita el botón del buscador y puede dejar el foco en body. El siguiente
  // Tab vuelve al diálogo, sin alcanzar los controles de la página que está detrás. Escape cierra el
  // pop-up salvo que lo esté usando un selector abierto, que lo cierra primero.
  onOutsideKeydown(event: KeyboardEvent): void {
    const dialog = this.document.querySelector<HTMLElement>(`.${MODAL_PANEL_STYLE_CLASS}`);
    if (event.key === 'Escape') {
      // Igual que PrimeNG: Escape llega al documento aunque el foco esté fuera del diálogo.
      if ((event.target as HTMLElement | null)?.closest?.('.p-select')) return;
      event.preventDefault();
      this.requestClose();
      return;
    }
    if (event.key !== 'Tab') return;
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
