import { ComponentFixture, TestBed } from '@angular/core/testing';
import type {
  PreviewLine, ReceiptCatalogItem, ReceiptPreview,
} from '../../interfaces/receipt.models';
import { ReceiptPreviewFormComponent } from './receipt-preview-form.component';

const CATALOG: ReceiptCatalogItem[] = [
  { id: 1, name: 'Creatina 300 g', image: null, unitCost: '12.5000', units: 7 },
  { id: 2, name: 'Barra', image: null, unitCost: '1.0000', units: 40 },
];
const line = (over: Partial<PreviewLine>): PreviewLine => ({
  position: 1, readName: 'CREATINA', suggestedName: 'Creatina', qty: 1, unitCost: '12.5000', match: 'alias',
  product: { id: 1, name: 'Creatina 300 g', image: null, unitCost: '12.5000' }, costChanged: false, ...over,
});
const preview = (lines: PreviewLine[]): ReceiptPreview => ({
  source: 'pdf', lines, skipped: [],
  stock: [{ productId: 1, before: 7, after: 8 }, { productId: 2, before: 40, after: 40 }],
});

describe('ReceiptPreviewFormComponent con cantidades de 1', () => {
  let fixture: ComponentFixture<ReceiptPreviewFormComponent>;
  const text = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  const render = (lines: PreviewLine[]) => {
    fixture = TestBed.createComponent(ReceiptPreviewFormComponent);
    fixture.componentRef.setInput('preview', preview(lines));
    fixture.componentRef.setInput('catalog', CATALOG);
    fixture.componentRef.setInput('requestId', 'req-1');
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReceiptPreviewFormComponent] }).compileComponents();
  });

  it('con un renglón de una pieza la barra dice «1 renglón · 1 pieza» y 0 va en plural', () => {
    render([line({})]);
    expect(text()).toContain('1 renglón · 1 pieza · 0 productos nuevos · 0 cambios de costo');
  });

  it('con un producto nuevo y un cambio de costo la barra usa el singular', () => {
    render([
      line({ qty: 1, product: { id: 2, name: 'Barra', image: null, unitCost: '1.0000' }, unitCost: '2.0000', costChanged: true }),
      line({ position: 2, readName: 'NUEVO', qty: 4, unitCost: null, match: 'none', product: null }),
    ]);
    expect(text()).toContain('2 renglones · 5 piezas · 1 producto nuevo · 1 cambio de costo');
  });
});
