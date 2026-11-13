import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { httpErrorMessage, isOffline } from '@shared/utils/http-errors';
import { closeModalLink, leaveModalLink } from '@shared/utils/modal-links';
import { newUuid } from '@shared/utils/uuid';
import { ReceiptFilePickerComponent } from '../../components/receipt-file-picker/receipt-file-picker.component';
import { ReceiptPreviewFormComponent } from '../../components/receipt-preview-form/receipt-preview-form.component';
import { ReceiptResultComponent } from '../../components/receipt-result/receipt-result.component';
import { ReceiptSkippedListComponent } from '../../components/receipt-skipped-list/receipt-skipped-list.component';
import { REQUEST_MISMATCH_MESSAGE, RECEIPT_PENDING_SEGMENTS } from '../../constants/receipts.constants';
import type {
  ConfirmReceiptPayload, Receipt, ReceiptCatalogItem, ReceiptPreview,
} from '../../interfaces/receipt.models';
import type { ReceiptUploadState } from '../../models/receipt-upload-page.models';
import { stockBefore } from '../../rules/receipt-preview.rules';
import { ReceiptsService } from '../../services/receipts.service';
import { RECEIPT_UPLOAD_PAGE_TEXTS } from './receipt-upload-page.constants';

// «Cargar remisión» (HU-42), pop-up sobre la página actual (ruta `remision` del outlet `ventana`). Lee
// el archivo, deja revisar y corregir los renglones, y registra la entrada una sola vez: un requestId por
// intento, que se conserva si falla y se renueva solo con «Cargar otra remisión». No pide confirmación:
// sumar piezas no es destructivo.
@Component({
  imports: [
    ButtonDirective, Skeleton, ModalPanelComponent, ReceiptFilePickerComponent, ReceiptPreviewFormComponent,
    ReceiptResultComponent, ReceiptSkippedListComponent,
  ],
  selector: 'app-receipt-upload-page',
  templateUrl: './receipt-upload-page.component.html',
})
export class ReceiptUploadPageComponent {
  // --- Dependencias ---
  private readonly router = inject(Router);
  private readonly receipts = inject(ReceiptsService);
  private readonly toast = inject(ToastService);
  private readonly stockChanges = inject(StockChangesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly texts = RECEIPT_UPLOAD_PAGE_TEXTS;

  // --- Estado del pop-up ---
  readonly state = signal<ReceiptUploadState>('pick');
  readonly fileName = signal<string | null>(null);
  readonly preview = signal<ReceiptPreview | null>(null);
  readonly readError = signal<string | null>(null);
  readonly confirmError = signal<string | null>(null);
  // Un 409 de «otros datos» ofrece «Ver lo registrado»: el primer intento sí quedó registrado.
  readonly conflict = signal(false);
  readonly receipt = signal<Receipt | null>(null);
  readonly stockBeforeById = signal<Record<number, number>>({});
  readonly hasUnsavedChanges = signal(false);
  // Leyendo o confirmando: no se puede cerrar ni salir (lo usa unsavedReceiptGuard).
  readonly busy = computed(() => {
    const current = this.state();
    return current === 'reading' || current === 'confirming';
  });
  readonly formVisible = computed(() => {
    const current = this.state();
    return current === 'review' || current === 'confirming';
  });

  // Un requestId por intento de registro: se renueva solo con «Cargar otra remisión».
  requestId = newUuid();

  // --- Catálogo para corregir renglones ---
  // Se pide al abrir una revisión (una acción, no la entrada a la pantalla), con un subscribe propio y no
  // con rxResource: un resource en carga registra una tarea pendiente y bloquea whenStable. Si falla, el
  // formulario sigue sin él y «Reintentar» lo vuelve a pedir.
  readonly catalog = signal<ReceiptCatalogItem[]>([]);
  readonly catalogError = signal(false);

  // --- Lectura ---
  onFilePicked(file: File): void {
    if (this.busy()) return;
    this.resetReview();
    this.fileName.set(file.name);
    this.state.set('reading');
    this.receipts
      .preview(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => this.onPreviewLoaded(preview),
        error: (error: unknown) => this.onReadFailed(error),
      });
  }

