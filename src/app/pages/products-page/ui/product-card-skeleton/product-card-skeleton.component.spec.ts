import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductoCardSkeletonComponent } from './producto-card-skeleton.component';

describe('ProductoCardSkeletonComponent', () => {
  let component: ProductoCardSkeletonComponent;
  let fixture: ComponentFixture<ProductoCardSkeletonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductoCardSkeletonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductoCardSkeletonComponent);
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
