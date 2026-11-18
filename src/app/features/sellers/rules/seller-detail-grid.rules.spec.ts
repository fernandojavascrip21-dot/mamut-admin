import {
  deliveryRows,
  returnRows,
  sellerDetailOptionLabel,
  shrinkageRows,
  stockRows,
} from './seller-detail-grid.rules';

describe('reglas del grid del detalle del vendedor', () => {
  it('una línea del stock lleva sus piezas sin signo, el precio y costo que le aplican y su acción', () => {
    const [general, own] = stockRows([
      {
        productId: 1, name: 'Creatina', image: null, units: 1, warehouseUnits: 1,
        price: '300.00', unitCost: '200.0000', unitPrice: null, unitCostWithShipping: null,
      },
      {
        productId: 2, name: 'Whey', image: null, units: 4, warehouseUnits: 8,
        price: '450.00', unitCost: '300.0000', unitPrice: '520.00', unitCostWithShipping: '310.5000',
      },
    ]);
    expect(general).toMatchObject({
      title: 'Creatina',
      actionId: '1',
      actionLabel: 'Editar Creatina',
      cells: {
        price: { value: '300.00', badge: null },
        cost: { value: '200.0000', badge: null },
        units: { value: '1 pieza' },
      },
    });
    expect(own!.cells).toMatchObject({
      price: { value: '520.00', badge: 'propio' },
      cost: { value: '310.5000', badge: 'propio' },
    });
  });

  it('una entrega suma piezas y, con requestId, enlaza a su resumen regresando al vendedor', () => {
    const [withSummary, withoutSummary] = deliveryRows([
      { requestId: 'r-1', createdAt: '2026-10-30T18:00:00.000Z', productId: 2, name: 'Whey', image: null, qty: 4 },
      { requestId: null, createdAt: '2026-10-29T18:00:00.000Z', productId: 1, name: 'Creatina', image: null, qty: 1 },
    ]);
    expect(withSummary).toMatchObject({
      link: ['/admin/entregas', 'r-1'],
      queryParams: { volver: 'vendedor' },
      cells: { date: { value: '2026-10-30T18:00:00.000Z' }, units: { value: '+4 piezas' } },
    });
    expect(withSummary!.actionId).toBeUndefined();
    expect(withoutSummary).toMatchObject({ link: null, queryParams: null, cells: { units: { value: '+1 pieza' } } });
  });

  it('un retiro resta piezas y enlaza al resumen bajo el vendedor solo con requestId', () => {
    const [withSummary, withoutSummary] = returnRows(
      [
        { requestId: 'rt-1', createdAt: '2026-10-31T10:00:00.000Z', productId: 2, name: 'Whey', image: null, qty: 2 },
        { requestId: null, createdAt: '2026-10-30T10:00:00.000Z', productId: 1, name: 'Creatina', image: null, qty: 1 },
      ],
      'v-1',
    );
    expect(withSummary).toMatchObject({
      link: ['/admin/vendedores/v-1/retiros', 'rt-1'],
      cells: { units: { value: '−2 piezas' } },
    });
    expect(withoutSummary!.link).toBeNull();
  });

  it('una merma resta piezas, lleva su motivo («Sin motivo» si falta) y nunca enlaza', () => {
    const [damaged, noReason] = shrinkageRows([
      {
        requestId: 'sh-1', createdAt: '2026-11-08T10:00:00.000Z', qty: 2, reason: 'damaged', reasonLabel: 'Dañado',
        holder: null, product: { id: 2, name: 'Whey', image: 'https://example.com/w.jpg' },
      },
      {
        requestId: null, createdAt: '2026-11-07T10:00:00.000Z', qty: 1, reason: null, reasonLabel: null,
        holder: null, product: { id: 1, name: 'Creatina', image: null },
      },
    ]);
    expect(damaged).toMatchObject({
      title: 'Whey',
      image: 'https://example.com/w.jpg',
      cells: { reason: { value: 'Dañado' }, units: { value: '−2 piezas' } },
    });
    expect(damaged!.link).toBeUndefined();
    expect(noReason!.cells['reason']!.value).toBe('Sin motivo');
  });

  it('dos movimientos iguales tienen llaves distintas', () => {
    const item = { requestId: null, createdAt: '2026-10-29T18:00:00.000Z', productId: 1, name: 'C', image: null, qty: 1 };
    const [a, b] = deliveryRows([item, item]);
    expect(a!.key).not.toBe(b!.key);
  });

  it('el texto de una opción lleva el conteo solo cuando la lista ya cargó', () => {
    expect(sellerDetailOptionLabel('Stock', 2)).toBe('Stock (2)');
    expect(sellerDetailOptionLabel('Mermas', 0)).toBe('Mermas (0)');
    expect(sellerDetailOptionLabel('Retiros', null)).toBe('Retiros');
  });
});