  // Sin renglones no hay nada que revisar: se muestra el aviso y los no leídos, y no se pide el catálogo.
  private onPreviewLoaded(preview: ReceiptPreview): void {
    this.preview.set(preview);
    if (preview.lines.length === 0) {
      this.state.set('empty');
      return;
    }
    this.loadCatalog();
    this.state.set('review');
  }

  private loadCatalog(): void {
    this.catalogError.set(false);
    this.receipts
      .getProducts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (products) => this.catalog.set(products),
        error: () => this.catalogError.set(true),
      });
  }

  // Sin red el backend no responde, así que el mensaje es el genérico de conexión.
  private onReadFailed(error: unknown): void {
    this.readError.set(
      isOffline(error) ? this.texts.readOffline : (httpErrorMessage(error) ?? this.texts.readFailed),
    );
    this.state.set('readError');
  }

  chooseAnother(): void {
    this.resetReview();
    this.fileName.set(null);
    this.state.set('pick');
  }

  // --- Confirmar ---
  // Un solo envío: en «confirming» el formulario no vuelve a emitir. Un error deja la revisión como estaba
  // con el mismo requestId, así que reintentar no registra dos veces.
  onConfirm(payload: ConfirmReceiptPayload): void {
    if (this.state() !== 'review') return;
    this.confirmError.set(null);
    this.conflict.set(false);
    this.state.set('confirming');
    this.receipts
      .confirm(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ receipt }) => this.onConfirmed(receipt),
        error: (error: unknown) => this.onConfirmFailed(error),
      });
  }

  private onConfirmed(receipt: Receipt): void {
    this.stockBeforeById.set(this.stockBeforeOf(receipt));
    this.receipt.set(receipt);
    this.hasUnsavedChanges.set(false);
    this.state.set('done');
    this.toast.success(this.texts.saved);
    this.stockChanges.notify();
  }

  // Los errores del backend (producto desactivado, 422, 409) se muestran arriba del formulario; el
  // mensaje ya viene en español. Solo el 409 de «otros datos» se identifica por su texto (ver constantes).
  private onConfirmFailed(error: unknown): void {
    const message = httpErrorMessage(error);
    this.state.set('review');
    this.confirmError.set(message ?? this.texts.confirmFailed);
    this.conflict.set(message === REQUEST_MISMATCH_MESSAGE);
  }

  // El primer intento sí se registró: se pide la remisión tal como quedó y se muestra como resultado.
  viewRegistered(): void {
    if (this.state() !== 'review') return;
    this.confirmError.set(null);
    this.state.set('confirming');
    this.receipts
      .get(this.requestId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (receipt) => {
          this.receipt.set(receipt);
          this.stockBeforeById.set({});
          this.hasUnsavedChanges.set(false);
          this.state.set('done');
        },
        error: (error: unknown) => {
          this.confirmError.set(httpErrorMessage(error) ?? this.texts.loadFailed);
          this.state.set('review');
        },
      });
  }

  onDirtyChange(dirty: boolean): void {
    this.hasUnsavedChanges.set(dirty);
  }

  reloadCatalog(): void {
    this.loadCatalog();
  }

  // --- Salida ---
  onAnother(): void {
    this.requestId = newUuid();
    this.fileName.set(null);
    this.resetReview();
    this.state.set('pick');
  }

  close(): void {
    void this.router.navigate(closeModalLink());
  }

  goToPending(): void {
    void this.router.navigate(leaveModalLink(RECEIPT_PENDING_SEGMENTS));
  }

  // Deja la ventana como al abrirla, sin tocar el requestId ni el nombre del archivo.
  private resetReview(): void {
    this.preview.set(null);
    this.readError.set(null);
    this.confirmError.set(null);
    this.conflict.set(false);
    this.receipt.set(null);
    this.stockBeforeById.set({});
    this.hasUnsavedChanges.set(false);
    this.catalog.set([]);
    this.catalogError.set(false);
  }

  // Antes de confirmar: el de la vista previa si el producto venía emparejado, o el del catálogo.
  private stockBeforeOf(receipt: Receipt): Record<number, number> {
    const preview = this.preview();
    if (preview === null) return {};
    return Object.fromEntries(
      receipt.units.map((unit): [number, number] => [
        unit.productId,
        stockBefore(unit.productId, preview, this.catalog()),
      ]),
    );
  }
}
