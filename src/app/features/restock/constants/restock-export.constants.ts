// Textos y medidas del PDF y del Excel del pedido de resurtir (spec M9-hu32 §2 y §4).
export const RESTOCK_EXPORT_TITLE = 'Pedido de resurtir · Mammut Supplements';
export const RESTOCK_EXPORT_PRODUCT_HEADER = 'Producto';
export const RESTOCK_EXPORT_QTY_HEADER = 'Piezas';
export const RESTOCK_EXPORT_SHEET_NAME = 'Pedido';
export const RESTOCK_EXPORT_FILE_PREFIX = 'pedido-resurtir';
export const RESTOCK_EXPORT_ERROR_MESSAGE = 'No pudimos generar el archivo. Inténtalo de nuevo.';

// Ancho de la columna «Producto» en el Excel, en caracteres; tope para nombres muy largos.
export const RESTOCK_EXPORT_NAME_COLUMN_WIDTH = 48;

// Tipo MIME del Excel; el PDF ya sale como blob de jsPDF con su propio tipo.
export const RESTOCK_EXPORT_XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Hoja carta vertical; los puntos (pt) son la unidad de jsPDF por defecto para medir.
export const RESTOCK_EXPORT_PDF_OPTIONS = { format: 'letter', orientation: 'portrait', unit: 'pt' } as const;

// Posiciones en puntos. La nota se envuelve a varias líneas: como no se puede medir el texto
// antes de escribirlo, la tabla se coloca con una estimación por caracteres (un poco alta de más).
export const RESTOCK_EXPORT_PDF_LAYOUT = {
  margin: 40,
  textWidth: 532,
  titleY: 56,
  dateY: 76,
  noteY: 100,
  noteLineHeight: 14,
  noteCharsPerLine: 80,
  tableGap: 20,
  tableTop: 120,
  titleSize: 16,
  textSize: 11,
} as const;
