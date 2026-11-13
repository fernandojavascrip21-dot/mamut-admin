import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type {
  ConfirmReceiptPayload, PreviewLine, ReceiptCatalogItem, ReceiptPreview,
} from '../../interfaces/receipt.models';
import { ReceiptPreviewLineComponent } from '../receipt-preview-line/receipt-preview-line.component';
import { ReceiptPreviewFormComponent } from './receipt-preview-form.component';

const CATALOG: ReceiptCatalogItem[] = [
  { id: 1, name: 'Creatina 300 g', image: null, unitCost: '12.5000', units: 7 },
  { id: 2, name: 'Barra', image: null, unitCost: '1.0000', units: 40 },
];
const line = (over: Partial<PreviewLine>): PreviewLine => ({
  position: 1, readName: 'CREATINA', suggestedName: 'Creatina', qty: 3, unitCost: '12.5000', match: 'alias',
  product: { id: 1, name: 'Creatina 300 g', image: null, unitCost: '12.5000' }, costChanged: false, ...over,
});
const PREVIEW: ReceiptPreview = {
  source: 'pdf',
  lines: [
    line({}),
    line({ position: 2, readName: 'BARRA', qty: 2, unitCost: '2.0000', product: { id: 2, name: 'Barra', image: null, unitCost: '1.0000' }, costChanged: true }),
    line({ position: 3, readName: 'NUEVO', qty: 4, unitCost: null, match: 'none', product: null }),
  ],
  skipped: [{ position: 4, text: 'raro', reason: 'invalid_qty', label: 'Piezas no válidas' }],
  stock: [{ productId: 1, before: 7, after: 10 }, { productId: 2, before: 40, after: 42 }],
};

describe('ReceiptPreviewFormComponent', () => {
  let fixture: ComponentFixture<ReceiptPreviewFormComponent>;
  let confirmed: ConfirmReceiptPayload[];
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim().startsWith(label))!;
  const qtyInput = (index: number) => root().querySelectorAll<HTMLInputElement>('input.receipt-qty')[index]!;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const render = (preview: ReceiptPreview = PREVIEW, inputs: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(ReceiptPreviewFormComponent);
    fixture.componentRef.setInput('preview', preview);
    fixture.componentRef.setInput('catalog', CATALOG);
    fixture.componentRef.setInput('requestId', 'req-1');
    fixture.componentRef.setInput('fileName', 'remision.pdf');
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    confirmed = [];
    fixture.componentInstance.confirmed.subscribe((payload) => confirmed.push(payload));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReceiptPreviewFormComponent] }).compileComponents();
  });

  it('pinta un renglón por cada línea propuesta', () => {
    render();
    expect(fixture.debugElement.queryAll(By.directive(ReceiptPreviewLineComponent)).length).toBe(3);
  });

  it('la barra resume renglones, piezas, productos nuevos y cambios de costo', () => {
    render();
    expect(text()).toContain('3 renglones · 9 piezas · 1 productos nuevos · 1 cambios de costo');
  });

  it('la barra se recalcula al cambiar las piezas', () => {
    render();
    type(qtyInput(0), '10');
    expect(text()).toContain('16 piezas');
  });

  it('muestra los no leídos plegados y no los muestra si no hay', () => {
    render();
    expect(text()).toContain('No leídos (1)');
    render({ ...PREVIEW, skipped: [] });
    expect(text()).not.toContain('No leídos');
  });

  it('«Confirmar entrada» emite el payload con productId null para «Producto nuevo» y unitCost null sin costo', () => {
    render();
    button('Confirmar entrada').click();
    expect(confirmed).toEqual([{
      requestId: 'req-1', source: 'pdf', fileName: 'remision.pdf',
      lines: [
        { readName: 'CREATINA', qty: 3, unitCost: '12.5000', productId: 1 },
        { readName: 'BARRA', qty: 2, unitCost: '2.0000', productId: 2 },
        { readName: 'NUEVO', qty: 4, unitCost: null, productId: null },
      ],
    }]);
  });

  it('el payload refleja las piezas corregidas', () => {
    render();
    type(qtyInput(1), '9');
    button('Confirmar entrada').click();
    expect(confirmed[0]!.lines[1]!.qty).toBe(9);
  });

  it('con una pieza inválida no emite y muestra los errores en los renglones', () => {
    render();
    type(qtyInput(0), '0');
    button('Confirmar entrada').click();
    fixture.detectChanges();
    expect(confirmed).toEqual([]);
    expect(root().querySelector('.receipt-line-error')).not.toBeNull();
  });

  it('«Quitar» saca el renglón y el payload ya no lo lleva', () => {
    render();
    button('Quitar').click();
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.directive(ReceiptPreviewLineComponent)).length).toBe(2);
    button('Confirmar entrada').click();
    expect(confirmed[0]!.lines.map((l) => l.readName)).toEqual(['BARRA', 'NUEVO']);
  });

  it('quitar un renglón marca el formulario como modificado', () => {
    render();
    const events: boolean[] = [];
    fixture.componentInstance.dirtyChange.subscribe((dirty) => events.push(dirty));
    button('Quitar').click();
    expect(events).toContain(true);
  });

  it('sin renglones muestra «Quitaste todos los renglones» y deshabilita «Confirmar entrada»', () => {
    render();
    for (let i = 0; i < 3; i++) {
      button('Quitar').click();
      fixture.detectChanges();
    }
    expect(text()).toContain('Quitaste todos los renglones');
    expect(button('Confirmar entrada').disabled).toBe(true);
  });

  it('con disabled deshabilita «Confirmar entrada» y los campos', () => {
    render(PREVIEW, { disabled: true });
    expect(button('Confirmar entrada').disabled).toBe(true);
    expect(qtyInput(0).disabled).toBe(true);
  });
});
