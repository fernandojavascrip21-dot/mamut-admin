import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SellerCashCutPageComponent } from './seller-cash-cut-page.component';

describe('SellerCashCutPageComponent', () => {
  let fixture: ComponentFixture<SellerCashCutPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SellerCashCutPageComponent] }).compileComponents();
    fixture = TestBed.createComponent(SellerCashCutPageComponent);
    await fixture.whenStable();
  });

  it('muestra el título «Mi corte»', () => {
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Mi corte');
  });
});
