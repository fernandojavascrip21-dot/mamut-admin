import { Injectable } from '@angular/core';
import type { RestockExportDocument } from '../interfaces/restock-export.models';
import type { RestockExportFormat } from '../interfaces/restock.models';

// Genera el PDF o el Excel del pedido y lo baja; las librerías se cargan al pulsar, nunca al inicio.
@Injectable({ providedIn: 'root' })
export class RestockExportService {
  async download(doc: RestockExportDocument, format: RestockExportFormat): Promise<void> {
    throw new Error(`Sin implementar: ${doc.fileName} ${format}`);
  }
}
