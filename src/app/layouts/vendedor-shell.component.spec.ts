import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VendedorShellComponent } from './vendedor-shell.component';

describe('VendedorShellComponent', () => {
  let component: VendedorShellComponent;
  let fixture: ComponentFixture<VendedorShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VendedorShellComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VendedorShellComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
