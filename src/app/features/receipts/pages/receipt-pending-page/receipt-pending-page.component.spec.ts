import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { ConfirmService } from '@core/confirm/confirm.service';
import { StockChangesService } from '@core/stock-changes/stock-changes.service';
import { ToastService } from '@core/toast/toast.service';
import { receiptModalLink } from '@shared/utils/modal-links';
import { NewProductDialogComponent } from '../../components/new-product-dialog/new-product-dialog.component';
import { PendingCostChangeCardComponent } from '../../components/pending-cost-change-card/pending-cost-change-card.component';
import { PendingNewProductCardComponent } from '../../components/pending-new-product-card/pending-new-product-card.component';
import type { PendingCostChange, PendingNewProduct, PendingReceiptLines } from '../../interfaces/receipt.models';
import { ReceiptPendingPageComponent } from './receipt-pending-page.component';

const BASE = `${API_BASE_URL}/api/receipts`;
const RECEIPT = { requestId: 'r-1', createdAt: '2026-11-10T18:00:00Z' };
const NEW_A: PendingNewProduct = { lineId: 1, receipt: RECEIPT, suggestedName: 'Glutamina 500 g', qty: 3, unitCost: '10.5000' };
const NEW_B: PendingNewProduct = { lineId: 2, receipt: RECEIPT, suggestedName: 'Omega 3', qty: 2, unitCost: null };
const COST: PendingCostChange = {
  lineId: 3, receipt: RECEIPT, product: { id: 4, name: 'Creatina 300 g', image: null, active: true }, qty: 6,
  currentUnitCost: '12.0000', previousUnitCost: '12.0000', newUnitCost: '13.5000',
};
const PENDING: PendingReceiptLines = { newProducts: [NEW_A, NEW_B], costChanges: [COST] };
const LINE = { id: 1, position: 1, readName: 'x', qty: 3, unitCost: null, status: 'created', costStatus: null, product: null };
const failure = (status: number, message: string, code = 'x') =>
  [{ error: { code, message } }, { status, statusText: 'Error' }] as const;

