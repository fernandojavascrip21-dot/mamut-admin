import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { PendingCostChange } from '../../interfaces/receipt.models';
import { PendingCostChangeCardComponent } from './pending-cost-change-card.component';

const ITEM: PendingCostChange = {
  lineId: 7, receipt: { requestId: 'r-1', createdAt: '2026-11-10T18:00:00Z' },
  product: { id: 4, name: 'Creatina 300 g', image: null, active: true }, qty: 6,
  currentUnitCost: '12.0000', previousUnitCost: '11.0000', newUnitCost: '13.5000',
};

describe('PendingCostChangeCardComponent', () => {
  let fixture: ComponentFixture<PendingCostChangeCardComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;
  const render = (item: PendingCostChange, inputs: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(PendingCostChangeCardComponent);
    fixture.componentRef.setInput('item', item);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingCostChangeCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra el producto, las piezas recibidas y los tres costos', () => {
    render(ITEM);
    expect(text()).toContain('Creatina 300 g');
    expect(text()).toContain('6 piezas recibidas');
    expect(text()).toContain('Actual $12');
    expect(text()).toContain('Al recibir $11');
    expect(text()).toContain('Nuevo $13.5');
  });

  it('«Al recibir» solo aparece si difiere del actual', () => {
    render({ ...ITEM, previousUnitCost: '12.0000' });
    expect(text()).not.toContain('Al recibir');
  });

  it('un producto desactivado muestra «Desactivado» y «Aceptar costo nuevo» deshabilitado', () => {
    render({ ...ITEM, product: { ...ITEM.product, active: false } });
    expect(text()).toContain('Desactivado');
    expect(button('Aceptar costo nuevo').disabled).toBe(true);
  });

  it('«Aceptar costo nuevo» y «Rechazar» emiten su salida', () => {
    render(ITEM);
    const events: string[] = [];
    fixture.componentInstance.acceptRequested.subscribe(() => events.push('accept'));
    fixture.componentInstance.rejectRequested.subscribe(() => events.push('reject'));
    button('Aceptar costo nuevo').click();
    button('Rechazar').click();
    expect(events).toEqual(['accept', 'reject']);
  });

  it('con showEditLink aparece «Editar producto» hacia /admin/productos/4/editar', () => {
    render(ITEM, { showEditLink: true });
    const link = Array.from(root().querySelectorAll('a')).find((a) => a.textContent!.trim() === 'Editar producto');
    expect(link?.getAttribute('href')).toBe('/admin/productos/4/editar');
  });

  it('sin showEditLink no aparece «Editar producto»', () => {
    render(ITEM);
    expect(text()).not.toContain('Editar producto');
  });
});
