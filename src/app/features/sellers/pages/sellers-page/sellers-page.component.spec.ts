import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SellersPageComponent } from './sellers-page.component';

describe('SellersPageComponent', () => {
  let fixture: ComponentFixture<SellersPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SellersPageComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SellersPageComponent);
    fixture.detectChanges();
  });

  it('el botón «Nuevo vendedor» lleva al alta', () => {
    const link = fixture.nativeElement.querySelector('.new-seller') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('Nuevo vendedor');
    expect(link.getAttribute('href')).toBe('/admin/vendedores/nuevo');
  });
});
