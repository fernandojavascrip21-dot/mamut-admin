import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { ShrinkageHistoryLineItem } from './shrinkage-history-line.models';
import { ShrinkageHistoryLineComponent } from './shrinkage-history-line.component';

const ITEM: ShrinkageHistoryLineItem = {
  createdAt: '2026-11-08T18:21:07.000Z',
  qty: 3,
  reasonLabel: 'Dañado',
  holder: { id: 'v-1', fullName: 'Luis Prueba' },
  product: { id: 10, name: 'Proteína Whey', image: null },
};

describe('ShrinkageHistoryLineComponent', () => {
  let fixture: ComponentFixture<ShrinkageHistoryLineComponent>;
  const el = () => fixture.nativeElement as HTMLElement;
  const text = (selector: string) => el().querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim();

  function render(item: ShrinkageHistoryLineItem, showHolder?: boolean) {
    fixture = TestBed.createComponent(ShrinkageHistoryLineComponent);
    fixture.componentRef.setInput('item', item);
    if (showHolder !== undefined) fixture.componentRef.setInput('showHolder', showHolder);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ShrinkageHistoryLineComponent] }).compileComponents();
  });

  it('muestra el producto y las piezas con signo menos', () => {
    render(ITEM);
    expect(text('.name')).toBe('Proteína Whey');
    expect(text('.qty')).toBe('−3');
  });

  it('muestra «<motivo> · dd/MM/yyyy HH:mm»', () => {
    render(ITEM);
    expect(text('.reason-date')).toMatch(/^Dañado · \d{2}\/\d{2}\/2026 \d{2}:\d{2}$/);
  });

  it('una merma sin motivo dice «Sin motivo»', () => {
    render({ ...ITEM, reasonLabel: null });
    expect(text('.reason-date')).toMatch(/^Sin motivo · \d{2}\/\d{2}\/2026/);
  });

  it('sin showHolder no muestra al titular', () => {
    render(ITEM);
    expect(el().querySelector('.holder')).toBeNull();
    expect(el().textContent).not.toContain('Luis Prueba');
  });

  it('con showHolder muestra el nombre del vendedor', () => {
    render(ITEM, true);
    expect(text('.holder')).toContain('Luis Prueba');
  });

  it('con showHolder y titular null muestra «Bodega»', () => {
    render({ ...ITEM, holder: null }, true);
    expect(text('.holder')).toContain('Bodega');
  });

  it('sin foto muestra las iniciales y no es un enlace', () => {
    render(ITEM);
    expect(el().querySelector('img')).toBeNull();
    expect(el().textContent).toContain('PW');
    expect(el().querySelector('a')).toBeNull();
  });

  it('con foto la pinta, y si no carga cae a las iniciales', () => {
    render({ ...ITEM, product: { ...ITEM.product, image: 'https://example.com/whey.jpg' } });
    const img = el().querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.com/whey.jpg');
    img.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(el().querySelector('img')).toBeNull();
  });
});
