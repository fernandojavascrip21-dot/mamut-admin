import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { httpErrorMessage, isOffline } from '@shared/utils/http-errors';
import { CutPeriodPickerComponent } from '../../components/cut-period-picker/cut-period-picker.component';
import { CutProductLineComponent } from '../../components/cut-product-line/cut-product-line.component';
import { CutSaleItemComponent } from '../../components/cut-sale-item/cut-sale-item.component';
import { CutSummaryComponent } from '../../components/cut-summary/cut-summary.component';
import { CUT_CARD_PASS_THROUGH } from '../../constants/cash-cut.constants';
import { SELLER_CASH_CUT_PAGE_TEXTS } from '../../constants/seller-cash-cut-page.constants';
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

// «Mi corte» del vendedor (/vendedor/mi-corte, HU-20): su corte de un día, semana o mes, con la
// ganancia calculada con el precio y el costo con envío que le puso el administrador (guardados en
// cada venta). Nada se calcula hasta tocar «Generar corte»; cambiar el periodo quita el resultado.
// No manda `holderId`: el backend usa al propio vendedor. Las cifras vienen del backend (T-20):
// aquí no se suma ni se resta dinero.
@Component({
  imports: [
    ButtonDirective,
    Card,
    Skeleton,
    CutPeriodPickerComponent,
    CutSummaryComponent,
    CutProductLineComponent,
    CutSaleItemComponent,
  ],
  selector: 'app-seller-cash-cut-page',
  templateUrl: './seller-cash-cut-page.component.html',
})
export class SellerCashCutPageComponent {
  // 1) Dependencias
  private readonly service = inject(CashCutService);

  readonly texts = SELLER_CASH_CUT_PAGE_TEXTS;
  readonly cardPassThrough = CUT_CARD_PASS_THROUGH;

  // 2) Selección. «Hoy» se fija al entrar y es el de México, no el del dispositivo.
  private readonly today = todayInMexico(new Date());
  readonly selection = signal<CutSelection>({ kind: 'day', offset: 0 });

  private readonly query = computed<CashCutQuery>(() => {
    const { kind, offset } = this.selection();
    return { holderId: null, period: kind, date: shiftPeriod(kind, this.today, offset) };
  });
  readonly selectionLabel = computed(() => {
    const { period, date } = this.query();
    const { from, to } = periodRange(period, date);
    return periodLabel(period, from, to, this.today);
  });

  // 3) Corte. `generated` es la petición pedida; `request` solo vale mientras siga siendo la
  // selección actual, así nunca se ve un corte de otro periodo. Al cambiar `request`, rxResource
  // cancela la petición anterior y descarta su respuesta tardía.
  private readonly generated = signal<CashCutQuery | undefined>(undefined);
  private readonly request = computed(() => {
    const generated = this.generated();
    const current = this.query();
    const same =
      generated !== undefined &&
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

  // 4) Textos del resultado. Con el corte generado manda el periodo del backend.
  readonly resultPeriodLabel = computed(() => {
    const cut = this.cut();
    if (cut === null) return this.selectionLabel();
    return periodLabel(cut.period.kind, cut.period.from, cut.period.to, this.today);
  });
  readonly showSaleDate = computed(() => (this.cut()?.period.kind ?? 'day') !== 'day');
  readonly generatedAtLabel = computed(() => {
    const at = this.generatedAt();
    return at === null ? '' : `${this.texts.generatedAt} ${clockTime(at)}`;
  });
  readonly errorMessage = computed(() => {
    const error = this.cutResource.error();
    if (isOffline(error)) return this.texts.errorHint;
    return httpErrorMessage(error) ?? this.texts.errorHint;
  });

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
    this.generatedAt.set(new Date());
    this.generated.set(this.query());
  }

  // «Generar de nuevo» y «Reintentar» piden el mismo corte otra vez, con las ventas de ahora.
  reload(): void {
    this.generatedAt.set(new Date());
    this.cutResource.reload();
  }
}
