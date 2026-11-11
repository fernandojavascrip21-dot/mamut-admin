import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { RestockHistoryItemView } from '../../models/restock-history-page.models';
import { RestockHistoryItemComponent } from './restock-history-item.component';

const ITEM: RestockHistoryItemView = {
  id: 12, closedLabel: 'Cerrado el 11 nov 2026', countsLabel: '3 productos · 42 piezas',
  estimatedTotal: '1234.50', note: 'Pedir antes del viernes',
};

describe('RestockHistoryItemComponent', () => {
  let fixture: ComponentFixture<RestockHistoryItemComponent>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const render = (item: RestockHistoryItemView) => {
    fixture = TestBed.createComponent(RestockHistoryItemComponent);
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestockHistoryItemComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra la fecha de cierre, los productos y piezas', () => {
    render(ITEM);
    expect(text()).toContain('Cerrado el 11 nov 2026');
    expect(text()).toContain('3 productos · 42 piezas');
  });

  it('muestra «Total estimado $1,234.50» con el total del backend', () => {
    render(ITEM);
    expect(text()).toContain('Total estimado');
    expect(text()).toContain('$1,234.50');
  });

  it('muestra la nota y, sin nota, no deja huecos con la palabra null', () => {
    render(ITEM);
    expect(text()).toContain('Pedir antes del viernes');
    render({ ...ITEM, note: null });
    expect(text()).not.toContain('null');
  });

  it('el renglón es un enlace al detalle del pedido', () => {
    render(ITEM);
    const link = root().querySelector('a')!;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toContain('resurtir/pedidos/12');
  });
});
