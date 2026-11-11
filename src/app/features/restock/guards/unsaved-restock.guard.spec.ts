import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ConfirmService } from '@core/confirm/confirm.service';
import type { RestockLeaveTarget } from '../models/restock-page.models';
import { unsavedRestockGuard } from './unsaved-restock.guard';

describe('unsavedRestockGuard', () => {
  let ask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ask = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: ConfirmService, useValue: { ask } }] });
  });

  const run = (target: RestockLeaveTarget) =>
    TestBed.runInInjectionContext(() =>
      unsavedRestockGuard(target, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot),
    );
  const target = (unsaved: boolean, saving = false): RestockLeaveTarget =>
    ({ hasUnsavedChanges: () => unsaved, saving: () => saving });

  it('sin cambios deja salir sin preguntar', async () => {
    expect(await run(target(false))).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('con cambios pregunta «¿Salir sin guardar?» con «Salir» y «Seguir editando»', async () => {
    ask.mockResolvedValue(true);
    await run(target(true));
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '¿Salir sin guardar? Se pierden los cambios del pedido.',
        confirmLabel: 'Salir',
        cancelLabel: 'Seguir editando',
      }),
    );
  });

  it('con «Salir» deja salir', async () => {
    ask.mockResolvedValue(true);
    expect(await run(target(true))).toBe(true);
  });

  it('con «Seguir editando» se queda', async () => {
    ask.mockResolvedValue(false);
    expect(await run(target(true))).toBe(false);
  });

  it('mientras un envío está en curso no se sale y no se pregunta', async () => {
    expect(await run(target(true, true))).toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });
});
