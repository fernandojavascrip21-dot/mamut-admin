import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewingBarComponent } from './viewing-bar.component';
import type { ViewingListStatus, ViewingSeller } from '@core/viewing/interfaces/viewing.models';

const SELLERS: ViewingSeller[] = [
  { id: 'v-2', fullName: 'Valeria Vendedora' },
  { id: 'v-1', fullName: 'Víctor Vendedor' },
];

describe('ViewingBarComponent', () => {
  let fixture: ComponentFixture<ViewingBarComponent>;

  // ngModel escribe el valor y el estado deshabilitado en un microtask: hay que esperar a que se asiente.
  async function render(sellers: ViewingSeller[], status: ViewingListStatus, selectedSellerId: string | null = null) {
    fixture = TestBed.createComponent(ViewingBarComponent);
    fixture.componentRef.setInput('sellers', sellers);
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('selectedSellerId', selectedSellerId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const combobox = () => el().querySelector('[role="combobox"]') as HTMLElement;
  const optionLabels = () =>
    Array.from(document.querySelectorAll<HTMLElement>('li.p-select-option')).map((o) =>
      o.textContent?.trim(),
    );

  // El selector es un Select de PrimeNG: se abre con un clic y la lista se monta en body.
  async function open() {
    el().querySelector<HTMLElement>('p-select')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const pick = (name: string) => {
    Array.from(document.querySelectorAll<HTMLElement>('li.p-select-option'))
      .find((o) => o.textContent!.includes(name))!
      .click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ViewingBarComponent] });
  });

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('.p-select-overlay').forEach((node) => node.remove());
  });

  it('muestra la etiqueta «Viendo» unida al selector', async () => {
    await render(SELLERS, 'ready');
    const label = el().querySelector('label') as HTMLLabelElement;
    expect(label.textContent?.trim()).toBe('Viendo');
    expect(label.htmlFor).toBe('viewing-select');
    expect(combobox().getAttribute('aria-labelledby')).toBe('viewing-label');
    expect(el().querySelector('select')).toBeNull();
  });

  it('lista «Yo · bodega» primero y después cada vendedor, en el orden recibido', async () => {
    await render(SELLERS, 'ready');
    expect(el().textContent).toContain('Yo · bodega');
    await open();
    expect(optionLabels()).toEqual(['Yo · bodega', 'Valeria Vendedora', 'Víctor Vendedor']);
  });

  it('marca al vendedor elegido y muestra sus iniciales', async () => {
    await render(SELLERS, 'ready', 'v-1');
    expect(el().textContent).toContain('Víctor Vendedor');
    expect(el().textContent).toContain('VV');
  });

  it('en «Yo · bodega» no muestra iniciales', async () => {
    await render(SELLERS, 'ready');
    expect(el().querySelector('.initials')).toBeNull();
  });

  it('elegir un vendedor emite su id, y «Yo · bodega» emite null', async () => {
    await render(SELLERS, 'ready');
    const emitted: (string | null)[] = [];
    fixture.componentInstance.selectionChange.subscribe((id) => emitted.push(id));

    await open();
    pick('Valeria');
    fixture.componentRef.setInput('selectedSellerId', 'v-2');
    fixture.detectChanges();
    await open();
    pick('Yo · bodega');

    expect(emitted).toEqual(['v-2', null]);
  });

  it('si quien usa la barra rechaza la elección (resetKey), vuelve a mostrar la selección vigente', async () => {
    await render(SELLERS, 'ready');
    await open();
    pick('Valeria');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(combobox().textContent).toContain('Valeria');

    fixture.componentRef.setInput('resetKey', 1);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(combobox().textContent).toContain('Yo · bodega');
  });

  it('mientras carga el selector está deshabilitado y con aria-busy', async () => {
    await render([], 'loading');
    expect(el().querySelector('p-select')!.classList.contains('p-disabled')).toBe(true);
    expect(combobox().getAttribute('aria-busy')).toBe('true');
    expect(el().textContent).toContain('Yo · bodega');
  });

  it('con error solo ofrece «Yo · bodega», y «Reintentar» emite retry', async () => {
    await render([], 'error');
    expect(el().querySelector('p-select')!.classList.contains('p-disabled')).toBe(false);
    await open();
    expect(optionLabels()).toEqual(['Yo · bodega']);

    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);
    (el().querySelector('.retry') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });

  it('sin error no muestra «Reintentar»', async () => {
    await render(SELLERS, 'ready');
    expect(el().querySelector('.retry')).toBeNull();
  });
});
