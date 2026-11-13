import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { ModalPanelComponent } from '@shared/components/modal-panel/modal-panel.component';
import { closeModalLink, leaveModalLink } from '@shared/utils/modal-links';
import { ReceiptFilePickerComponent } from '../../components/receipt-file-picker/receipt-file-picker.component';
import { ReceiptPreviewFormComponent } from '../../components/receipt-preview-form/receipt-preview-form.component';
import { ReceiptResultComponent } from '../../components/receipt-result/receipt-result.component';
import type {
  ConfirmReceiptPayload, Receipt, ReceiptCatalogItem, ReceiptPreview,
} from '../../interfaces/receipt.models';
import { ReceiptUploadPageComponent } from './receipt-upload-page.component';

const BASE = `${API_BASE_URL}/api/receipts`;
const PRODUCTS = `${BASE}/products`;
const CATALOG: ReceiptCatalogItem[] = [{ id: 1, name: 'Creatina 300 g', image: null, unitCost: '12.5000', units: 7 }];
const PREVIEW: ReceiptPreview = {
  source: 'excel',
  lines: [{
    position: 1, readName: 'CREATINA', suggestedName: 'Creatina', qty: 3, unitCost: '12.5000', match: 'alias',
    product: { id: 1, name: 'Creatina 300 g', image: null, unitCost: '12.5000' }, costChanged: false,
  }],
  skipped: [{ position: 2, text: 'raro', reason: 'invalid_qty', label: 'Piezas no válidas' }],
  stock: [{ productId: 1, before: 7, after: 10 }],
};
const RECEIPT: Receipt = {
  requestId: 'r-1', source: 'excel', fileName: 'remision.xlsx', createdAt: '2026-11-10T18:00:00Z',
  lines: [{
    id: 1, position: 1, readName: 'CREATINA', qty: 3, unitCost: '12.5000', status: 'received', costStatus: null,
    product: { id: 1, name: 'Creatina 300 g', image: null },
  }],
  units: [{ productId: 1, units: 10 }],
};
const failure = (status: number, message: string, code = 'x') =>
  [{ error: { code, message } }, { status, statusText: 'Error' }] as const;

