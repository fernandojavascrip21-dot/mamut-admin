import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/services/auth.service';
import { appConfig } from './app.config';

// Con la configuración real de la app, sin pedir CartService a mano: debe existir desde el arranque
// para borrar el carrito al cerrar sesión, aunque la página abierta no use el `top-nav` (p. ej. /cuenta
// tras recargar).
describe('appConfig', () => {
  const USER = { userId: 'v-luis', role: 'vendedor', clientId: null, fullName: 'Luis' };
  const CART_KEY = 'mamut.cart.v-luis';

  beforeEach(() => {
    localStorage.setItem('mamut.user', JSON.stringify(USER));
    localStorage.setItem(CART_KEY, JSON.stringify({ version: 1, lines: [{ productId: 1, units: 2 }] }));
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('cerrar sesión borra el carrito del usuario aunque nadie haya pedido CartService', () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    const auth = TestBed.inject(AuthService);
    TestBed.tick();
    expect(localStorage.getItem(CART_KEY)).not.toBeNull();

    auth.clearSession();
    TestBed.tick();

    expect(localStorage.getItem(CART_KEY)).toBeNull();
  });
});
