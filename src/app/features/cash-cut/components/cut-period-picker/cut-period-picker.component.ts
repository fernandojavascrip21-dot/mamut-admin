import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import type { CutPeriodKind } from '../../interfaces/cash-cut.models';
import { CUT_PERIOD_KIND_OPTIONS, CUT_PERIOD_PICKER_TEXTS } from './cut-period-picker.constants';

// Selector de periodo del corte (HU-19): Día / Semana / Mes y las flechas «‹ Anterior / Siguiente ›».
// Solo presenta: la página guarda la clase y el desplazamiento y calcula el texto del periodo.
// `offset` 0 es el periodo actual y -1 el anterior; «Siguiente» no pasa del actual porque no se
// cortan periodos futuros.
@Component({
  imports: [ButtonDirective, FormsModule, SelectButton],
  selector: 'app-cut-period-picker',
  templateUrl: './cut-period-picker.component.html',
})
export class CutPeriodPickerComponent {
  readonly texts = CUT_PERIOD_PICKER_TEXTS;
  readonly kindOptions = CUT_PERIOD_KIND_OPTIONS;

  readonly kind = input.required<CutPeriodKind>();
  readonly offset = input.required<number>();
  // Texto ya armado del periodo («2 al 8 nov»).
  readonly label = input.required<string>();

  // Emite la clase elegida; la página vuelve al periodo actual de esa clase.
  readonly kindChange = output<CutPeriodKind>();
  // Emite el desplazamiento nuevo (offset - 1 o offset + 1).
  readonly offsetChange = output<number>();

  selectKind(kind: CutPeriodKind): void {
    if (kind !== this.kind()) this.kindChange.emit(kind);
  }

  previous(): void {
    this.offsetChange.emit(this.offset() - 1);
  }

  next(): void {
    if (this.offset() < 0) this.offsetChange.emit(this.offset() + 1);
  }
}
