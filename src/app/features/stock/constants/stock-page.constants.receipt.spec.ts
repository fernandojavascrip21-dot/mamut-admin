import { receiptModalLink } from '@shared/utils/modal-links';
import { YO_QUICK_ACTIONS } from './stock-page.constants';

describe('YO_QUICK_ACTIONS · Cargar remisión (HU-42)', () => {
  it('receiptModalLink abre la ventana «remision» del outlet «ventana»', () => {
    expect(receiptModalLink()).toEqual(['/admin', { outlets: { ventana: ['remision'] } }]);
  });

  it('incluye «Cargar remisión» con receiptModalLink() y el ícono receipt', () => {
    expect(YO_QUICK_ACTIONS).toContainEqual({ label: 'Cargar remisión', link: receiptModalLink(), icon: 'receipt' });
  });

  it('va justo después de «Entrada a bodega»', () => {
    const labels = YO_QUICK_ACTIONS.map((action) => action.label);
    expect(labels.indexOf('Cargar remisión')).toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('Cargar remisión')).toBe(labels.indexOf('Entrada a bodega') + 1);
  });
});
