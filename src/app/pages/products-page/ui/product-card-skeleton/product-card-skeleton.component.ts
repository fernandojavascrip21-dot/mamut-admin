import { Component } from '@angular/core';

// Tarjeta de esqueleto del estado cargando (spec M1-hu05 §6): mismo tamaño y distribución
// que app-producto-card, sin datos ni entradas; aria-hidden porque es puro relleno visual.
@Component({
  imports: [],
  selector: 'app-producto-card-skeleton',
  templateUrl: './producto-card-skeleton.component.html',
})
export class ProductoCardSkeletonComponent {}
