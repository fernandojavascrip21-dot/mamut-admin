import type { ReceiptLineFormValue } from '../components/receipt-preview-form/receipt-preview-form.models';
import type { PreviewLine, ReceiptCatalogItem, ReceiptPreview } from '../interfaces/receipt.models';
import { buildConfirmPayload, costChanged, stockAfter, stockBefore } from './receipt-preview.rules';

const CATALOG: ReceiptCatalogItem[] = [
  { id: 1, name: 'Creatina', image: null, unitCost: '12.5000', units: 10 },
  { id: 2, name: 'Barra', image: null, unitCost: '1.0000', units: 40 },
];
const PREVIEW: ReceiptPreview = {
  source: 'excel', lines: [], skipped: [], stock: [{ productId: 1, before: 7, after: 12 }],
};
const value = (productId: string, qty: string, unitCost = ''): ReceiptLineFormValue => ({ productId, qty, unitCost });

describe('stockBefore', () => {
  it('usa el «before» de la vista previa si viene', () => {
    expect(stockBefore(1, PREVIEW, CATALOG)).toBe(7);
  });

  it('si el producto se eligió a mano, usa las piezas del catálogo', () => {
    expect(stockBefore(2, PREVIEW, CATALOG)).toBe(40);
  });
});

describe('stockAfter', () => {
  it('suma las piezas de todos los renglones del mismo producto', () => {
    expect(stockAfter(1, PREVIEW, CATALOG, [value('1', '3'), value('2', '9'), value('1', '2')])).toBe(12);
  });

  it('con un producto elegido a mano parte de las piezas del catálogo', () => {
    expect(stockAfter(2, PREVIEW, CATALOG, [value('2', '5')])).toBe(45);
  });

  it('ignora las piezas inválidas', () => {
    expect(stockAfter(1, PREVIEW, CATALOG, [value('1', '3'), value('1', 'abc'), value('1', '')])).toBe(10);
  });
});

describe('costChanged', () => {
  it('12.5 contra 12.5000 no es un cambio', () => {
    expect(costChanged(value('1', '1', '12.5'), CATALOG[0]!)).toBe(false);
  });

  it('un costo distinto es un cambio', () => {
    expect(costChanged(value('1', '1', '13'), CATALOG[0]!)).toBe(true);
  });

  it('sin costo o sin producto no hay cambio', () => {
    expect(costChanged(value('1', '1', ''), CATALOG[0]!)).toBe(false);
    expect(costChanged(value('', '1', '13'), null)).toBe(false);
  });
});

describe('buildConfirmPayload', () => {
  const proposed = (position: number, readName: string): PreviewLine => ({
    position, readName, suggestedName: readName, qty: 1, unitCost: null, match: 'none', product: null, costChanged: false,
  });

  it('arma requestId, source y fileName con los renglones en el orden del formulario', () => {
    const payload = buildConfirmPayload({
      requestId: 'r-1', source: 'pdf', fileName: 'r.pdf',
      proposed: [proposed(1, ' Creatina '), proposed(2, 'Barra')],
      values: [value('1', '4', '12.5'), value('2', '2', '1')],
    });
    expect(payload).toEqual({
      requestId: 'r-1', source: 'pdf', fileName: 'r.pdf',
      lines: [
        { readName: ' Creatina ', qty: 4, unitCost: '12.5', productId: 1 },
        { readName: 'Barra', qty: 2, unitCost: '1', productId: 2 },
      ],
    });
  });

  it('«Producto nuevo» manda productId null y costo vacío manda unitCost null', () => {
    const payload = buildConfirmPayload({
      requestId: 'r-1', source: 'image', fileName: null, proposed: [proposed(1, 'Nuevo')], values: [value('', '3', '')],
    });
    expect(payload.lines).toEqual([{ readName: 'Nuevo', qty: 3, unitCost: null, productId: null }]);
  });
});
