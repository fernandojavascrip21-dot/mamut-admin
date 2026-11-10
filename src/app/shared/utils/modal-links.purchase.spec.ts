import { MODAL_OUTLET, MODAL_PURCHASE_PATH } from '../constants/modal.constants';
import { purchaseModalLink } from './modal-links';

describe('Enlace de la ventana «Entrada a bodega»', () => {
  it('la ruta del outlet se llama «entrada»', () => {
    expect(MODAL_PURCHASE_PATH).toBe('entrada');
  });

  it('abre la ventana de la bodega sin parámetros', () => {
    expect(purchaseModalLink()).toEqual(['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_PURCHASE_PATH] } }]);
  });
});
