import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Shrinkage } from '../../interfaces/shrinkage.models';
import { ShrinkageResultComponent } from './shrinkage-result.component';

const SHRINKAGE: Shrinkage = {
  requestId: 'r-1',
  createdAt: '2026-11-08T10:00:00Z',
  qty: 2,
  reason: 'damaged',
  reasonLabel: 'Dañado',
  holder: { id: 'v-1', fullName: 'Luis Prueba' },
  product: { id: 10, name: 'Creatina 300 g', image: null },
  stock: { before: 6, after: 4 },
};

describe('ShrinkageResultComponent', () => {
  let fixture: ComponentFixture<ShrinkageResultComponent>;

  const render = (shrinkage: Shrinkage = SHRINKAGE) => {
    fixture = TestBed.createComponent(ShrinkageResultComponent);
    fixture.componentRef.setInput('shrinkage', shrinkage);
    fixture.detectChanges();
  };
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  const button = (label: string) =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find((b) =>
      b.textContent!.includes(label),
    )!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ShrinkageResultComponent] }).compileComponents();
  });

  it('muestra el nombre del producto, las piezas y el motivo', () => {
    render();
    expect(text()).toContain('Creatina 300 g');
    expect(text()).toContain('2 piezas · Dañado');
  });

  it('muestra el stock del titular antes → después tal como lo mandó el backend', () => {
    render();
    expect(text()).toContain('Stock de Luis Prueba');
    expect(text()).toContain('6 → 4');
  });

  it('con la bodega como titular dice «Stock de la bodega»', () => {
    render({ ...SHRINKAGE, holder: null, stock: { before: 10, after: 7 } });
    expect(text()).toContain('Stock de la bodega');
    expect(text()).toContain('10 → 7');
  });

  it('«Registrar otra» emite again y «Cerrar» emite closed', () => {
    render();
    let again = 0;
    let closed = 0;
    fixture.componentInstance.again.subscribe(() => again++);
    fixture.componentInstance.closed.subscribe(() => closed++);
    button('Registrar otra').click();
    button('Cerrar').click();
    expect(again).toBe(1);
    expect(closed).toBe(1);
  });
});
