import { viewingSellerLabel } from './viewing-label';

describe('viewingSellerLabel', () => {
  it('con negocio es «Nombre · Negocio»', () => {
    expect(
      viewingSellerLabel({ id: 'v-1', fullName: 'Víctor Vendedor', businessName: 'Gimnasio Fuerza Norte' }),
    ).toBe('Víctor Vendedor · Gimnasio Fuerza Norte');
  });

  it('sin negocio es solo el nombre', () => {
    expect(viewingSellerLabel({ id: 'v-2', fullName: 'Valeria Vendedora', businessName: null })).toBe(
      'Valeria Vendedora',
    );
  });
});