describe('ReceiptUploadPageComponent', () => {
  let fixture: ComponentFixture<ReceiptUploadPageComponent>;
  let httpMock: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  const root = () => document.body;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const panel = () => fixture.debugElement.query(By.directive(ModalPanelComponent)).componentInstance as ModalPanelComponent;
  const picker = () => fixture.debugElement.query(By.directive(ReceiptFilePickerComponent));
  const form = () => fixture.debugElement.query(By.directive(ReceiptPreviewFormComponent));
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;
  const payload = (requestId: string): ConfirmReceiptPayload => ({
    requestId, source: 'excel', fileName: 'remision.xlsx',
    lines: [{ readName: 'CREATINA', qty: 3, unitCost: '12.5000', productId: 1 }],
  });

  const setup = async () => {
    toast = { success: vi.fn(), error: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ReceiptUploadPageComponent],
      providers: [
        MessageService, provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReceiptUploadPageComponent);
    fixture.detectChanges();
  };
  const pick = async (name = 'remision.xlsx'): Promise<TestRequest> => {
    picker().componentInstance.fileSelected.emit(new File(['x'], name));
    await settle();
    return httpMock.expectOne(`${BASE}/preview`);
  };
  const toReview = async (preview: ReceiptPreview = PREVIEW) => {
    (await pick()).flush(preview);
    await settle();
    httpMock.expectOne(PRODUCTS).flush({ products: CATALOG });
    await settle();
  };
  const confirmWith = async (body: ConfirmReceiptPayload) => {
    form().componentInstance.confirmed.emit(body);
    await settle();
    return httpMock.expectOne(BASE);
  };

  afterEach(() => httpMock.verify());

  it('va en un modal-panel ancho con el título «Cargar remisión» y empieza eligiendo archivo', async () => {
    await setup();
    expect(panel().title()).toBe('Cargar remisión');
    expect(panel().wide()).toBe(true);
    expect(picker()).not.toBeNull();
  });

  it('cerrar el pop-up navega con closeModalLink', async () => {
    await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    panel().closed.emit();
    expect(navigate).toHaveBeenCalledWith(closeModalLink());
  });

  describe('lectura', () => {
    it('manda el archivo en un FormData y mientras lee muestra el aviso y no se puede cerrar', async () => {
      await setup();
      const request = await pick();
      expect(request.request.body).toBeInstanceOf(FormData);
      expect((request.request.body as FormData).get('file')).toBeInstanceOf(File);
      expect(text()).toContain('Leyendo la remisión…');
      expect(text()).toContain('Un PDF o una imagen puede tardar hasta un minuto.');
      expect(panel().closable()).toBe(false);
      expect(fixture.componentInstance.busy()).toBe(true);
      request.flush(PREVIEW);
      await settle();
      httpMock.expectOne(PRODUCTS).flush({ products: CATALOG });
    });

    it('un 422 muestra el mensaje del backend y «Elegir otro archivo» vuelve a elegir', async () => {
      await setup();
      (await pick()).flush(...failure(422, 'El archivo no es una remisión.'));
      await settle();
      expect(text()).toContain('El archivo no es una remisión.');
      button('Elegir otro archivo').click();
      await settle();
      expect(picker()).not.toBeNull();
    });

    it('sin red muestra «No pudimos leer la remisión. Revisa tu conexión.»', async () => {
      await setup();
      (await pick()).error(new ProgressEvent('error'));
      await settle();
      expect(text()).toContain('No pudimos leer la remisión. Revisa tu conexión.');
    });

    it('sin renglones muestra «No encontré productos en la remisión», los no leídos y «Elegir otro archivo»', async () => {
      await setup();
      (await pick()).flush({ ...PREVIEW, lines: [] });
      await settle();
      expect(text()).toContain('No encontré productos en la remisión');
      expect(text()).toContain('No leídos (1)');
      expect(button('Elegir otro archivo')).toBeDefined();
    });
  });

  describe('revisión', () => {
    it('muestra el formulario con la vista previa, carga el catálogo y marca cambios sin guardar al editar', async () => {
      await setup();
      await toReview();
      expect(form().componentInstance.preview()).toEqual(PREVIEW);
      expect(form().componentInstance.catalog()).toEqual(CATALOG);
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
      form().componentInstance.dirtyChange.emit(true);
      expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    });

    it('si el catálogo falla, el formulario sigue y recibe catalogError; «Reintentar» lo vuelve a pedir', async () => {
      await setup();
      (await pick()).flush(PREVIEW);
      await settle();
      httpMock.expectOne(PRODUCTS).flush(...failure(500, 'x'));
      await settle();
      expect(form().componentInstance.catalogError()).toBe(true);
      form().componentInstance.catalogRetry.emit();
      await settle();
      httpMock.expectOne(PRODUCTS).flush({ products: CATALOG });
    });

    it('al confirmar manda el payload a POST /api/receipts y mientras tanto no se puede cerrar', async () => {
      await setup();
      await toReview();
      const requestId = form().componentInstance.requestId();
      const request = await confirmWith(payload(requestId));
      expect(request.request.body).toEqual(payload(requestId));
      expect(form().componentInstance.disabled()).toBe(true);
      expect(panel().closable()).toBe(false);
      expect(fixture.componentInstance.busy()).toBe(true);
      request.flush({ receipt: RECEIPT, replayed: false }, { status: 201, statusText: 'Created' });
      await settle();
    });

    it('un solo envío: un segundo confirmar con el primero en curso no manda otra petición', async () => {
      await setup();
      await toReview();
      const requestId = form().componentInstance.requestId();
      const request = await confirmWith(payload(requestId));
      form().componentInstance.confirmed.emit(payload(requestId));
      await settle();
      request.flush({ receipt: RECEIPT, replayed: false }, { status: 201, statusText: 'Created' });
    });
  });

  describe('confirmar', () => {
    it('201 pasa a «done» con el resultado, avisa del stock y muestra el toast «Entrada registrada»', async () => {
      await setup();
      await toReview();
      const request = await confirmWith(payload(form().componentInstance.requestId()));
      request.flush({ receipt: RECEIPT, replayed: false }, { status: 201, statusText: 'Created' });
      await settle();
      const result = fixture.debugElement.query(By.directive(ReceiptResultComponent));
      expect(result.componentInstance.receipt()).toEqual(RECEIPT);
      expect(result.componentInstance.stockBefore()).toEqual({ 1: 7 });
      expect(toast.success).toHaveBeenCalledWith('Entrada registrada');
      expect(TestBed.inject(StockChangesService).version()).toBe(1);
    });

    it('200 replayed también pasa a «done»', async () => {
      await setup();
      await toReview();
      const request = await confirmWith(payload(form().componentInstance.requestId()));
      request.flush({ receipt: RECEIPT, replayed: true }, { status: 200, statusText: 'OK' });
      await settle();
      expect(fixture.debugElement.query(By.directive(ReceiptResultComponent))).not.toBeNull();
    });

    it('sin red muestra «No pudimos confirmar la entrada. Inténtalo de nuevo.», sigue en revisión y conserva el requestId', async () => {
      await setup();
      await toReview();
      const requestId = form().componentInstance.requestId();
      (await confirmWith(payload(requestId))).error(new ProgressEvent('error'));
      await settle();
      expect(text()).toContain('No pudimos confirmar la entrada. Inténtalo de nuevo.');
      expect(form().componentInstance.disabled()).toBe(false);
      expect(form().componentInstance.requestId()).toBe(requestId);
    });

    it('409 PRODUCT_INACTIVE muestra el mensaje del backend arriba y se queda en revisión', async () => {
      await setup();
      await toReview();
      (await confirmWith(payload(form().componentInstance.requestId())))
        .flush(...failure(409, 'Un producto se desactivó; elige otro o márcalo como producto nuevo', 'PRODUCT_INACTIVE'));
      await settle();
      expect(text()).toContain('Un producto se desactivó; elige otro o márcalo como producto nuevo');
      expect(form()).not.toBeNull();
    });

    it('422 muestra el mensaje del backend arriba del formulario', async () => {
      await setup();
      await toReview();
      (await confirmWith(payload(form().componentInstance.requestId()))).flush(...failure(422, 'Las piezas no son válidas.'));
      await settle();
      expect(text()).toContain('Las piezas no son válidas.');
      expect(form()).not.toBeNull();
    });

    it('409 de otros datos muestra el mensaje y «Ver lo registrado» pide la remisión y pasa a «done»', async () => {
      await setup();
      await toReview();
      const requestId = form().componentInstance.requestId();
      (await confirmWith(payload(requestId))).flush(...failure(409, 'Esta remisión ya se registró con otros datos.'));
      await settle();
      expect(text()).toContain('Esta remisión ya se registró con otros datos.');
      button('Ver lo registrado').click();
      await settle();
      httpMock.expectOne(`${BASE}/${requestId}`).flush({ receipt: RECEIPT });
      await settle();
      expect(fixture.debugElement.query(By.directive(ReceiptResultComponent)).componentInstance.receipt()).toEqual(RECEIPT);
    });
  });

  describe('resultado', () => {
    const toDone = async () => {
      await setup();
      await toReview();
      const request = await confirmWith(payload(form().componentInstance.requestId()));
      request.flush({ receipt: RECEIPT, replayed: false }, { status: 201, statusText: 'Created' });
      await settle();
      return fixture.debugElement.query(By.directive(ReceiptResultComponent)).componentInstance as ReceiptResultComponent;
    };

    it('«Cargar otra remisión» vuelve a elegir archivo y el siguiente intento usa otro requestId', async () => {
      const result = await toDone();
      const first = payload('x').requestId;
      result.another.emit();
      await settle();
      expect(picker()).not.toBeNull();
      await toReviewAgain();
      expect(form().componentInstance.requestId()).not.toBe(first);
      expect(form().componentInstance.requestId()).toMatch(/^[0-9a-f-]{36}$/);
    });

    const toReviewAgain = async () => {
      (await pick('otra.xlsx')).flush(PREVIEW);
      await settle();
      httpMock.expectOne(PRODUCTS).flush({ products: CATALOG });
      await settle();
    };

    it('«Ver pendientes» cierra la ventana y lleva a /admin/remisiones/pendientes', async () => {
      const result = await toDone();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      result.pendingRequested.emit();
      expect(navigate).toHaveBeenCalledWith(leaveModalLink(['remisiones', 'pendientes']));
    });

    it('«Cerrar» navega con closeModalLink', async () => {
      const result = await toDone();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      result.closed.emit();
      expect(navigate).toHaveBeenCalledWith(closeModalLink());
    });
  });
});
