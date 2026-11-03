import { MessageService } from 'primeng/api';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ToastService } from '../toast.service';
import { ToastHostComponent } from './toast-host.component';

describe('ToastHostComponent', () => {
  let component: ToastHostComponent;
  let fixture: ComponentFixture<ToastHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastHostComponent],
      providers: [MessageService],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastHostComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('entrega el aviso en espera tras su primer render', async () => {
    const messages = TestBed.inject(MessageService);
    const add = vi.spyOn(messages, 'add');
    TestBed.inject(ToastService).error('Sin conexión');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(add).toHaveBeenCalled();
  });
});
