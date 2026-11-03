// Clases de fondo de cada color de la barra y de la leyenda. Van escritas completas, porque
// Tailwind solo genera las utilidades que encuentra literales en el código (tokens --color-split-*
// de styles.css).
export const SPLIT_COLOR_CLASSES = [
  'bg-split-1',
  'bg-split-2',
  'bg-split-3',
  'bg-split-4',
  'bg-split-5',
] as const;

export const WAREHOUSE_COLOR_CLASS = 'bg-split-warehouse';
export const INACTIVE_COLOR_CLASS = 'bg-faint';

// Un segmento diminuto sigue viéndose: ancho mínimo en píxeles.
export const MIN_SEGMENT_WIDTH_PX = 4;
