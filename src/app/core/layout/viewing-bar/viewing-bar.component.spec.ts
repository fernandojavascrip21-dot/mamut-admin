import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewingBarComponent } from './viewing-bar.component';
import type { ViewingListStatus, ViewingSeller } from '@core/viewing/interfaces/viewing.models';

const SELLERS: ViewingSeller[] = [
  { id: 'v-2', fullName: 'Valeria Vendedora' },
  { id: 'v-1', fullName: 'Víctor Vendedor' },
];

describe('ViewingBarComponent', () => {
  let fixture: ComponentFixture<ViewingBarComponent>;

  function render(sellers: ViewingSeller[], status: ViewingListStatus, selectedSellerId: string | null = null) {
    fixture = TestBed.createComponent(ViewingBarComponent);
    fixture.componentRef.setInput('sellers', sellers);
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('selectedSellerId', selectedSellerId);
    fixture.detectChanges();
  }

  const select = () => fixture.nativeElement.querySelector('select') as HTMLSelectElement;
  const optionLabels = () => Array.from(select().options).map((o) => o.textContent?.trim());

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ViewingBarComponent] });
  });

  it('muestra la etiqueta «Viendo» unida al select', () => {
    render(SELLERS, 'ready');
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.textContent?.trim()).toBe('Viendo');
    expect(label.htmlFor).toBe(select().id);
  });

  it('lista «Yo · bodega» primero y después cada vendedor, en el orden recibido', () => {
    render(SELLERS, 'ready');
    expect(optionLabels()).toEqual(['Yo · bodega', 'Valeria Vendedora', 'Víctor Vendedor']);
    expect(select().value).toBe('');
  });

  it('marca al vendedor elegido y muestra sus iniciales', () => {
    render(SELLERS, 'ready', 'v-1');
    expect(select().value).toBe('v-1');
    expect(fixture.nativeElement.textContent).toContain('VV');
  });

  it('cambiar el select emite el id, y «Yo · bodega» emite null', () => {
    render(SELLERS, 'ready');
    const emitted: (string | null)[] = [];
    fixture.componentInstance.selectionChange.subscribe((id) => emitted.push(id));

    select().value = 'v-2';
    select().dispatchEvent(new Event('change'));
    select().value = '';
    select().dispatchEvent(new Event('change'));

    expect(emitted).toEqual(['v-2', null]);
  });

  it('mientras carga el select está deshabilitado en «Yo · bodega»', () => {
    render([], 'loading');
    expect(select().disabled).toBe(true);
    expect(select().getAttribute('aria-busy')).toBe('true');
    expect(optionLabels()).toEqual(['Yo · bodega']);
  });

  it('con error solo ofrece «Yo · bodega», y «Reintentar» emite retry', () => {
    render([], 'error');
    expect(select().disabled).toBe(false);
    expect(optionLabels()).toEqual(['Yo · bodega']);

    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);
    (fixture.nativeElement.querySelector('.retry') as HTMLButtonElement).click();
    expect(retried).toBe(1);
  });

  it('sin error no muestra «Reintentar»', () => {
    render(SELLERS, 'ready');
    expect(fixture.nativeElement.querySelector('.retry')).toBeNull();
  });
});
