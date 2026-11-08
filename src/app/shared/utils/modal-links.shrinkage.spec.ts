import { MODAL_OUTLET, MODAL_SHRINKAGE_PATH } from '../constants/modal.constants';
import { shrinkageModalLink } from './modal-links';

describe('Enlace de la ventana «Registrar merma»', () => {
  it('la ruta del outlet se llama «merma»', () => {
    expect(MODAL_SHRINKAGE_PATH).toBe('merma');
  });

  it('sin vendedor abre la ventana de la bodega sin parámetros matriciales', () => {
    expect(shrinkageModalLink()).toEqual(['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_SHRINKAGE_PATH, {}] } }]);
  });

  it('con vendedor lo manda como matricial «vendedor», igual que «dejar»', () => {
    expect(shrinkageModalLink({ sellerId: 'v-1' })).toEqual([
      '/admin',
      { outlets: { [MODAL_OUTLET]: [MODAL_SHRINKAGE_PATH, { vendedor: 'v-1' }] } },
    ]);
  });
});
