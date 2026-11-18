import { CurrencyPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { initialsOf } from '../../utils/initials';
import type {
  DataGridCell,
  DataGridColumn,
  DataGridOption,
  DataGridRow,
  DataGridState,
  DataGridTexts,
} from './data-grid.models';

// Grid reutilizable: filtro opcional (`p-selectbutton`) arriba a la derecha, el título que proyecte la
// página a la izquierda (`[gridTitle]`) y una tabla de PrimeNG con la lista elegida. Es presentacional:
// recibe columnas, filas, estado y textos ya armados; avisa el filtro elegido (`selectedChange`), la
// fila tocada (`rowAction` con su `actionId`) y «Reintentar» (`retry`). En móvil las columnas que no
// son `primary` bajan bajo el título de la fila, para que la tabla no haga scroll horizontal.
@Component({
  imports: [CurrencyPipe, DatePipe, NgTemplateOutlet, FormsModule, RouterLink, ButtonDirective, SelectButton, TableModule],
  selector: 'app-data-grid',
  templateUrl: './data-grid.component.html',
})
export class DataGridComponent {
  readonly columns = input.required<DataGridColumn[]>();
  readonly rows = input.required<DataGridRow[]>();
  readonly state = input.required<DataGridState>();
  readonly texts = input.required<DataGridTexts>();
  readonly options = input<DataGridOption[]>([]);
  readonly selected = input<string | null>(null);
  readonly filterLabel = input('');

  readonly selectedChange = output<string>();
  readonly rowAction = output<string>();
  readonly retry = output<void>();

  // Columnas que en móvil bajan bajo el título, y cuántas celdas ocupa el mensaje vacío.
  readonly secondaryColumns = computed(() => this.columns().filter((column) => !column.primary));
  readonly columnCount = computed(() => this.columns().length + 1);

  // Fotos que no cargaron: esas filas caen a las iniciales en vez de dejar una imagen rota.
  private readonly brokenImages = signal<ReadonlySet<string>>(new Set());

  showPhoto(row: DataGridRow): boolean {
    return row.image !== null && !this.brokenImages().has(row.key);
  }

  initials(row: DataGridRow): string {
    return initialsOf(row.title);
  }

  // Alineación de la columna y, si no es `primary`, oculta en móvil (su valor baja bajo el título).
  columnClass(column: DataGridColumn): string {
    const align = column.align === 'right' ? 'text-right' : 'text-left';
    return column.primary ? align : `${align} hidden md:table-cell`;
  }

  cell(row: DataGridRow, column: DataGridColumn): DataGridCell {
    return row.cells[column.key] ?? { value: null };
  }

  // Los montos viajan como texto; `Number()` solo para el pipe `currency` al mostrarlos.
  amount(value: string): number {
    return Number(value);
  }

  // Una fila con `actionId` es tocable completa; el botón del título le da foco y teclado.
  onRowClick(row: DataGridRow): void {
    if (row.actionId) this.rowAction.emit(row.actionId);
  }

  onPhotoError(row: DataGridRow): void {
    this.brokenImages.update((keys) => new Set(keys).add(row.key));
  }
}
