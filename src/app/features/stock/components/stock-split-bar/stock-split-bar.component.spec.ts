import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { StockSplitPart } from '../../interfaces/stock-overview.models';
import { StockSplitBarComponent } from './stock-split-bar.component';

const PARTS: StockSplitPart[] = [
  { key: 'warehouse', label: 'Bodega', units: 4, colorIndex: null },
  { key: 'luis', label: 'Luis', units: 6, colorIndex: 0 },
  { key: 'valeria', label: 'Valeria', units: 0, colorIndex: 1 },
  { key: 'inactive', label: 'Vendedores inactivos', units: 2, colorIndex: null },
];

describe('StockSplitBarComponent', () => {
  let fixture: ComponentFixture<StockSplitBarComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StockSplitBarComponent] }).compileComponents();
    fixture = TestBed.createComponent(StockSplitBarComponent);
    fixture.componentRef.setInput('parts', PARTS);
    fixture.detectChanges();
  });

  it('la leyenda trae a todos con nombre y número, también con 0 piezas', () => {
    const items = Array.from(el().querySelectorAll('.legend li')).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(items).toEqual(['Bodega 4', 'Luis 6', 'Valeria 0', 'Vendedores inactivos 2']);
  });

  it('la barra es decorativa (aria-hidden) y la leyenda no', () => {
    const bar = el().querySelector('.segment')!.parentElement!;
    expect(bar.getAttribute('aria-hidden')).toBe('true');
    expect(el().querySelector('.legend')!.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('solo dibuja segmentos de los lugares con piezas, con ancho proporcional', () => {
    const segments = Array.from(el().querySelectorAll<HTMLElement>('.segment'));
    expect(segments).toHaveLength(3);
    expect(segments.map((s) => s.style.flexGrow)).toEqual(['4', '6', '2']);
  });

  it('cada lugar usa su color: tinta, paleta de vendedor y gris para inactivos', () => {
    const segments = Array.from(el().querySelectorAll<HTMLElement>('.segment'));
    expect(segments[0].classList.contains('bg-split-warehouse')).toBe(true);
    expect(segments[1].classList.contains('bg-split-1')).toBe(true);
    expect(segments[2].classList.contains('bg-faint')).toBe(true);
  });

  it('un vendedor con índice mayor al de la paleta vuelve al primer color', () => {
    fixture.componentRef.setInput('parts', [{ key: 'g', label: 'G', units: 1, colorIndex: 5 }]);
    fixture.detectChanges();
    expect(el().querySelector('.segment')!.classList.contains('bg-split-1')).toBe(true);
  });
});
