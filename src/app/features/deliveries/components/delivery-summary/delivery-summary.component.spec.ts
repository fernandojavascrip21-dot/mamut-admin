import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { Delivery } from '../../interfaces/delivery.models';
import { DeliverySummaryComponent } from './delivery-summary.component';

const DELIVERY: Delivery = {
  requestId: 'r-1',
  createdAt: '2026-10-30T18:21:07.000Z',
  qty: 6,
  seller: { id: 'v-1', fullName: 'Luis Pérez' },
  product: { id: 10, name: 'Proteína Whey 2 lb', image: null, price: '450.00', unitCost: '300.0000' },
  unitPrice: null,
  unitCostWithShipping: null,
  warehouse: { before: 10, after: 4 },
  sellerStock: { before: 0, after: 6 },
};

describe('DeliverySummaryComponent', () => {
  let fixture: ComponentFixture<DeliverySummaryComponent>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');

  function render(delivery: Delivery) {
    fixture = TestBed.createComponent(DeliverySummaryComponent);
    fixture.componentRef.setInput('delivery', delivery);
    fixture.componentRef.setInput('doneUrl', '/admin/productos');
    fixture.componentRef.setInput('anotherQueryParams', { vendedor: 'v-1', volver: 'productos' });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeliverySummaryComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('dice cuántas piezas se le dejaron a quién y muestra los saldos', () => {
    render(DELIVERY);
    expect(fixture.nativeElement.querySelector('.headline').textContent.replace(/\s+/g, ' ').trim()).toBe(
      'Le dejaste 6 piezas a Luis Pérez.',
    );
    expect(fixture.nativeElement.querySelector('.product-name').textContent.trim()).toBe('Proteína Whey 2 lb');
    expect(text()).toContain('Bodega: 10 → 4');
    expect(text()).toContain('Luis Pérez: 0 → 6');
    expect(text()).toContain('El total del negocio no cambia.');
  });

  it('sin precios propios muestra los generales y la ganancia con ellos', () => {
    render(DELIVERY);
    expect(fixture.nativeElement.querySelector('.price').textContent).toContain('$450.00');
    expect(fixture.nativeElement.querySelector('.price').textContent).toContain('general');
    expect(text()).toContain('Costo de fábrica');
    expect(fixture.nativeElement.querySelector('.cost').textContent).toContain('de fábrica');
    expect(fixture.nativeElement.querySelector('.profit').textContent.trim()).toBe('$150.00');
  });

  it('con precio y costo propios los muestra con «propio» y calcula la ganancia con ellos', () => {
    render({ ...DELIVERY, unitPrice: '520.00', unitCostWithShipping: '310.5000' });
    expect(fixture.nativeElement.querySelector('.price').textContent).toContain('$520.00');
    expect(fixture.nativeElement.querySelector('.price').textContent).toContain('propio');
    expect(text()).toContain('Costo con envío');
    expect(fixture.nativeElement.querySelector('.cost').textContent).toContain('$310.50');
    expect(fixture.nativeElement.querySelector('.profit').textContent.trim()).toBe('$209.50');
  });

  it('con un solo propio marca solo ese', () => {
    render({ ...DELIVERY, unitPrice: '500.00' });
    expect(fixture.nativeElement.querySelector('.price').textContent).toContain('propio');
    expect(fixture.nativeElement.querySelector('.cost').textContent).toContain('de fábrica');
  });

  it('«Listo» vuelve al origen y «Dejar otro producto» reabre la ventana con el mismo vendedor', () => {
    render(DELIVERY);
    expect((fixture.nativeElement.querySelector('a.done') as HTMLAnchorElement).getAttribute('href')).toBe(
      '/admin/productos',
    );
    expect((fixture.nativeElement.querySelector('a.another') as HTMLAnchorElement).getAttribute('href')).toBe(
      '/admin/entregas/nueva?vendedor=v-1&volver=productos',
    );
  });
});