describe('ReceiptPendingPageComponent', () => {
  let fixture: ComponentFixture<ReceiptPendingPageComponent>;
  let httpMock: HttpTestingController;
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let confirm: { ask: ReturnType<typeof vi.fn> };

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const tab = (label: string) =>
    Array.from(root().querySelectorAll<HTMLElement>('p-togglebutton, button')).find((el) =>
      el.textContent!.trim().startsWith(label))!;
  const buttonByText = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;
  const setup = async () => {
    toast = { success: vi.fn(), error: vi.fn() };
    confirm = { ask: vi.fn().mockResolvedValue(true) };
    await TestBed.configureTestingModule({
      imports: [ReceiptPendingPageComponent],
      providers: [
        MessageService, provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: confirm },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReceiptPendingPageComponent);
  };
  const load = async (pending: PendingReceiptLines = PENDING) => {
    await setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/pending`).flush(pending);
    await settle();
  };
  const newCards = () => fixture.debugElement.queryAll(By.directive(PendingNewProductCardComponent));
  const costCards = () => fixture.debugElement.queryAll(By.directive(PendingCostChangeCardComponent));

  afterEach(() => httpMock.verify());

  it('mientras carga muestra el título y esqueletos de tarjetas', async () => {
    await setup();
    fixture.detectChanges();
    expect(text()).toContain('Pendientes de remisiones');
    expect(root().querySelectorAll('p-skeleton').length).toBeGreaterThan(0);
    httpMock.expectOne(`${BASE}/pending`).flush(PENDING);
  });

  it('si la carga falla muestra el error y «Reintentar» vuelve a pedir', async () => {
    await setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/pending`).flush(...failure(500, 'x'));
    await settle();
    expect(text()).toContain('No pudimos cargar los pendientes');
    buttonByText('Reintentar').click();
    await settle();
    httpMock.expectOne(`${BASE}/pending`).flush(PENDING);
  });

  it('el selector muestra los contadores y empieza en «Productos nuevos»', async () => {
    await load();
    expect(text()).toContain('Productos nuevos (2)');
    expect(text()).toContain('Cambios de costo (1)');
    expect(newCards().length).toBe(2);
    expect(costCards().length).toBe(0);
  });

  it('cambiar a «Cambios de costo» muestra esas tarjetas', async () => {
    await load();
    tab('Cambios de costo').click();
    await settle();
    expect(costCards().length).toBe(1);
    expect(newCards().length).toBe(0);
  });

  it('si no hay productos nuevos pero sí cambios de costo, empieza en «Cambios de costo»', async () => {
    await load({ newProducts: [], costChanges: [COST] });
    expect(costCards().length).toBe(1);
  });

  it('un apartado vacío muestra su mensaje', async () => {
    await load({ newProducts: [], costChanges: [] });
    expect(text()).toContain('No hay productos nuevos pendientes');
    tab('Cambios de costo').click();
    await settle();
    expect(text()).toContain('No hay cambios de costo pendientes');
  });

  it('«Cargar remisión» abre la ventana', async () => {
    await load();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    buttonByText('Cargar remisión').click();
    expect(navigate).toHaveBeenCalledWith(receiptModalLink());
  });

  describe('descartar', () => {
    it('pide confirmación con el nombre y las piezas, descarta y quita la tarjeta sin recargar', async () => {
      await load();
      newCards()[0]!.componentInstance.discardRequested.emit();
      await settle();
      expect(confirm.ask).toHaveBeenCalledWith(expect.objectContaining({
        message: '¿Descartar Glutamina 500 g? Sus 3 piezas no entrarán a bodega.',
      }));
      const request = httpMock.expectOne(`${BASE}/lines/1/discard`);
      expect(request.request.method).toBe('POST');
      request.flush({ line: LINE });
      await settle();
      expect(toast.success).toHaveBeenCalledWith('Producto descartado');
      expect(newCards().length).toBe(1);
      expect(text()).toContain('Productos nuevos (1)');
    });

    it('si el administrador cancela no manda nada', async () => {
      await load();
      confirm.ask.mockResolvedValue(false);
      newCards()[0]!.componentInstance.discardRequested.emit();
      await settle();
      httpMock.expectNone(`${BASE}/lines/1/discard`);
      expect(newCards().length).toBe(2);
    });

    it('409 «Este pendiente ya se resolvió.» avisa con toast y recarga la lista', async () => {
      await load();
      newCards()[0]!.componentInstance.discardRequested.emit();
      await settle();
      httpMock.expectOne(`${BASE}/lines/1/discard`).flush(...failure(409, 'Este pendiente ya se resolvió.'));
      await settle();
      expect(toast.error).toHaveBeenCalledWith('Este pendiente ya se resolvió.');
      httpMock.expectOne(`${BASE}/pending`).flush({ newProducts: [NEW_B], costChanges: [COST] });
    });
  });

  describe('dar de alta', () => {
    const openDialog = async () => {
      newCards()[0]!.componentInstance.createRequested.emit();
      await settle();
      httpMock.expectOne(`${API_BASE_URL}/api/categories`).flush([{ id: 1, name: 'Proteínas' }]);
      await settle();
    };
    const dialog = () => fixture.debugElement.query(By.directive(NewProductDialogComponent));
    const save = async (payload: { name: string; price: string; categoryId: number | null; unitCost?: string }) => {
      dialog().componentInstance.saved.emit(payload);
      await settle();
      return httpMock.expectOne(`${BASE}/lines/1/product`);
    };

    it('abre el diálogo con las categorías', async () => {
      await load();
      await openDialog();
      expect(dialog()).not.toBeNull();
      expect(dialog().componentInstance.categories()).toEqual([{ id: 1, name: 'Proteínas' }]);
    });

    it('manda el alta y con 201 cierra, avisa del stock, quita la tarjeta y muestra el toast', async () => {
      await load();
      await openDialog();
      const request = await save({ name: 'Glutamina 500 g', price: '99.00', categoryId: 1 });
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ name: 'Glutamina 500 g', price: '99.00', categoryId: 1 });
      request.flush(
        { product: { id: 9, name: 'Glutamina 500 g' }, line: LINE, stock: { before: 0, after: 3 } },
        { status: 201, statusText: 'Created' },
      );
      await settle();
      expect(toast.success).toHaveBeenCalledWith('Glutamina 500 g dado de alta · Bodega 0 → 3');
      expect(TestBed.inject(StockChangesService).version()).toBe(1);
      expect(dialog()).toBeNull();
      expect(newCards().length).toBe(1);
    });

    it('un solo envío: con uno en curso, el diálogo recibe saving y no sale otra petición', async () => {
      await load();
      await openDialog();
      const request = await save({ name: 'A', price: '9', categoryId: null });
      expect(dialog().componentInstance.saving()).toBe(true);
      dialog().componentInstance.saved.emit({ name: 'A', price: '9', categoryId: null });
      await settle();
      request.flush(
        { product: { id: 9, name: 'A' }, line: LINE, stock: { before: 0, after: 3 } },
        { status: 201, statusText: 'Created' },
      );
    });

    it('409 DUPLICATE_NAME marca el error en el campo nombre y deja el diálogo abierto', async () => {
      await load();
      await openDialog();
      const request = await save({ name: 'Creatina', price: '9', categoryId: null });
      request.flush(...failure(409, 'Ya existe un producto con ese nombre.', 'DUPLICATE_NAME'));
      await settle();
      expect(dialog().componentInstance.nameError()).toBe('Ya existe un producto con ese nombre.');
    });

    it('422 muestra el mensaje arriba del formulario del diálogo', async () => {
      await load();
      await openDialog();
      const request = await save({ name: 'A', price: '1', categoryId: null });
      request.flush(...failure(422, 'El precio no puede ser menor que el costo.'));
      await settle();
      expect(dialog().componentInstance.formError()).toBe('El precio no puede ser menor que el costo.');
    });
  });

  describe('cambios de costo', () => {
    const toCosts = async () => {
      await load();
      tab('Cambios de costo').click();
      await settle();
    };
    const accept = async () => {
      costCards()[0]!.componentInstance.acceptRequested.emit();
      await settle();
    };

    it('aceptar pide confirmación, acepta, quita la tarjeta y avisa «Costo actualizado»', async () => {
      await toCosts();
      await accept();
      expect(confirm.ask).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('¿Cambiar el costo de fábrica de Creatina 300 g a $'),
      }));
      const request = httpMock.expectOne(`${BASE}/lines/3/cost/accept`);
      expect(request.request.method).toBe('POST');
      request.flush({ line: LINE, product: { id: 4, unitCost: '13.5000' } });
      await settle();
      expect(toast.success).toHaveBeenCalledWith('Costo actualizado');
      expect(costCards().length).toBe(0);
    });

    it('422 COST_ABOVE_PRICE avisa con el mensaje del backend y ofrece «Editar producto» en la tarjeta', async () => {
      await toCosts();
      await accept();
      httpMock.expectOne(`${BASE}/lines/3/cost/accept`).flush(...failure(422, 'El costo supera el precio.', 'COST_ABOVE_PRICE'));
      await settle();
      expect(toast.error).toHaveBeenCalledWith('El costo supera el precio.');
      expect(costCards()[0]!.componentInstance.showEditLink()).toBe(true);
    });

    it('409 PRODUCT_INACTIVE avisa con el mensaje y recarga la lista', async () => {
      await toCosts();
      await accept();
      httpMock.expectOne(`${BASE}/lines/3/cost/accept`).flush(...failure(409, 'El producto está desactivado.', 'PRODUCT_INACTIVE'));
      await settle();
      expect(toast.error).toHaveBeenCalledWith('El producto está desactivado.');
      httpMock.expectOne(`${BASE}/pending`).flush(PENDING);
    });

    it('rechazar no pide confirmación, rechaza, quita la tarjeta y avisa «Costo rechazado»', async () => {
      await toCosts();
      costCards()[0]!.componentInstance.rejectRequested.emit();
      await settle();
      expect(confirm.ask).not.toHaveBeenCalled();
      const request: TestRequest = httpMock.expectOne(`${BASE}/lines/3/cost/reject`);
      expect(request.request.method).toBe('POST');
      request.flush({ line: LINE });
      await settle();
      expect(toast.success).toHaveBeenCalledWith('Costo rechazado');
      expect(costCards().length).toBe(0);
    });

    it('404 al resolver avisa con el mensaje y recarga la lista', async () => {
      await toCosts();
      costCards()[0]!.componentInstance.rejectRequested.emit();
      await settle();
      httpMock.expectOne(`${BASE}/lines/3/cost/reject`).flush(...failure(404, 'No encontramos ese pendiente.'));
      await settle();
      expect(toast.error).toHaveBeenCalledWith('No encontramos ese pendiente.');
      httpMock.expectOne(`${BASE}/pending`).flush(PENDING);
    });
  });
});
