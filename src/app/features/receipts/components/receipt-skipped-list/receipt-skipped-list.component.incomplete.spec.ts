import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { SkippedLine } from '../../interfaces/receipt.models';
import { ReceiptSkippedListComponent } from './receipt-skipped-list.component';

const NOTE = 'Se guardará en Por completar con su costo leído';
const SKIPPED: SkippedLine[] = [
  { position: 3, text: 'BLOOM SPARKLING ENERGY 12 OZ 12PK', reason: 'invalid_qty', label: 'Piezas no válidas' },
  { position: 5, text: 'Sin nombre', reason: 'missing_name', label: 'Falta el nombre' },
  { position: 6, text: 'Costo raro', reason: 'invalid_cost', label: 'Costo no válido' },
];

describe('ReceiptSkippedListComponent con renglones por completar', () => {
  let fixture: ComponentFixture<ReceiptSkippedListComponent>;
  const text = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReceiptSkippedListComponent] }).compileComponents();
    fixture = TestBed.createComponent(ReceiptSkippedListComponent);
    fixture.componentRef.setInput('skipped', SKIPPED);
    fixture.detectChanges();
  });

  it('un invalid_qty muestra la nota «Se guardará en Por completar con su costo leído»', () => {
    expect(text()).toContain(NOTE);
  });

  it('la nota aparece solo una vez: los otros motivos no la llevan', () => {
    expect(text().split(NOTE).length - 1).toBe(1);
  });

  it('sigue siendo solo lectura', () => {
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('button, input').length).toBe(0);
  });
});
