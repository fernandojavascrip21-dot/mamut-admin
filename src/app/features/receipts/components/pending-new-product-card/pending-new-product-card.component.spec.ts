import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PendingNewProduct } from '../../interfaces/receipt.models';
import { PendingNewProductCardComponent } from './pending-new-product-card.component';

const ITEM: PendingNewProduct = {
  lineId: 5, receipt: { requestId: 'r-1', createdAt: '2026-11-10T03:00:00Z' }, suggestedName: 'Glutamina 500 g',
  qty: 3, unitCost: '10.5000',
};

describe('PendingNewProductCardComponent', () => {
  let fixture: ComponentFixture<PendingNewProductCardComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;
  const render = (item: PendingNewProduct) => {
    fixture = TestBed.createComponent(PendingNewProductCardComponent);
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PendingNewProductCardComponent] }).compileComponents();
  });

  it('muestra el nombre sugerido, las piezas y el costo leído', () => {
    render(ITEM);
    expect(text()).toContain('Glutamina 500 g');
    expect(text()).toContain('3 piezas');
    expect(text()).toContain('Costo leído $10');
  });

  it('sin costo leído muestra «Sin costo leído»', () => {
    render({ ...ITEM, unitCost: null });
    expect(text()).toContain('Sin costo leído');
  });

  it('muestra «Remisión del» con la fecha en la zona de Ciudad de México (9 nov, no 10)', () => {
    render(ITEM);
    expect(text()).toMatch(/Remisión del.*\b9\b/);
  });

  it('«Dar de alta» y «Descartar» emiten su salida', () => {
    render(ITEM);
    const events: string[] = [];
    fixture.componentInstance.createRequested.subscribe(() => events.push('create'));
    fixture.componentInstance.discardRequested.subscribe(() => events.push('discard'));
    button('Dar de alta').click();
    button('Descartar').click();
    expect(events).toEqual(['create', 'discard']);
  });

  it('con busy los botones quedan deshabilitados', () => {
    render(ITEM);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(button('Dar de alta').disabled).toBe(true);
    expect(button('Descartar').disabled).toBe(true);
  });
});
