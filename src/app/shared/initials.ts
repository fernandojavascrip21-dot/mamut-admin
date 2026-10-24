// Iniciales para el círculo de "Mi cuenta" (ver mockup Cuenta.dc.html). Un nombre de una sola
// palabra usa sus primeras dos letras ("Administrador" -> "AD"); con dos o más, la primera letra
// de cada una de las dos primeras ("Ana López" -> "AL").
export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
