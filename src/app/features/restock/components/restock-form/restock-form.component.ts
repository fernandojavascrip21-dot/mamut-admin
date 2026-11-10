import {
  Component, DestroyRef, ElementRef, Injector, OnInit, afterNextRender, computed, effect, inject, input, output,
  signal, untracked,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, PristineChangeEvent, ReactiveFormsModule } from '@angular/forms';
import { filter, map } from 'rxjs';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Textarea } from 'primeng/textarea';
import { unitsLabel } from '@shared/utils/units-label';
import { MAX_LINES, MAX_NOTE_LENGTH } from '../../constants/restock.constants';
import type {
  RestockLinePayload, RestockProduct, RestockSuggestion, UpdateRestockOrderPayload,
} from '../../interfaces/restock.models';
import { estimateTotal } from '../../rules/restock-estimate.rules';
import { addableProducts, existsInCatalog, lineViews, missingSuggestions } from '../../rules/restock-lines.rules';
import { duplicateNameIndexes, restockCustomName, restockNote, restockQty, restockUnitCost } from '../../validators/restock-form.validators';
import { RestockLineComponent } from '../restock-line/restock-line.component';
import { RESTOCK_LINE_TEXTS } from '../restock-line/restock-line.constants';
import { RESTOCK_FORM_TEXTS, RESTOCK_NOTICE_LABELS } from './restock-form.constants';
import type {
  RestockBusyAction, RestockFormGroup, RestockFormSubmit, RestockFormValue, RestockLineForm,
  RestockLineFormGroup, RestockNoticeAction, RestockRow,
} from './restock-form.models';

// Lista de renglones del pedido de resurtir. Es presentacional: las sugerencias, los productos y el
// borrador llegan por inputs; guardar, cerrar y descartar salen por outputs con el payload ya
// validado. Los errores de campo aparecen al enviar; los generales (lista vacía para cerrar,
// renglones que ya no se pueden pedir, más de 200) se explican arriba de los botones.
@Component({
  imports: [CurrencyPipe, ReactiveFormsModule, ButtonDirective, InputText, Select, Textarea, RestockLineComponent],
  selector: 'app-restock-form',
  templateUrl: './restock-form.component.html',
})
export class RestockFormComponent implements OnInit {
  // --- Dependencias ---
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // --- Entradas y salidas ---
  readonly products = input.required<RestockProduct[]>();
  readonly suggestions = input.required<RestockSuggestion[]>();
  readonly initialLines = input.required<RestockLineForm[]>();
  readonly initialNote = input('');
  readonly busy = input<RestockBusyAction | null>(null);
  readonly hasDraft = input(false);
  readonly notice = input<string | null>(null);
  readonly noticeAction = input<RestockNoticeAction | null>(null);
  // Total que devuelve el backend tras guardar; null mientras la lista no se guardó o cambió.
  readonly savedTotal = input<string | null>(null);

  readonly saved = output<RestockFormSubmit>();
  readonly closed = output<RestockFormSubmit>();
  readonly discarded = output<void>();
  readonly noticeActionClicked = output<RestockNoticeAction>();
  // true al primer cambio del usuario; una lista recién cargada no cuenta.
  readonly dirtyChange = output<boolean>();

  // --- Formulario y estados ---
  form!: RestockFormGroup;
  readonly customForm = this.formBuilder.group({
    name: this.formBuilder.control('', restockCustomName()),
    cost: this.formBuilder.control('', restockUnitCost({ required: false })),
  });
  // Selector «Agregar producto»: siempre vuelve a vacío después de elegir.
  readonly pickerControl = new FormControl<number | null>(null);
  readonly texts = RESTOCK_FORM_TEXTS;
  readonly lineTexts = RESTOCK_LINE_TEXTS;
  readonly noticeLabels = RESTOCK_NOTICE_LABELS;
  readonly maxNoteLength = MAX_NOTE_LENGTH;
  readonly customOpen = signal(false);
  readonly customSubmitted = signal(false);
  // Se enciende en el primer envío que no pasa; los errores de campo solo se pintan con esto.
  readonly submitted = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly isBusy = computed(() => this.busy() !== null);
  private readonly snapshot = signal<RestockFormValue>({ note: '', lines: [] });
  // Última acción de guardar o cerrar: el reintento la repite con los valores actuales.
  private lastAction: 'save' | 'close' | null = null;

