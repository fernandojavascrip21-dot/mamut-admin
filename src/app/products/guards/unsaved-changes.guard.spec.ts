import { vi } from 'vitest';
import { cambiosSinGuardarGuard, type ConCambiosSinGuardar } from './cambios-sin-guardar.guard';

describe('cambiosSinGuardarGuard', () => {
  const run = (component: ConCambiosSinGuardar) =>
    cambiosSinGuardarGuard(component, {} as never, {} as never, {} as never);

  it('sin cambios deja salir sin preguntar', () => {
    const confirmarDescartar = vi.fn().mockResolvedValue(false);
    expect(run({ tieneCambiosSinGuardar: () => false, confirmarDescartar })).toBe(true);
    expect(confirmarDescartar).not.toHaveBeenCalled();
  });

  it('con cambios devuelve la decisión del diálogo', async () => {
    for (const decision of [false, true]) {
      const confirmarDescartar = vi.fn().mockResolvedValue(decision);
      expect(await run({ tieneCambiosSinGuardar: () => true, confirmarDescartar })).toBe(decision);
      expect(confirmarDescartar).toHaveBeenCalledOnce();
    }
  });
});
