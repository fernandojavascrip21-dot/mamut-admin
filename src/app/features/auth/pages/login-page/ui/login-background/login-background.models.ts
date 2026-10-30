// Una columna del fondo del login: un «nivel de stock» dibujado como la barra de reparto
// (bodega abajo en tinta, luego ámbar y café, arena arriba).
export interface StockBar {
  // Altura de la columna en % del área animada (que ocupa la parte baja de la pantalla).
  heightPercent: number;
  // Proporción de cada segmento, de abajo hacia arriba: tinta, ámbar, café, arena.
  segments: readonly [number, number, number, number];
  // Duración de una subida o bajada, en segundos; con distintas duraciones no se mueven al unísono.
  durationSeconds: number;
  // Retraso negativo, en segundos, para que cada columna arranque a media animación.
  delaySeconds: number;
  // En móvil solo se dibujan las columnas marcadas, para no saturar una pantalla angosta.
  showOnMobile: boolean;
}
