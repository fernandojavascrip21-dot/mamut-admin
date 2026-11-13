import { FormControl, FormGroup } from '@angular/forms';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PreviewLine, ReceiptCatalogItem } from '../../interfaces/receipt.models';
import { receiptQty, receiptUnitCost } from '../../validators/receipt-line.validators';
import { ReceiptPreviewLineComponent } from './receipt-preview-line.component';

const CATALOG: ReceiptCatalogItem[] = [
  { id: 1, name: 'Creatina 300 g', image: null, unitCost: '12.5000', units: 7 },
  { id: 2, name: 'Barra', image: null, unitCost: '1.0000', units: 40 },
];
const PROPOSED: PreviewLine = {
  position: 1, readName: 'CREATINA 300', suggestedName: 'Creatina 300', qty: 3, unitCost: '12.5',
  match: 'alias', product: { id: 1, name: 'Creatina 300 g', image: null, unitCost: '12.5000' }, costChanged: false,
};
const groupOf = (productId: string, qty: string, unitCost: string) =>
  new FormGroup({
    productId: new FormControl(productId, { nonNullable: true }),
    qty: new FormControl(qty, { nonNullable: true, validators: [receiptQty()] }),
    unitCost: new FormControl(unitCost, { nonNullable: true, validators: [receiptUnitCost()] }),
  });

describe('ReceiptPreviewLineComponent', () => {
  let fixture: ComponentFixture<ReceiptPreviewLineComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const render = (
    group = groupOf('1', '3', '12.5'),
    proposed: PreviewLine = PROPOSED,
    inputs: Record<string, unknown> = {},
  ) => {
    fixture = TestBed.createComponent(ReceiptPreviewLineComponent);
    fixture.componentRef.setInput('proposed', proposed);
    fixture.componentRef.setInput('group', group);
    fixture.componentRef.setInput('catalog', CATALOG);
    fixture.componentRef.setInput('stockBefore', 7);
    fixture.componentRef.setInput('stockAfter', 10);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return group;
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReceiptPreviewLineComponent] }).compileComponents();
  });

  it('muestra el nombre leído tal cual y la etiqueta «Reconocido»', () => {
    render();
    expect(text()).toContain('CREATINA 300');
    expect(text()).toContain('Reconocido');
  });

  it('si el administrador cambia el producto muestra «Elegido por ti»', () => {
    const group = render();
    group.controls.productId.setValue('2');
    fixture.detectChanges();
    expect(text()).toContain('Elegido por ti');
  });

  it('con «Producto nuevo» muestra el nombre sugerido y que quedará en pendientes', () => {
    render(groupOf('', '3', ''), { ...PROPOSED, match: 'none', product: null });
    expect(text()).toContain('Producto nuevo');
    expect(text()).toContain('Nombre sugerido: Creatina 300');
    expect(text()).toContain('Quedará en pendientes para darlo de alta');
  });

  it('con producto muestra «+N · Bodega X → Y» y sin producto no muestra bodega', () => {
    render();
    expect(text()).toContain('+3 · Bodega 7 → 10');
    const group = render(groupOf('', '3', ''), { ...PROPOSED, match: 'none', product: null }, {
      stockBefore: null, stockAfter: null,
    });
    expect(group.controls.productId.value).toBe('');
    expect(text()).not.toContain('Bodega');
  });

  it('con costo distinto del actual avisa «Costo distinto» y que quedará en pendientes', () => {
    render(groupOf('1', '3', '13'));
    expect(text()).toContain('Costo distinto');
    expect(text()).toContain('quedará en pendientes');
  });

  it('12.5 contra 12.5000 no avisa costo distinto, y se actualiza en vivo al escribir', () => {
    const group = render();
    expect(text()).not.toContain('Costo distinto');
    group.controls.unitCost.setValue('14');
    fixture.detectChanges();
    expect(text()).toContain('Costo distinto');
  });

  it('piezas y costo son campos de texto con inputmode numeric y decimal', () => {
    render();
    expect(root().querySelector<HTMLInputElement>('input.receipt-qty')!.getAttribute('inputmode')).toBe('numeric');
    const cost = root().querySelector<HTMLInputElement>('input.receipt-cost')!;
    expect(cost.type).toBe('text');
    expect(cost.getAttribute('inputmode')).toBe('decimal');
  });

  it('escribir en piezas y costo actualiza el formulario', () => {
    const group = render();
    const qty = root().querySelector<HTMLInputElement>('input.receipt-qty')!;
    qty.value = '8';
    qty.dispatchEvent(new Event('input'));
    const cost = root().querySelector<HTMLInputElement>('input.receipt-cost')!;
    cost.value = '9.5';
    cost.dispatchEvent(new Event('input'));
    expect(group.getRawValue()).toEqual({ productId: '1', qty: '8', unitCost: '9.5' });
  });

  it('los errores de campo solo se ven con showErrors', () => {
    render(groupOf('1', '0', '1.23456'));
    expect(root().querySelector('.receipt-line-error')).toBeNull();
    fixture.componentRef.setInput('showErrors', true);
    fixture.detectChanges();
    expect(root().querySelectorAll('.receipt-line-error').length).toBe(2);
  });

  it('«Quitar» emite removed', () => {
    render();
    let removed = 0;
    fixture.componentInstance.removed.subscribe(() => removed++);
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes('Quitar'))!.click();
    expect(removed).toBe(1);
  });

  it('si el catálogo falló muestra «No pudimos cargar los productos» y «Reintentar»', () => {
    render(undefined, PROPOSED, { catalogError: true });
    expect(text()).toContain('No pudimos cargar los productos');
    let retried = 0;
    fixture.componentInstance.catalogRetry.subscribe(() => retried++);
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === 'Reintentar')!.click();
    expect(retried).toBe(1);
  });
});
