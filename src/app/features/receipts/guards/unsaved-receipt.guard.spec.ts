import { TestBed } from '@angular/core/testing';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { ConfirmService } from '@core/confirm/confirm.service';
import type { ReceiptLeaveTarget } from '../models/receipt-upload-page.models';
import { unsavedReceiptGuard } from './unsaved-receipt.guard';

describe('unsavedReceiptGuard', () => {
  let ask: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ask = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: ConfirmService, useValue: { ask } }] });
  });

  const run = (target: ReceiptLeaveTarget) =>
    TestBed.runInInjectionContext(() =>
      unsavedReceiptGuard(target, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot),
    );
  const target = (busy: boolean, unsaved: boolean): ReceiptLeaveTarget =>
    ({ busy: () => busy, hasUnsavedChanges: () => unsaved });

  it('leyendo o confirmando no se sale y no se pregunta', async () => {
    expect(await run(target(true, false))).toBe(false);
    expect(await run(target(true, true))).toBe(false);
    expect(ask).not.toHaveBeenCalled();
  });

  it('en revisión pregunta «¿Descartar la remisión? No se registró nada.» con «Descartar» y «Seguir revisando»', async () => {
    ask.mockResolvedValue(true);
    await run(target(false, true));
    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '¿Descartar la remisión? No se registró nada.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Seguir revisando',
      }),
    );
  });

  it('en revisión, con «Descartar» sale y con «Seguir revisando» se queda', async () => {
    ask.mockResolvedValueOnce(true);
    expect(await run(target(false, true))).toBe(true);
    ask.mockResolvedValueOnce(false);
    expect(await run(target(false, true))).toBe(false);
  });

  it('en cualquier otro estado sale sin preguntar', async () => {
    expect(await run(target(false, false))).toBe(true);
    expect(ask).not.toHaveBeenCalled();
  });
});
