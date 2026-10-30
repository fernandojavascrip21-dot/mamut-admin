// Una columna del fondo del panel oscuro del login: un «nivel de stock» en capas (café abajo,
// luego ámbar, arena y crema arriba).
export interface StockBar {
  // Altura de la columna en % del área animada (que ocupa la parte baja de la pantalla).
  heightPercent: number;
  // Proporción de cada segmento, de abajo hacia arriba: café, ámbar, arena, crema.
  segments: readonly [number, number, number, number];
  // Duración de una subida o bajada, en segundos; con distintas duraciones no se mueven al unísono.
  durationSeconds: number;
  // Retraso negativo, en segundos, para que cada columna arranque a media animación.
  delaySeconds: number;
  // Retraso de la entrada (la columna crece desde cero), en segundos: de izquierda a derecha.
  growDelaySeconds: number;
  // En móvil solo se dibujan las columnas marcadas, para no saturar una pantalla angosta.
  showOnMobile: boolean;
}
