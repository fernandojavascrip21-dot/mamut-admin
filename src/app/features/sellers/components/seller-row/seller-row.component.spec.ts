import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SellerRowComponent } from './seller-row.component';

describe('SellerRowComponent', () => {
  let fixture: ComponentFixture<SellerRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SellerRowComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SellerRowComponent);
    fixture.componentRef.setInput('seller', { id: 'abc', fullName: 'Luis Prueba', units: 6 });
    fixture.detectChanges();
  });

  it('muestra iniciales, nombre y piezas, y lleva al detalle', () => {
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/admin/vendedores/abc');
    expect(link.getAttribute('aria-label')).toBe('Ver a Luis Prueba, 6 piezas');
    expect(link.textContent).toContain('LP');
    expect(link.textContent).toContain('Luis Prueba');
    expect(fixture.nativeElement.querySelector('.units').textContent.trim()).toBe('6 piezas');
  });

  it('con una pieza usa el singular', () => {
    fixture.componentRef.setInput('seller', { id: 'abc', fullName: 'Luis', units: 1 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.units').textContent.trim()).toBe('1 pieza');
  });
});
