import { MODAL_EDIT_SELLER_PATH, MODAL_OUTLET } from '../constants/modal.constants';
import { editSellerModalLink } from './modal-links';

describe('Enlace de la ventana «Editar datos» del vendedor', () => {
  it('la ruta del outlet se llama «vendedor»', () => {
    expect(MODAL_EDIT_SELLER_PATH).toBe('vendedor');
  });

  it('lleva el id del vendedor en el outlet «ventana» y conserva la ruta primaria', () => {
    expect(editSellerModalLink('abc')).toEqual([
      '/admin',
      { outlets: { [MODAL_OUTLET]: [MODAL_EDIT_SELLER_PATH, 'abc'] } },
    ]);
  });
});
