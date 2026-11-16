// Forma de un sustantivo según la cantidad: solo 1 va en singular; 0 y el resto, en plural («0 piezas»,
// «2 piezas»). Devuelve solo la palabra: el texto pone el número aparte, así cada pantalla decide su orden.
export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
