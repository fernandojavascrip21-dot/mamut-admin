import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// /admin/vendedores: por ahora solo la entrada al alta (HU-08). La lista «Mis vendedores» con las
// piezas de cada uno llega con HU-09.
@Component({
  imports: [RouterLink],
  selector: 'app-sellers-page',
  templateUrl: './sellers-page.component.html',
})
export class SellersPageComponent {}
