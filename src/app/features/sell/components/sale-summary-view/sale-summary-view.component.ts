import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import type { Sale, SaleLine } from '../../interfaces/sale.models';
import type { SaleSummaryLinks, SaleSummaryState, SaleSummaryTexts } from '../../models/sale-summary-page.models';
import { SaleLineComponent } from '../sale-line/sale-line.component';
import { SellProductCardSkeletonComponent } from '../sell-product-card-skeleton/sell-product-card-skeleton.component';

// Cuerpo de «Venta confirmada» compartido por el administrador y el vendedor (spec M3-hu16 y M3-hu17):
// el mismo diseño para los dos. Solo presenta y emite; cada página decide qué dato le pasa a su rol: la
// ganancia, el titular y el desglose «antes → después» solo llegan al administrador, y el aviso de baja
// existencia solo al vendedor. Lo que no llega (null) no se pinta, así el vendedor nunca ve costos.
@Component({
  imports: [CurrencyPipe, DatePipe, RouterLink, ButtonDirective, SaleLineComponent, SellProductCardSkeletonComponent],
  selector: 'app-sale-summary-view',
  templateUrl: './sale-summary-view.component.html',
})
export class SaleSummaryViewComponent {
  readonly texts = input.required<SaleSummaryTexts>();
  readonly links = input.required<SaleSummaryLinks>();
  readonly state = input.required<SaleSummaryState>();
  readonly sale = input.required<Sale | null>();
  readonly replayed = input(false);
  // «Vendido de: Bodega|nombre»; null = no se muestra (vendedor).
  readonly holderName = input<string | null>(null);
  // «Bodega» o primer nombre en cada renglón; null = «Te quedan N» (vendedor).
  readonly holderLabel = input<string | null>(null);
  readonly countsLabel = input('');
  // Único Number() sobre un monto, hecho por la página.
  readonly totalAmount = input.required<number>();
  // null = no se muestra (vendedor).
  readonly profitAmount = input<number | null>(null);
  // Aviso de baja existencia del vendedor (HU-18); null = no hay.
  readonly lowStockNotice = input<string | null>(null);

  readonly retry = output<void>();

  // Ganancia del renglón si la venta la trae (solo la lectura del administrador); null para el vendedor.
  profitOf(line: SaleLine): string | null {
    return (line as Partial<{ profit: string }>).profit ?? null;
  }
}
