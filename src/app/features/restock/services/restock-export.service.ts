import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import {
  RESTOCK_EXPORT_NAME_COLUMN_WIDTH,
  RESTOCK_EXPORT_PDF_LAYOUT,
  RESTOCK_EXPORT_PDF_OPTIONS,
  RESTOCK_EXPORT_PRODUCT_HEADER,
  RESTOCK_EXPORT_QTY_HEADER,
  RESTOCK_EXPORT_SHEET_NAME,
  RESTOCK_EXPORT_XLSX_MIME,
} from '../constants/restock-export.constants';
import type { RestockExportDocument } from '../interfaces/restock-export.models';
import type { RestockExportFormat } from '../interfaces/restock.models';

// Genera el PDF o el Excel del pedido y lo baja. Las librerías se piden con import() al pulsar,
// nunca al arrancar la app: así no pesan en la carga inicial ni en la de un vendedor.
@Injectable({ providedIn: 'root' })
export class RestockExportService {
  private readonly document = inject(DOCUMENT);

  // Un fallo (librería que no carga o generación) se rechaza: la página decide el toast.
  async download(doc: RestockExportDocument, format: RestockExportFormat): Promise<void> {
    const blob = format === 'pdf' ? await this.buildPdf(doc) : await this.buildXlsx(doc);
    this.save(blob, `${doc.fileName}.${format}`);
  }

  private async buildPdf(doc: RestockExportDocument): Promise<Blob> {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const pdf = new jsPDF(RESTOCK_EXPORT_PDF_OPTIONS);
    const layout = RESTOCK_EXPORT_PDF_LAYOUT;

    pdf.setFontSize(layout.titleSize);
    pdf.text(doc.title, layout.margin, layout.titleY);
    pdf.setFontSize(layout.textSize);
    pdf.text(doc.dateLabel, layout.margin, layout.dateY);

    let tableTop: number = layout.tableTop;
    if (doc.note !== null) {
      pdf.text(doc.note, layout.margin, layout.noteY, { maxWidth: layout.textWidth });
      const noteLines = Math.ceil(doc.note.length / layout.noteCharsPerLine);
      tableTop = layout.noteY + noteLines * layout.noteLineHeight + layout.tableGap;
    }

    // showHead «everyPage» repite el encabezado cuando la tabla salta de hoja.
    autoTable(pdf, {
      startY: tableTop,
      margin: { left: layout.margin, right: layout.margin },
      head: [[RESTOCK_EXPORT_PRODUCT_HEADER, RESTOCK_EXPORT_QTY_HEADER]],
      body: doc.rows.map((row) => [row.name, String(row.qty)]),
      foot: [[{ content: doc.totalLabel, colSpan: 2, styles: { halign: 'right' } }]],
      showHead: 'everyPage',
      columnStyles: { 1: { halign: 'right' } },
    });

    return pdf.output('blob');
  }

  private async buildXlsx(doc: RestockExportDocument): Promise<Blob> {
    const { default: ExcelJS } = await import('exceljs/dist/exceljs.min.js');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(RESTOCK_EXPORT_SHEET_NAME);
    sheet.getColumn(1).width = RESTOCK_EXPORT_NAME_COLUMN_WIDTH;
    sheet.getColumn(2).width = 12;

    sheet.addRow([doc.title]).font = { bold: true, size: 14 };
    sheet.addRow([doc.dateLabel]);
    if (doc.note !== null) sheet.addRow([doc.note]);
    sheet.addRow([]);
    sheet.addRow([RESTOCK_EXPORT_PRODUCT_HEADER, RESTOCK_EXPORT_QTY_HEADER]).font = { bold: true };
    for (const row of doc.rows) {
      // Las piezas van como número para que Excel las sume y no como texto.
      sheet.addRow([row.name, row.qty]);
    }
    sheet.addRow([doc.totalLabel]).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: RESTOCK_EXPORT_XLSX_MIME });
  }

  // Descarga con un enlace temporal. La URL se revoca en el siguiente turno: algunos navegadores
  // aún no han empezado la descarga cuando click() regresa.
  private save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }
}
