import { MODAL_FRACTION_PATH, MODAL_OUTLET } from '../constants/modal.constants';
import { fractionModalLink } from './modal-links';

describe('Enlace de la ventana «Fraccionar»', () => {
  it('la ruta del outlet se llama «fraccionar»', () => {
    expect(MODAL_FRACTION_PATH).toBe('fraccionar');
  });

  it('sin producto abre la ventana en el outlet sin parámetros matriciales', () => {
    expect(fractionModalLink()).toEqual(['/admin', { outlets: { [MODAL_OUTLET]: [MODAL_FRACTION_PATH, {}] } }]);
  });

  it('con producto lo manda como matricial «producto», igual que «dejar»', () => {
    expect(fractionModalLink({ productId: 7 })).toEqual([
      '/admin',
      { outlets: { [MODAL_OUTLET]: [MODAL_FRACTION_PATH, { producto: 7 }] } },
    ]);
  });
});
