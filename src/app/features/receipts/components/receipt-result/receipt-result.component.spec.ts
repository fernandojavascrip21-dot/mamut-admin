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
    line({ id: 2, qty: 5, product: { id: 2, name: 'Barra de avena', image: null } }),
    line({ id: 3, status: 'pending', product: null, readName: 'Nuevo A' }),
    line({ id: 4, costStatus: 'pending', product: { id: 3, name: 'Proteína', image: null } }),
  ],
  units: [{ productId: 1, units: 10 }, { productId: 2, units: 45 }, { productId: 3, units: 8 }],
};

describe('ReceiptResultComponent', () => {
  let fixture: ComponentFixture<ReceiptResultComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim().startsWith(label));
  const render = (receipt: Receipt) => {
    fixture = TestBed.createComponent(ReceiptResultComponent);
    fixture.componentRef.setInput('receipt', receipt);
    fixture.componentRef.setInput('stockBefore', { 1: 7, 2: 40, 3: 8 });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceiptResultComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('cuenta las entradas registradas (renglones recibidos)', () => {
    render(RECEIPT);
    expect(text()).toContain('3 entradas registradas');
  });

  it('por cada entrada muestra el producto, «+qty» y la bodega antes → después', () => {
    render(RECEIPT);
    expect(text()).toContain('Creatina 300 g');
    expect(text()).toContain('+3');
    expect(text()).toContain('Bodega 7 → 10');
    expect(text()).toContain('Barra de avena');
    expect(text()).toContain('+5');
    expect(text()).toContain('Bodega 40 → 45');
  });

  it('avisa de los productos nuevos y cambios de costo pendientes con «Ver pendientes (K + C)»', () => {
    render(RECEIPT);
    expect(text()).toContain('1 productos nuevos y 1 cambios de costo quedaron pendientes');
    expect(button('Ver pendientes (2)')).toBeDefined();
  });

  it('sin pendientes no muestra el aviso ni el botón', () => {
    render({ ...RECEIPT, lines: RECEIPT.lines.slice(0, 2) });
    expect(text()).not.toContain('quedaron pendientes');
    expect(button('Ver pendientes')).toBeUndefined();
  });

  it('«Ver pendientes», «Cargar otra remisión» y «Cerrar» emiten su salida', () => {
    render(RECEIPT);
    const events: string[] = [];
    fixture.componentInstance.pendingRequested.subscribe(() => events.push('pending'));
    fixture.componentInstance.another.subscribe(() => events.push('another'));
    fixture.componentInstance.closed.subscribe(() => events.push('closed'));
    button('Ver pendientes')!.click();
    button('Cargar otra remisión')!.click();
    button('Cerrar')!.click();
    expect(events).toEqual(['pending', 'another', 'closed']);
  });
});
