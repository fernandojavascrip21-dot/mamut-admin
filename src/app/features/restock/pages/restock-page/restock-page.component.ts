import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter, from, Observable, of, switchMap, tap } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { ConfirmService } from '@core/confirm/confirm.service';
import type { ConfirmOptions } from '@core/confirm/confirm.models';
import { ToastService } from '@core/toast/toast.service';
import { newUuid } from '@shared/utils/uuid';
import { RestockFormComponent } from '../../components/restock-form/restock-form.component';
import type { RestockBusyAction, RestockFormSubmit, RestockNoticeAction } from '../../components/restock-form/restock-form.models';
import { CLOSED_ORDER_MESSAGE } from '../../constants/restock.constants';
import { DISCARD_CONFIRMATION, RESTOCK_PAGE_TEXTS, RESTOCK_SKELETON_ROWS, RESTOCK_TIME_ZONE } from '../../constants/restock-page.constants';
import type {
  RestockDiscardResult, RestockFailure, RestockOrder, RestockResult,
} from '../../interfaces/restock.models';
import type { RestockPageData, RestockSavedDraft } from '../../models/restock-page.models';
import { initialLines } from '../../rules/restock-lines.rules';
import { RestockService } from '../../services/restock.service';

// «Lista de resurtir» (HU-31, /admin/resurtir). Carga la pantalla con rxResource y orquesta guardar,
// cerrar y descartar; la lista y sus errores de campo son del formulario. Un solo envío a la vez:
// mientras uno está en curso, los botones quedan deshabilitados y no sale otra petición.
@Component({
  imports: [DatePipe, ButtonDirective, Skeleton, RestockFormComponent],
  selector: 'app-restock-page',
  templateUrl: './restock-page.component.html',
})
export class RestockPageComponent {
  // --- Dependencias ---
  private readonly service = inject(RestockService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly destroyRef = inject(DestroyRef);

  readonly texts = RESTOCK_PAGE_TEXTS;
  readonly skeletonRows = RESTOCK_SKELETON_ROWS;
  readonly timeZone = RESTOCK_TIME_ZONE;

  // --- Carga y datos de la pantalla ---
  readonly data = rxResource({ stream: () => this.service.getPageData() });
  // Borrador que la página acaba de guardar o descartar sobre la carga actual.
  private readonly savedDraft = signal<RestockSavedDraft | null>(null);
  private readonly loaded = computed(() => (this.data.hasValue() ? this.data.value() : null));
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
  readonly formLines = computed(() => {
    const page = this.page();
    return page ? initialLines(page) : [];
  });
  readonly initialNote = computed(() => this.draft()?.note ?? '');

  // --- Envío y estados ---
  readonly busy = signal<RestockBusyAction | null>(null);
  readonly saving = computed(() => this.busy() !== null);
  readonly dirty = signal(false);
  readonly notice = signal<string | null>(null);
  readonly noticeAction = signal<RestockNoticeAction | null>(null);
  // Repite lo último que falló, con los mismos datos y el mismo requestId.
  private retryLast: (() => void) | null = null;
  // Llave de idempotencia del pedido nuevo: se crea una vez y solo se conserva si el envío falla por red.
  private requestId: string | null = null;

  // Lo que consulta el guard de salida.
  hasUnsavedChanges(): boolean {
    return this.dirty();
  }

  retryLoad(): void {
    this.data.reload();
  }

  onDirtyChange(dirty: boolean): void {
    this.dirty.set(dirty);
  }

  onNoticeAction(action: RestockNoticeAction): void {
    if (action === 'reload') this.refresh();
    else this.retryLast?.();
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
    this.retryLast = () => this.perform(action, submit);
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
    this.retryLast = () => this.discardNow(id);
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
      this.retryLast = null;
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

  // Un pedido guardado pasa a ser el borrador de la pantalla: el formulario se re-sincroniza y queda sin cambios.
  private adopt(result: RestockResult): void {
    const base = this.loaded();
    if (result.ok && base) this.savedDraft.set({ base, draft: result.order });
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
    this.requestId = null;
    this.retryLast = null;
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
