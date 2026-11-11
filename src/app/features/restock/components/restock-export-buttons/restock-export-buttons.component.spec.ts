import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { RestockExportFormat } from '../../interfaces/restock.models';
import { RestockExportButtonsComponent } from './restock-export-buttons.component';

describe('RestockExportButtonsComponent', () => {
  let fixture: ComponentFixture<RestockExportButtonsComponent>;
  let emitted: RestockExportFormat[];

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.includes(label))!;
  const render = (inputs: Record<string, unknown> = {}) => {
    fixture = TestBed.createComponent(RestockExportButtonsComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    emitted = [];
    fixture.componentInstance.exportRequested.subscribe((format) => emitted.push(format));
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RestockExportButtonsComponent] }).compileComponents();
  });

  it('muestra «Exportar PDF» y «Exportar Excel» habilitados', () => {
    render();
    expect(button('Exportar PDF').disabled).toBe(false);
    expect(button('Exportar Excel').disabled).toBe(false);
  });

  it('«Exportar PDF» emite pdf y «Exportar Excel» emite xlsx', () => {
    render();
    button('Exportar PDF').click();
    button('Exportar Excel').click();
    expect(emitted).toEqual(['pdf', 'xlsx']);
  });

  it('deshabilitado: los dos botones quedan deshabilitados y no emiten', () => {
    render({ disabled: true });
    expect(button('Exportar PDF').disabled).toBe(true);
    expect(button('Exportar Excel').disabled).toBe(true);
    button('Exportar PDF').click();
    expect(emitted).toEqual([]);
  });

  it('muestra la ayuda cuando llega y no la muestra cuando es null', () => {
    render({ disabled: true, helpText: 'Guarda el pedido para exportarlo' });
    expect(text()).toContain('Guarda el pedido para exportarlo');
    render();
    expect(text()).not.toContain('Guarda el pedido');
  });

  it('con un formato en curso los dos botones quedan deshabilitados y el pulsado muestra espera', () => {
    render({ busyFormat: 'pdf' });
    expect(button('Exportar PDF').disabled).toBe(true);
    expect(button('Exportar Excel').disabled).toBe(true);
    expect(root().querySelector('[aria-busy="true"], .p-button-loading, .pi-spinner, [data-busy="true"]')).not.toBeNull();
  });
});
