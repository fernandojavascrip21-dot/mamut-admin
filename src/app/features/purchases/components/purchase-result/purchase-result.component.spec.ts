import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Purchase } from '../../interfaces/purchase.models';
import { PurchaseResultComponent } from './purchase-result.component';

const PURCHASE: Purchase = {
  requestId: 'r-1',
  createdAt: '2026-11-09T10:00:00Z',
  qty: 5,
  product: { id: 10, name: 'Creatina 300 g', image: null },
  stock: { before: 3, after: 8 },
};

describe('PurchaseResultComponent', () => {
  let fixture: ComponentFixture<PurchaseResultComponent>;

  const render = (purchase: Purchase = PURCHASE) => {
    fixture = TestBed.createComponent(PurchaseResultComponent);
    fixture.componentRef.setInput('purchase', purchase);
    fixture.detectChanges();
  };
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent!.includes(label),
    )!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PurchaseResultComponent] }).compileComponents();
  });

  it('muestra el producto y las piezas que entraron', () => {
    render();
    expect(text()).toContain('Creatina 300 g');
    expect(text()).toContain('+ 5 piezas');
  });

  it('muestra el stock de la bodega antes → después tal como lo mandó el backend', () => {
    render();
    expect(text()).toContain('Stock de la bodega');
    expect(text()).toContain('3 → 8');
  });

  it('«Registrar otra» emite again y «Cerrar» emite closed', () => {
    render();
    let again = 0;
    let closed = 0;
    fixture.componentInstance.again.subscribe(() => again++);
    fixture.componentInstance.closed.subscribe(() => closed++);
    button('Registrar otra').click();
    button('Cerrar').click();
    expect(again).toBe(1);
    expect(closed).toBe(1);
  });
});
