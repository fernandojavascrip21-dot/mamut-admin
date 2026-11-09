import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { FractionHistoryLineItem } from './fraction-history-line.models';
import { FractionHistoryLineComponent } from './fraction-history-line.component';

// 03:30 UTC del 8 de noviembre = 21:30 del 7 en America/Mexico_City.
const ITEM: FractionHistoryLineItem = {
  id: 1,
  requestId: 'r-1',
  createdAt: '2026-11-08T03:30:00Z',
  portions: 7,
  wholeUnitCost: '450.0000',
  portionUnitCost: '64.2857',
  portionPrice: '85.00',
  product: { id: 10, name: 'Creatina 300 g' },
  portionProduct: { id: 11, name: 'Creatina 300 g · bolsita 30 g' },
  createdBy: { id: 'a-1', name: 'Ana Admin' },
};

describe('FractionHistoryLineComponent', () => {
  let fixture: ComponentFixture<FractionHistoryLineComponent>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  const render = (item: FractionHistoryLineItem = ITEM) => {
    fixture = TestBed.createComponent(FractionHistoryLineComponent);
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
  };

  beforeEach(() => TestBed.configureTestingModule({ imports: [FractionHistoryLineComponent] }));

  it('muestra el entero y la bolsita', () => {
    render();
    expect(text()).toContain('Creatina 300 g');
    expect(text()).toContain('Creatina 300 g · bolsita 30 g');
  });

  it('muestra «1 entero → 7 bolsitas»', () => {
    render();
    expect(text()).toContain('1 entero → 7 bolsitas');
  });

  it('muestra el costo por bolsita en centavos y el precio que quedó', () => {
    render();
    expect(text()).toContain('$64.29');
    expect(text()).toContain('$85.00');
  });

  it('muestra quién lo hizo', () => {
    render();
    expect(text()).toContain('Ana Admin');
  });

  it('muestra la fecha y la hora en America/Mexico_City, no en UTC', () => {
    render();
    expect(text()).toMatch(/21:30|9:30/);
    expect(text()).not.toContain('03:30');
  });

  it('con un producto desactivado sigue mostrando su nombre', () => {
    render({ ...ITEM, product: { id: 10, name: 'Creatina vieja' } });
    expect(text()).toContain('Creatina vieja');
  });
});
