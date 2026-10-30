import { DestroyRef, Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, Subject, Subscription } from 'rxjs';
import { API_BASE_URL } from '@core/api-base-url';
import { AuthService } from '@core/auth/services/auth.service';
import { sortByName } from '@shared/utils/sort-by-name';
import { VIEWING_STORAGE_KEY } from './constants/viewing.constants';
import type { ViewingListStatus, ViewingSeller } from './interfaces/viewing.models';

// A quién está viendo el administrador en la barra «Viendo» (HU-10): «Yo · bodega» (null) o un
// vendedor activo. Vive en root para mantenerse entre pantallas, y guarda el id en
// sessionStorage para sobrevivir a recargar la pestaña. Ver specs/M2-hu10-barra-viendo/spec.md §2.
@Injectable({ providedIn: 'root' })
export class ViewingService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  // sessionStorage no existe en el render de servidor: ahí la selección siempre es «Yo».
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly storedId = signal<string | null>(this.readStored());
  private readonly sellersSignal = signal<ViewingSeller[]>([]);
  private readonly statusSignal = signal<ViewingListStatus>('loading');
  private readonly pickedSubject = new Subject<string | null>();
  private loaded = false;
  private request: Subscription | null = null;

  readonly sellers = this.sellersSignal.asReadonly();
  readonly listStatus = this.statusSignal.asReadonly();

  // Selección efectiva: el id guardado solo cuenta cuando la lista cargada lo confirma, para no
  // «ver» a un vendedor desactivado o cuyo nombre la barra no puede mostrar.
  readonly selectedSeller = computed<ViewingSeller | null>(() => {
    const id = this.storedId();
    if (id === null || this.statusSignal() !== 'ready') return null;
    return this.sellersSignal().find((seller) => seller.id === id) ?? null;
  });
  readonly selectedSellerId = computed(() => this.selectedSeller()?.id ?? null);

  // Solo emite cuando el administrador elige en la barra (no cuando una página fija la
  // selección con select()), para que las páginas naveguen sin entrar en bucle.
  readonly picked: Observable<string | null> = this.pickedSubject.asObservable();

  constructor() {
    // Al cerrar sesión vuelve a «Yo» y olvida la lista, para que otra cuenta que entre en la
    // misma pestaña no herede la selección ni los vendedores.
    effect(() => {
      if (this.auth.currentUser() !== null) return;
      this.write(null);
      this.request?.unsubscribe();
      this.loaded = false;
      this.sellersSignal.set([]);
      this.statusSignal.set('loading');
    });
  }

  // La primera llamada pide la lista; las siguientes no hacen nada. La llama admin-shell, así
  // que un vendedor nunca pide GET /api/sellers.
  // En el render de servidor no hay sesión ni selección: no se pide nada.
  load(): void {
    if (this.loaded || !this.isBrowser) return;
    this.reload();
  }

  // Vuelve a pedir la lista («Reintentar», o después de dar de alta a un vendedor).
  reload(): void {
    this.loaded = true;
    this.request?.unsubscribe();
    this.statusSignal.set('loading');
    this.request = this.http
      .get<ViewingSeller[]>(`${API_BASE_URL}/api/sellers`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          const sellers = sortByName(rows.map(({ id, fullName }) => ({ id, fullName })));
          this.sellersSignal.set(sellers);
          this.statusSignal.set('ready');
          // Un id guardado que ya no está activo regresa a «Yo» sin aviso.
          const id = this.storedId();
          if (id !== null && !sellers.some((seller) => seller.id === id)) this.write(null);
        },
        error: () => {
          this.sellersSignal.set([]);
          this.statusSignal.set('error');
        },
      });
  }

  // Elección en la barra: guarda y avisa a las páginas que reaccionan (picked).
  pick(sellerId: string | null): void {
    this.write(sellerId);
    this.pickedSubject.next(sellerId);
  }

  // Selección fijada por una página (p. ej. al abrir el detalle de un vendedor): guarda sin emitir picked.
  select(sellerId: string | null): void {
    this.write(sellerId);
  }

  private write(sellerId: string | null): void {
    this.storedId.set(sellerId);
    if (!this.isBrowser) return;
    if (sellerId === null) sessionStorage.removeItem(VIEWING_STORAGE_KEY);
    else sessionStorage.setItem(VIEWING_STORAGE_KEY, sellerId);
  }

  private readStored(): string | null {
    return this.isBrowser ? sessionStorage.getItem(VIEWING_STORAGE_KEY) : null;
  }
}
