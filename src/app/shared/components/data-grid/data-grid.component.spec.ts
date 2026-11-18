import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DataGridComponent } from './data-grid.component';
import type { DataGridColumn, DataGridOption, DataGridRow, DataGridState, DataGridTexts } from './data-grid.models';

const COLUMNS: DataGridColumn[] = [
  { key: 'price', header: 'Precio', align: 'right', format: 'money' },
  { key: 'cost', header: 'Costo', align: 'right', format: 'cost' },
  { key: 'date', header: 'Fecha', align: 'left', format: 'date' },
  { key: 'qty', header: 'Piezas', align: 'right', format: 'text', primary: true },
];

const ROWS: DataGridRow[] = [
  {
    key: 'a', title: 'Proteína Whey 2 lb', image: null, actionId: '2', actionLabel: 'Editar Proteína Whey 2 lb',
    cells: {
      price: { value: '520.00', badge: 'propio' },
      cost: { value: '310.5000' },
      date: { value: '2026-10-30T18:21:07.000Z' },
      qty: { value: '4 piezas' },
    },
  },
  {
    key: 'b', title: 'Creatina Monohidratada', image: null, link: ['/admin/entregas', 'r-1'],
    queryParams: { volver: 'vendedor' },
    cells: { price: { value: '300.00' }, cost: { value: null }, date: { value: null }, qty: { value: '2 piezas' } },
  },
  {
    key: 'c', title: 'Glutamina', image: 'https://example.com/g.jpg',
    cells: { qty: { value: '1 pieza' } },
  },
];

const TEXTS: DataGridTexts = {
  titleHeader: 'Producto',
  loading: 'Cargando entregas…',
  error: 'No pudimos cargar las entregas',
  empty: 'Todavía no hay nada.',
  stateClass: 'history',
  emptyClass: 'history-empty',
};

const OPTIONS: DataGridOption[] = [
  { value: 'one', label: 'Uno (2)' },
  { value: 'two', label: 'Dos' },
];

// Anfitrión: proyecta el título y guarda lo que emite el grid.
@Component({
  imports: [DataGridComponent],
  template: `
    <app-data-grid
      [columns]="columns()"
      [rows]="rows()"
      [state]="state()"
      [texts]="texts"
      [options]="options()"
      [selected]="selected()"
      filterLabel="Qué mostrar"
      (selectedChange)="picked.push($event)"
      (rowAction)="actions.push($event)"
      (retry)="retries = retries + 1"
    >
      <h2 gridTitle class="grid-title">Mi lista</h2>
    </app-data-grid>
  `,
})
class HostComponent {
  readonly columns = signal(COLUMNS);
  readonly rows = signal<DataGridRow[]>(ROWS);
  readonly state = signal<DataGridState>('ready');
  readonly options = signal<DataGridOption[]>(OPTIONS);
  readonly selected = signal<string | null>('one');
  readonly texts = TEXTS;
  picked: string[] = [];
  actions: string[] = [];
  retries = 0;
}

describe('DataGridComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  const el = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(el().querySelectorAll('tr.data-grid-row')) as HTMLElement[];
  const headers = () => Array.from(el().querySelectorAll('th')).map((th) => th.textContent!.trim());
  const options = () => Array.from(el().querySelectorAll('p-selectbutton p-togglebutton')) as HTMLElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await render();
  });

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('proyecta el título y pinta los encabezados: título de fila primero y luego las columnas', () => {
    expect(el().querySelector('.grid-title')?.textContent).toBe('Mi lista');
    expect(headers()).toEqual(['Producto', 'Precio', 'Costo', 'Fecha', 'Piezas']);
  });

  it('pinta una fila por elemento con cada valor en su formato', () => {
    expect(rows()).toHaveLength(3);
    const first = rows()[0]!;
    expect(first.querySelector('.cell-price')?.textContent).toContain('$520.00');
    expect(first.querySelector('.cell-cost')?.textContent).toContain('$310.50');
    expect(first.querySelector('.cell-date')?.textContent).toContain('30/10/2026');
    expect(first.querySelector('.cell-qty')?.textContent?.trim()).toBe('4 piezas');
  });

  it('una celda sin valor queda vacía y la marca solo aparece donde se pidió', () => {
    expect(rows()[0]!.querySelector('.cell-price .badge')?.textContent).toBe('propio');
    expect(rows()[1]!.querySelector('.cell-price .badge')).toBeNull();
    expect(rows()[1]!.querySelector('.cell-cost')?.textContent?.trim()).toBe('');
  });

  it('las columnas secundarias se ocultan en móvil y bajan bajo el título; la principal no', () => {
    const price = rows()[0]!.querySelector('.cell-price') as HTMLElement;
    const qty = rows()[0]!.querySelector('.cell-qty') as HTMLElement;
    expect(price.classList).toContain('hidden');
    expect(price.classList).toContain('md:table-cell');
    expect(qty.classList).not.toContain('hidden');
    expect(qty.classList).toContain('text-right');
    expect(rows()[0]!.querySelector('td .md\\:hidden')?.textContent).toContain('$520.00');
  });

  it('una fila con actionId es un botón con su nombre accesible y emite ese id al tocarla', () => {
    const button = rows()[0]!.querySelector('button.data-grid-action') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Editar Proteína Whey 2 lb');
    button.click();
    rows()[1]!.click();
    expect(host.actions).toEqual(['2']);
  });

  it('una fila con link es un enlace; sin link ni acción, solo texto', () => {
    expect(rows()[1]!.querySelector('a')?.getAttribute('href')).toBe('/admin/entregas/r-1?volver=vendedor');
    expect(rows()[2]!.querySelector('a, button')).toBeNull();
  });

  it('si la foto no carga muestra las iniciales', () => {
    rows()[2]!.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(rows()[2]!.querySelector('img')).toBeNull();
    expect(rows()[2]!.textContent).toContain('GL');
  });

  it('el filtro muestra las opciones y avisa la elegida', () => {
    expect(options().map((o) => o.textContent!.trim())).toEqual(['Uno (2)', 'Dos']);
    expect(el().querySelector('p-selectbutton')?.getAttribute('aria-label')).toBe('Qué mostrar');
    options()[1]!.click();
    expect(host.picked).toEqual(['two']);
  });

  it('sin opciones no muestra filtro', async () => {
    host.options.set([]);
    await render();
    expect(el().querySelector('p-selectbutton')).toBeNull();
  });

  it('sin filas muestra el mensaje vacío ocupando toda la fila', async () => {
    host.rows.set([]);
    await render();
    const empty = el().querySelector('.history-empty') as HTMLElement;
    expect(empty.textContent?.trim()).toBe('Todavía no hay nada.');
    expect(empty.getAttribute('colspan')).toBe('5');
  });

  it('mientras carga muestra el aviso de carga y no la tabla', async () => {
    host.state.set('loading');
    await render();
    expect(el().querySelector('.history-loading')?.textContent).toContain('Cargando entregas…');
    expect(el().querySelector('p-table')).toBeNull();
  });

  it('con error muestra el aviso y «Reintentar» emite retry', async () => {
    host.state.set('error');
    await render();
    expect(el().querySelector('.history-error')?.textContent).toContain('No pudimos cargar las entregas');
    (el().querySelector('.retry-history') as HTMLButtonElement).click();
    expect(host.retries).toBe(1);
  });
});
