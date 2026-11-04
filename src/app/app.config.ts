import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideEnvironmentInitializer } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { authInterceptor } from '@core/auth/services/auth.interceptor';
import { CartService } from '@core/cart/cart.service';
import { ViewingService } from '@core/viewing/viewing.service';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';
import { PRIMENG_CONFIG } from '@core/ui/constants/primeng.constants';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    providePrimeNG(PRIMENG_CONFIG),
    // No son providedIn root: el toast y el diálogo de confirmación (app.html) y quienes los
    // disparan (ToastService, ConfirmService) tienen que compartir la misma instancia.
    MessageService,
    ConfirmationService,
    // La barra «Viendo» se crea al arrancar, no al entrar a /admin: así ve cerrar sesión desde
    // cualquier pantalla (p. ej. /cuenta tras recargar) y borra la selección guardada (HU-10).
    provideEnvironmentInitializer(() => inject(ViewingService)),
    // Lo mismo con el carrito (HU-15): el servicio borra el carrito del usuario al cerrar sesión, y para
    // eso tiene que existir desde el arranque aunque la página abierta no use el `top-nav`.
    provideEnvironmentInitializer(() => inject(CartService)),
  ]
};
