import { MAMMUT_THEME } from './mammut-theme.constants';

describe('Tema Mammut de PrimeNG', () => {
  it('resuelve todas las referencias de los controles de Aura sin depender de su preset completo', () => {
    const paths = new Set<string>();
    const references = new Set<string>();

    // PrimeUI convierte nombres camelCase a rutas con puntos al resolver los tokens.
    function visit(value: unknown, path = ''): void {
      if (typeof value === 'string') {
        paths.add(path);
        for (const match of value.matchAll(/\{([a-z0-9.]+)\}/g)) references.add(match[1]);
        return;
      }
      if (typeof value !== 'object' || value === null) return;
      for (const [key, child] of Object.entries(value)) {
        const segment = key.replace(/[A-Z]/g, (letter) => `.${letter.toLowerCase()}`);
        visit(child, path ? `${path}.${segment}` : segment);
      }
    }

    visit(MAMMUT_THEME.primitive);
    visit(MAMMUT_THEME.semantic);
    visit(MAMMUT_THEME.components, 'components');
    expect([...references].filter((reference) => !paths.has(reference))).toEqual([]);
  });
});
