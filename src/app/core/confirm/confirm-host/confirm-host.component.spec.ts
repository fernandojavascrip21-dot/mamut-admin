import { ConfirmationService } from 'primeng/api';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmHostComponent } from './confirm-host.component';

describe('ConfirmHostComponent', () => {
  let component: ConfirmHostComponent;
  let fixture: ComponentFixture<ConfirmHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfirmHostComponent],
      providers: [ConfirmationService],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmHostComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
