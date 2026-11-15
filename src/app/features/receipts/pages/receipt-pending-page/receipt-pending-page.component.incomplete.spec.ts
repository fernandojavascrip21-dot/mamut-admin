import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { API_BASE_URL } from '@core/api-base-url';
import { ConfirmService } from '@core/confirm/confirm.service';
import { ToastService } from '@core/toast/toast.service';
import { PendingNewProductCardComponent } from '../../components/pending-new-product-card/pending-new-product-card.component';
import type { PendingNewProduct, PendingReceiptLines } from '../../interfaces/receipt.models';
import { ReceiptPendingPageComponent } from './receipt-pending-page.component';

const BASE = `${API_BASE_URL}/api/receipts`;
const RECEIPT = { requestId: 'r-1', createdAt: '2026-11-10T18:00:00Z' };
const NEW_A: PendingNewProduct = { lineId: 1, receipt: RECEIPT, suggestedName: 'Glutamina 500 g', qty: 3, unitCost: '10.5000' };
const BLOOM: PendingNewProduct = {
  lineId: 7, receipt: RECEIPT, suggestedName: 'BLOOM SPARKLING ENERGY 12 OZ 12PK', qty: null, unitCost: '495.0000',
};

describe('ReceiptPendingPageComponent con renglones por completar', () => {
  let fixture: ComponentFixture<ReceiptPendingPageComponent>;
  let httpMock: HttpTestingController;

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
  const cards = () => fixture.debugElement.queryAll(By.directive(PendingNewProductCardComponent));
  const load = async (pending: PendingReceiptLines) => {
    await TestBed.configureTestingModule({
      imports: [ReceiptPendingPageComponent],
      providers: [
        MessageService, provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ConfirmService, useValue: { ask: vi.fn().mockResolvedValue(true) } },
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ReceiptPendingPageComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/pending`).flush(pending);
    await settle();
  };

  afterEach(() => httpMock.verify());

  it('el selector muestra un tercer apartado «Por completar (P)»', async () => {
    await load({ newProducts: [NEW_A], costChanges: [], incompleteProducts: [BLOOM] });
    expect(text()).toContain('Productos nuevos (1)');
    expect(text()).toContain('Cambios de costo (0)');
    expect(text()).toContain('Por completar (1)');
  });

  it('al elegir «Por completar» muestra las tarjetas con «Piezas por capturar»', async () => {
    await load({ newProducts: [NEW_A], costChanges: [], incompleteProducts: [BLOOM] });
    tab('Por completar').click();
    await settle();
    expect(cards().length).toBe(1);
    expect(text()).toContain('BLOOM SPARKLING ENERGY 12 OZ 12PK');
    expect(text()).toContain('Piezas por capturar');
  });

  it('sin por completar muestra «No hay productos por completar»', async () => {
    await load({ newProducts: [NEW_A], costChanges: [], incompleteProducts: [] });
    tab('Por completar').click();
    await settle();
    expect(text()).toContain('No hay productos por completar');
  });

  it('empieza en «Por completar» si es el único apartado con contenido', async () => {
    await load({ newProducts: [], costChanges: [], incompleteProducts: [BLOOM] });
    expect(cards().length).toBe(1);
    expect(text()).toContain('Piezas por capturar');
  });

  it('«Dar de alta» sobre un por completar abre el diálogo con el campo de piezas', async () => {
    await load({ newProducts: [], costChanges: [], incompleteProducts: [BLOOM] });
    httpMock.expectNone(`${BASE}/lines/7/product`);
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Dar de alta')!.click();
    await settle();
    httpMock.expectOne(`${API_BASE_URL}/api/categories`).flush([]);
    await settle();
    expect(document.body.querySelector('input.receipt-qty')).not.toBeNull();
  });
});
