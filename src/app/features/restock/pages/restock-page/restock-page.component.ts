import { DatePipe } from '@angular/common';
import {
  Component, DestroyRef, computed, effect, inject, signal, untracked, viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, forkJoin, from, map, Observable, of, switchMap, tap } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { ConfirmService } from '@core/confirm/confirm.service';
import type { ConfirmOptions } from '@core/confirm/confirm.models';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink, restockHistoryModalLink, restockModalLink } from '@shared/utils/modal-links';
import { newUuid } from '@shared/utils/uuid';
import { RestockFormComponent } from '../../components/restock-form/restock-form.component';
import type { RestockBusyAction, RestockFormSubmit, RestockNoticeAction } from '../../components/restock-form/restock-form.models';
import { CLOSED_ORDER_MESSAGE, RESTOCK_TIME_ZONE } from '../../constants/restock.constants';
import { RESTOCK_EXPORT_ERROR_MESSAGE } from '../../constants/restock-export.constants';
import {
  DISCARD_CONFIRMATION, REPLACE_DRAFT_CONFIRMATION, RESTOCK_PAGE_TEXTS, RESTOCK_SKELETON_ROWS,
} from '../../constants/restock-page.constants';
import type {
  RestockDiscardResult, RestockExportFormat, RestockFailure, RestockOrder, RestockOrderLookup, RestockResult,
} from '../../interfaces/restock.models';
import type {
  RestockBaseOutcome, RestockBaseReady, RestockBaseReplacement, RestockPageData, RestockSavedDraft, RestockScreenLoad,
} from '../../models/restock-page.models';
import { buildExportDocument } from '../../rules/restock-export.rules';
import { baseOutcome, parseBaseId, skippedNoticeText } from '../../rules/restock-base.rules';
import { formatRestockDate } from '../../rules/restock-dates.rules';
import { initialLines } from '../../rules/restock-lines.rules';
import { RestockExportService } from '../../services/restock-export.service';
import { RestockService } from '../../services/restock.service';

