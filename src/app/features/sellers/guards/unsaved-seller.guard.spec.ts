import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ConfirmService } from '@core/confirm/confirm.service';
import type { EditSellerLeaveTarget } from '../models/edit-seller-page.models';
import { unsavedSellerGuard } from './unsaved-seller.guard';

describe('unsavedSellerGuard', () => {
  let ask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ask = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: ConfirmService, useValue: { ask } }] });
  });

  const run = (target: EditSellerLeaveTarget) =>
    TestBed.runInInjectionContext(() =>
      unsavedSellerGuard(target, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot),
    );
  const target = (saving: boolean, unsaved: boolean): EditSellerLeaveTarget =>
    ({ saving: () => saving, hasUnsavedChanges: () => unsaved });

  it('mientras guarda no se sale y no se pregunta', async () => {
    expect(await run(target(true, false))).toBe(false);
    expect(await run(target(true, true))).toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });

  it('sin cambios sale sin preguntar', async () => {
    expect(await run(target(false, false))).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });

  it('con cambios pregunta «¿Salir sin guardar?» con «Salir» y «Seguir editando»', async () => {
    ask.mockResolvedValue(true);
    await run(target(false, true));
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '¿Salir sin guardar?',
        message: 'Perderás los cambios en los datos del vendedor.',
        confirmLabel: 'Salir',
        cancelLabel: 'Seguir editando',
      }),
    );
  });

  it('con cambios, «Salir» sale y «Seguir editando» se queda', async () => {
    ask.mockResolvedValueOnce(true);
    expect(await run(target(false, true))).toBe(true);
    ask.mockResolvedValueOnce(false);
    expect(await run(target(false, true))).toBe(false);
  });
});
