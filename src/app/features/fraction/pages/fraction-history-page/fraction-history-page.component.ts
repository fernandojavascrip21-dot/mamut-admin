import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';
import { FractionHistoryLineComponent } from '../../components/fraction-history-line/fraction-history-line.component';
import { FRACTION_HISTORY_TEXTS, STOCK_URL } from '../../constants/fraction-history-page.constants';
import type { FractionHistoryPageState } from '../../models/fraction-history-page.models';
import type { FractionHistoryItem } from '../../interfaces/fraction.models';
import { filterFractionHistory } from '../../rules/fraction-history.rules';
import { FractionService } from '../../services/fraction.service';

// «Fraccionados» (HU-24, /admin/fraccionados): los 50 fraccionados más recientes de la bodega, con un
// buscador por nombre. La página no depende de «Viendo»: el historial es siempre de la bodega.
@Component({
  imports: [RouterLink, ButtonDirective, InputText, Skeleton, FractionHistoryLineComponent],
  selector: 'app-fraction-history-page',
  templateUrl: './fraction-history-page.component.html',
})
export class FractionHistoryPageComponent {
  // 1) Dependencias
  private readonly fractionService = inject(FractionService);

  // 2) Carga. El recurso pide la lista al entrar; «Reintentar» vuelve a pedirla con reload().
  readonly texts = FRACTION_HISTORY_TEXTS;
  readonly stockUrl = STOCK_URL;
  readonly historyResource = rxResource({ stream: () => this.fractionService.getHistory() });
  readonly state = computed<FractionHistoryPageState>(() => {
    if (this.historyResource.status() === 'error') return 'error';
    return this.historyResource.hasValue() ? 'ready' : 'loading';
  });
  readonly items = computed<FractionHistoryItem[]>(() => this.historyResource.value() ?? []);
  readonly hasItems = computed(() => this.items().length > 0);

  // 3) Buscador. El filtro vive en rules; aquí solo se guarda lo que escribe la persona.
  readonly query = signal('');
  readonly visibleItems = computed(() => filterFractionHistory(this.items(), this.query()));
  // Número de resultados para el lector de pantalla (aria-live en la plantilla).
  readonly countLabel = computed(() => {
    const count = this.visibleItems().length;
    const noun = count === 1 ? this.texts.countSingular : this.texts.countPlural;
    return `${count} ${noun}`;
  });

  // 4) Acciones del usuario
  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.query.set('');
  }

  retry(): void {
    this.historyResource.reload();
  }
}
