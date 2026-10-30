// Una palabra del titular del panel: entra sola, con su retraso, para el revelado en secuencia.
export interface HeadlineWord {
  text: string;
  // Las palabras resaltadas van en ámbar (solo en texto grande: sobre tinta da 3.6:1).
  highlighted: boolean;
  // Salto de línea después de esta palabra.
  breakAfter: boolean;
  delaySeconds: number;
}
