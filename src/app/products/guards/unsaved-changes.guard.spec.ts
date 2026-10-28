import { vi } from 'vitest';
import { unsavedChangesGuard, type HasUnsavedChanges } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  const run = (component: HasUnsavedChanges) =>
    unsavedChangesGuard(component, {} as never, {} as never, {} as never);

  it('sin cambios deja salir sin preguntar', () => {
    const confirmDiscard = vi.fn().mockResolvedValue(false);
    expect(run({ hasUnsavedChanges: () => false, confirmDiscard })).toBe(true);
    expect(confirmDiscard).not.toHaveBeenCalled();
  });

  it('con cambios devuelve la decisión del diálogo', async () => {
    for (const decision of [false, true]) {
      const confirmDiscard = vi.fn().mockResolvedValue(decision);
      expect(await run({ hasUnsavedChanges: () => true, confirmDiscard })).toBe(decision);
      expect(confirmDiscard).toHaveBeenCalledOnce();
    }
  });
});
