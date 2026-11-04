import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LowStockAlertComponent } from './low-stock-alert.component';
import type { LowStockAlertItem } from './low-stock-alert.models';

const ITEMS: LowStockAlertItem[] = [
  { key: '1-luis', name: 'Whey 2 lb', holder: 'Luis', units: 0, stockLevel: 'out' },
  { key: '2-warehouse', name: 'Creatina 300 g', holder: 'Bodega', units: 1, stockLevel: 'low' },
];

describe('LowStockAlertComponent', () => {
  let fixture: ComponentFixture<LowStockAlertComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  function render(title: string, items: LowStockAlertItem[] = ITEMS) {
    fixture.componentRef.setInput('title', title);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LowStockAlertComponent] }).compileComponents();
    fixture = TestBed.createComponent(LowStockAlertComponent);
  });

  it('muestra el título que recibe, en plural y en singular', () => {
    render('3 productos con baja existencia');
    expect(text('.title')).toBe('3 productos con baja existencia');
    render('1 producto con baja existencia');
    expect(text('.title')).toBe('1 producto con baja existencia');
  });

  it('cada renglón lleva nombre, titular y piezas', () => {
    render('2 productos con baja existencia');
    const rows = el().querySelectorAll('.item');
    expect(rows).toHaveLength(2);
    expect(rows[1].querySelector('.name')?.textContent?.trim()).toBe('Creatina 300 g');
    expect(rows[1].querySelector('.holder')?.textContent).toContain('Bodega');
    expect(rows[1].querySelector('.units')?.textContent?.trim()).toBe('1');
  });

  it('el renglón agotado dice «Agotado» con texto y el de baja existencia no', () => {
    render('2 productos con baja existencia');
    const rows = el().querySelectorAll('.item');
    expect(rows[0].querySelector('.out')?.textContent?.trim()).toBe('Agotado');
    expect(rows[1].querySelector('.out')).toBeNull();
  });
});
