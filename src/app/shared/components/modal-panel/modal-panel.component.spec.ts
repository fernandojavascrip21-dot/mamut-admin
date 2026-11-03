import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Dialog } from 'primeng/dialog';
import { ModalPanelComponent } from './modal-panel.component';

// Anfitrión de prueba: abre y cierra el pop-up con un @if, como lo hacen las páginas.
@Component({
  imports: [ModalPanelComponent],
  template: `
    <button id="opener" type="button" (click)="open.set(true)">Abrir</button>
    @if (open()) {
      <app-modal-panel
        title="Retirar producto"
        [closable]="closable()"
        (closed)="closes = closes + 1; open.set(false)"
      >
        <input id="first" type="text" />
        <button id="last" type="button">Guardar</button>
      </app-modal-panel>
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
  readonly closable = signal(true);
  closes = 0;
}

describe('ModalPanelComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
    document.querySelectorAll('.p-dialog-mask').forEach((node) => node.remove());
  });

  const root = () => fixture.nativeElement as HTMLElement;
  const opener = () => root().querySelector('#opener') as HTMLButtonElement;
  // p-dialog se monta en body: el pop-up y su contenido ya no cuelgan del anfitrión.
  const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
  const mask = () => document.querySelector('.p-dialog-mask') as HTMLElement | null;
  const closeButton = () => document.querySelector('.p-dialog-close-button') as HTMLButtonElement | null;
  const keydown = (key: string, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    (document.activeElement ?? document.body).dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function openDialog() {
    opener().focus();
    opener().click();
    await settle();
  }

  it('muestra el título y el contenido proyectado', async () => {
    await openDialog();
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
    expect(dialog()!.textContent).toContain('Retirar producto');
    expect(document.querySelector('#first')).not.toBeNull();
  });

  it('está configurado para enfocar al abrir y atrapar el foco', async () => {
    await openDialog();
    // PrimeNG enfoca el primer control al terminar la animación de entrada, que jsdom no dispara
    // ni sabe medir: aquí se comprueba la configuración; el foco real se revisa en el navegador.
    const instance = fixture.debugElement.query(By.directive(Dialog)).componentInstance as Dialog;
    expect(instance.focusOnShow()).toBe(true);
    expect(instance.focusTrap()).toBe(true);
    expect(instance.modal()).toBe(true);
    expect(instance.dismissableMask()).toBe(false);
  });

  it('Tab desde fuera del pop-up regresa al primer control y Shift+Tab al último', async () => {
    await openDialog();
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();

    keydown('Tab');
    expect(dialog()!.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(closeButton());

    (document.activeElement as HTMLElement).blur();
    keydown('Tab', true);
    expect(document.activeElement).toBe(document.querySelector('#last'));
  });

  it('Escape cierra', async () => {
    await openDialog();
    keydown('Escape');
    await settle();
    expect(fixture.componentInstance.closes).toBe(1);
    expect(dialog()).toBeNull();
  });

  it('bloquea el scroll del fondo y lo libera al cerrar', async () => {
    await openDialog();
    expect(document.body.classList.contains('p-overflow-hidden')).toBe(true);
    keydown('Escape');
    await settle();
    expect(document.body.classList.contains('p-overflow-hidden')).toBe(false);
  });

  it('la X cierra', async () => {
    await openDialog();
    closeButton()!.click();
    await settle();
    expect(fixture.componentInstance.closes).toBe(1);
  });

  it('un clic en el fondo no cierra', async () => {
    await openDialog();
    mask()!.click();
    await settle();
    expect(fixture.componentInstance.closes).toBe(0);
    expect(dialog()).not.toBeNull();
  });

  it('con closable en false no hay X y Escape no cierra', async () => {
    fixture.componentInstance.closable.set(false);
    await openDialog();
    expect(closeButton()).toBeNull();
    keydown('Escape');
    await settle();
    expect(fixture.componentInstance.closes).toBe(0);
    expect(dialog()).not.toBeNull();
  });

  it('al cerrar, el foco regresa al botón que lo abrió', async () => {
    await openDialog();
    keydown('Escape');
    await settle();
    expect(document.activeElement).toBe(opener());
  });
});
