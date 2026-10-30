import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('muestra un aviso de éxito y se cierra solo a los 4 s', () => {
    service.success('Producto guardado');
    expect(service.current()).toEqual(expect.objectContaining({ tone: 'success', message: 'Producto guardado' }));
    vi.advanceTimersByTime(3999);
    expect(service.current()).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(service.current()).toBeNull();
  });

  it('el error dura 6 s', () => {
    service.error('No se pudo guardar');
    vi.advanceTimersByTime(5999);
    expect(service.current()?.tone).toBe('error');
    vi.advanceTimersByTime(1);
    expect(service.current()).toBeNull();
  });

  it('un aviso nuevo reemplaza al anterior y el temporizador viejo no lo cierra', () => {
    service.success('Primero');
    vi.advanceTimersByTime(3000);
    service.error('Segundo');
    vi.advanceTimersByTime(1000);
    expect(service.current()?.message).toBe('Segundo');
    vi.advanceTimersByTime(5000);
    expect(service.current()).toBeNull();
  });

  it('dismiss() lo cierra de inmediato', () => {
    service.success('Producto guardado');
    service.dismiss();
    expect(service.current()).toBeNull();
  });
});
