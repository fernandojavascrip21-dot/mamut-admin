import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from '@core/auth/services/auth.service';
import { newUuid } from '@shared/utils/uuid';
import {
  CART_STORAGE_PREFIX,
  CART_STORAGE_VERSION,
  LEGACY_CART_STORAGE_VERSION,
  REQUEST_ID_PATTERN,
} from './cart.constants';
import type { CartLine, ReadCart, StoredCart } from './cart.models';

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
  // Llave de idempotencia de la venta en curso: se crea al confirmar por primera vez y vive con los
  // renglones, así un reintento tras recargar no duplica la venta. Se descarta al vaciar el carrito.
  private requestId: string | null = null;
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
      const cart = nextKey ? this.readStored(nextKey) : { lines: [], requestId: null };
      this.requestId = cart.requestId;
      this.linesSignal.set(cart.lines);
    });
  }

  // Piezas de un producto en el carrito; 0 si no está.
  unitsOf(productId: number): number {
    return this.linesSignal().find((line) => line.productId === productId)?.units ?? 0;
  }

  // Llave de la venta en curso: la guardada con el carrito o una nueva que se guarda en ese momento.
  // Sin renglones no hay nada que guardar, así que esa llave solo vive en memoria hasta que los haya.
  saleRequestId(): string {
    if (this.requestId === null) {
      this.requestId = newUuid();
      this.persist();
    }
    return this.requestId;
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

  // Punto único donde los renglones cambian: se reflejan en el signal y se guardan. Un carrito vacío
  // descarta también el `requestId`: la siguiente venta es otra y necesita otra llave.
  private commit(lines: CartLine[]): void {
    this.linesSignal.set(lines);
    if (lines.length === 0) this.requestId = null;
    this.persist();
  }

  // Escribe el carrito en localStorage. Un carrito vacío borra la llave en vez de guardar `[]`.
  private persist(): void {
    if (this.storageKey === null) return;
    const lines = this.linesSignal();
    if (lines.length === 0) {
      this.removeStored(this.storageKey);
      return;
    }
    const stored: StoredCart = {
      version: CART_STORAGE_VERSION,
      lines,
      ...(this.requestId === null ? {} : { requestId: this.requestId }),
    };
    this.writeStored(this.storageKey, JSON.stringify(stored));
  }

  // Lee y valida lo guardado. Otra versión (la 1 sí se acepta, sin llave), JSON inválido, un
  // `requestId` que no es UUID o cualquier renglón mal formado descartan el carrito entero: es
  // preferible empezar vacío que mostrar piezas que el usuario no eligió.
  private readStored(key: string): ReadCart {
    const empty: ReadCart = { lines: [], requestId: null };
    const raw = this.read(key);
    if (raw === null) return empty;
    try {
      const data: unknown = JSON.parse(raw);
      if (typeof data !== 'object' || data === null) return empty;
      const { version, lines, requestId } = data as Partial<StoredCart>;
      if (version !== CART_STORAGE_VERSION && version !== LEGACY_CART_STORAGE_VERSION) return empty;
      if (!Array.isArray(lines)) return empty;
      if (requestId !== undefined && (typeof requestId !== 'string' || !REQUEST_ID_PATTERN.test(requestId))) {
        return empty;
      }
      const seen = new Set<number>();
      const valid: CartLine[] = [];
      for (const line of lines as unknown[]) {
        if (typeof line !== 'object' || line === null) return empty;
        const { productId, units } = line as Partial<CartLine>;
        if (!Number.isInteger(productId) || !Number.isInteger(units)) return empty;
        if ((productId as number) <= 0 || (units as number) <= 0 || seen.has(productId as number)) return empty;
        seen.add(productId as number);
        valid.push({ productId: productId as number, units: units as number });
      }
      // Un carrito sin renglones no tiene venta en curso, aunque traiga llave.
      return { lines: valid, requestId: valid.length > 0 ? (requestId ?? null) : null };
    } catch {
      return empty;
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
