import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PendingNewProduct } from '../../interfaces/receipt.models';
import { PendingNewProductCardComponent } from './pending-new-product-card.component';

const ITEM: PendingNewProduct = {
  lineId: 9, receipt: { requestId: 'r-1', createdAt: '2026-11-10T18:00:00Z' },
  suggestedName: 'Glutamina 500 g', qty: 1, unitCost: '495.0000',
};

describe('PendingNewProductCardComponent con una pieza', () => {
  let fixture: ComponentFixture<PendingNewProductCardComponent>;
  const text = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [PendingNewProductCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(PendingNewProductCardComponent);
    fixture.componentRef.setInput('item', ITEM);
    fixture.detectChanges();
  });

  it('dice «1 pieza» en singular', () => {
    expect(text()).toContain('1 pieza');
    expect(text()).not.toContain('1 piezas');
  });
});
