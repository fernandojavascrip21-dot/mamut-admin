import {
  Component, DestroyRef, ElementRef, OnInit, afterRenderEffect, computed, effect, inject, input,
  output, signal, viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, PristineChangeEvent, ReactiveFormsModule } from '@angular/forms';
import { filter, map } from 'rxjs';
import { initialsOf } from '../../../shared/initials';
import { notBlank } from '../../../shared/validators';
import {
  portionRequiredWhenFractionable, positiveInteger, positiveNumber, priceNotBelowCost,
} from '../../validators/product-form.validators';
import type { Category, Product, ProductFormValue } from '../../interfaces/product.models';

type FieldWithError = 'name' | 'unitCost' | 'price' | 'units' | 'portionSize';

// Mensajes de cada campo al enviar (HU-04 §2, HU-06 §2).
const FIELD_MESSAGES: Record<FieldWithError, string> = {
  name: 'Escribe el nombre del producto',
  unitCost: 'El costo debe ser mayor a 0',
  price: 'El precio debe ser mayor a 0',
  units: 'Las piezas deben ser un número entero mayor a 0',
  portionSize: 'Escribe la porción',
};

// Formulario de producto (pantalla 03b) compartido por el alta y la edición. Solo presenta:
// las reglas están en los validadores, y guardar, navegar o leer errores HTTP es de la página,
// que recibe el valor por `submitted` y le devuelve el resultado por los inputs. Los errores de
// cada campo aparecen al enviar (como antes de Reactive Forms); solo «precio menor que el
// costo» se muestra en vivo y deshabilita «Guardar».
@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent implements OnInit {
  readonly mode = input.required<'create' | 'edit'>();
  readonly categories = input<Category[]>([]);
  readonly initialValue = input<Product | null>(null); // edición: llena el formulario y muestra «N en bodega»
  readonly busy = input(false); // deshabilita mientras guarda u offline
  readonly saving = input(false); // cambia «Guardar» por «Guardando…»
  readonly nameTaken = input(false); // 409: «Ya existe un producto con ese nombre»
  readonly categoryMissing = input(false); // 422: aviso en categoría
  readonly submitted = output<ProductFormValue>();
  readonly dirtyChange = output<boolean>();

  // Los numéricos aceptan texto porque al editar se cargan tal cual llegan de Postgres
  // ("100.00"); lo que escribe el usuario llega como número. Se convierten al emitir.
  readonly form = new FormGroup(
    {
      name: new FormControl('', { nonNullable: true, validators: notBlank() }),
      categoryId: new FormControl('', { nonNullable: true }),
      unitCost: new FormControl<number | string | null>(null, positiveNumber()),
      price: new FormControl<number | string | null>(null, positiveNumber()),
      units: new FormControl<number | null>(null),
      fractionable: new FormControl(false, { nonNullable: true }),
      portionSize: new FormControl('', { nonNullable: true }),
    },
    { validators: [portionRequiredWhenFractionable(), priceNotBelowCost()] },
  );

  readonly fractionable = toSignal(this.form.controls.fractionable.valueChanges, { initialValue: false });
  private readonly groupErrors = toSignal(this.form.valueChanges.pipe(map(() => this.form.errors)), {
    initialValue: null,
  });
  readonly priceBelowCost = computed(() => this.groupErrors()?.['priceBelowCost'] === true);

  private readonly fieldErrors = signal<Partial<Record<FieldWithError, string>>>({});
  readonly nameError = computed(() =>
    this.fieldErrors().name ?? (this.nameTaken() ? 'Ya existe un producto con ese nombre' : null),
  );
  readonly categoryError = computed(() =>
    this.categoryMissing() ? 'La categoría ya no existe. Actualiza la página e inténtalo otra vez.' : null,
  );
  readonly unitCostError = computed(() => this.fieldErrors().unitCost ?? null);
  readonly priceError = computed(() =>
    this.fieldErrors().price ?? (this.priceBelowCost() ? 'El precio no puede ser menor que el costo' : null),
  );
  readonly unitsError = computed(() => this.fieldErrors().units ?? null);
  readonly portionSizeError = computed(() => this.fieldErrors().portionSize ?? null);

  readonly selectedPhoto = signal<File | null>(null);
  readonly photoPreview = signal('');
  readonly removePhoto = signal(false);
  readonly imageBroken = signal(false);
  readonly visibleImage = computed(() =>
    this.removePhoto() ? '' : this.photoPreview() || this.initialValue()?.image || '',
  );
  readonly initial = computed(() => initialsOf(this.initialValue()?.name || 'Producto'));

  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly categoryInput = viewChild<ElementRef<HTMLSelectElement>>('categoryInput');
  private readonly unitCostInput = viewChild<ElementRef<HTMLInputElement>>('unitCostInput');
  private readonly priceInput = viewChild<ElementRef<HTMLInputElement>>('priceInput');
  private readonly unitsInput = viewChild<ElementRef<HTMLInputElement>>('unitsInput');
  private readonly portionSizeInput = viewChild<ElementRef<HTMLInputElement>>('portionSizeInput');
  private readonly photoInput = viewChild<ElementRef<HTMLInputElement>>('photoInput');

  constructor() {
    const destroyRef = inject(DestroyRef);
    const { price, unitCost, fractionable } = this.form.controls;

    // Escribir en precio o costo borra su error de campo, como antes; desmarcar «se fracciona»
    // borra el de porción.
    price.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.clearFieldError('price'));
    unitCost.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe(() => this.clearFieldError('unitCost'));
    fractionable.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((checked) => {
      if (!checked) this.clearFieldError('portionSize');
    });

    this.form.events
      .pipe(
        filter((event) => event instanceof PristineChangeEvent),
        map((event) => !event.pristine),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((dirty) => this.dirtyChange.emit(dirty));

    // Edición: llena el formulario con cada producto cargado.
    effect(() => {
      const product = this.initialValue();
      if (product) this.fill(product);
    });

    effect(() => {
      if (this.busy()) this.form.disable({ emitEvent: false });
      else this.form.enable({ emitEvent: false });
    });

    // Tras un 409 o un 422 el foco va al campo señalado, una vez que el formulario se habilitó.
    afterRenderEffect(() => {
      if (this.busy()) return;
      if (this.nameTaken()) this.nameInput()?.nativeElement.focus();
      else if (this.categoryMissing()) this.categoryInput()?.nativeElement.focus();
    });
  }

  // Las piezas solo se validan (y se muestran) en el alta.
  ngOnInit(): void {
    if (this.mode() === 'create') {
      this.form.controls.units.addValidators(positiveInteger());
      this.form.controls.units.updateValueAndValidity({ emitEvent: false });
    }
  }

  // La selección se conserva hasta guardar; el servicio decide si ya se subió.
  onPhotoSelected(file: File | null): void {
    this.selectedPhoto.set(file);
    this.removePhoto.set(false);
    this.imageBroken.set(false);
    this.photoPreview.set('');
    this.form.markAsDirty();
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (this.selectedPhoto() === file) this.photoPreview.set(String(reader.result || ''));
      };
      reader.readAsDataURL(file);
    }
  }

  removeCurrentPhoto(): void {
    this.removePhoto.set(true);
    this.selectedPhoto.set(null);
    this.photoPreview.set('');
    this.form.markAsDirty();
    const photoInput = this.photoInput();
    if (photoInput) photoInput.nativeElement.value = '';
  }

  // Pinta los errores de cada campo y lleva el foco al primero inválido; si todo es válido,
  // emite el valor normalizado.
  onSubmit(): void {
    const { name, unitCost, price, units } = this.form.controls;
    const errors: Partial<Record<FieldWithError, string>> = {};
    if (name.invalid) errors.name = FIELD_MESSAGES.name;
    if (unitCost.invalid) errors.unitCost = FIELD_MESSAGES.unitCost;
    if (price.invalid) errors.price = FIELD_MESSAGES.price;
    if (this.mode() === 'create' && units.invalid) errors.units = FIELD_MESSAGES.units;
    if (this.form.hasError('portionRequired')) errors.portionSize = FIELD_MESSAGES.portionSize;
    this.fieldErrors.set(errors);

    const first = errors.name ? this.nameInput()
      : errors.unitCost ? this.unitCostInput()
      : errors.price || this.priceBelowCost() ? this.priceInput()
      : errors.units ? this.unitsInput()
      : errors.portionSize ? this.portionSizeInput()
      : null;
    if (first) {
      first.nativeElement.focus();
      return;
    }
    this.submitted.emit(this.currentValue());
  }

  // Valor actual normalizado (nombre y porción sin espacios, números con Number()). La página
  // de edición lo lee para comparar contra lo cargado antes de salir.
  currentValue(): ProductFormValue {
    const raw = this.form.getRawValue();
    return {
      name: raw.name.trim(),
      categoryId: raw.categoryId === '' ? null : Number(raw.categoryId),
      price: Number(raw.price),
      unitCost: Number(raw.unitCost),
      units: this.mode() === 'create' && raw.units !== null ? Number(raw.units) : null,
      fractionable: raw.fractionable,
      portionSize: raw.fractionable ? raw.portionSize.trim() : null,
      photo: this.selectedPhoto(),
      removePhoto: this.removePhoto(),
    };
  }

  private fill(product: Product): void {
    this.form.reset({
      name: product.name,
      categoryId: product.categoryId === null ? '' : String(product.categoryId),
      unitCost: product.unitCost,
      price: product.price,
      units: null,
      fractionable: product.fractionable,
      portionSize: product.portionSize ?? '',
    });
    this.fieldErrors.set({});
    this.selectedPhoto.set(null);
    this.photoPreview.set('');
    this.removePhoto.set(false);
    this.imageBroken.set(false);
  }

  private clearFieldError(field: FieldWithError): void {
    if (this.fieldErrors()[field]) this.fieldErrors.update((errors) => ({ ...errors, [field]: undefined }));
  }
}
