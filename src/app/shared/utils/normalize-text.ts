// Minúsculas, sin acentos ni diéresis y sin espacios en los extremos, para comparar
// búsquedas: "Cbúm " y "cbum" dan lo mismo. Se reusará en el catálogo del vendedor (06).
export function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
