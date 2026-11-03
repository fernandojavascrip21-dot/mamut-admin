import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyStockCardSkeletonComponent } from './my-stock-card-skeleton.component';

describe('MyStockCardSkeletonComponent', () => {
  let fixture: ComponentFixture<MyStockCardSkeletonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MyStockCardSkeletonComponent] }).compileComponents();
    fixture = TestBed.createComponent(MyStockCardSkeletonComponent);
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
