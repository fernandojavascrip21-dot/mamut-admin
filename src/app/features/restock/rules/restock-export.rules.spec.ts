import type { RestockOrder } from '../interfaces/restock.models';
import { buildExportDocument } from './restock-export.rules';

const CLOSED: RestockOrder = {
  id: 12, status: 'closed', note: 'Pedir antes del viernes', createdAt: '2026-11-09T18:00:00Z',
  updatedAt: '2026-11-12T05:30:00Z', closedAt: '2026-11-12T05:30:00Z', lineCount: 3, totalUnits: 42,
  estimatedTotal: '999.00', requestId: 'r-12',
  lines: [
    { product: { id: 1, name: 'Creatina 300 g', image: null }, qty: 30, unitCost: '12.5000' },
    { product: { id: 2, name: 'Proteína 2 kg', image: null }, qty: 10, unitCost: '10.0000' },
  ],
  customLines: [{ id: 5, name: 'Shaker ñandú', qty: 2, unitCost: '3.0000' }],
};
const DRAFT: RestockOrder = {
  ...CLOSED, id: 7, status: 'draft', note: null, closedAt: null, updatedAt: '2026-11-10T18:00:00Z',
};

describe('buildExportDocument', () => {
  it('el título es «Pedido de resurtir · Mammut Supplements»', () => {
    expect(buildExportDocument(CLOSED).title).toBe('Pedido de resurtir · Mammut Supplements');
  });

  it('un cerrado dice «Cerrado el <closedAt>» con la fecha de México', () => {
    expect(buildExportDocument(CLOSED).dateLabel).toBe('Cerrado el 11 nov 2026');
  });

  it('un borrador dice «Borrador guardado el <updatedAt>»', () => {
    expect(buildExportDocument(DRAFT).dateLabel).toBe('Borrador guardado el 10 nov 2026');
  });

  it('lleva la nota del pedido, o null si no tiene', () => {
    expect(buildExportDocument(CLOSED).note).toBe('Pedir antes del viernes');
    expect(buildExportDocument(DRAFT).note).toBeNull();
  });

  it('primero los renglones de catálogo y después los escritos a mano, con su nombre tal cual', () => {
    expect(buildExportDocument(CLOSED).rows).toEqual([
      { name: 'Creatina 300 g', qty: 30 },
      { name: 'Proteína 2 kg', qty: 10 },
      { name: 'Shaker ñandú', qty: 2 },
    ]);
  });

  it('el pie usa lineCount y totalUnits del backend', () => {
    expect(buildExportDocument(CLOSED).totalLabel).toBe('3 productos · 42 piezas');
  });

  it('el nombre del archivo usa el id y la fecha de cierre en México: 23:30 del 11 da 2026-11-11', () => {
    expect(buildExportDocument(CLOSED).fileName).toBe('pedido-resurtir-12-2026-11-11');
  });

  it('el nombre del archivo de un borrador usa la fecha del último guardado', () => {
    expect(buildExportDocument(DRAFT).fileName).toBe('pedido-resurtir-7-2026-11-10');
  });

  it('el documento no contiene ningún costo ni total estimado', () => {
    const serialized = JSON.stringify(buildExportDocument(CLOSED));
    expect(serialized).not.toContain('12.5');
    expect(serialized).not.toContain('999');
    expect(serialized).not.toMatch(/unitCost|subtotal|estimatedTotal|Total estimado/i);
    expect(Object.keys(buildExportDocument(CLOSED)).sort()).toEqual(
      ['dateLabel', 'fileName', 'note', 'rows', 'title', 'totalLabel'],
    );
  });
});
