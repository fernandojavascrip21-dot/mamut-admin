import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { httpStatus } from '@shared/utils/http-errors';
import { ProductPhotosService } from './product-photos.service';
import { ProductsService } from './products.service';
import { UPLOAD_FAILED } from '../constants/products.constants';
import type { Product, ProductFormValue, SaveResult } from '../interfaces/product.models';

// Orquesta el guardado de la pantalla 03b: si hay foto nueva, la sube primero y su URL
// alimenta el alta o la edición, todo en una sola cadena. Recuerda la URL ya subida para que
// «Reintentar» no vuelva a subir el mismo archivo (HU-04 §2), y traduce los errores HTTP a un
// SaveResult para que las páginas no lean HttpErrorResponse. Sin providedIn: cada página lo
// provee en sus `providers`, así lo recordado muere con la pantalla.
@Injectable()
export class ProductSaveService {
  private readonly productsService = inject(ProductsService);
  private readonly photosService = inject(ProductPhotosService);

  private uploadedPhoto: File | null = null;
  private uploadedImageUrl: string | null = null;

  // Alta: las piezas (`units`) entran como el movimiento inicial del producto.
  create(value: ProductFormValue): Observable<SaveResult> {
    return this.uploadPhoto(value.photo).pipe(
      switchMap((imageUrl) => this.productsService.create({
        name: value.name,
        categoryId: value.categoryId,
        price: value.price,
        unitCost: value.unitCost,
        initialQty: value.units ?? 0,
        fractionable: value.fractionable,
        portionSize: value.portionSize,
        image: imageUrl,
      })),
      map((product): SaveResult => ({ ok: true, product })),
      catchError((error: unknown) => of(this.toFailure(error, false))),
    );
  }

  // Edición: manda el cuerpo completo sin piezas (solo cambian con movimientos). La foto queda
  // vacía si se quitó, la nueva si se subió, o la que ya tenía.
  update(original: Product, value: ProductFormValue): Observable<SaveResult> {
    return this.uploadPhoto(value.removePhoto ? null : value.photo).pipe(
      switchMap((imageUrl) => this.productsService.update(original.id, {
        name: value.name,
        categoryId: value.categoryId,
        price: value.price,
        unitCost: value.unitCost,
        fractionable: value.fractionable,
        portionSize: value.portionSize,
        image: value.removePhoto ? '' : imageUrl ?? original.image,
      })),
      map((product): SaveResult => ({ ok: true, product })),
      catchError((error: unknown) => of(this.toFailure(error, true))),
    );
  }

  // Reinicia la URL recordada, para «Dar de alta otro» sin recargar.
  reset(): void {
    this.uploadedPhoto = null;
    this.uploadedImageUrl = null;
  }

  // Sube la foto solo si es un archivo distinto al último que ya se subió; emite su URL, o
  // null si no hay foto nueva.
  private uploadPhoto(photo: File | null): Observable<string | null> {
    if (!photo) return of(null);
    if (photo === this.uploadedPhoto) return of(this.uploadedImageUrl);
    return this.photosService.upload(photo).pipe(
      tap((url) => {
        this.uploadedPhoto = photo;
        this.uploadedImageUrl = url;
      }),
      catchError(() => throwError(() => UPLOAD_FAILED)),
    );
  }

  // 404 solo significa «no disponible» al editar; en el alta cualquier otro error (incluido
  // sin red o un 5xx) se trata como «no se pudo guardar», con Reintentar.
  private toFailure(error: unknown, editing: boolean): SaveResult {
    if (error === UPLOAD_FAILED) return { ok: false, reason: 'offline' };
    const status = httpStatus(error);
    if (status === 404 && editing) return { ok: false, reason: 'not-found' };
    if (status === 409) return { ok: false, reason: 'duplicate-name' };
    if (status === 422) return { ok: false, reason: 'category-missing' };
    return { ok: false, reason: 'offline' };
  }
}