  // --- Vistas calculadas de la lista escrita ---
  readonly rows = computed<RestockRow[]>(() => {
    const { lines } = this.snapshot();
    const products = this.products();
    const views = lineViews(lines, products);
    const duplicates = new Set(this.duplicateIndexes());
    return lines.map((line, index) => ({
      view: views[index],
      existsInCatalog: line.kind === 'custom' && existsInCatalog(line.name, products),
      duplicateName: duplicates.has(index),
    }));
  });
  // Un renglón que ya no se puede pedir no cuenta en el total.
  readonly estimate = computed(() =>
    estimateTotal(this.snapshot().lines.filter((_, index) => this.rows()[index].view.orderable)),
  );
  // Lo que se pinta: el total del backend tras guardar, y el calculado en vivo al volver a editar.
  readonly shownTotal = computed(() => this.savedTotal() ?? this.estimate().total);
  // Único `Number()` del total: solo para que el pipe `currency` lo muestre.
  readonly shownAmount = computed(() => Number(this.shownTotal()));
  readonly noteLength = computed(() => [...this.snapshot().note.trim()].length);
  readonly noteError = computed(() =>
    this.submitted() && this.noteLength() > MAX_NOTE_LENGTH ? this.texts.noteTooLong : null,
  );
  readonly productOptions = computed(() =>
    addableProducts(this.products(), this.snapshot().lines).map((product) => ({
      label: `${product.name} · ${unitsLabel(product.units)} en bodega`,
      name: product.name,
      value: product.productId,
    })),
  );
  readonly missing = computed(() => missingSuggestions(this.suggestions(), this.snapshot().lines));
  readonly nonOrderableCount = computed(() => this.rows().filter((row) => !row.view.orderable).length);
  // Índices de los nombres escritos que ya aparecieron antes (sin mayúsculas ni acentos).
  private readonly duplicateIndexes = computed(() =>
    duplicateNameIndexes(this.snapshot().lines.map((line) => (line.kind === 'custom' ? line.name : ''))),
  );

  // Cada renglón del FormArray, para el @for (la identidad del grupo es la llave).
  get lineGroups(): RestockLineFormGroup[] {
    return this.form.controls.lines.controls;
  }

  // --- Ciclo de vida ---
  constructor() {
    // Una lista nueva (sugerencias, borrador recién guardado o recargado) reemplaza renglones y nota.
    // Es carga del servidor, no un cambio del usuario, así que deja el formulario sin cambios.
    effect(() => {
      const lines = this.initialLines();
      const note = this.initialNote();
      untracked(() => this.loadInitial(lines, note));
    });
  }

  // Primero la estructura vacía con sus reglas; la carga la hace el effect con los inputs.
  ngOnInit(): void {
    this.form = this.createEmptyForm();
    this.listenToChanges();
  }

  // --- Estructura y reacciones ---
  private createEmptyForm(): RestockFormGroup {
    return this.formBuilder.group({
      note: this.formBuilder.control('', restockNote()),
      lines: this.formBuilder.array<RestockLineFormGroup>([]),
    });
  }

  // Cada cambio refresca la copia de la lista (vistas, total) y avisa a la página si hay cambios sin
  // guardar; el aviso solo sale al cambiar el estado pristine, no en cada tecla.
  private listenToChanges(): void {
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snapshot.set(this.readValue()));
    this.form.events
      .pipe(
        filter((event) => event instanceof PristineChangeEvent),
        map((event) => !event.pristine),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((dirty) => this.dirtyChange.emit(dirty));
  }

  private readValue(): RestockFormValue {
    const raw = this.form.getRawValue();
    return { note: raw.note, lines: raw.lines };
  }

  // Reemplaza todos los renglones con los que llegan y deja el formulario sin cambios pendientes.
  private loadInitial(lines: RestockLineForm[], note: string): void {
    const wasDirty = this.form.dirty;
    this.form.controls.lines.clear();
    for (const line of lines) this.addLine(line);
    this.form.controls.note.setValue(note);
    this.form.markAsPristine();
    if (wasDirty) this.dirtyChange.emit(false);
  }

  // Único camino para crear renglones (cargar, agregar, sugerir): así cada uno lleva las mismas reglas.
  private addLine(line: RestockLineForm): void {
    this.form.controls.lines.push(this.createLineGroup(line));
  }

  private createLineGroup(line: RestockLineForm): RestockLineFormGroup {
    return this.formBuilder.group({
      kind: this.formBuilder.control(line.kind),
      productId: new FormControl<number | null>(line.productId),
      name: this.formBuilder.control(line.name, line.kind === 'custom' ? restockCustomName() : []),
      qty: this.formBuilder.control(line.qty, restockQty()),
      unitCost: this.formBuilder.control(line.unitCost, restockUnitCost({ required: line.kind === 'catalog' })),
    });
  }

