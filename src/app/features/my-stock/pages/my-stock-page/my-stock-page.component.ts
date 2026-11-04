import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { MyStockCardSkeletonComponent } from '../../components/my-stock-card-skeleton/my-stock-card-skeleton.component';
import { MyStockCardComponent } from '../../components/my-stock-card/my-stock-card.component';
import { MY_STOCK_PAGE_TEXTS } from '../../constants/my-stock-page.constants';
import type { MyStock } from '../../interfaces/my-stock.models';
import type { MyStockPageState } from '../../models/my-stock-page.models';
import { filterMyStockByName } from '../../rules/my-stock.rules';
import { MyStockService } from '../../services/my-stock.service';

// «Mi stock» (/vendedor/mi-stock, HU-14): lo que el vendedor tiene en mano, con su precio y sin
// costos. Pide el stock cada vez que se entra (la página nace de nuevo al volver), así que tras un
// «Dejar», un «Retirar» o una venta los números ya son los nuevos; no se actualiza en vivo.
@Component({
  imports: [ButtonDirective, InputText, MyStockCardComponent, MyStockCardSkeletonComponent],
  selector: 'app-my-stock-page',
  templateUrl: './my-stock-page.component.html',
})
export class MyStockPageComponent {
  // 1) Dependencias
  private readonly myStockService = inject(MyStockService);

  // 2) Datos y estados. Volver a pedir con datos en pantalla no cuenta como cargando.
  readonly stockResource = rxResource({ stream: () => this.myStockService.load() });
  readonly state = computed<MyStockPageState>(() => {
    if (this.stockResource.status() === 'error') return 'error';
    return this.stockResource.hasValue() ? 'ready' : 'loading';
  });
  readonly stock = computed<MyStock | null>(() =>
    this.stockResource.hasValue() ? this.stockResource.value() : null,
  );
  readonly isEmpty = computed(() => (this.stock()?.products.length ?? 0) === 0);

  readonly searchQuery = signal('');
  readonly texts = MY_STOCK_PAGE_TEXTS;

  // 3) Lista. El total sale de la respuesta, así que filtrar la lista no lo cambia.
  readonly totalUnits = computed(() => this.stock()?.total ?? 0);
  readonly visibleProducts = computed(() =>
    filterMyStockByName(this.stock()?.products ?? [], this.searchQuery()),
  );

  // 4) Acciones del usuario
  retry(): void {
    this.stockResource.reload();
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }
}
