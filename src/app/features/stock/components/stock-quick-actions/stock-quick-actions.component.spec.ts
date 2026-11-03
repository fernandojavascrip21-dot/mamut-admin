import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StockQuickActionsComponent } from './stock-quick-actions.component';

describe('StockQuickActionsComponent', () => {
  let fixture: ComponentFixture<StockQuickActionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StockQuickActionsComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(StockQuickActionsComponent);
  });

  it('pinta un enlace por acción, con su texto y su destino', () => {
    fixture.componentRef.setInput('actions', [
      { label: 'Entrada a bodega', link: '/admin/entrada', icon: 'entry' },
      { label: 'Nuevo producto', link: '/admin/productos/nuevo', icon: 'new' },
    ]);
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a.quick-action')) as HTMLAnchorElement[];
    expect(links.map((a) => a.textContent!.trim())).toEqual(['Entrada a bodega', 'Nuevo producto']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/admin/entrada', '/admin/productos/nuevo']);
  });

  it('con una lista vacía no pinta enlaces', () => {
    fixture.componentRef.setInput('actions', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('a')).toHaveLength(0);
  });
});
