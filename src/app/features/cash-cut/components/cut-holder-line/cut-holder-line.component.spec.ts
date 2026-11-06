import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { BusinessCutHolder } from '../../interfaces/cash-cut.models';
import { CutHolderLineComponent } from './cut-holder-line.component';

// Renglones del desglose «Por titular» (criterio 2 de HU-22): bodega $500 y Luis $1,840.
const WAREHOUSE: BusinessCutHolder = {
  holder: null,
  salesCount: 1,
  units: 2,
  total: '500.00',
  factoryCost: '312.50',
  realProfit: '187.50',
  shippingCover: '0.00',
};

const LUIS: BusinessCutHolder = {
  holder: { id: 'a000-2', fullName: 'Luis Vendedor', active: false },
  salesCount: 3,
  units: 5,
  total: '1840.00',
  factoryCost: '1200.00',
  realProfit: '640.00',
  shippingCover: '200.00',
};

describe('CutHolderLineComponent · renglón por titular', () => {
  let fixture: ComponentFixture<CutHolderLineComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) =>
    el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();
  const allText = () => el().textContent?.replace(/\s+/g, ' ') ?? '';

  function render(holder: BusinessCutHolder) {
    fixture = TestBed.createComponent(CutHolderLineComponent);
    fixture.componentRef.setInput('holder', holder);
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.configureTestingModule({ imports: [CutHolderLineComponent] }));

  it('la bodega se llama «Bodega»', () => {
    render(WAREHOUSE);
    expect(text('.holder-name')).toBe('Bodega');
  });

  it('un vendedor muestra su nombre completo', () => {
    render(LUIS);
    expect(text('.holder-name')).toBe('Luis Vendedor');
  });

  it('muestra «3 ventas · 5 piezas»', () => {
    render(LUIS);
    expect(text('.holder-meta')).toBe('3 ventas · 5 piezas');
  });

  it('en singular muestra «1 venta · 1 pieza»', () => {
    render({ ...WAREHOUSE, salesCount: 1, units: 1 });
    expect(text('.holder-meta')).toBe('1 venta · 1 pieza');
  });

  it('muestra el vendido como moneda', () => {
    render(LUIS);
    expect(text('.sold')).toBe('$1,840.00');
  });

  it('una ganancia real positiva lleva signo más: «+$640.00»', () => {
    render(LUIS);
    expect(text('.profit')).toBe('+$640.00');
  });

  it('una ganancia real negativa lleva signo menos: «-$20.00»', () => {
    render({ ...LUIS, realProfit: '-20.00' });
    expect(text('.profit')).toBe('-$20.00');
  });

  it('un vendedor desactivado lleva la etiqueta «Desactivado»', () => {
    render(LUIS);
    const tag = el().querySelector('p-tag.inactive-tag');
    expect(tag).not.toBeNull();
    expect(tag?.textContent?.trim()).toBe('Desactivado');
  });

  it('un vendedor activo no lleva la etiqueta «Desactivado»', () => {
    render({ ...LUIS, holder: { id: 'a000-2', fullName: 'Luis Vendedor', active: true } });
    expect(el().querySelector('.holder-name')).not.toBeNull();
    expect(el().querySelector('.inactive-tag')).toBeNull();
    expect(allText()).not.toContain('Desactivado');
  });

  it('la bodega no lleva la etiqueta «Desactivado»', () => {
    render(WAREHOUSE);
    expect(el().querySelector('.holder-name')).not.toBeNull();
    expect(el().querySelector('.inactive-tag')).toBeNull();
    expect(allText()).not.toContain('Desactivado');
  });

  it('no muestra el costo de fábrica ni «Para cubrir envíos»', () => {
    render(LUIS);
    expect(el().querySelector('.sold')).not.toBeNull();
    expect(el().querySelector('.factory-cost')).toBeNull();
    expect(el().querySelector('.shipping-cover')).toBeNull();
    expect(allText()).not.toContain('$1,200.00');
    expect(allText()).not.toContain('$200.00');
    expect(allText()).not.toContain('Para cubrir envíos');
    expect(allText()).not.toContain('Costo de fábrica');
  });

  it('el renglón no se puede tocar: sin botones ni enlaces', () => {
    render(LUIS);
    expect(el().querySelector('.holder-name')).not.toBeNull();
    expect(el().querySelector('button')).toBeNull();
    expect(el().querySelector('a')).toBeNull();
    expect(el().querySelector('[routerLink], [ng-reflect-router-link]')).toBeNull();
  });
});
