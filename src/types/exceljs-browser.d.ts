// El build de navegador de exceljs (dist/exceljs.min.js) no trae tipos propios. Se declara con los
// mismos tipos de la API principal: el default es el objeto que exporta el UMD (`.Workbook`).
declare module 'exceljs/dist/exceljs.min.js' {
  import type * as ExcelJS from 'exceljs';
  const browser: typeof ExcelJS;
  export default browser;
}
