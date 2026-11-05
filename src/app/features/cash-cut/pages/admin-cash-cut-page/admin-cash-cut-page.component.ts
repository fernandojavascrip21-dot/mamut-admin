import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { ViewingService } from '@core/viewing/viewing.service';
import { httpErrorMessage, isOffline } from '@shared/utils/http-errors';
import { CutPeriodPickerComponent } from '../../components/cut-period-picker/cut-period-picker.component';
import { CutProductLineComponent } from '../../components/cut-product-line/cut-product-line.component';
import { CutSaleItemComponent } from '../../components/cut-sale-item/cut-sale-item.component';
import { CutSummaryComponent } from '../../components/cut-summary/cut-summary.component';
import {
  ADMIN_CASH_CUT_PAGE_TEXTS,
  CUT_TYPE_OPTIONS,
  DEFAULT_CUT_TYPE,
} from '../../constants/admin-cash-cut-page.constants';
import type { CashCut, CashCutQuery, CutPeriodKind } from '../../interfaces/cash-cut.models';
import type { CashCutPageState, CutSelection } from '../../models/admin-cash-cut-page.models';
import {
  periodLabel,
  periodRange,
  shiftPeriod,
  todayInMexico,
} from '../../rules/cash-cut-period.rules';
import { clockTime } from '../../rules/cut-sale-time.rules';
import { CashCutService } from '../../services/cash-cut.service';

// «Corte» del administrador (/admin/corte, HU-19): corte con los precios del titular de «Viendo» (un
// vendedor o «Yo · bodega») para un día, semana o mes. Nada se calcula hasta tocar «Generar corte», y
// cualquier cambio de periodo o de titular quita el resultado para no mostrar el corte de otra selección.
// Las cifras vienen tal cual del backend (T-20): aquí no se suma ni se resta dinero.
@Component({
  imports: [
    FormsModule,
    ButtonDirective,
    Select,
    Skeleton,
    CutPeriodPickerComponent,
    CutSummaryComponent,
    CutProductLineComponent,
    CutSaleItemComponent,
  ],
  selector: 'app-admin-cash-cut-page',
  templateUrl: './admin-cash-cut-page.component.html',
})
export class AdminCashCutPageComponent {
  // 1) Dependencias
  private readonly service = inject(CashCutService);
  private readonly viewing = inject(ViewingService);

  readonly texts = ADMIN_CASH_CUT_PAGE_TEXTS;
  readonly cutTypeOptions = CUT_TYPE_OPTIONS;
  readonly cutType = DEFAULT_CUT_TYPE;

  // 2) Selección. «Hoy» se fija al entrar y es el de México, no el del dispositivo.
  private readonly today = todayInMexico(new Date());
  readonly selection = signal<CutSelection>({ kind: 'day', offset: 0 });
  // Titular: primer nombre del vendedor en «Viendo», o null con «Yo · bodega».
  readonly holderName = computed(
    () => this.viewing.selectedSeller()?.fullName.split(' ')[0] ?? null,
  );
  // Mientras «Viendo» carga, el vendedor guardado aún no se conoce: generar ahora cortaría la bodega.
  readonly viewingLoading = computed(() => this.viewing.listStatus() === 'loading');

  private readonly query = computed<CashCutQuery>(() => {
    const { kind, offset } = this.selection();
    return {
      holderId: this.viewing.selectedSellerId(),
      period: kind,
      date: shiftPeriod(kind, this.today, offset),
    };
  });
  // Texto del periodo elegido, antes de generar.
  readonly selectionLabel = computed(() => {
    const { period, date } = this.query();
    const { from, to } = periodRange(period, date);
    return periodLabel(period, from, to, this.today);
  });
  readonly ownerLabel = computed(() => this.holderName() ?? this.texts.warehouseOwner);

  // 3) Corte. `generated` es la petición que el usuario pidió; `request` solo vale mientras siga
  // siendo la selección actual, así nunca se ve (ni se pide) un corte de otra selección. Al cambiar
  // `request`, rxResource cancela la petición anterior y descarta su respuesta tardía.
  private readonly generated = signal<CashCutQuery | undefined>(undefined);
  private readonly request = computed(() => {
    const generated = this.generated();
    const current = this.query();
    const same =
      generated !== undefined &&
      generated.holderId === current.holderId &&
      generated.period === current.period &&
      generated.date === current.date;
    return same ? generated : undefined;
  });
  readonly generatedAt = signal<Date | null>(null);
  readonly cutResource = rxResource({
    params: () => this.request(),
    stream: ({ params }) => this.service.get(params),
  });
  readonly cut = computed<CashCut | null>(() =>
    this.cutResource.hasValue() ? this.cutResource.value() : null,
  );

  readonly state = computed<CashCutPageState>(() => {
    if (this.request() === undefined) return 'idle';
    if (this.cutResource.status() === 'error') return 'error';
    const cut = this.cut();
    if (cut === null) return 'loading';
    return cut.totals.salesCount === 0 ? 'empty' : 'ready';
  });

  // 4) Textos del resultado. Con el corte generado manda el periodo del backend, no el calculado aquí.
  readonly resultPeriodLabel = computed(() => {
    const cut = this.cut();
    if (cut === null) return this.selectionLabel();
    return periodLabel(cut.period.kind, cut.period.from, cut.period.to, this.today);
  });
  readonly showSaleDate = computed(() => (this.cut()?.period.kind ?? 'day') !== 'day');
  readonly resultTitle = computed(() =>
    this.holderName() ? `${this.texts.resultTitle} · ${this.holderName()}` : this.texts.resultTitle,
  );
  readonly productsTitle = computed(() =>
    this.holderName()
      ? `${this.texts.productsOfSeller} ${this.holderName()}`
      : this.texts.productsOfWarehouse,
  );
  readonly generatedAtLabel = computed(() => {
    const at = this.generatedAt();
    return at === null ? '' : `${this.texts.generatedAt} ${clockTime(at)}`;
  });
  readonly errorMessage = computed(() => {
    const error = this.cutResource.error();
    if (isOffline(error)) return this.texts.errorHint;
    return httpErrorMessage(error) ?? this.texts.errorHint;
  });

  constructor() {
    // Cambiar el titular en la barra «Viendo» quita el resultado. El cambio de periodo lo quita
    // `selectKind()`/`selectOffset()`; `request` ya impide mostrar un corte de otra selección.
    effect(() => {
      this.viewing.selectedSellerId();
      untracked(() => this.generated.set(undefined));
    });
  }

  // 5) Acciones
  selectKind(kind: CutPeriodKind): void {
    this.selection.set({ kind, offset: 0 });
    this.generated.set(undefined);
  }

  selectOffset(offset: number): void {
    this.selection.update((current) => ({ ...current, offset }));
    this.generated.set(undefined);
  }

  generate(): void {
    if (this.viewingLoading()) return;
    this.generatedAt.set(new Date());
    this.generated.set(this.query());
  }

  // «Generar de nuevo» y «Reintentar» piden el mismo corte otra vez, con las ventas de ahora.
  reload(): void {
    this.generatedAt.set(new Date());
    this.cutResource.reload();
  }
}
