import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/services/auth.service';
import type { AuthContext } from '@core/auth/interfaces/auth.models';
import { CART_STORAGE_PREFIX, CART_STORAGE_VERSION } from './cart.constants';
import { CartService } from './cart.service';

const LUIS: AuthContext = { userId: 'v-luis', role: 'vendedor', clientId: null, fullName: 'Luis' };
const VALERIA: AuthContext = { userId: 'v-valeria', role: 'vendedor', clientId: null, fullName: 'Valeria' };
const keyOf = (user: AuthContext) => `${CART_STORAGE_PREFIX}${user.userId}`;

describe('CartService', () => {
  let user: ReturnType<typeof signal<AuthContext | null>>;

  // Crea el servicio con una sesión simulada; `TestBed.tick()` corre el efecto que carga el carrito.
  function create(initial: AuthContext | null = LUIS): CartService {
    user = signal<AuthContext | null>(initial);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { currentUser: user.asReadonly() } }],
    });
    const service = TestBed.inject(CartService);
    TestBed.tick();
    return service;
  }

  const stored = (u: AuthContext) => localStorage.getItem(keyOf(u));

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('piezas', () => {
    it('arranca vacío', () => {
      const cart = create();
      expect(cart.lines()).toEqual([]);
      expect(cart.totalUnits()).toBe(0);
      expect(cart.unitsOf(10)).toBe(0);
    });

    it('setUnits agrega un producto nuevo al final y totalUnits suma las piezas', () => {
      const cart = create();
      cart.setUnits(10, 2);
      cart.setUnits(12, 3);
      expect(cart.lines()).toEqual([{ productId: 10, units: 2 }, { productId: 12, units: 3 }]);
      expect(cart.unitsOf(12)).toBe(3);
      expect(cart.totalUnits()).toBe(5);
    });

    it('setUnits de un producto que ya está cambia sus piezas sin moverlo de lugar', () => {
      const cart = create();
      cart.setUnits(10, 2);
      cart.setUnits(12, 3);
      cart.setUnits(10, 5);
      expect(cart.lines()).toEqual([{ productId: 10, units: 5 }, { productId: 12, units: 3 }]);
    });

    it('setUnits con 0 o menos quita el producto', () => {
      const cart = create();
      cart.setUnits(10, 2);
      cart.setUnits(12, 3);
      cart.setUnits(10, 0);
      cart.setUnits(12, -1);
      expect(cart.lines()).toEqual([]);
    });

    it('ignora piezas que no son un entero y productos que no son un id válido', () => {
      const cart = create();
      cart.setUnits(10, 1.5);
      cart.setUnits(10, Number.NaN);
      cart.setUnits(0, 2);
      cart.setUnits(-3, 2);
      cart.setUnits(2.5, 2);
      expect(cart.lines()).toEqual([]);
      expect(stored(LUIS)).toBeNull();
    });

    it('remove quita un producto y es inocuo si no está', () => {
      const cart = create();
      cart.setUnits(10, 2);
      cart.setUnits(12, 3);
      cart.remove(10);
      cart.remove(99);
      expect(cart.lines()).toEqual([{ productId: 12, units: 3 }]);
    });

    it('clear vacía el carrito', () => {
      const cart = create();
      cart.setUnits(10, 2);
      cart.clear();
      expect(cart.lines()).toEqual([]);
      expect(cart.totalUnits()).toBe(0);
    });
  });

  describe('persistencia', () => {
    it('guarda en mamut.cart.<userId> con versión y solo productId y piezas', () => {
      const cart = create();
      cart.setUnits(10, 2);
      expect(JSON.parse(stored(LUIS)!)).toEqual({ version: CART_STORAGE_VERSION, lines: [{ productId: 10, units: 2 }] });
    });

    it('un servicio nuevo recupera el carrito guardado (recarga)', () => {
      create().setUnits(10, 2);
      TestBed.resetTestingModule();
      const cart = create();
      expect(cart.lines()).toEqual([{ productId: 10, units: 2 }]);
      expect(cart.totalUnits()).toBe(2);
    });

    it('un carrito vacío borra la llave en vez de guardar una lista vacía', () => {
      const cart = create();
      cart.setUnits(10, 2);
      cart.remove(10);
      expect(stored(LUIS)).toBeNull();
    });

    it('al cerrar sesión borra la llave del usuario que salió y vacía el carrito', () => {
      const cart = create();
      cart.setUnits(10, 2);
      user.set(null);
      TestBed.tick();
      expect(stored(LUIS)).toBeNull();
      expect(cart.lines()).toEqual([]);
    });

    it('sin sesión no guarda nada, pero el carrito funciona en memoria', () => {
      const cart = create(null);
      cart.setUnits(10, 2);
      expect(cart.totalUnits()).toBe(2);
      expect(localStorage.length).toBe(0);
    });

    it('otro usuario en el mismo navegador empieza con el carrito vacío y no toca el del primero', () => {
      const cart = create();
      cart.setUnits(10, 2);
      user.set(VALERIA);
      TestBed.tick();
      expect(cart.lines()).toEqual([]);
      cart.setUnits(12, 1);
      expect(JSON.parse(stored(VALERIA)!).lines).toEqual([{ productId: 12, units: 1 }]);
      expect(JSON.parse(stored(LUIS)!).lines).toEqual([{ productId: 10, units: 2 }]);
    });

    it('al volver a entrar el mismo usuario recupera su carrito', () => {
      const cart = create();
      cart.setUnits(10, 2);
      user.set(VALERIA);
      TestBed.tick();
      user.set(LUIS);
      TestBed.tick();
      expect(cart.lines()).toEqual([{ productId: 10, units: 2 }]);
    });
  });

  describe('datos guardados inválidos', () => {
    const seed = (raw: string) => localStorage.setItem(keyOf(LUIS), raw);

    it.each([
      ['JSON inválido', '{no es json'],
      ['otra versión', JSON.stringify({ version: CART_STORAGE_VERSION + 1, lines: [{ productId: 1, units: 1 }] })],
      ['sin versión', JSON.stringify({ lines: [{ productId: 1, units: 1 }] })],
      ['lines que no es lista', JSON.stringify({ version: CART_STORAGE_VERSION, lines: 'x' })],
      ['un valor que no es objeto', JSON.stringify(7)],
      ['null', 'null'],
      ['un renglón sin piezas', JSON.stringify({ version: CART_STORAGE_VERSION, lines: [{ productId: 1 }] })],
      ['piezas decimales', JSON.stringify({ version: CART_STORAGE_VERSION, lines: [{ productId: 1, units: 1.5 }] })],
      ['piezas en 0', JSON.stringify({ version: CART_STORAGE_VERSION, lines: [{ productId: 1, units: 0 }] })],
      ['productId negativo', JSON.stringify({ version: CART_STORAGE_VERSION, lines: [{ productId: -1, units: 1 }] })],
      ['un renglón que no es objeto', JSON.stringify({ version: CART_STORAGE_VERSION, lines: [3] })],
      [
        'un producto repetido',
        JSON.stringify({ version: CART_STORAGE_VERSION, lines: [{ productId: 1, units: 1 }, { productId: 1, units: 2 }] }),
      ],
    ])('descarta el carrito guardado con %s', (_label, raw) => {
      seed(raw);
      const cart = create();
      expect(cart.lines()).toEqual([]);
      expect(cart.totalUnits()).toBe(0);
    });

    it('un carrito válido se recupera tal cual', () => {
      seed(JSON.stringify({ version: CART_STORAGE_VERSION, lines: [{ productId: 1, units: 2 }, { productId: 3, units: 1 }] }));
      expect(create().lines()).toEqual([{ productId: 1, units: 2 }, { productId: 3, units: 1 }]);
    });
  });

  describe('sin localStorage', () => {
    it('si leer lanza, arranca vacío; si escribir lanza, el carrito sigue funcionando en memoria', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('bloqueado');
      });
      const cart = create();
      expect(cart.lines()).toEqual([]);
      expect(() => cart.setUnits(10, 2)).not.toThrow();
      expect(cart.totalUnits()).toBe(2);
      expect(() => cart.remove(10)).not.toThrow();
      expect(cart.totalUnits()).toBe(0);
    });
  });
});
