import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SellerRowSkeletonComponent } from './seller-row-skeleton.component';

describe('SellerRowSkeletonComponent', () => {
  let fixture: ComponentFixture<SellerRowSkeletonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SellerRowSkeletonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SellerRowSkeletonComponent);
    fixture.detectChanges();
  });

  it('se oculta a los lectores de pantalla', () => {
    expect(fixture.nativeElement.firstElementChild.getAttribute('aria-hidden')).toBe('true');
  });
});
