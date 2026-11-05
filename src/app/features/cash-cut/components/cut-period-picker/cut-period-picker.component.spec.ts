import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { CutPeriodKind } from '../../interfaces/cash-cut.models';
import { CutPeriodPickerComponent } from './cut-period-picker.component';

describe('CutPeriodPickerComponent', () => {
  let fixture: ComponentFixture<CutPeriodPickerComponent>;
  let kinds: CutPeriodKind[];
  let offsets: number[];
  const el = () => fixture.nativeElement as HTMLElement;
  const button = (selector: string) => el().querySelector(selector) as HTMLButtonElement;
  // Opciones del selector de PrimeNG (p-togglebutton), en el orden Día, Semana, Mes.
  const option = (label: string) =>
    Array.from(el().querySelectorAll<HTMLElement>('p-togglebutton')).find((o) => o.textContent?.trim() === label)!;

  async function render(kind: CutPeriodKind, offset: number) {
    fixture = TestBed.createComponent(CutPeriodPickerComponent);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('offset', offset);
    fixture.componentRef.setInput('label', '2 al 8 nov');
    kinds = [];
    offsets = [];
    fixture.componentInstance.kindChange.subscribe((k) => kinds.push(k));
    fixture.componentInstance.offsetChange.subscribe((o) => offsets.push(o));
    fixture.detectChanges();
    // ngModel y el selector de PrimeNG propagan el valor en dos ciclos.
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutPeriodPickerComponent] }));

  it('muestra el texto del periodo y marca la clase elegida', async () => {
    await render('week', 0);
    expect(el().querySelector('.label')?.textContent?.trim()).toBe('2 al 8 nov');
    expect(option('Semana').getAttribute('aria-pressed')).toBe('true');
    expect(option('Día').getAttribute('aria-pressed')).toBe('false');
  });

  it('emite la clase al elegir otra, y nada si es la misma', async () => {
    await render('week', 0);
    option('Mes').click();
    option('Semana').click();
    expect(kinds).toEqual(['month']);
  });

  it('«Anterior» emite offset - 1', async () => {
    await render('week', -2);
    button('.previous').click();
    expect(offsets).toEqual([-3]);
  });

  it('«Siguiente» emite offset + 1 y está deshabilitado en el periodo actual', async () => {
    await render('week', -1);
    button('.next').click();
    expect(offsets).toEqual([0]);

    await render('week', 0);
    expect(button('.next').disabled).toBe(true);
    button('.next').click();
    expect(offsets).toEqual([]);
  });

  it('las flechas tienen nombre accesible', async () => {
    await render('day', -1);
    expect(button('.previous').getAttribute('aria-label')).toBe('Periodo anterior');
    expect(button('.next').getAttribute('aria-label')).toBe('Periodo siguiente');
  });
});
