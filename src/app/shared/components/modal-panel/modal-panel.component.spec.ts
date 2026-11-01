import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  afterEach(() => fixture.nativeElement.remove());

  const root = () => fixture.nativeElement as HTMLElement;
  const opener = () => root().querySelector('#opener') as HTMLButtonElement;
  const dialog = () => root().querySelector('[role="dialog"]') as HTMLElement | null;
  const keydown = (key: string, shiftKey = false) => {
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    dialog()!.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  };

  async function openDialog() {
    opener().focus();
    opener().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('muestra el título y el contenido proyectado', async () => {
    await openDialog();
    expect(dialog()!.getAttribute('aria-modal')).toBe('true');
    expect(root().querySelector('#modal-panel-title')!.textContent).toContain('Retirar producto');
    expect(root().querySelector('#first')).not.toBeNull();
  });

  it('al abrir, el foco entra en el pop-up', async () => {
    await openDialog();
    expect(document.activeElement).toBe(dialog());
  });

  it('Tab atrapa el foco: del último pasa al primero y Shift+Tab del primero al último', async () => {
    await openDialog();
    const close = root().querySelector<HTMLButtonElement>('.close')!;
    const last = root().querySelector<HTMLButtonElement>('#last')!;

    last.focus();
    expect(keydown('Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);

    expect(keydown('Tab', true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('Escape cierra', async () => {
    await openDialog();
    keydown('Escape');
    expect(fixture.componentInstance.closes).toBe(1);
    expect(dialog()).toBeNull();
  });

  it('Tab desde el marco entra al primer control y Shift+Tab va al último', async () => {
    await openDialog();
    keydown('Tab');
    expect(document.activeElement).toBe(root().querySelector('.close'));
    dialog()!.focus();
    keydown('Tab', true);
    expect(document.activeElement).toBe(root().querySelector('#last'));
  });

  it('si desaparece el control enfocado, Tab vuelve al diálogo', async () => {
    await openDialog();
    const input = root().querySelector<HTMLInputElement>('#first')!;
    input.focus();
    input.remove();
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(root().querySelector('.close'));
  });

  it('bloquea el scroll del fondo y lo libera al cerrar', async () => {
    await openDialog();
    expect(document.body.classList.contains('overflow-hidden')).toBe(true);
    keydown('Escape');
    expect(document.body.classList.contains('overflow-hidden')).toBe(false);
  });

  it('la X cierra', async () => {
    await openDialog();
    root().querySelector<HTMLButtonElement>('.close')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.closes).toBe(1);
  });

  it('un clic en el fondo no cierra', async () => {
    await openDialog();
    (dialog()!.parentElement as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.closes).toBe(0);
    expect(dialog()).not.toBeNull();
  });

  it('con closable en false no hay X y Escape no cierra', async () => {
    fixture.componentInstance.closable.set(false);
    await openDialog();
    expect(root().querySelector('.close')).toBeNull();
    keydown('Escape');
    expect(fixture.componentInstance.closes).toBe(0);
    expect(dialog()).not.toBeNull();
  });

  it('al cerrar, el foco regresa al botón que lo abrió', async () => {
    await openDialog();
    keydown('Escape');
    fixture.detectChanges();
    expect(document.activeElement).toBe(opener());
  });
});
