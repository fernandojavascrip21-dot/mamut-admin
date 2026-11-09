import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import {
  FRACTION_HISTORY_CURRENCY,
  FRACTION_HISTORY_CURRENCY_DISPLAY,
  FRACTION_HISTORY_DATE_FORMAT,
  FRACTION_HISTORY_LINE_TEXTS,
  FRACTION_HISTORY_TIME_ZONE,
} from './fraction-history-line.constants';
import type { FractionHistoryLineItem } from './fraction-history-line.models';

// Una fila del historial: qué entero se fraccionó, en cuántas bolsitas, a qué costo y precio, y quién
// lo hizo. Solo presenta: los montos llegan como texto y el pipe currency los muestra en centavos.
@Component({
  imports: [CurrencyPipe, DatePipe],
  selector: 'app-fraction-history-line',
  templateUrl: './fraction-history-line.component.html',
})
export class FractionHistoryLineComponent {
  readonly item = input.required<FractionHistoryLineItem>();

  // Constantes expuestas a la plantilla: la fecha, la moneda y los textos viven en el archivo aparte.
  readonly dateFormat = FRACTION_HISTORY_DATE_FORMAT;
  readonly timeZone = FRACTION_HISTORY_TIME_ZONE;
  readonly currency = FRACTION_HISTORY_CURRENCY;
  readonly currencyDisplay = FRACTION_HISTORY_CURRENCY_DISPLAY;
  readonly texts = FRACTION_HISTORY_LINE_TEXTS;
}
