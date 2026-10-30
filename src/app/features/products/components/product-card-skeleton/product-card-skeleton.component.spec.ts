import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductCardSkeletonComponent } from './product-card-skeleton.component';

describe('ProductCardSkeletonComponent', () => {
  let component: ProductCardSkeletonComponent;
  let fixture: ComponentFixture<ProductCardSkeletonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductCardSkeletonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardSkeletonComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('está marcado con aria-hidden para que no distraiga a lectores de pantalla', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
