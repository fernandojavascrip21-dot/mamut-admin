import { Injectable, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TOAST_DURATION_MS } from './constants/toast.constants';
import type { ToastTone } from './toast.models';

// Notificación flotante de la app («Producto guardado», «No se pudo guardar»). Es global
// (providedIn root, pintada por <p-toast> en app.html) para que sobreviva a la navegación:
// la edición guarda y regresa a Productos, y el aviso tiene que seguir visible ahí. Muestra uno
// a la vez: el nuevo reemplaza al anterior y se cierra solo; el error dura más para leerlo.
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly messages = inject(MessageService);

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  dismiss(): void {
    this.messages.clear();
  }

  // clear() antes de add() mantiene la regla de un solo aviso; PrimeNG cierra cada mensaje con
  // su propio `life`, así que un aviso viejo no puede cerrar al que lo reemplazó.
  private show(tone: ToastTone, message: string): void {
    this.messages.clear();
    this.messages.add({ severity: tone, summary: message, life: TOAST_DURATION_MS[tone] });
  }
}
