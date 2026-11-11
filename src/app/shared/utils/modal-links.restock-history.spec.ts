import { MODAL_OUTLET, MODAL_RESTOCK_HISTORY_PATH, MODAL_RESTOCK_PATH } from '../constants/modal.constants';
import { restockHistoryModalLink, restockModalLink, restockOrderModalLink } from './modal-links';

describe('Enlaces de «Pedidos anteriores» (HU-32)', () => {
  it('la ruta del outlet se llama «resurtir/pedidos»', () => {
    expect(MODAL_RESTOCK_HISTORY_PATH).toBe('resurtir/pedidos');
  });

  it('restockHistoryModalLink abre la lista sin parámetros', () => {
    expect(restockHistoryModalLink()).toEqual(['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_RESTOCK_HISTORY_PATH] } }]);
  });

  it('restockOrderModalLink abre el detalle con el id del pedido', () => {
    expect(restockOrderModalLink(12)).toEqual(['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_RESTOCK_HISTORY_PATH, 12] } }]);
  });

  it('restockModalLink con baseId lleva el parámetro matricial base', () => {
    expect(restockModalLink({ baseId: 12 })).toEqual([
      '/admin',
      { outlets: { [MODAL_OUTLET]: [MODAL_RESTOCK_PATH, { base: 12 }] } },
    ]);
  });

  it('restockModalLink sin parámetros no cambia', () => {
    expect(restockModalLink()).toEqual(['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_RESTOCK_PATH] } }]);
    expect(restockModalLink({})).toEqual(['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_RESTOCK_PATH] } }]);
  });
});
