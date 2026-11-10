import { MODAL_OUTLET, MODAL_RESTOCK_PATH } from '../constants/modal.constants';
import { restockModalLink } from './modal-links';

describe('Enlace de la ventana «Lista de resurtir»', () => {
  it('la ruta del outlet se llama «resurtir»', () => {
    expect(MODAL_RESTOCK_PATH).toBe('resurtir');
  });

  it('abre la ventana de la bodega sin parámetros', () => {
    expect(restockModalLink()).toEqual(['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_RESTOCK_PATH] } }]);
  });
});
