// Orden alfabético por nombre sin distinguir mayúsculas ni acentos («Ángel» junto a «Ana»).
// Lo comparten «Mis vendedores» (HU-09) y la barra «Viendo» (HU-10). Devuelve una copia: no
// reordena la lista que llegó del backend.
export function sortByName<T extends { fullName: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es', { sensitivity: 'base' }));
}
