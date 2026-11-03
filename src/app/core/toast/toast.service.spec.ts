import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;
  let messages: { add: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    messages = { add: vi.fn(), clear: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MessageService, useValue: messages }] });
    service = TestBed.inject(ToastService);
    service.markToastReady();
  });

  it('un aviso de éxito se muestra con su texto y dura 4 s', () => {
    service.success('Producto guardado');
    expect(messages.add).toHaveBeenCalledWith({ severity: 'success', summary: 'Producto guardado', life: 4000 });
  });

  it('el error dura 6 s', () => {
    service.error('No se pudo guardar');
    expect(messages.add).toHaveBeenCalledWith({ severity: 'error', summary: 'No se pudo guardar', life: 6000 });
  });

  it('un aviso nuevo limpia el anterior antes de mostrarse', () => {
    service.success('Primero');
    service.error('Segundo');
    expect(messages.clear).toHaveBeenCalledTimes(2);
    expect(messages.clear.mock.invocationCallOrder[1]).toBeLessThan(messages.add.mock.invocationCallOrder[1]);
  });

  it('dismiss() lo cierra de inmediato', () => {
    service.dismiss();
    expect(messages.clear).toHaveBeenCalledTimes(1);
    expect(messages.add).not.toHaveBeenCalled();
  });

  describe('antes de que exista el toast diferido', () => {
    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [{ provide: MessageService, useValue: messages }] });
      service = TestBed.inject(ToastService);
      messages.add.mockClear();
      messages.clear.mockClear();
    });

    it('el aviso queda en espera y se muestra en cuanto el toast está listo', () => {
      service.error('Credenciales inválidas');
      expect(messages.add).not.toHaveBeenCalled();
      service.markToastReady();
      expect(messages.add).toHaveBeenCalledWith({ severity: 'error', summary: 'Credenciales inválidas', life: 6000 });
    });

    it('si llegan varios, solo se muestra el último', () => {
      service.success('Primero');
      service.error('Segundo');
      service.markToastReady();
      expect(messages.add).toHaveBeenCalledTimes(1);
      expect(messages.add).toHaveBeenCalledWith({ severity: 'error', summary: 'Segundo', life: 6000 });
    });

    it('dismiss() descarta el aviso en espera', () => {
      service.success('Pendiente');
      service.dismiss();
      service.markToastReady();
      expect(messages.add).not.toHaveBeenCalled();
    });
  });
});
