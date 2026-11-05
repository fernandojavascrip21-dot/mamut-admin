import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StockProductRowComponent } from './stock-product-row.component';

describe('StockProductRowComponent', () => {
  let fixture: ComponentFixture<StockProductRowComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [StockProductRowComponent] }).compileComponents();
    fixture = TestBed.createComponent(StockProductRowComponent);
    fixture.componentRef.setInput('name', 'Proteína Whey');
    fixture.componentRef.setInput('units', 10);
  });

  it('con reparto muestra el nombre, las piezas y la línea «Bodega 4 · Luis 6»', () => {
    fixture.componentRef.setInput('breakdown', 'Bodega 4 · Luis 6');
    fixture.detectChanges();
    expect(el().querySelector('.name')!.textContent!.trim()).toBe('Proteína Whey');
    expect(el().querySelector('.units')!.textContent!.trim()).toBe('10 piezas');
    expect(el().querySelector('.breakdown')!.textContent!.trim()).toBe('Bodega 4 · Luis 6');
  });

  it('sin reparto no pinta la línea', () => {
    fixture.detectChanges();
    expect(el().querySelector('.breakdown')).toBeNull();
  });

  it('con una pieza usa el singular', () => {
    fixture.componentRef.setInput('units', 1);
    fixture.detectChanges();
    expect(el().querySelector('.units')!.textContent!.trim()).toBe('1 pieza');
  });

  it('con foto muestra la imagen; sin foto, o si no carga, las iniciales', () => {
    fixture.componentRef.setInput('image', 'https://example.com/w.jpg');
    fixture.detectChanges();
    const img = el().querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/w.jpg');
    expect(img.getAttribute('alt')).toBe('Proteína Whey');

    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el().querySelector('img')).toBeNull();
    expect(el().textContent).toContain('PW');

    fixture.componentRef.setInput('image', null);
    fixture.detectChanges();
    expect(el().querySelector('img')).toBeNull();
  });

  it('con stockLevel «out» muestra «Agotado» en texto; con «low» o sin él, no (HU-18)', () => {
    fixture.componentRef.setInput('units', 0);
    fixture.componentRef.setInput('stockLevel', 'out');
    fixture.detectChanges();
    expect(el().querySelector('.out')!.textContent!.trim()).toBe('Agotado');

    fixture.componentRef.setInput('stockLevel', 'low');
    fixture.detectChanges();
    expect(el().querySelector('.out')).toBeNull();

    fixture.componentRef.setInput('stockLevel', null);
    fixture.detectChanges();
    expect(el().querySelector('.out')).toBeNull();
  });
});
