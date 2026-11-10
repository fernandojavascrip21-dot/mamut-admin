import { Component, inject, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ModalPanelComponent } from './modal-panel.component';

@Component({ template: '' })
class BlankComponent {}

// Anfitrión: como restock-page, al pedir el cierre navega y solo se quita si la navegación se concreta.
@Component({
  imports: [ModalPanelComponent],
  template: `
    @if (!left()) {
      <app-modal-panel title="Lista de resurtir" (closed)="close()">
        <input id="field" type="text" />
      </app-modal-panel>
    }
  `,
})
class HostComponent {
  private readonly router = inject(Router);
  readonly left = signal(false);

  close(): void {
    void this.router.navigate(['/salida']).then((done) => this.left.set(done));
  }
}

describe('ModalPanelComponent · cierre sujeto a la navegación', () => {
  let fixture: ComponentFixture<HostComponent>;
  let allowLeaving: boolean;

  beforeEach(async () => {
    allowLeaving = false;
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideRouter([{ path: 'salida', component: BlankComponent, canActivate: [() => allowLeaving] }]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    fixture.nativeElement.remove();
    document.querySelectorAll('.p-dialog-mask').forEach((node) => node.remove());
  });

  const dialog = () => document.querySelector('[role="dialog"]') as HTMLElement | null;
  const closeButton = () => document.querySelector('.p-dialog-close-button') as HTMLButtonElement;

  async function settle() {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    fixture.detectChanges();
  }

  const pressEscape = () =>
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

  it('con la X, si el guard cancela la navegación, el diálogo sigue visible', async () => {
    closeButton().click();
    await settle();
    expect(dialog()).not.toBeNull();
    expect(dialog()!.textContent).toContain('Lista de resurtir');
  });

  it('con Escape, si el guard cancela la navegación, el diálogo sigue visible', async () => {
    pressEscape();
    await settle();
    expect(dialog()).not.toBeNull();
  });

  it('tras cancelar, la X vuelve a pedir el cierre', async () => {
    closeButton().click();
    await settle();
    allowLeaving = true;
    closeButton().click();
    await settle();
    expect(dialog()).toBeNull();
  });

  it('con la X, si la navegación se confirma, el diálogo se cierra', async () => {
    allowLeaving = true;
    closeButton().click();
    await settle();
    expect(dialog()).toBeNull();
  });
});
