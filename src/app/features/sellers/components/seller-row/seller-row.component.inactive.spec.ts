import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SellerRowComponent } from './seller-row.component';

describe('SellerRowComponent de un vendedor desactivado (HU-44)', () => {
  let fixture: ComponentFixture<SellerRowComponent>;

  async function setup(seller: { fullName: string; businessName: string | null }, inactive = true) {
    await TestBed.configureTestingModule({
      imports: [SellerRowComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(SellerRowComponent);
    fixture.componentRef.setInput('seller', { id: 'abc', units: 0, ...seller });
    fixture.componentRef.setInput('inactive', inactive);
    fixture.detectChanges();
  }

  const link = () => fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

  it('muestra el Tag «Desactivado» en lugar de las piezas', async () => {
    await setup({ fullName: 'Víctor Vendedor', businessName: 'Gimnasio Fuerza Norte' });
    const tag = fixture.nativeElement.querySelector('p-tag') as HTMLElement;
    expect(tag.textContent!.trim()).toBe('Desactivado');
    expect(tag.classList.contains('p-tag-secondary')).toBe(true);
    expect(fixture.nativeElement.querySelector('.units')).toBeNull();
    expect(link().textContent).not.toContain('pieza');
  });

  it('conserva iniciales, nombre y negocio, y abre su ficha', async () => {
    await setup({ fullName: 'Víctor Vendedor', businessName: 'Gimnasio Fuerza Norte' });
    expect(link().getAttribute('href')).toBe('/admin/vendedores/abc');
    expect(link().textContent).toContain('VV');
    expect(link().textContent).toContain('Víctor Vendedor');
    expect(fixture.nativeElement.querySelector('.business').textContent.trim()).toBe('Gimnasio Fuerza Norte');
  });

  it('el aria-label incluye el negocio y «desactivado»', async () => {
    await setup({ fullName: 'Víctor Vendedor', businessName: 'Gimnasio Fuerza Norte' });
    expect(link().getAttribute('aria-label')).toBe('Ver a Víctor Vendedor, Gimnasio Fuerza Norte, desactivado');
  });

  it('sin negocio el aria-label es «Ver a Víctor Vendedor, desactivado»', async () => {
    await setup({ fullName: 'Víctor Vendedor', businessName: null });
    expect(link().getAttribute('aria-label')).toBe('Ver a Víctor Vendedor, desactivado');
    expect(fixture.nativeElement.querySelector('.business')).toBeNull();
  });

  it('sin `inactive` sigue mostrando las piezas y no el Tag', async () => {
    await setup({ fullName: 'Víctor Vendedor', businessName: null }, false);
    expect(fixture.nativeElement.querySelector('p-tag')).toBeNull();
    expect(fixture.nativeElement.querySelector('.units').textContent.trim()).toBe('0 piezas');
  });
});
