import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

// Anfitrión de prueba: abre y cierra el diálogo con un @if, como lo hacen las páginas.
@Component({
  imports: [ConfirmDialogComponent],
  template: `
    <button id="opener" type="button" (click)="open.set(true)">Abrir</button>
    @if (open()) {
      <app-confirm-dialog
        title="¿Cerrar sesión?"
        message="Lo que ya registraste queda guardado."
        confirmLabel="Cerrar sesión"
        cancelLabel="Cancelar"
        tone="danger"
        (confirmed)="result = 'confirmed'; open.set(false)"
        (cancelled)="result = 'cancelled'; open.set(false)"
      />
    }
  `,
})
class HostComponent {
  readonly open = signal(false);
  result: 'confirmed' | 'cancelled' | null = null;
}

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  });

  afterEach(() => fixture.nativeElement.remove());

  const opener = () => fixture.nativeElement.querySelector('#opener') as HTMLButtonElement;
  const dialog = () => fixture.nativeElement.querySelector('[role="alertdialog"]') as HTMLElement | null;
  const buttons = () => Array.from(dialog()!.querySelectorAll('button')) as HTMLButtonElement[];

  async function openDialog() {
    opener().focus();
    opener().click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('muestra título, mensaje y etiquetas, y el foco entra en «cancelar»', async () => {
    await openDialog();
    expect(dialog()!.textContent).toContain('¿Cerrar sesión?');
    expect(dialog()!.textContent).toContain('Lo que ya registraste queda guardado.');
    expect(dialog()!.getAttribute('aria-describedby')).toBe('confirm-dialog-desc');
    const [cancel, confirm] = buttons();
    expect(cancel.textContent?.trim()).toBe('Cancelar');
    expect(confirm.textContent?.trim()).toBe('Cerrar sesión');
    expect(confirm.className).toContain('bg-danger');
    expect(document.activeElement).toBe(cancel);
  });

  it('Tab y Shift+Tab quedan atrapados entre los dos botones', async () => {
    await openDialog();
    const [cancel, confirm] = buttons();
    cancel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(confirm);
    confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(cancel);
  });

  it('Escape emite cancelled y el foco regresa a quien lo abrió', async () => {
    await openDialog();
    buttons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.result).toBe('cancelled');
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  it('cada botón emite su evento', async () => {
    await openDialog();
    buttons()[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.result).toBe('confirmed');

    await openDialog();
    buttons()[0].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.result).toBe('cancelled');
    expect(document.activeElement).toBe(opener());
  });
});
