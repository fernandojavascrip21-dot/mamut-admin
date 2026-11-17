import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Receipt, ReceiptLine } from '../../interfaces/receipt.models';
import { ReceiptResultComponent } from './receipt-result.component';

const line = (over: Partial<ReceiptLine>): ReceiptLine => ({
  id: 1, position: 1, readName: 'x', qty: 1, unitCost: '10.0000', status: 'received', costStatus: null,
  product: { id: 1, name: 'Creatina 300 g', image: null }, ...over,
});
// Una sola entrada (el renglón con cambio de costo también entra, porque se recibió), un producto nuevo
// y un cambio de costo: todas las cuentas en 1.
const RECEIPT: Receipt = {
  requestId: 'r-1', source: 'excel', fileName: 'r.xlsx', createdAt: '2026-11-10T18:00:00Z',
  lines: [
    line({ id: 4, costStatus: 'pending', product: { id: 3, name: 'Proteína', image: null } }),
    line({ id: 3, status: 'pending', product: null, readName: 'Nuevo A' }),
  ],
  units: [{ productId: 3, units: 8 }],
};

describe('ReceiptResultComponent con cantidades de 1', () => {
  let fixture: ComponentFixture<ReceiptResultComponent>;
  const text = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceiptResultComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ReceiptResultComponent);
    fixture.componentRef.setInput('receipt', RECEIPT);
    fixture.componentRef.setInput('stockBefore', { 3: 7 });
    fixture.detectChanges();
  });

  it('dice «1 entrada registrada» en singular', () => {
    expect(text()).toContain('1 entrada registrada');
    expect(text()).not.toContain('1 entradas');
  });

  it('pluraliza el resumen de pendientes: «1 producto nuevo y 1 cambio de costo»', () => {
    expect(text()).toContain('1 producto nuevo y 1 cambio de costo quedaron pendientes');
    expect(text()).not.toContain('1 productos nuevos');
    expect(text()).not.toContain('1 cambios de costo');
  });
});
