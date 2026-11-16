import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PendingNewProduct } from '../../interfaces/receipt.models';
import { NewProductDialogComponent } from './new-product-dialog.component';

const ITEM: PendingNewProduct = {
  lineId: 5, receipt: { requestId: 'r-1', createdAt: '2026-11-10T18:00:00Z' }, suggestedName: 'Glutamina 500 g',
  qty: 1, unitCost: '10.5000',
};
const CATEGORIES = [{ id: 1, name: 'Proteínas' }];

describe('NewProductDialogComponent con una pieza', () => {
  let fixture: ComponentFixture<NewProductDialogComponent>;
  const text = () => (document.body.textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NewProductDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(NewProductDialogComponent);
    fixture.componentRef.setInput('item', ITEM);
    fixture.componentRef.setInput('categories', CATEGORIES);
    fixture.detectChanges();
  });

  it('la nota dice «Entrará 1 pieza a bodega» en singular', () => {
    expect(text()).toContain('Entrará 1 pieza a bodega. La foto se agrega después en Editar producto.');
  });
});
