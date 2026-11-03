import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationService } from 'primeng/api';
import { ConfirmHostComponent } from './confirm-host/confirm-host.component';
import { ConfirmService } from './confirm.service';
import type { ConfirmOptions } from './confirm.models';

const OPTIONS: ConfirmOptions = {
  title: '¿Descartar los cambios?',
  message: 'Lo que cambiaste no se va a guardar.',
  confirmLabel: 'Descartar',
  cancelLabel: 'Seguir editando',
  tone: 'danger',
};

describe('ConfirmService', () => {
  let service: ConfirmService;
  let fixture: ComponentFixture<ConfirmHostComponent>;

  const query = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);

  // Abre la confirmación y espera a que PrimeNG pinte el diálogo. Devuelve la respuesta dentro
  // de un objeto: una función async que devolviera la promesa a secas la esperaría.
  async function open(options = OPTIONS): Promise<{ answer: Promise<boolean> }> {
    const answer = service.ask(options);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { answer };
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ConfirmationService] });
    fixture = TestBed.createComponent(ConfirmHostComponent);
    service = TestBed.inject(ConfirmService);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    document.body.querySelectorAll('.p-dialog-mask').forEach((mask) => mask.remove());
  });

  it('pide la pregunta con los textos y los botones recibidos', async () => {
    void open();
    await fixture.whenStable();
    fixture.detectChanges();
    const dialog = query<HTMLElement>('.p-confirmdialog');
    expect(dialog?.textContent).toContain('¿Descartar los cambios?');
    expect(dialog?.textContent).toContain('Lo que cambiaste no se va a guardar.');
    expect(query('.p-confirmdialog-accept-button')?.textContent).toContain('Descartar');
    expect(query('.p-confirmdialog-reject-button')?.textContent).toContain('Seguir editando');
  });

  it('resuelve true al aceptar', async () => {
    const { answer } = await open();
    query<HTMLButtonElement>('.p-confirmdialog-accept-button')?.click();
    expect(await answer).toBe(true);
  });

  it('resuelve false al cancelar', async () => {
    const { answer } = await open();
    query<HTMLButtonElement>('.p-confirmdialog-reject-button')?.click();
    expect(await answer).toBe(false);
  });

  it('resuelve false con Escape', async () => {
    const { answer } = await open();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(await answer).toBe(false);
  });

  it('resuelve false con la X', async () => {
    const { answer } = await open();
    query<HTMLButtonElement>('.p-dialog-close-button')?.click();
    expect(await answer).toBe(false);
  });

  it('el foco inicial queda en cancelar, la acción segura', async () => {
    void open();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement).toBe(query('.p-confirmdialog-reject-button'));
  });

  it('una segunda confirmación con la primera abierta resuelve la primera en false', async () => {
    const { answer: first } = await open();
    const { answer: second } = await open({ ...OPTIONS, title: 'Otra pregunta' });
    expect(await first).toBe(false);
    query<HTMLButtonElement>('.p-confirmdialog-accept-button')?.click();
    expect(await second).toBe(true);
  });

  it('una confirmación pedida antes de que exista el diálogo no se pierde', async () => {
    // Un fixture nuevo sin detectChanges: el diálogo todavía no está montado ni escucha.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ConfirmationService] });
    const lateFixture = TestBed.createComponent(ConfirmHostComponent);
    const lateService = TestBed.inject(ConfirmService);
    const answer = lateService.ask(OPTIONS);
    lateFixture.detectChanges();
    await lateFixture.whenStable();
    lateFixture.detectChanges();
    query<HTMLButtonElement>('.p-confirmdialog-accept-button')?.click();
    expect(await answer).toBe(true);
    lateFixture.destroy();
  });

  it('una segunda petición antes de que exista el diálogo resuelve la primera en false', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [ConfirmationService] });
    const lateFixture = TestBed.createComponent(ConfirmHostComponent);
    const lateService = TestBed.inject(ConfirmService);
    const first = lateService.ask(OPTIONS);
    const second = lateService.ask({ ...OPTIONS, title: 'Otra pregunta' });
    lateFixture.detectChanges();
    await lateFixture.whenStable();
    lateFixture.detectChanges();
    expect(await first).toBe(false);
    expect(query('.p-confirmdialog')?.textContent).toContain('Otra pregunta');
    query<HTMLButtonElement>('.p-confirmdialog-reject-button')?.click();
    expect(await second).toBe(false);
    lateFixture.destroy();
  });
});
