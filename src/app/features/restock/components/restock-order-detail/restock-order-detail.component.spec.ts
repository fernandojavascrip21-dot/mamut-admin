import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { RestockOrder } from '../../interfaces/restock.models';
import { RestockOrderDetailComponent } from './restock-order-detail.component';

const ORDER: RestockOrder = {
  id: 12, status: 'closed', note: 'Pedir antes del viernes', createdAt: '2026-11-09T18:00:00Z',
  updatedAt: '2026-11-12T05:30:00Z', closedAt: '2026-11-12T05:30:00Z', lineCount: 3, totalUnits: 33,
  estimatedTotal: '999.00', requestId: 'r-12',
  lines: [
    { product: { id: 1, name: 'Creatina 300 g', image: null }, qty: 30, unitCost: '12.5000' },
  ],
  customLines: [
    { id: 5, name: 'Shaker', qty: 2, unitCost: '3.0000' },
    { id: 6, name: 'Bolsas', qty: 1, unitCost: null },
  ],
};

describe('RestockOrderDetailComponent', () => {
  let fixture: ComponentFixture<RestockOrderDetailComponent>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const render = (order: RestockOrder = ORDER) => {
    fixture = TestBed.createComponent(RestockOrderDetailComponent);
    fixture.componentRef.setInput('order', order);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RestockOrderDetailComponent] }).compileComponents();
  });

  it('el encabezado dice «Pedido del <createdAt>» y «Cerrado el <closedAt>» en hora de México', () => {
    render();
    expect(text()).toContain('Pedido del 9 nov 2026');
    expect(text()).toContain('Cerrado el 11 nov 2026');
  });

  it('muestra la nota encima de la tabla y la omite si no hay', () => {
    render();
    expect(text()).toContain('Pedir antes del viernes');
    render({ ...ORDER, note: null });
    expect(text()).not.toContain('Pedir antes del viernes');
  });

  it('la tabla tiene los encabezados «Producto», «Piezas» y «Costo unitario»', () => {
    render();
    const headers = Array.from(root().querySelectorAll('th')).map((th) => th.textContent!.trim());
    expect(headers).toEqual(expect.arrayContaining(['Producto', 'Piezas', 'Costo unitario']));
  });

  it('pinta un renglón por producto de catálogo y por escrito a mano, con piezas y costo guardado', () => {
    render();
    expect(text()).toContain('Creatina 300 g');
    expect(text()).toContain('30');
    expect(text()).toContain('12.50');
    expect(text()).toContain('Shaker');
    expect(text()).toContain('3.00');
  });

  it('un escrito a mano lleva la etiqueta «Escrito a mano» y, sin costo, «Sin costo»', () => {
    render();
    expect(text().match(/Escrito a mano/g)).toHaveLength(2);
    expect(text().match(/Sin costo/g)).toHaveLength(1);
  });

  it('es solo lectura: no hay campos editables ni subtotales por renglón', () => {
    render();
    expect(root().querySelector('table')).not.toBeNull();
    expect(root().querySelectorAll('input, textarea, select')).toHaveLength(0);
    expect(text()).not.toContain('375.00');
  });
});
