// Minúsculas, sin acentos ni diéresis y sin espacios en los extremos, para comparar
// búsquedas: "Cbúm " y "cbum" dan lo mismo. Se reusará en el catálogo del vendedor (06).
export function normalizarTexto(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
