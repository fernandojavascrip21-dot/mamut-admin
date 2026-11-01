import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners, provideEnvironmentInitializer } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { authInterceptor } from '@core/auth/services/auth.interceptor';
import { ViewingService } from '@core/viewing/viewing.service';
import { providePrimeNG } from 'primeng/config';
import { PRIMENG_CONFIG } from '@core/ui/constants/primeng.constants';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    providePrimeNG(PRIMENG_CONFIG),
    // La barra «Viendo» se crea al arrancar, no al entrar a /admin: así ve cerrar sesión desde
    // cualquier pantalla (p. ej. /cuenta tras recargar) y borra la selección guardada (HU-10).
    provideEnvironmentInitializer(() => inject(ViewingService)),
  ]
};
