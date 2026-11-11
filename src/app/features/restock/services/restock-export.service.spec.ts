import { TestBed } from '@angular/core/testing';
import type { RestockExportDocument } from '../interfaces/restock-export.models';
import { RestockExportService } from './restock-export.service';

// Las librerías pesadas se simulan: la prueba revisa lo que el servicio les manda, no el archivo real.
const lib = vi.hoisted(() => ({
  failImport: false,
  failGenerate: false,
  attempts: 0,
  pdfOptions: [] as unknown[],
  pdfCalls: [] as Array<{ method: string; args: unknown[] }>,
  tables: [] as unknown[],
  sheetNames: [] as string[],
  sheetRows: [] as unknown[][],
}));

vi.mock('jspdf', () => {
  class FakePdf {
    constructor(options?: unknown) {
      lib.attempts++;
      if (lib.failGenerate) throw new Error('falla la generación');
      lib.pdfOptions.push(options);
      return new Proxy(this, {
        get: (target, property) => {
          if (property === 'output') return () => new Blob(['pdf'], { type: 'application/pdf' });
          if (typeof property !== 'string') return Reflect.get(target, property);
          return (...args: unknown[]) => {
            lib.pdfCalls.push({ method: property, args });
            return target;
          };
        },
      });
    }
  }
  const module: Record<string, unknown> = {};
  for (const name of ['jsPDF', 'default']) {
    Object.defineProperty(module, name, {
      enumerable: true,
      get: () => {
        lib.attempts++;
        if (lib.failImport) throw new Error('no cargó el chunk');
        return FakePdf;
      },
    });
  }
  return module;
});

vi.mock('jspdf-autotable', () => {
  const autoTable = (_doc: unknown, options: unknown) => lib.tables.push(options);
  return { autoTable, default: autoTable };
});

vi.mock('exceljs/dist/exceljs.min.js', () => {
  class FakeWorkbook {
    readonly xlsx = { writeBuffer: async () => new ArrayBuffer(8) };
    addWorksheet(name: string) {
      lib.attempts++;
      if (lib.failGenerate) throw new Error('falla la generación');
      lib.sheetNames.push(name);
      const sheet = {
        addRow: (values: unknown[]) => {
          lib.sheetRows.push(values);
          return { font: {}, getCell: () => ({}) };
        },
        addRows: (rows: unknown[][]) => lib.sheetRows.push(...rows),
        getRow: () => ({ font: {}, getCell: () => ({}) }),
        getColumn: () => ({}),
        columns: [] as unknown[],
        mergeCells: () => undefined,
      };
      return sheet;
    }
  }
  const module: Record<string, unknown> = {};
  for (const name of ['default', 'Workbook']) {
    Object.defineProperty(module, name, {
      enumerable: true,
      get: () => {
        lib.attempts++;
        if (lib.failImport) throw new Error('no cargó el chunk');
        return name === 'default' ? { Workbook: FakeWorkbook } : FakeWorkbook;
      },
    });
  }
  return module;
});

const DOC: RestockExportDocument = {
  title: 'Pedido de resurtir · Mammut Supplements',
  dateLabel: 'Cerrado el 11 nov 2026',
  note: 'Pedir antes del viernes',
  rows: [
    { name: 'Creatina 300 g', qty: 30 },
    { name: 'Shaker ñandú', qty: 2 },
  ],
  totalLabel: '2 productos · 32 piezas',
  fileName: 'pedido-resurtir-12-2026-11-11',
};

describe('RestockExportService', () => {
  let service: RestockExportService;
  let downloads: string[];

  beforeEach(() => {
    lib.failImport = false;
    lib.failGenerate = false;
    lib.attempts = 0;
    lib.pdfOptions.length = 0;
    lib.pdfCalls.length = 0;
    lib.tables.length = 0;
    lib.sheetNames.length = 0;
    lib.sheetRows.length = 0;
    downloads = [];
    URL.createObjectURL = vi.fn(() => 'blob:prueba');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    service = TestBed.inject(RestockExportService);
  });

  afterEach(() => vi.restoreAllMocks());

  const written = (value: unknown) => JSON.stringify(value);

  describe('PDF', () => {
    it('baja un archivo con el nombre del documento y la extensión .pdf', async () => {
      await service.download(DOC, 'pdf');
      expect(downloads).toEqual(['pedido-resurtir-12-2026-11-11.pdf']);
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    });

    it('crea el documento en tamaño carta, vertical', async () => {
      await service.download(DOC, 'pdf');
      expect(lib.pdfOptions[0]).toEqual(expect.objectContaining({ format: 'letter', orientation: 'portrait' }));
    });

    it('escribe el título, la fecha, la nota y el pie del documento', async () => {
      await service.download(DOC, 'pdf');
      const texts = written(lib.pdfCalls.filter((call) => call.method === 'text').map((call) => call.args[0]));
      expect(texts).toContain(DOC.title);
      expect(texts).toContain(DOC.dateLabel);
      expect(texts).toContain(DOC.note);
      expect(written([lib.pdfCalls, lib.tables])).toContain(DOC.totalLabel);
    });

    it('la tabla lleva «Producto» y «Piezas» y un renglón por producto', async () => {
      await service.download(DOC, 'pdf');
      expect(lib.tables).toHaveLength(1);
      const table = written(lib.tables[0]);
      expect(table).toContain('Producto');
      expect(table).toContain('Piezas');
      expect(table).toContain('Creatina 300 g');
      expect(table).toContain('Shaker ñandú');
    });

    it('sin nota no escribe la palabra null', async () => {
      await service.download({ ...DOC, note: null }, 'pdf');
      expect(written([lib.pdfCalls, lib.tables])).not.toContain('null');
    });
  });

  describe('Excel', () => {
    it('baja un archivo con el nombre del documento y la extensión .xlsx', async () => {
      await service.download(DOC, 'xlsx');
      expect(downloads).toEqual(['pedido-resurtir-12-2026-11-11.xlsx']);
    });

    it('crea una sola hoja llamada «Pedido»', async () => {
      await service.download(DOC, 'xlsx');
      expect(lib.sheetNames).toEqual(['Pedido']);
    });

    it('escribe título, fecha, nota, encabezado, renglones y el total', async () => {
      await service.download(DOC, 'xlsx');
      const rows = written(lib.sheetRows);
      for (const expected of [DOC.title, DOC.dateLabel, DOC.note, 'Producto', 'Piezas', 'Creatina 300 g', 'Shaker ñandú', DOC.totalLabel]) {
        expect(rows).toContain(expected);
      }
    });

    it('las piezas van como número, no como texto', async () => {
      await service.download(DOC, 'xlsx');
      const productRow = lib.sheetRows.find((row) => row.includes('Creatina 300 g'));
      expect(productRow).toContain(30);
      expect(productRow?.every((cell) => cell !== '30')).toBe(true);
    });
  });

  describe('errores', () => {
    it.each(['pdf', 'xlsx'] as const)('si la librería no carga, %s se rechaza y no baja nada', async (format) => {
      lib.failImport = true;
      await expect(service.download(DOC, format)).rejects.toThrow(/chunk|generación/);
      expect(lib.attempts).toBeGreaterThan(0);
      expect(downloads).toEqual([]);
    });

    it.each(['pdf', 'xlsx'] as const)('si falla la generación, %s se rechaza y no baja nada', async (format) => {
      lib.failGenerate = true;
      await expect(service.download(DOC, format)).rejects.toThrow(/chunk|generación/);
      expect(lib.attempts).toBeGreaterThan(0);
      expect(downloads).toEqual([]);
    });
  });
});
