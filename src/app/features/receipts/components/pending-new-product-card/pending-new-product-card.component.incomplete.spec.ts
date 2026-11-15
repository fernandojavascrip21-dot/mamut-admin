import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PendingNewProduct } from '../../interfaces/receipt.models';
import { PendingNewProductCardComponent } from './pending-new-product-card.component';

const ITEM: PendingNewProduct = {
  lineId: 9, receipt: { requestId: 'r-1', createdAt: '2026-11-10T18:00:00Z' },
  suggestedName: 'BLOOM SPARKLING ENERGY 12 OZ 12PK', qty: null, unitCost: '495.0000',
};

describe('PendingNewProductCardComponent con piezas por capturar', () => {
  let fixture: ComponentFixture<PendingNewProductCardComponent>;
  const text = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PendingNewProductCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(PendingNewProductCardComponent);
    fixture.componentRef.setInput('item', ITEM);
    fixture.detectChanges();
  });

  it('con qty null muestra «Piezas por capturar» en vez de «N piezas»', () => {
    expect(text()).toContain('Piezas por capturar');
    expect(text()).not.toContain('null piezas');
  });

  it('sigue mostrando el nombre y el costo leído', () => {
    expect(text()).toContain('BLOOM SPARKLING ENERGY 12 OZ 12PK');
    expect(text()).toContain('Costo leído $495');
  });
});
