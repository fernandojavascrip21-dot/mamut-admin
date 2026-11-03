import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@core/auth/services/auth.service';
import { CART_STORAGE_PREFIX, CART_STORAGE_VERSION } from './cart.constants';
import type { CartLine, StoredCart } from './cart.models';

// El carrito de la venta en curso (HU-15): qué productos y cuántas piezas eligió el usuario en sesión.
// Vive en root para mantenerse entre «Vender» y «Carrito», y se guarda en localStorage por usuario
// para sobrevivir a recargar o cerrar la pestaña. No conoce el stock: el tope de piezas lo aplican las
// pantallas antes de llamar a `setUnits`, y el backend lo vuelve a validar al confirmar (HU-16).
// Ver specs/M3-hu15-vender-catalogo-carrito/spec.md §2 y §4.
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly auth = inject(AuthService);
  // localStorage no existe en el render de servidor: ahí el carrito vive solo en memoria.
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly linesSignal = signal<CartLine[]>([]);
  // Llave del usuario cuyo carrito está cargado; sirve para borrarla cuando esa sesión se cierra.
  private storageKey: string | null = null;

  readonly lines = this.linesSignal.asReadonly();
  readonly totalUnits = computed(() => this.linesSignal().reduce((sum, line) => sum + line.units, 0));

  constructor() {
    // Con cada cambio de sesión se cambia de carrito. Al cerrar sesión se borra el del usuario que
    // salió; al entrar otro usuario se carga el suyo (o uno vacío), nunca el del anterior.
    effect(() => {
      const user = this.auth.currentUser();
      const nextKey = user ? `${CART_STORAGE_PREFIX}${user.userId}` : null;
      if (nextKey === this.storageKey) return;
      if (this.storageKey !== null && nextKey === null) this.removeStored(this.storageKey);
      this.storageKey = nextKey;
      this.linesSignal.set(nextKey ? this.readStored(nextKey) : []);
    });
  }

  // Piezas de un producto en el carrito; 0 si no está.
  unitsOf(productId: number): number {
    return this.linesSignal().find((line) => line.productId === productId)?.units ?? 0;
  }

  // Pone las piezas de un producto. 0 o menos lo quita; un valor que no sea entero, o un producto que
  // no sea un id válido, se ignora para no guardar basura. Un producto nuevo va al final.
  setUnits(productId: number, units: number): void {
    if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(units)) return;
    if (units <= 0) {
      this.remove(productId);
      return;
    }
    const lines = this.linesSignal();
    const exists = lines.some((line) => line.productId === productId);
    this.commit(
      exists
        ? lines.map((line) => (line.productId === productId ? { productId, units } : line))
        : [...lines, { productId, units }],
    );
  }

  remove(productId: number): void {
    const lines = this.linesSignal();
    if (!lines.some((line) => line.productId === productId)) return;
    this.commit(lines.filter((line) => line.productId !== productId));
  }

  clear(): void {
    if (this.linesSignal().length === 0) return;
    this.commit([]);
  }

  // Punto único donde el carrito cambia: se refleja en el signal y se guarda. Un carrito vacío borra
  // la llave en vez de guardar `[]`.
  private commit(lines: CartLine[]): void {
    this.linesSignal.set(lines);
    if (this.storageKey === null) return;
    if (lines.length === 0) {
      this.removeStored(this.storageKey);
      return;
    }
    const stored: StoredCart = { version: CART_STORAGE_VERSION, lines };
    this.writeStored(this.storageKey, JSON.stringify(stored));
  }

  // Lee y valida lo guardado. Otra versión, JSON inválido o cualquier renglón mal formado descartan
  // el carrito entero: es preferible empezar vacío que mostrar piezas que el usuario no eligió.
  private readStored(key: string): CartLine[] {
    const raw = this.read(key);
    if (raw === null) return [];
    try {
      const data: unknown = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return [];
      const { version, lines } = data as Partial<StoredCart>;
      if (version !== CART_STORAGE_VERSION || !Array.isArray(lines)) return [];
      const seen = new Set<number>();
      const valid: CartLine[] = [];
      for (const line of lines as unknown[]) {
        if (typeof line !== 'object' || line === null) return [];
        const { productId, units } = line as Partial<CartLine>;
        if (!Number.isInteger(productId) || !Number.isInteger(units)) return [];
        if ((productId as number) <= 0 || (units as number) <= 0 || seen.has(productId as number)) return [];
        seen.add(productId as number);
        valid.push({ productId: productId as number, units: units as number });
      }
      return valid;
    } catch {
      return [];
    }
  }

  // Todo acceso a localStorage va en try/catch: puede faltar (SSR), estar bloqueado o lanzar, y el
  // carrito debe seguir funcionando en memoria.
  private read(key: string): string | null {
    if (!this.isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStored(key: string, value: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Sin almacenamiento el carrito sigue en memoria.
    }
  }

  private removeStored(key: string): void {
    if (!this.isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Igual que arriba.
    }
  }
}
