import { TestBed } from '@angular/core/testing';
import { StockProductRowSkeletonComponent } from './stock-product-row-skeleton.component';

describe('StockProductRowSkeletonComponent', () => {
  it('se oculta a los lectores de pantalla y pinta los bloques de carga', async () => {
    await TestBed.configureTestingModule({ imports: [StockProductRowSkeletonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(StockProductRowSkeletonComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('p-card')!.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelectorAll('p-skeleton').length).toBeGreaterThanOrEqual(3);
  });
});
