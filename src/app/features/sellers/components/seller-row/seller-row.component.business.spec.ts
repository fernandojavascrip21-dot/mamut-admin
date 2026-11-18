import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SellerRowComponent } from './seller-row.component';
import type { SellerSummary } from '../../interfaces/seller.models';

describe('SellerRowComponent · negocio (HU-43)', () => {
  let fixture: ComponentFixture<SellerRowComponent>;

  function render(seller: SellerSummary) {
    TestBed.configureTestingModule({ imports: [SellerRowComponent], providers: [provideRouter([])] });
    fixture = TestBed.createComponent(SellerRowComponent);
    fixture.componentRef.setInput('seller', seller);
    fixture.detectChanges();
  }
  const link = () => fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

  it('con negocio lo muestra debajo del nombre', () => {
    render({ id: 'abc', fullName: 'Víctor Vendedor', businessName: 'Gimnasio Fuerza Norte', units: 12 });
    const lines = (link().textContent as string).replace(/\s+/g, ' ');
    expect(lines.indexOf('Gimnasio Fuerza Norte')).toBeGreaterThan(lines.indexOf('Víctor Vendedor'));
  });

  it('el aria-label del enlace suma el negocio', () => {
    render({ id: 'abc', fullName: 'Víctor Vendedor', businessName: 'Gimnasio Fuerza Norte', units: 12 });
    expect(link().getAttribute('aria-label')).toBe('Ver a Víctor Vendedor, Gimnasio Fuerza Norte, 12 piezas');
  });

  it('sin negocio no hay línea ni «Sin negocio» y el aria-label queda como antes', () => {
    render({ id: 'abc', fullName: 'Valeria Vendedora', businessName: null, units: 3 });
    expect(link().textContent).not.toContain('Sin negocio');
    expect(link().getAttribute('aria-label')).toBe('Ver a Valeria Vendedora, 3 piezas');
    expect(link().querySelector('.business')).toBeNull();
  });
});
