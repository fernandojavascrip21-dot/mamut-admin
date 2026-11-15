import type { ReceiptLineFormValue } from '../components/receipt-preview-form/receipt-preview-form.models';
import type { IncompleteLine, PreviewLine } from '../interfaces/receipt.models';
import { buildConfirmPayload } from './receipt-preview.rules';

const PROPOSED: PreviewLine[] = [{
  position: 2, readName: 'Creatina', suggestedName: 'Creatina', qty: 3, unitCost: '12.5',
  match: 'none', product: null, costChanged: false,
}];
const VALUES: ReceiptLineFormValue[] = [{ productId: '', qty: '3', unitCost: '12.5' }];
const INCOMPLETE: IncompleteLine[] = [
  { position: 5, readName: 'BLOOM SPARKLING ENERGY 12 OZ 12PK', unitCost: '495.0000' },
  { position: 6, readName: 'Sin costo', unitCost: null },
];

describe('buildConfirmPayload con renglones por completar', () => {
  it('incluye incomplete con solo nombre leído y costo, tomados de la vista previa', () => {
    const payload = buildConfirmPayload({
      requestId: 'r-1', source: 'image', fileName: 'r.png', proposed: PROPOSED, values: VALUES, incomplete: INCOMPLETE,
    });
    expect(payload.incomplete).toEqual([
      { readName: 'BLOOM SPARKLING ENERGY 12 OZ 12PK', unitCost: '495.0000' },
      { readName: 'Sin costo', unitCost: null },
    ]);
  });

  it('los renglones quitados de la pantalla no afectan a incomplete', () => {
    const payload = buildConfirmPayload({
      requestId: 'r-1', source: 'image', fileName: null, proposed: PROPOSED, values: [], incomplete: INCOMPLETE,
    });
    expect(payload.lines).toEqual([]);
    expect(payload.incomplete).toHaveLength(2);
  });

  it('conserva lines, requestId, source y fileName como antes', () => {
    const payload = buildConfirmPayload({
      requestId: 'r-1', source: 'image', fileName: 'r.png', proposed: PROPOSED, values: VALUES, incomplete: INCOMPLETE,
    });
    expect(payload).toMatchObject({
      requestId: 'r-1', source: 'image', fileName: 'r.png',
      lines: [{ readName: 'Creatina', qty: 3, unitCost: '12.5', productId: null }],
    });
  });
});
