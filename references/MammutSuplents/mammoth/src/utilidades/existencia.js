/**
 * Reglas de inventario (una sola fuente de verdad):
 *   4 o más -> Disponible  · 1 a 3 -> Últimas piezas · 0 -> Agotado
 */
export function estadoExistencia(existencia) {
  const n = Number(existencia) || 0
  if (n === 0) {
    return {
      clave: 'agotado',
      etiqueta: 'Agotado',
      clase: 'insignia-agotado',
      color: 'text-ladrillo',
      texto: 'Sin existencia por ahora',
      disponible: false
    }
  }
  if (n <= 3) {
    return {
      clave: 'ultimas',
      etiqueta: 'Últimas piezas',
      clase: 'insignia-ultimas',
      color: 'text-ambar',
      texto: n === 1 ? '1 pieza disponible' : n + ' piezas disponibles',
      disponible: true
    }
  }
  return {
    clave: 'disponible',
    etiqueta: 'Disponible',
    clase: 'insignia-disponible',
    color: 'text-oliva',
    texto: n + ' piezas disponibles',
    disponible: true
  }
}
