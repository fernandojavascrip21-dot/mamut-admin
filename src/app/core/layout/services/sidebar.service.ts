import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { SIDEBAR_COLLAPSED_KEY } from '../constants/sidebar.constants';

// Estado de la barra lateral de escritorio (mostrada u oculta). Se recuerda entre visitas como
// una preferencia del navegador; en el servidor (SSR) o con el almacenamiento bloqueado se
// parte siempre de «mostrada».
@Injectable({ providedIn: 'root' })
export class SidebarService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly collapsedState = signal(this.read());
  readonly collapsed = this.collapsedState.asReadonly();

  toggle(): void {
    const next = !this.collapsedState();
    this.collapsedState.set(next);
    this.write(next);
  }

  private read(): boolean {
    if (!this.isBrowser) return false;
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  }

  private write(collapsed: boolean): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      // Sin almacenamiento la preferencia solo dura mientras la pestaña esté abierta.
    }
  }
}
