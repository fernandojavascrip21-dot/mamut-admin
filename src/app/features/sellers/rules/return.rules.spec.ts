import { previewReturnBalances } from './return.rules';

describe('previewReturnBalances', () => {
  it('baja las piezas del vendedor y sube las de la bodega', () => {
    expect(previewReturnBalances(6, 4, 2)).toEqual({ seller: 4, warehouse: 6 });
  });

  it('retirar todo deja al vendedor en 0', () => {
    expect(previewReturnBalances(6, 4, 6)).toEqual({ seller: 0, warehouse: 10 });
  });

  it('el total del negocio no cambia', () => {
    const { seller, warehouse } = previewReturnBalances(7, 3, 5);
    expect(seller + warehouse).toBe(10);
  });
});
