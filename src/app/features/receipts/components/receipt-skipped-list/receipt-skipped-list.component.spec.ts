import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { SkippedLine } from '../../interfaces/receipt.models';
import { ReceiptSkippedListComponent } from './receipt-skipped-list.component';

const SKIPPED: SkippedLine[] = [
  { position: 3, text: 'Algo raro 2', reason: 'invalid_qty', label: 'Piezas no válidas' },
  { position: 5, text: 'Sin nombre', reason: 'missing_name', label: 'Falta el nombre' },
];

describe('ReceiptSkippedListComponent', () => {
  let fixture: ComponentFixture<ReceiptSkippedListComponent>;
  const text = () => ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');
  const render = (skipped: SkippedLine[]) => {
    fixture = TestBed.createComponent(ReceiptSkippedListComponent);
    fixture.componentRef.setInput('skipped', skipped);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReceiptSkippedListComponent] }).compileComponents();
  });

  it('muestra «No leídos (N)» con el texto y la etiqueta de cada uno', () => {
    render(SKIPPED);
    expect(text()).toContain('No leídos (2)');
    for (const line of SKIPPED) {
      expect(text()).toContain(line.text);
      expect(text()).toContain(line.label);
    }
  });

  it('no pinta nada si no hay no leídos', () => {
    render([]);
    expect(text()).not.toContain('No leídos');
  });

  it('es solo lectura: no tiene botones ni campos', () => {
    render(SKIPPED);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('button, input').length).toBe(0);
  });
});
