import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastComponent } from './toast.component';
import { ToastService } from '../../toast.service';

describe('ToastComponent', () => {
  let fixture: ComponentFixture<ToastComponent>;
  let service: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToastComponent);
    service = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  afterEach(() => service.dismiss());

  function toast(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.toast');
  }

  it('sin aviso no pinta nada, pero la región aria-live existe', () => {
    expect(toast()).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-live]')).toBeTruthy();
  });

  it('el éxito se anuncia como status y el error como alert', () => {
    service.success('Producto guardado');
    fixture.detectChanges();
    expect(toast()?.textContent).toContain('Producto guardado');
    expect(toast()?.getAttribute('role')).toBe('status');

    service.error('No se pudo guardar');
    fixture.detectChanges();
    expect(toast()?.textContent).toContain('No se pudo guardar');
    expect(toast()?.getAttribute('role')).toBe('alert');
  });

  it('«Cerrar» quita el aviso', () => {
    service.success('Producto guardado');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.dismiss') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(toast()).toBeNull();
  });
});
