import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Fraction } from '../../interfaces/fraction.models';
import { FractionResultComponent } from './fraction-result.component';

const FRACTION: Fraction = {
  id: 1,
  requestId: 'r-1',
  portions: 7,
  wholeUnitCost: '450.0000',
  portionUnitCost: '64.2857',
  createdAt: '2026-11-07T10:00:00Z',
  product: { id: 10, name: 'Creatina 300 g', stock: 2 },
  portionProduct: { id: 11, name: 'Creatina 300 g · bolsita 30 g', created: true, price: '85.00', stock: 7 },
};

describe('FractionResultComponent', () => {
  let fixture: ComponentFixture<FractionResultComponent>;

  const render = (fraction: Fraction = FRACTION, replayed = false) => {
    fixture = TestBed.createComponent(FractionResultComponent);
    fixture.componentRef.setInput('fraction', fraction);
    fixture.componentRef.setInput('replayed', replayed);
    fixture.detectChanges();
  };
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FractionResultComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('muestra «Fraccionado listo» y los nombres del entero y de la bolsita', () => {
    render();
    expect(text()).toContain('Fraccionado listo');
    expect(text()).toContain('Creatina 300 g');
    expect(text()).toContain('Creatina 300 g · bolsita 30 g');
  });

  it('pinta el costo por bolsita del backend ($64.29) y el precio de la bolsita ($85.00)', () => {
    render();
    expect(text()).toContain('Costo por bolsita');
    expect(text()).toContain('$64.29');
    expect(text()).toContain('Precio de la bolsita');
    expect(text()).toContain('$85.00');
  });

  it('muestra la bodega antes → después: entero 3 → 2 y bolsita 0 → 7', () => {
    render();
    expect(text()).toContain('Bodega');
    expect(text()).toContain('3 → 2');
    expect(text()).toContain('0 → 7');
  });

  it('con replayed solo pinta el «después»', () => {
    render(FRACTION, true);
    expect(text()).not.toContain('3 → 2');
    expect(text()).not.toContain('0 → 7');
    expect(text()).toContain('2');
    expect(text()).toContain('7');
  });

  it('muestra «Bolsita nueva» solo si portionProduct.created es true', () => {
    render();
    expect(text()).toContain('Bolsita nueva');
  });

  it('no muestra «Bolsita nueva» si la bolsita ya existía', () => {
    render({ ...FRACTION, portionProduct: { ...FRACTION.portionProduct, created: false } });
    expect(text()).not.toContain('Bolsita nueva');
  });

  it('«Fraccionar otro» emite again', () => {
    render();
    const again = vi.fn();
    fixture.componentInstance.again.subscribe(again);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent!.includes('Fraccionar otro'),
    ) as HTMLButtonElement;
    button.click();
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('«Ver stock general» es un botón que emite viewStock', () => {
    render();
    const viewStock = vi.fn();
    fixture.componentInstance.viewStock.subscribe(viewStock);
    const button = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent!.includes('Ver stock general'),
    ) as HTMLButtonElement;
    button.click();
    expect(viewStock).toHaveBeenCalledTimes(1);
  });

});
