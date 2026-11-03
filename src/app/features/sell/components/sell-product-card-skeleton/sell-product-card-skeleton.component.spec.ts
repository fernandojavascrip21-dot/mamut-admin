import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SellProductCardSkeletonComponent } from './sell-product-card-skeleton.component';

describe('SellProductCardSkeletonComponent', () => {
  let fixture: ComponentFixture<SellProductCardSkeletonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SellProductCardSkeletonComponent] }).compileComponents();
    fixture = TestBed.createComponent(SellProductCardSkeletonComponent);
    await fixture.whenStable();
  });

  it('se renderiza', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('está marcado con aria-hidden para que no distraiga a lectores de pantalla', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
