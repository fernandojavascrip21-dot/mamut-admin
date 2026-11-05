import { PLATFORM_ID, Injectable, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@core/auth/services/auth.service';
import { LOW_STOCK_NOTICE_STORAGE_KEY } from './low-stock-notice.constants';

// Si el administrador ya cerró la tarjeta ámbar «N productos con baja existencia» de «Stock general»
// (HU-18, spec §10). La tarjeta es para verla al iniciar sesión: una vez cerrada no vuelve en esa sesión
// (aunque se navegue, se cambie de vendedor o se recargue la pestaña) y reaparece en el siguiente inicio
// de sesión. Vive en root porque la página de stock se destruye al navegar, y guarda el estado en
// sessionStorage (como `ViewingService`) para sobrevivir a recargar. Las notificaciones del botón
// «Baja existencia» no dependen de esto. Se crea al arrancar (`app.config.ts`) para ver cerrar sesión
// desde cualquier pantalla.
@Injectable({ providedIn: 'root' })
export class LowStockNoticeService {
  private readonly auth = inject(AuthService);
  // sessionStorage no existe en el render de servidor: ahí la tarjeta nunca está cerrada.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly dismissedSignal = signal(this.readStored());
  readonly dismissed = this.dismissedSignal.asReadonly();

  constructor() {
    // Al cerrar sesión (o si el token vence y la sesión se limpia) se olvida: el siguiente inicio de
    // sesión vuelve a mostrar la tarjeta, aunque entre otra cuenta en la misma pestaña.
    effect(() => {
      if (this.auth.currentUser() !== null) return;
      this.write(false);
    });
  }

  dismiss(): void {
    this.write(true);
  }

  private write(dismissed: boolean): void {
    this.dismissedSignal.set(dismissed);
    if (!this.isBrowser) return;
    if (dismissed) sessionStorage.setItem(LOW_STOCK_NOTICE_STORAGE_KEY, '1');
    else sessionStorage.removeItem(LOW_STOCK_NOTICE_STORAGE_KEY);
  }

  private readStored(): boolean {
    return this.isBrowser && sessionStorage.getItem(LOW_STOCK_NOTICE_STORAGE_KEY) === '1';
  }
}
