import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminCashCutPageComponent } from './admin-cash-cut-page.component';

describe('AdminCashCutPageComponent', () => {
  let component: AdminCashCutPageComponent;
  let fixture: ComponentFixture<AdminCashCutPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCashCutPageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminCashCutPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
