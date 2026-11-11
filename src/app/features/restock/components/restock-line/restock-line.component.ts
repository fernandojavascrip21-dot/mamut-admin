import { Component, input, output, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';
import { STOCK_LEVEL_LABELS } from '@shared/constants/stock-level.constants';
import { newUuid } from '@shared/utils/uuid';
import { initialsOf } from '@shared/utils/initials';
import { unitsLabel } from '@shared/utils/units-label';
import type { RestockLineFormGroup } from '../restock-form/restock-form.models';
import { RESTOCK_LINE_TEXTS } from './restock-line.constants';
import type { RestockLineView } from './restock-line.models';

// Un renglón del pedido de resurtir. Es presentacional: el valor vive en `group` (el formulario de
// la lista) y solo emite «Quitar». Los errores de Piezas y Costo se pintan solo cuando la lista ya
// intentó enviarse (`showErrors`), y se borran solos al corregir el campo.
@Component({
  imports: [ReactiveFormsModule, ButtonDirective, InputText, Tag],
  selector: 'app-restock-line',
  templateUrl: './restock-line.component.html',
})
export class RestockLineComponent {
  readonly group = input.required<RestockLineFormGroup>();
  readonly view = input.required<RestockLineView>();
  readonly showErrors = input(false);
  readonly existsInCatalog = input(false);
  readonly duplicateName = input(false);
  readonly removed = output<void>();

  readonly texts = RESTOCK_LINE_TEXTS;
  readonly stockLabels = STOCK_LEVEL_LABELS;
  // Ids propios para enlazar cada etiqueta con su campo sin chocar con otros renglones.
  readonly uid = newUuid().slice(0, 8);
  readonly imageBroken = signal(false);

  showPhoto(): boolean {
    return !!this.view().image && !this.imageBroken();
  }

  initials(): string {
    return initialsOf(this.view().name);
  }

  // «N piezas en bodega» de un renglón de catálogo; un renglón escrito a mano no tiene existencia.
  unitsText(): string {
    const units = this.view().units;
    return units === null ? '' : `${unitsLabel(units)} ${this.texts.inStock}`;
  }

  qtyError(): string | null {
    if (!this.showErrors()) return null;
    const errors = this.group().controls.qty.errors;
    if (!errors) return null;
    if (errors['required']) return this.texts.qtyRequired;
    if (errors['integer']) return this.texts.qtyInteger;
    return this.texts.qtyTooLarge;
  }

  costError(): string | null {
    return this.showErrors() && this.group().controls.unitCost.invalid ? this.texts.costInvalid : null;
  }

  nameError(): string | null {
    if (this.duplicateName()) return this.texts.duplicateName;
    if (!this.showErrors() || !this.group().controls.name.invalid) return null;
    return this.group().controls.name.errors?.['maxlength'] ? this.texts.nameTooLong : this.texts.nameRequired;
  }
}
