import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService.warn', () => {
  let service: ToastService;
  let messages: { add: ReturnType<typeof vi.fn>; clear: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    messages = { add: vi.fn(), clear: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MessageService, useValue: messages }] });
    service = TestBed.inject(ToastService);
  });

  it('muestra un aviso con severidad de advertencia y su texto', () => {
    service.markToastReady();
    service.warn('Se desactivó, pero no se pudo avisarle por correo');
    expect(messages.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'warn', summary: 'Se desactivó, pero no se pudo avisarle por correo' }),
    );
  });

  it('le da una duración para cerrarse solo', () => {
    service.markToastReady();
    service.warn('Aviso');
    const [message] = messages.add.mock.calls[0] as [{ life: number }];
    expect(message.life).toBeGreaterThan(0);
  });

  it('un aviso de advertencia limpia el anterior, como los demás', () => {
    service.markToastReady();
    service.success('Primero');
    service.warn('Segundo');
    expect(messages.clear).toHaveBeenCalledTimes(2);
    expect(messages.add).toHaveBeenCalledTimes(2);
  });

  it('antes de que exista el toast diferido queda en espera y se muestra al estar listo', () => {
    service.warn('En espera');
    expect(messages.add).not.toHaveBeenCalled();
    service.markToastReady();
    expect(messages.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warn', summary: 'En espera' }));
  });
});
