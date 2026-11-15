import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CreateProductFromLinePayload, PendingNewProduct } from '../../interfaces/receipt.models';
import { NewProductDialogComponent } from './new-product-dialog.component';

const ITEM: PendingNewProduct = {
  lineId: 9, receipt: { requestId: 'r-1', createdAt: '2026-11-10T18:00:00Z' },
  suggestedName: 'BLOOM SPARKLING ENERGY 12 OZ 12PK', qty: null, unitCost: '495.0000',
};
const WITH_QTY: PendingNewProduct = { ...ITEM, qty: 3 };

describe('NewProductDialogComponent con piezas por capturar', () => {
  let fixture: ComponentFixture<NewProductDialogComponent>;
  let saved: CreateProductFromLinePayload[];

  const root = () => document.body;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const field = (name: 'price' | 'qty') => root().querySelector<HTMLInputElement>(`input.receipt-${name}`);
  const type = (name: 'price' | 'qty', value: string) => {
    const input = field(name)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const submit = () => {
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Dar de alta')!.click();
    fixture.detectChanges();
  };
  const render = (item: PendingNewProduct) => {
    fixture = TestBed.createComponent(NewProductDialogComponent);
    fixture.componentRef.setInput('item', item);
    fixture.componentRef.setInput('categories', []);
    saved = [];
    fixture.componentInstance.saved.subscribe((payload) => saved.push(payload));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NewProductDialogComponent] }).compileComponents();
  });

  it('con qty null muestra el campo de piezas', () => {
    render(ITEM);
    expect(field('qty')).not.toBeNull();
  });

  it('con qty conocida no muestra el campo de piezas', () => {
    render(WITH_QTY);
    expect(field('qty')).toBeNull();
  });

  it('la nota de bodega no dice «null piezas»', () => {
    render(ITEM);
    expect(text()).not.toContain('null');
  });

  it('las piezas son obligatorias: vacío, 0, decimales o letras no emiten', () => {
    render(ITEM);
    type('price', '600');
    for (const bad of ['', '0', '2.5', 'abc', '-1']) {
      type('qty', bad);
      submit();
      expect(saved).toEqual([]);
    }
  });

  it('con piezas enteras emite el payload con qty como número', () => {
    render(ITEM);
    type('price', '600');
    type('qty', '6');
    submit();
    expect(saved).toEqual([{ name: 'BLOOM SPARKLING ENERGY 12 OZ 12PK', price: '600', categoryId: null, qty: 6 }]);
  });

  it('mantiene la regla en vivo de precio menor que el costo', () => {
    render(ITEM);
    type('price', '100');
    expect(text()).toContain('El precio es menor que el costo');
  });

  it('con qty conocida el payload no lleva qty', () => {
    render(WITH_QTY);
    type('price', '600');
    submit();
    expect(saved).toEqual([{ name: 'BLOOM SPARKLING ENERGY 12 OZ 12PK', price: '600', categoryId: null }]);
  });
});
