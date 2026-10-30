import { Injectable, signal } from '@angular/core';
import { TOAST_DURATION_MS } from './constants/toast.constants';
import type { Toast, ToastTone } from './components/toast/toast.models';

// Notificación flotante de la app («Producto guardado», «No se pudo guardar»). Es global
// (providedIn root, pintada por <app-toast> en app.html) para que sobreviva a la navegación:
// la edición guarda y regresa a Productos, y el aviso tiene que seguir visible ahí. Muestra uno
// a la vez: el nuevo reemplaza al anterior y se cierra solo; el error dura más para leerlo.
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toast = signal<Toast | null>(null);
  readonly current = this.toast.asReadonly();

  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  dismiss(): void {
    this.clearTimer();
    this.toast.set(null);
  }

  // El id evita que el temporizador de un aviso anterior cierre al que lo reemplazó.
  private show(tone: ToastTone, message: string): void {
    this.clearTimer();
    const id = this.nextId++;
    this.toast.set({ id, tone, message });
    this.timer = setTimeout(() => {
      if (this.toast()?.id === id) this.dismiss();
    }, TOAST_DURATION_MS[tone]);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}
