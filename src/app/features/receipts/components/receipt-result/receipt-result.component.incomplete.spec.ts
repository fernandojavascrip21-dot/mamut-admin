import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Receipt, ReceiptLine } from '../../interfaces/receipt.models';
import { ReceiptResultComponent } from './receipt-result.component';

const line = (over: Partial<ReceiptLine>): ReceiptLine => ({
  id: 1, position: 1, readName: 'x', qty: 3, unitCost: '10.0000', status: 'received', costStatus: null,
  product: { id: 1, name: 'Creatina 300 g', image: null }, ...over,
});
const RECEIPT: Receipt = {
  requestId: 'r-1', source: 'excel', fileName: 'r.xlsx', createdAt: '2026-11-10T18:00:00Z',
  lines: [
    line({ id: 1 }),
    line({ id: 3, status: 'pending', product: null, readName: 'Nuevo A' }),
    line({ id: 4, costStatus: 'pending', product: { id: 3, name: 'Proteína', image: null } }),
    line({ id: 5, status: 'incomplete', qty: null as unknown as number, product: null, readName: 'Bloom' }),
  ],
  units: [{ productId: 1, units: 10 }, { productId: 3, units: 8 }],
};

describe('ReceiptResultComponent con renglones por completar', () => {
  let fixture: ComponentFixture<ReceiptResultComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const render = (receipt: Receipt) => {
    fixture = TestBed.createComponent(ReceiptResultComponent);
    fixture.componentRef.setInput('receipt', receipt);
    fixture.componentRef.setInput('stockBefore', { 1: 7, 3: 8 });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceiptResultComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('cuenta «1 por completar» en el aviso de pendientes', () => {
    render(RECEIPT);
    expect(text()).toContain('1 por completar');
  });

  it('el botón suma nuevos, costos y por completar: «Ver pendientes (3)»', () => {
    render(RECEIPT);
    const labels = Array.from(root().querySelectorAll('button')).map((b) => b.textContent!.trim());
    expect(labels).toContain('Ver pendientes (3)');
  });

  it('un por completar no cuenta como entrada registrada', () => {
    render(RECEIPT);
    expect(text()).toContain('2 entradas registradas');
  });

  it('con solo un por completar muestra el aviso y «Ver pendientes (1)»', () => {
    render({ ...RECEIPT, lines: [RECEIPT.lines[3]!], units: [] });
    expect(text()).toContain('1 por completar');
    expect(Array.from(root().querySelectorAll('button')).map((b) => b.textContent!.trim())).toContain('Ver pendientes (1)');
  });
});
