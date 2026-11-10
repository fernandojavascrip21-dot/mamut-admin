import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StockQuickActionsComponent } from './stock-quick-actions.component';

describe('StockQuickActionsComponent · ícono «restock»', () => {
  let fixture: ComponentFixture<StockQuickActionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockQuickActionsComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(StockQuickActionsComponent);
  });

  it('«Resurtir» apunta a /admin/resurtir y dibuja su ícono', () => {
    fixture.componentRef.setInput('actions', [{ label: 'Resurtir', link: '/admin/resurtir', icon: 'restock' }]);
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a.quick-action') as HTMLAnchorElement;
    expect(link.textContent!.trim()).toBe('Resurtir');
    expect(link.getAttribute('href')).toBe('/admin/resurtir');
    expect(link.querySelector('svg')!.children.length).toBeGreaterThan(0);
  });

  it('el ícono de resurtir es distinto al de los demás movimientos', () => {
    const iconOf = (icon: string) => {
      fixture.componentRef.setInput('actions', [{ label: 'X', link: '/x', icon }]);
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('svg')!.innerHTML as string;
    };
    const restock = iconOf('restock');
    for (const other of ['entry', 'deliver', 'return', 'sell', 'new', 'fraction', 'shrinkage']) {
      expect(restock).not.toBe(iconOf(other));
    }
  });
});