  // --- Controles que cambia el usuario ---
  pickProduct(productId: number | null): void {
    this.pickerControl.setValue(null);
    const product = this.products().find((candidate) => candidate.productId === productId);
    if (!product || this.isBusy()) return;
    this.addCatalogLine(product);
    this.form.markAsDirty();
  }

  addSuggestions(): void {
    if (this.isBusy()) return;
    const missing = this.missing();
    if (missing.length === 0) return;
    for (const suggestion of missing) this.addCatalogLine(suggestion);
    this.form.markAsDirty();
  }

  removeLine(index: number): void {
    this.form.controls.lines.removeAt(index);
    this.form.markAsDirty();
  }

  openCustom(): void {
    this.customOpen.set(true);
  }

  cancelCustom(): void {
    this.resetCustom();
  }

  // Un renglón escrito a mano: sin nombre no agrega y muestra su error dentro del bloque.
  addCustom(): void {
    this.customSubmitted.set(true);
    if (this.customForm.invalid) return;
    const { name, cost } = this.customForm.getRawValue();
    this.addLine({ kind: 'custom', productId: null, name: name.trim(), qty: '', unitCost: cost.trim() });
    this.form.markAsDirty();
    this.resetCustom();
  }

  customNameError(): string | null {
    const name = this.customForm.controls.name;
    if (!this.customSubmitted() || !name.invalid) return null;
    return name.errors?.['maxlength'] ? RESTOCK_LINE_TEXTS.nameTooLong : RESTOCK_LINE_TEXTS.nameRequired;
  }

  customCostError(): string | null {
    return this.customSubmitted() && this.customForm.controls.cost.invalid ? RESTOCK_LINE_TEXTS.costInvalid : null;
  }

  // Renglón de catálogo con piezas vacías y el costo registrado (de producto o de sugerencia).
  private addCatalogLine(source: Pick<RestockProduct, 'productId' | 'name' | 'unitCost'>): void {
    this.addLine({ kind: 'catalog', productId: source.productId, name: source.name, qty: '', unitCost: source.unitCost });
  }

  private resetCustom(): void {
    this.customForm.reset();
    this.customSubmitted.set(false);
    this.customOpen.set(false);
  }

  // --- Validación, payload y envío ---
  save(): void {
    this.submit('save');
  }

  close(): void {
    this.submit('close');
  }

  discard(): void {
    if (!this.isBusy()) this.discarded.emit();
  }

  // Valida y emite. Primero los avisos generales (que no tienen campo), después los campos; un
  // error general no marca campos, así que no se pinta nada sobre renglones que no se ven.
  // Reintento tras un fallo de red: vuelve a leer la lista tal como está ahora, no el envío anterior.
  resubmit(): void {
    if (this.lastAction) this.submit(this.lastAction);
  }

  private submit(action: 'save' | 'close'): void {
    if (this.isBusy()) return;
    this.lastAction = action;
    const problem = this.generalProblem(action);
    this.submitError.set(problem);
    if (problem) return;
    if (this.form.invalid || this.duplicateIndexes().length > 0) {
      this.submitted.set(true);
      this.form.markAllAsTouched();
      this.focusFirstError();
      return;
    }
    this.submitted.set(false);
    const submit: RestockFormSubmit = {
      payload: this.preparePayload(),
      total: this.estimate().total,
      lineCount: this.lineGroups.length,
    };
    if (action === 'save') this.saved.emit(submit);
    else this.closed.emit(submit);
  }

  private generalProblem(action: 'save' | 'close'): string | null {
    const lines = this.lineGroups.length;
    if (this.nonOrderableCount() > 0) return this.texts.notOrderable;
    if (lines > MAX_LINES) return this.texts.tooManyLines;
    if (action === 'close' && lines === 0) return this.texts.emptyClose;
    return null;
  }

  // Payload con los nombres que espera el servicio. El dinero sigue como texto; piezas y tope ya
  // están validados. getRawValue incluye los controles deshabilitados.
  private preparePayload(): UpdateRestockOrderPayload {
    const raw = this.form.getRawValue();
    const note = raw.note.trim();
    return {
      note: note === '' ? null : note,
      lines: raw.lines.map((line) => this.linePayload(line)),
    };
  }

  private linePayload(line: RestockLineForm): RestockLinePayload {
    const qty = Number(line.qty.trim());
    if (line.kind === 'catalog' && line.productId !== null) {
      return { productId: line.productId, qty, unitCost: line.unitCost.trim() };
    }
    return { name: line.name.trim(), qty, unitCost: line.unitCost.trim() || null };
  }

  // Lleva el foco al primer campo con error, una vez que el aviso ya está en el DOM.
  private focusFirstError(): void {
    afterNextRender(
      () => {
        this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      },
      { injector: this.injector },
    );
  }
}