// «Lista de resurtir» (HU-31), pop-up en el outlet `ventana`. Carga la pantalla con rxResource y orquesta guardar,
// cerrar, descartar, exportar y usar un pedido como base (HU-32). La lista y sus errores de campo son del
// formulario. Un solo envío a la vez: mientras uno está en curso, los botones quedan deshabilitados y no sale otra petición.
@Component({
  imports: [DatePipe, ButtonDirective, Skeleton, ModalPanelComponent, RestockFormComponent],
  selector: 'app-restock-page',
  templateUrl: './restock-page.component.html',
})
export class RestockPageComponent {
  // --- Dependencias ---
  private readonly service = inject(RestockService);
  private readonly exporter = inject(RestockExportService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly texts = RESTOCK_PAGE_TEXTS;
  readonly skeletonRows = RESTOCK_SKELETON_ROWS;
  readonly timeZone = RESTOCK_TIME_ZONE;

  // Pedido base que pidió la URL (`resurtir;base=<id>`). Se consume con la primera carga que lo pide: después
  // de eso el parámetro ya no existe, así que un reload (tras cerrar o descartar) no lo vuelve a aplicar.
  private pendingBaseId: number | null = parseBaseId(this.route.snapshot.paramMap.get('base'));

  // --- Carga y datos de la pantalla ---
  readonly data = rxResource({ stream: () => this.loadScreen() });
  // Borrador que la página acaba de guardar o descartar sobre la carga actual.
  private readonly savedDraft = signal<RestockSavedDraft | null>(null);
  private readonly loaded = computed(() => (this.data.hasValue() ? this.data.value().page : null));
  readonly page = computed<RestockPageData | null>(() => {
    const base = this.loaded();
    if (!base) return null;
    const saved = this.savedDraft();
    return saved && saved.base === base ? { ...base, draft: saved.draft } : base;
  });
  readonly failed = computed(() => this.data.status() === 'error');
  readonly draft = computed<RestockOrder | null>(() => this.page()?.draft ?? null);
  readonly products = computed(() => this.page()?.products ?? []);
  readonly suggestions = computed(() => this.page()?.suggestions ?? []);
  // Pedido base aplicado a la lista; null mientras no se aplicó (la lista usa el borrador o las sugerencias).
  // Mientras está, la lista no se vuelve a cargar desde la página: tras guardar solo queda sin cambios, así
  // que sus renglones y su nota no cambian y no revierten lo que el usuario sigue editando.
  private readonly replacement = signal<RestockBaseReplacement | null>(null);
  readonly formLines = computed(() => {
    const replaced = this.replacement();
    if (replaced) return replaced.lines;
    const page = this.page();
    return page ? initialLines(page) : [];
  });
  // Un pedido base deja cambios sin guardar: el formulario entra con `dirty` para que salir pregunte.
  readonly startsDirty = computed(() => this.replacement() !== null);
  readonly initialNote = computed(() => this.replacement()?.note ?? this.draft()?.note ?? '');
  // Ya se guardó el pedido base: el aviso de omitidos deja de mostrarse.
  private readonly baseSaved = computed(() => {
    const saved = this.savedDraft();
    return saved !== null && saved.base === this.loaded();
  });
  readonly newOrderText = computed(() => {
    const base = this.replacement();
    return base ? `${this.texts.basedOn} ${formatRestockDate(base.baseClosedAt)}` : this.texts.newOrder;
  });
  readonly skippedText = computed(() => {
    const base = this.replacement();
    if (!base || this.baseSaved() || base.skipped === 0) return null;
    return skippedNoticeText(base.skipped);
  });

  // --- Envío y estados ---
  readonly busy = signal<RestockBusyAction | null>(null);
  readonly saving = computed(() => this.busy() !== null);
  readonly dirty = signal(false);
  // Total estimado que devolvió el backend tras guardar; null cuando la lista cambió después.
  readonly savedTotal = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly noticeAction = signal<RestockNoticeAction | null>(null);
  // Reintento de descartar. Guardar y cerrar se reintentan desde el formulario (datos actuales).
  private discardRetry: (() => void) | null = null;
  private readonly formRef = viewChild(RestockFormComponent);
  // Lista bloqueada mientras guarda o mientras vuelve a cargar el borrador tras cerrar o descartar.
  readonly formBusy = computed<RestockBusyAction | null>(() =>
    this.busy() ?? (this.data.isLoading() ? 'reload' : null),
  );
  // Exportar lee lo guardado: con cambios sin guardar o guardando, los botones quedan bloqueados.
  readonly exporting = signal<RestockExportFormat | null>(null);
  readonly exportBlocked = computed(() => this.dirty() || this.saving());
  readonly exportHelp = computed(() => (this.exportBlocked() ? this.texts.exportHelp : null));
  // Llave de idempotencia del pedido nuevo: se crea una vez y solo se conserva si el envío falla por red.
  private requestId: string | null = null;

  // Aplica el pedido base cada vez que una carga lo trae (solo la que lo pidió).
  private readonly baseEffect = effect(() => {
    const base = this.data.hasValue() ? this.data.value().base : null;
    if (base !== null) untracked(() => this.applyBase(base));
  });

  // Lo que consulta el guard de salida.
  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  retryLoad(): void {
    this.data.reload();
  }

  // Cerrar vuelve a «Stock general»; el guard de salida pregunta si hay cambios sin guardar.
  close(): void {
    if (this.saving()) return;
    void this.router.navigate(closeModalLink());
  }

  // «Pedidos anteriores»: el guard de salida pregunta si hay cambios sin guardar, como cualquier salida.
  openHistory(): void {
    void this.router.navigate(restockHistoryModalLink());
  }

  // Al primer cambio después de guardar, el total vuelve a calcularse en pantalla.
  onDirtyChange(dirty: boolean): void {
    if (dirty) this.savedTotal.set(null);
    this.dirty.set(dirty);
  }

  onNoticeAction(action: RestockNoticeAction): void {
    if (action === 'reload') {
      this.refresh();
      return;
    }
    if (this.discardRetry) this.discardRetry();
    else this.formRef()?.resubmit();
  }

  // --- Exportar el borrador guardado (HU-32) ---
  // Siempre exporta el pedido que devolvió el backend, nunca lo que hay en pantalla.
  onExport(format: RestockExportFormat): void {
    const draft = this.draft();
    if (draft === null || this.exportBlocked() || this.exporting() !== null) return;
    this.exporting.set(format);
    from(this.exporter.download(buildExportDocument(draft), format))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        complete: () => this.exporting.set(null),
        error: () => {
          this.exporting.set(null);
          this.toast.error(RESTOCK_EXPORT_ERROR_MESSAGE);
        },
      });
  }

  // --- Guardar, cerrar y descartar ---
  onSave(submit: RestockFormSubmit): void {
    if (this.saving()) return;
    this.perform('save', submit);
  }

  // Cerrar pide confirmación; al aceptar, guarda lo pendiente y cierra en la misma cadena.
  onClose(submit: RestockFormSubmit): void {
    if (this.saving()) return;
    from(this.confirm.ask(this.closeConfirmation(submit)))
      .pipe(
        filter((accepted) => accepted),
        switchMap(() => this.start('close', submit)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.settle('close', result));
  }

  onDiscard(): void {
    const draft = this.draft();
    if (this.saving() || draft === null) return;
    from(this.confirm.ask(DISCARD_CONFIRMATION))
      .pipe(
        filter((accepted) => accepted),
        switchMap(() => this.startDiscard(draft.id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => this.settleDiscard(result));
  }

  // --- Pedido base (HU-32) ---
  // La carga de la pantalla y la del pedido base van juntas: si el base falla por otra causa, la pantalla
  // entra en error y «Reintentar» lo vuelve a pedir (no se consumió).
  private loadScreen(): Observable<RestockScreenLoad> {
    const baseId = untracked(() => this.pendingBaseId);
    const lookup: Observable<RestockOrderLookup | null> =
      baseId === null ? of(null) : this.service.getOrder(baseId);
    return forkJoin({ page: this.service.getPageData(), lookup }).pipe(
      tap(() => {
        if (baseId !== null) this.consumeBase();
      }),
      map(({ page, lookup: found }) => ({
        page,
        base: found === null ? null : baseOutcome(found, page.products),
      })),
    );
  }

  // Quita `base` de la URL con una navegación que reemplaza la anterior, para que un reload no lo vuelva a pedir.
  private consumeBase(): void {
    this.pendingBaseId = null;
    void this.router.navigate(restockModalLink(), { replaceUrl: true });
  }

  // Sin borrador, los renglones del base entran directo. Con borrador, primero se pregunta: aceptar
  // reemplaza los renglones (la nota del borrador se conserva) y se guarda con el PUT de siempre.
  private applyBase(base: RestockBaseOutcome): void {
    if (base.kind === 'missing') {
      this.toast.error(this.texts.baseMissing);
      return;
    }
    if (this.draft() === null) {
      this.replaceLines(base);
      return;
    }
    from(this.confirm.ask(REPLACE_DRAFT_CONFIRMATION))
      .pipe(
        filter((accepted) => accepted),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.replaceLines(base));
  }

  // Los renglones del base reemplazan los de la lista; la nota se conserva (la del borrador, o vacía).
  private replaceLines(base: RestockBaseReady): void {
    this.replacement.set({ ...base, note: this.draft()?.note ?? '' });
  }

  // --- Envío de guardar, cerrar y descartar ---
  // Un envío de guardar: un solo subscribe; el reintento vuelve a entrar por aquí.
  private perform(action: 'save' | 'close', submit: RestockFormSubmit): void {
    this.start(action, submit)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.settle(action, result));
  }

  // Marca el envío en curso y devuelve la petición: guardar, o guardar y cerrar.
  private start(action: 'save' | 'close', submit: RestockFormSubmit): Observable<RestockResult> {
    this.busy.set(action);
    this.notice.set(null);
    this.noticeAction.set(null);
    this.discardRetry = null;
    return action === 'save' ? this.sendSave(submit) : this.closeOrder(submit);
  }

  // Pedido nuevo: POST con el requestId. Con borrador: PUT del mismo pedido.
  private sendSave(submit: RestockFormSubmit): Observable<RestockResult> {
    const draft = this.draft();
    if (draft) {
      return this.service.update(draft.id, submit.payload).pipe(tap((result) => this.adopt(result)));
    }
    const requestId = this.requestId ?? newUuid();
    this.requestId = requestId;
    return this.service.create({ requestId, ...submit.payload }).pipe(
      tap((result) => {
        // Un fallo de red o 5xx conserva la llave: reintentar no debe crear dos pedidos.
        if (result.ok || result.reason !== 'offline') this.requestId = null;
        this.adopt(result);
      }),
    );
  }

  // Guarda si hay cambios o el pedido es nuevo, y después cierra. Sin cambios, solo cierra.
  // Si el guardado sale bien pero el cierre falla, el borrador ya quedó como base de la pantalla.
  private closeOrder(submit: RestockFormSubmit): Observable<RestockResult> {
    const draft = this.draft();
    const saved$ = draft && !this.dirty() ? of<RestockResult>({ ok: true, order: draft }) : this.sendSave(submit);
    return saved$.pipe(
      switchMap((saved) => (saved.ok ? this.service.close(saved.order.id) : of(saved))),
    );
  }

  private startDiscard(id: number): Observable<RestockDiscardResult> {
    this.busy.set('discard');
    this.notice.set(null);
    this.noticeAction.set(null);
    this.discardRetry = () => this.discardNow(id);
    return this.service.discard(id);
  }

  private discardNow(id: number): void {
    this.startDiscard(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => this.settleDiscard(result));
  }

  // --- Resultados ---
  private settle(action: 'save' | 'close', result: RestockResult): void {
    this.busy.set(null);
    if (!result.ok) {
      this.showFailure(result, this.texts.saveFailed);
      return;
    }
    if (action === 'save') {
      this.discardRetry = null;
      this.toast.success(this.texts.saved);
      return;
    }
    this.toast.success(this.texts.closed);
    this.refreshAfterSuccess();
  }

  private settleDiscard(result: RestockDiscardResult): void {
    this.busy.set(null);
    if (result.ok) {
      this.toast.success(this.texts.discarded);
      this.refreshAfterSuccess();
      return;
    }
    this.showFailure(result, this.texts.discardFailed);
  }

  // Un fallo se muestra como aviso encima de los botones; la lista no se toca, así que lo escrito no se pierde.
  private showFailure(failure: RestockFailure, offlineText: string): void {
    if (failure.reason === 'closed') {
      this.setNotice(failure.message ?? CLOSED_ORDER_MESSAGE, 'reload');
    } else if (failure.reason === 'offline') {
      this.setNotice(offlineText, 'retry');
    } else {
      this.setNotice(failure.message ?? offlineText, null);
    }
  }

  private setNotice(message: string, action: RestockNoticeAction | null): void {
    this.notice.set(message);
    this.noticeAction.set(action);
  }

  // Un pedido guardado pasa a ser el borrador de la pantalla. Sin pedido base, el formulario se re-sincroniza
  // con él y queda sin cambios. Con pedido base, la lista ya tiene lo guardado: solo se marca sin cambios.
  private adopt(result: RestockResult): void {
    const base = this.loaded();
    if (!result.ok || !base) return;
    this.savedDraft.set({ base, draft: result.order });
    this.savedTotal.set(result.order.estimatedTotal);
    if (this.replacement() !== null) this.formRef()?.markSaved();
  }

  // Vuelve a pedir todo tras «Volver a cargar». El pedido nuevo que sigue parte de cero, con llave nueva.
  private refresh(): void {
    this.resetOrderState();
    this.data.reload();
  }

  // Tras cerrar o descartar, la recarga se encola como microtarea: el resultado (aviso y botones)
  // se pinta antes de que el recurso entre en carga, y no en el mismo ciclo que cerró el envío.
  private refreshAfterSuccess(): void {
    this.resetOrderState();
    queueMicrotask(() => this.data.reload());
  }

  private resetOrderState(): void {
    this.savedTotal.set(null);
    this.requestId = null;
    this.discardRetry = null;
    this.replacement.set(null);
    this.notice.set(null);
    this.noticeAction.set(null);
  }

  // Confirmación de cerrar con el total que se ve en pantalla.
  private closeConfirmation(submit: RestockFormSubmit): ConfirmOptions {
    const noun = submit.lineCount === 1 ? this.texts.productSingular : this.texts.productPlural;
    return {
      title: this.texts.closeTitle,
      message: `¿Cerrar el pedido con ${submit.lineCount} ${noun} (total estimado $${submit.total})? Ya no se podrá editar.`,
      confirmLabel: this.texts.close,
      cancelLabel: this.texts.cancel,
      tone: 'default',
    };
  }
}
