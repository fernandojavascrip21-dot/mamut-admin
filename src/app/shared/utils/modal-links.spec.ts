import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router, RouterOutlet } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom, take } from 'rxjs';
import { ModalPanelComponent } from '../components/modal-panel/modal-panel.component';
import { modalSavingGuard } from '../guards/modal-saving.guard';
import { closeModalLink, deliveryModalLink, openModalPath, returnModalLink } from './modal-links';

@Component({ template: '<input aria-label="Búsqueda" />' })
class ProbeComponent {}

@Component({ imports: [RouterOutlet], template: '<router-outlet /><router-outlet name="ventana" />' })
class ShellComponent {}

@Component({
  imports: [ModalPanelComponent],
  template: '<app-modal-panel title="Ventana" [closable]="!saving()" (closed)="close()" />',
})
class ModalProbeComponent {
  readonly saving = signal(false);
  private readonly router = inject(Router);
  close(): void { void this.router.navigate(closeModalLink()); }
}

describe('Enlaces de ventanas', () => {
  let router: Router;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideLocationMocks(), provideRouter([
      { path: 'admin', component: ShellComponent, children: [
        { path: 'vendedores/:id', component: ProbeComponent },
        { path: 'productos', component: ProbeComponent },
        { path: 'dejar', outlet: 'ventana', component: ModalProbeComponent, canDeactivate: [modalSavingGuard] },
        { path: 'retirar/:sellerId', outlet: 'ventana', component: ModalProbeComponent, canDeactivate: [modalSavingGuard] },
      ] },
    ])] });
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create('/admin/vendedores/v-1');
    router.initialNavigation();
  });

  it('dejar conserva el detalle y manda vendedor y producto como matriciales', async () => {
    await router.navigate(deliveryModalLink({ sellerId: 'v-1', productId: 3 }));
    expect(router.url).toBe('/admin/(vendedores/v-1//ventana:dejar;vendedor=v-1;producto=3)');
  });

  it('admite vendedor, producto o ninguno', async () => {
    await router.navigate(deliveryModalLink({ sellerId: 'v-1' }));
    expect(router.url).toContain('ventana:dejar;vendedor=v-1');
    await router.navigate(deliveryModalLink({ productId: 3 }));
    expect(router.url).toContain('ventana:dejar;producto=3');
    await router.navigate(deliveryModalLink());
    expect(router.url).toBe('/admin/(vendedores/v-1//ventana:dejar)');
  });

  it('retirar conserva la ruta primaria y cerrar quita el outlet y sus parámetros', async () => {
    await router.navigate(returnModalLink('v-1'));
    expect(router.url).toBe('/admin/(vendedores/v-1//ventana:retirar/v-1)');
    await router.navigate(closeModalLink());
    expect(router.url).toBe('/admin/vendedores/v-1');
  });

  it('conserva Productos al abrir y cerrar', async () => {
    await router.navigateByUrl('/admin/productos');
    await router.navigate(deliveryModalLink({ productId: 3 }));
    expect(router.url).toBe('/admin/(productos//ventana:dejar;producto=3)');
    await router.navigate(closeModalLink());
    expect(router.url).toBe('/admin/productos');
  });

  it('abrir y cerrar conserva la instancia y lo escrito en la página de atrás', async () => {
    const input = harness.routeNativeElement!.querySelector('input')!;
    input.value = 'creatina';
    await router.navigate(deliveryModalLink());
    harness.detectChanges();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('input')).toBe(input);
    await router.navigate(closeModalLink());
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('input')).toBe(input);
    expect(input.value).toBe('creatina');
  });

  it('una URL directa restaura ambos outlets, y Atrás cierra la ventana', async () => {
    const url = '/admin/(vendedores/v-1//ventana:dejar;vendedor=v-1;producto=3)';
    await router.navigateByUrl(url);
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('input')).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    const navigation = firstValueFrom(router.events.pipe(filter((event) => event instanceof NavigationEnd), take(1)));
    TestBed.inject(Location).back();
    await navigation;
    harness.detectChanges();
    expect(router.url).toBe('/admin/vendedores/v-1');
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('mientras guarda bloquea salir por navegación y permite cerrar al terminar', async () => {
    await router.navigate(returnModalLink('v-1'));
    harness.detectChanges();
    const modal = harness.routeDebugElement!.query((element) => element.componentInstance instanceof ModalProbeComponent)
      .componentInstance as ModalProbeComponent;
    modal.saving.set(true);
    expect(await router.navigate(closeModalLink())).toBe(false);
    expect(router.url).toContain('ventana:retirar/v-1');
    modal.saving.set(false);
    expect(await router.navigate(closeModalLink())).toBe(true);
    expect(router.url).toBe('/admin/vendedores/v-1');
  });
});

describe('openModalPath', () => {
  const tree = (url: string) => TestBed.inject(Router).parseUrl(url);

  it('devuelve el nombre de la ventana abierta', () => {
    expect(openModalPath(tree('/admin/(productos//ventana:dejar;vendedor=v-1)'))).toBe('dejar');
    expect(openModalPath(tree('/admin/(vendedores/v-1//ventana:retirar/v-1)'))).toBe('retirar');
  });

  it('devuelve null si no hay ventana', () => {
    expect(openModalPath(tree('/admin/vendedores/v-1'))).toBeNull();
  });
});
