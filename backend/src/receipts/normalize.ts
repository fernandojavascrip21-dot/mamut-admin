// Normaliza un nombre para compararlo: minúsculas, sin acentos, símbolos como espacio y espacios
// juntos. El orden importa: primero se quitan las marcas (ñ → n + marca) y luego se cambian símbolos,
// porque una marca no es letra ni dígito y, si no se quita antes, se convertiría en espacio.
export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// El proveedor pega etiquetas que cambian entre remisiones (*OFERTA*, *NUEVO*, comillas). Se corta
// desde el primer marcador hasta el final para que la misma presentación dé la misma llave aunque
// la etiqueta cambie.
export function stripSupplierTags(readName: string): string {
  return readName.replace(/[*"“”][\s\S]*$/, '').trim()
}

// Llave con la que se busca un renglón en el catálogo y en los alias: nombre sin etiquetas, normalizado.
export function matchKey(readName: string): string {
  return normalizeName(stripSupplierTags(readName))
}

// Nombre que se propone para dar de alta: sin etiquetas, con los espacios juntos y las mayúsculas
// originales, para que el administrador lo reconozca tal como lo escribió el proveedor.
export function suggestedName(readName: string): string {
  return stripSupplierTags(readName).replace(/\s+/g, ' ').trim()
}
