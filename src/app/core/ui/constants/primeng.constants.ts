import type { PrimeNGConfigType } from 'primeng/config';
import { MAMMUT_THEME } from './mammut-theme.constants';
import { PRIMENG_LICENSE_KEY } from './primeng-license.generated';

export const PRIMENG_CONFIG = {
  license: PRIMENG_LICENSE_KEY,
  ripple: false,
  preflight: false,
  inputVariant: 'outlined',
  theme: {
    preset: MAMMUT_THEME,
    options: {
      darkModeSelector: 'none',
      cssLayer: {
        name: 'primeng',
        order: 'theme, base, primeng, components, utilities',
      },
    },
  },
  translation: {
    emptyMessage: 'No hay opciones disponibles',
    emptyFilterMessage: 'No se encontraron resultados',
    searchMessage: 'Hay {0} resultados disponibles',
    selectionMessage: '{0} elementos seleccionados',
    emptySelectionMessage: 'Ningún elemento seleccionado',
    emptySearchMessage: 'No se encontraron resultados',
    aria: {
      trueLabel: 'Marcado',
      falseLabel: 'Sin marcar',
      nullLabel: 'Sin selección',
      close: 'Cerrar',
      filter: 'Filtrar',
    },
  },
} satisfies PrimeNGConfigType;
