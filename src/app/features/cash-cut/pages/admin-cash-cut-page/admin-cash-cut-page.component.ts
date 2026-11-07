import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { Select } from 'primeng/select';
import { Skeleton } from 'primeng/skeleton';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { ViewingService } from '@core/viewing/viewing.service';
import { httpErrorMessage, isOffline } from '@shared/utils/http-errors';
import { CutPeriodPickerComponent } from '../../components/cut-period-picker/cut-period-picker.component';
import { CutHolderLineComponent } from '../../components/cut-holder-line/cut-holder-line.component';
import { CutProductLineComponent } from '../../components/cut-product-line/cut-product-line.component';
import { CutSaleItemComponent } from '../../components/cut-sale-item/cut-sale-item.component';
import { CutSummaryComponent } from '../../components/cut-summary/cut-summary.component';
import {
  ADMIN_CASH_CUT_PAGE_TEXTS,
  CUT_TYPE_OPTIONS,
  DEFAULT_CUT_TYPE,
} from '../../constants/admin-cash-cut-page.constants';
import { CUT_CARD_PASS_THROUGH } from '../../constants/cash-cut.constants';
import type {
  CashCut,
  CashCutQuery,
  CutPeriodKind,
  CutScope,
  CutTypeValue,
} from '../../interfaces/cash-cut.models';
import type {
  CashCutPageState,
  CutRequest,
  CutSelection,
} from '../../models/admin-cash-cut-page.models';
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
// Con «Corte de casa» y «Yo · bodega» aparece el interruptor «Incluir a mis vendedores» (apagado por
// defecto): apagado es el corte de la bodega sola; encendido pide el resumen del negocio (HU-22), con un
// renglón por titular en lugar del desglose por producto y las ventas. Tocarlo descarta el corte.
@Component({
  imports: [
    FormsModule,
    ButtonDirective,
    Card,
    Select,
    Skeleton,
    ToggleSwitch,
    CutPeriodPickerComponent,
    CutSummaryComponent,
    CutHolderLineComponent,
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
  readonly cardPassThrough = CUT_CARD_PASS_THROUGH;
  readonly cutTypeOptions = CUT_TYPE_OPTIONS;
  readonly cutType = signal<CutTypeValue>(DEFAULT_CUT_TYPE);
  readonly includeSellers = signal(false);
  // Solo el corte de casa de la bodega puede sumar a los vendedores; con un vendedor en «Viendo» no aplica.
  readonly showSellersToggle = computed(
    () => this.cutType() === 'home' && this.viewing.selectedSellerId() === null,
  );
  readonly sellersToggleHelp = computed(() =>
    this.includeSellers() ? this.texts.sellersToggleHelpOn : this.texts.sellersToggleHelpOff,
  );
  // Alcance que pediría «Generar» ahora; también decide si el corte generado sigue vigente.
  private readonly currentScope = computed<CutScope>(() =>
    this.showSellersToggle() && this.includeSellers() ? 'business' : 'holder',
  );

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
  private readonly generated = signal<CutRequest | undefined>(undefined);
  private readonly request = computed<CutRequest | undefined>(() => {
    const generated = this.generated();
    const current = this.query();
    const same =
      generated !== undefined &&
      generated.cutType === this.cutType() &&
      generated.scope === this.currentScope() &&
      generated.holderId === current.holderId &&
      generated.period === current.period &&
      generated.date === current.date;
    return same ? generated : undefined;
  });
  readonly generatedAt = signal<Date | null>(null);
  readonly cutResource = rxResource({
    params: () => this.request(),
    // El alcance de la petición generada manda: «business» es el resumen del negocio; si no, el tipo.
    stream: ({ params }) => {
      if (params.scope === 'business') return this.service.getBusiness(params);
      return params.cutType === 'home' ? this.service.getHome(params) : this.service.get(params);
    },
  });
  // Decide por la petición generada, no por los controles, para que el resultado no cambie al tocarlos.
  readonly isBusiness = computed(() => this.request()?.scope === 'business');
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
  // Tipo del corte ya generado (no el del selector) para que el resultado no cambie al tocar el selector.
  readonly resultCutType = computed<CutTypeValue>(() => this.request()?.cutType ?? this.cutType());
  readonly cutTypeHelp = computed(() =>
    this.cutType() === 'home' ? this.texts.cutTypeHelpHome : this.texts.cutTypeHelp,
  );
  readonly resultTitle = computed(() => {
    const base =
      this.resultCutType() === 'home' ? this.texts.resultTitleHome : this.texts.resultTitle;
    return this.holderName() ? `${base} · ${this.holderName()}` : base;
  });
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

  selectCutType(cutType: CutTypeValue): void {
    this.cutType.set(cutType);
    this.generated.set(undefined);
  }

  selectIncludeSellers(value: boolean): void {
    this.includeSellers.set(value);
    this.generated.set(undefined);
  }

  selectOffset(offset: number): void {
    this.selection.update((current) => ({ ...current, offset }));
    this.generated.set(undefined);
  }

  generate(): void {
    if (this.viewingLoading()) return;
    this.generatedAt.set(new Date());
    this.generated.set({ ...this.query(), cutType: this.cutType(), scope: this.currentScope() });
  }

  // «Generar de nuevo» y «Reintentar» piden el mismo corte otra vez, con las ventas de ahora.
  reload(): void {
    this.generatedAt.set(new Date());
    this.cutResource.reload();
  }
}
