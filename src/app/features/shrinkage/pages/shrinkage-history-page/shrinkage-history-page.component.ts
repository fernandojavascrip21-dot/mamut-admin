import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';
import { ShrinkageHistoryLineComponent } from '@shared/components/shrinkage-history-line/shrinkage-history-line.component';
import { SHRINKAGE_HISTORY_STOCK_URL, SHRINKAGE_HISTORY_TEXTS } from '../../constants/shrinkage-history-page.constants';
import type { ShrinkageHistoryItem } from '../../interfaces/shrinkage.models';
import type { ShrinkageHistoryLoad, ShrinkageHistoryPageState } from '../../models/shrinkage-history-page.models';
import { filterShrinkageHistory } from '../../rules/shrinkage-history.rules';
import { ShrinkageService } from '../../services/shrinkage.service';

// «Mermas» (HU-26, /admin/mermas): las últimas 50 mermas. Con «Yo · bodega» son todas (bodega y
// vendedores, con su titular); con un vendedor en «Viendo» son solo las suyas, sin repetir el titular.
// El id de «Viendo» es el parámetro del recurso: cambiarlo vuelve a pedir la lista.
@Component({
  imports: [RouterLink, ButtonDirective, InputText, Skeleton, ShrinkageHistoryLineComponent],
  selector: 'app-shrinkage-history-page',
  templateUrl: './shrinkage-history-page.component.html',
})
export class ShrinkageHistoryPageComponent {
  // 1) Dependencias
  private readonly shrinkageService = inject(ShrinkageService);
  private readonly viewing = inject(ViewingService);
  private readonly stockChanges = inject(StockChangesService);

  // 2) Carga. La lista se pide con el vendedor de «Viendo» (o sin él para la bodega y todos). Se usa
  // toSignal y no rxResource: un recurso cuenta como tarea pendiente mientras pide, y la pantalla no
  // queda «estable» hasta que llega la respuesta. Un cambio de «Viendo» o de stock vuelve a pedir.
  readonly texts = SHRINKAGE_HISTORY_TEXTS;
  readonly stockUrl = SHRINKAGE_HISTORY_STOCK_URL;
  readonly seller = this.viewing.selectedSeller;
  // Sube con «Reintentar» y con cada aviso de StockChangesService para repetir la misma petición.
  private readonly reloads = signal(0);
  private readonly request = computed(() => ({ sellerId: this.seller()?.id ?? null, reload: this.reloads() }));
  private readonly load = toSignal(
    toObservable(this.request).pipe(
      switchMap(({ sellerId }) =>
        this.shrinkageService.list(sellerId ?? undefined).pipe(
          map((items): ShrinkageHistoryLoad => ({ state: 'ready', items })),
          // Un fallo no se lanza: la pantalla lo pinta como error con «Reintentar».
          catchError(() => of<ShrinkageHistoryLoad>({ state: 'error', items: [] })),
          startWith<ShrinkageHistoryLoad>({ state: 'loading', items: [] }),
        ),
      ),
    ),
    { initialValue: { state: 'loading', items: [] } satisfies ShrinkageHistoryLoad },
  );
  readonly state = computed<ShrinkageHistoryPageState>(() => this.load().state);
  readonly items = computed<ShrinkageHistoryItem[]>(() => this.load().items);
  readonly hasItems = computed(() => this.items().length > 0);
  // Con un vendedor en «Viendo» el titular ya es conocido: no se repite en cada fila.
  readonly showHolder = computed(() => this.seller() === null);

  // Título: «Mermas» o «Mermas de <nombre>» con el vendedor en «Viendo».
  readonly title = computed(() => {
    const seller = this.seller();
    return seller ? `${this.texts.titlePrefix} ${seller.fullName}` : this.texts.title;
  });
  readonly emptyMessage = computed(() => {
    const seller = this.seller();
    return seller ? `${seller.fullName} ${this.texts.emptySellerSuffix}` : this.texts.empty;
  });

  // 3) Buscador. El filtro vive en rules; aquí solo se guarda lo que escribe la persona.
  readonly query = signal('');
  readonly visibleItems = computed(() => filterShrinkageHistory(this.items(), this.query()));
  // Número de resultados para el lector de pantalla (role="status" en la plantilla).
  readonly countLabel = computed(() => {
    const count = this.visibleItems().length;
    const noun = count === 1 ? this.texts.countSingular : this.texts.countPlural;
    return `${count} ${noun}`;
  });

  constructor() {
    // Dejar o retirar piezas, o registrar una merma, cambia el stock: se vuelve a pedir la lista. Se
    // ignora la versión con la que nació la página, para no pedirla dos veces al entrar.
    const initial = this.stockChanges.version();
    effect(() => {
      if (this.stockChanges.version() === initial) return;
      untracked(() => this.reloads.update((value) => value + 1));
    });
  }

  // 4) Acciones del usuario
  onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.query.set('');
  }

  retry(): void {
    this.reloads.update((value) => value + 1);
  }
}
