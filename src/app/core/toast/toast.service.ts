import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TOAST_DURATION_MS } from './constants/toast.constants';
import type { ToastTone } from './toast.models';

// Notificación flotante de la app («Producto guardado», «No se pudo guardar»). Es global
// (providedIn root, pintada por el <p-toast> que monta ToastHostComponent en diferido) para que sobreviva a la navegación:
// la edición guarda y regresa a Productos, y el aviso tiene que seguir visible ahí. Muestra uno
// a la vez: el nuevo reemplaza al anterior y se cierra solo; el error dura más para leerlo.
// Si el aviso llega antes de que el toast diferido exista, queda en espera (solo el último, porque
// cada uno reemplaza al anterior) y se muestra en cuanto `markToastReady()` avisa.
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messages = inject(MessageService);
  private toastReady = false;
  private pending: { tone: ToastTone; message: string } | null = null;

  // Lo llama ToastHostComponent cuando el toast ya escucha los mensajes.
  markToastReady(): void {
    this.toastReady = true;
    if (!this.pending) return;
    const { tone, message } = this.pending;
    this.pending = null;
    this.show(tone, message);
  }

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  dismiss(): void {
    this.pending = null;
    this.messages.clear();
  }

  // clear() antes de add() mantiene la regla de un solo aviso; PrimeNG cierra cada mensaje con
  // su propio `life`, así que un aviso viejo no puede cerrar al que lo reemplazó.
  private show(tone: ToastTone, message: string): void {
    if (!this.toastReady) {
      this.pending = { tone, message };
      return;
    }
    this.messages.clear();
    this.messages.add({ severity: tone, summary: message, life: TOAST_DURATION_MS[tone] });
  }
}
