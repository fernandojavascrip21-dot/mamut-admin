import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ReceiptFilePickerComponent } from './receipt-file-picker.component';

describe('ReceiptFilePickerComponent', () => {
  let fixture: ComponentFixture<ReceiptFilePickerComponent>;
  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const input = () => root().querySelector<HTMLInputElement>('input[type="file"]')!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReceiptFilePickerComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ReceiptFilePickerComponent);
    fixture.detectChanges();
  });

  it('explica los formatos admitidos', () => {
    expect(text()).toContain('Sube la remisión en Excel (.xlsx), PDF o imagen (JPG o PNG).');
  });

  it('tiene el botón «Elegir archivo» y el enlace «Pendientes de remisiones»', () => {
    const labels = Array.from(root().querySelectorAll('button')).map((b) => b.textContent!.trim());
    expect(labels).toContain('Elegir archivo');
    expect(text()).toContain('Pendientes de remisiones');
  });

  it('el input de archivo está oculto y solo acepta .xlsx, .pdf, .jpg, .jpeg y .png', () => {
    expect(input().accept).toBe('.xlsx,.pdf,.jpg,.jpeg,.png');
    expect(input().hidden || input().classList.contains('hidden')).toBe(true);
  });

  it('al elegir un archivo lo emite', () => {
    const emitted: File[] = [];
    fixture.componentInstance.fileSelected.subscribe((file) => emitted.push(file));
    const file = new File(['x'], 'remision.pdf');
    Object.defineProperty(input(), 'files', { value: [file] });
    input().dispatchEvent(new Event('change'));
    expect(emitted).toEqual([file]);
  });
});
