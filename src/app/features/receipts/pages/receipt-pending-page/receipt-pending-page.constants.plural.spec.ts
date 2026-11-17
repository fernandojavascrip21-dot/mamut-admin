import { RECEIPT_PENDING_PAGE_TEXTS } from './receipt-pending-page.constants';

describe('RECEIPT_PENDING_PAGE_TEXTS.discardMessage con cantidades de 1', () => {
  it('con 1 pieza dice «Su 1 pieza no entrará a bodega»', () => {
    expect(RECEIPT_PENDING_PAGE_TEXTS.discardMessage('Glutamina 500 g', 1)).toBe(
      '¿Descartar Glutamina 500 g? Su 1 pieza no entrará a bodega.',
    );
  });

  it('con 0 piezas sigue en plural: «Sus 0 piezas no entrarán a bodega»', () => {
    expect(RECEIPT_PENDING_PAGE_TEXTS.discardMessage('Glutamina 500 g', 0)).toBe(
      '¿Descartar Glutamina 500 g? Sus 0 piezas no entrarán a bodega.',
    );
  });
});
