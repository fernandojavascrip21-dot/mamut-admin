import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ViewingBarComponent } from './viewing-bar.component';
import type { ViewingSeller } from '@core/viewing/interfaces/viewing.models';

const SELLERS: ViewingSeller[] = [
  { id: 'v-2', fullName: 'Valeria Vendedora', businessName: null },
  { id: 'v-1', fullName: 'Víctor Vendedor', businessName: 'Gimnasio Fuerza Norte' },
];

describe('ViewingBarComponent · negocio (HU-43)', () => {
  let fixture: ComponentFixture<ViewingBarComponent>;

  async function render(selectedSellerId: string | null) {
    fixture = TestBed.createComponent(ViewingBarComponent);
    fixture.componentRef.setInput('sellers', SELLERS);
    fixture.componentRef.setInput('status', 'ready');
    fixture.componentRef.setInput('selectedSellerId', selectedSellerId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => TestBed.configureTestingModule({ imports: [ViewingBarComponent] }));

  afterEach(() => {
    fixture.destroy();
    document.querySelectorAll('.p-select-overlay').forEach((node) => node.remove());
  });

  it('las opciones son «Nombre · Negocio» con negocio y solo el nombre sin él', async () => {
    await render(null);
    el().querySelector<HTMLElement>('p-select')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const labels = Array.from(document.querySelectorAll<HTMLElement>('li.p-select-option')).map((o) =>
      o.textContent?.trim(),
    );
    expect(labels).toEqual(['Yo · bodega', 'Valeria Vendedora', 'Víctor Vendedor · Gimnasio Fuerza Norte']);
  });

  it('la selección muestra «Nombre · Negocio» y las iniciales salen solo del nombre', async () => {
    await render('v-1');
    expect(el().textContent).toContain('Víctor Vendedor · Gimnasio Fuerza Norte');
    expect(el().querySelector('.initials')!.textContent!.trim()).toBe('VV');
  });
});
