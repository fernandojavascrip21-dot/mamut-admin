import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { PendingCostChange } from '../../interfaces/receipt.models';
import { PendingCostChangeCardComponent } from './pending-cost-change-card.component';

const ITEM: PendingCostChange = {
  lineId: 7, receipt: { requestId: 'r-1', createdAt: '2026-11-10T18:00:00Z' },
  product: { id: 4, name: 'Creatina 300 g', image: null, active: true }, qty: 1,
  currentUnitCost: '12.0000', previousUnitCost: '11.0000', newUnitCost: '13.5000',
};

describe('PendingCostChangeCardComponent con una pieza', () => {
  let fixture: ComponentFixture<PendingCostChangeCardComponent>;
  const text = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PendingCostChangeCardComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(PendingCostChangeCardComponent);
    fixture.componentRef.setInput('item', ITEM);
    fixture.detectChanges();
  });

  it('dice «1 pieza recibida» en singular', () => {
    expect(text()).toContain('1 pieza recibida');
    expect(text()).not.toContain('1 piezas');
  });
});
