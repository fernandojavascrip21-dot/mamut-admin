import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { RestockProduct, RestockSuggestion } from '../../interfaces/restock.models';
import { RestockFormComponent } from './restock-form.component';
import type { RestockFormSubmit, RestockLineForm } from './restock-form.models';

const PRODUCTS: RestockProduct[] = [
  { productId: 1, name: 'Creatina 300 g', image: null, units: 0, stockLevel: 'out', unitCost: '120.0000' },
  { productId: 2, name: 'Proteína 2 kg', image: null, units: 2, stockLevel: 'low', unitCost: '450.5000' },
  { productId: 3, name: 'Barra de avena', image: null, units: 40, stockLevel: 'ok', unitCost: '10.0000' },
];
const SUGGESTIONS: RestockSuggestion[] = [
  { productId: 1, name: 'Creatina 300 g', image: null, units: 0, stockLevel: 'out', unitCost: '120.0000' },
  { productId: 2, name: 'Proteína 2 kg', image: null, units: 2, stockLevel: 'low', unitCost: '450.5000' },
];
const catalog = (productId: number, name: string, qty = '', unitCost = '10.0000'): RestockLineForm =>
  ({ kind: 'catalog', productId, name, qty, unitCost });

describe('RestockFormComponent', () => {
  let fixture: ComponentFixture<RestockFormComponent>;
  let saved: RestockFormSubmit[];
  let closed: RestockFormSubmit[];
  let dirty: boolean[];

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => (root().textContent ?? '').replace(/\s+/g, ' ');
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const render = async (
    lines: RestockLineForm[],
    inputs: { suggestions?: RestockSuggestion[]; products?: RestockProduct[]; initialNote?: string } = {},
  ) => {
    fixture = TestBed.createComponent(RestockFormComponent);
    fixture.componentRef.setInput('products', inputs.products ?? PRODUCTS);
    fixture.componentRef.setInput('suggestions', inputs.suggestions ?? []);
    fixture.componentRef.setInput('initialLines', lines);
    if (inputs.initialNote !== undefined) fixture.componentRef.setInput('initialNote', inputs.initialNote);
    saved = [];
    closed = [];
    dirty = [];
    fixture.componentInstance.saved.subscribe((v) => saved.push(v));
    fixture.componentInstance.closed.subscribe((v) => closed.push(v));
    fixture.componentInstance.dirtyChange.subscribe((v) => dirty.push(v));
    await settle();
  };
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent!.trim() === label)!;
  const lineCount = () => root().querySelectorAll('app-restock-line').length;
  const type = (selector: string, index: number, value: string) => {
    const input = root().querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(selector)[index]!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const typeQty = (index: number, value: string) => type('input.restock-qty', index, value);
  const typeCost = (index: number, value: string) => type('input.restock-cost', index, value);
  const click = async (label: string) => {
    button(label).click();
    await settle();
  };
  const addCustom = async (name: string, cost = '') => {
    await click('Escribir un producto');
    type('input.restock-custom-name', 0, name);
    type('input.restock-custom-cost', 0, cost);
    await click('Agregar');
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RestockFormComponent] }).compileComponents();
  });

  describe('lista', () => {
    it('pinta un renglón por cada uno de los iniciales y los botones de acción', async () => {
      await render([catalog(1, 'Creatina 300 g'), catalog(2, 'Proteína 2 kg')]);
      expect(lineCount()).toBe(2);
      expect(text()).toContain('Guardar pedido');
      expect(text()).toContain('Cerrar pedido');
      expect(text()).toContain('Nota del pedido');
      expect(text()).toContain('Total estimado');
    });

    it('«Descartar borrador» solo aparece con un borrador guardado', async () => {
      await render([catalog(1, 'Creatina 300 g')]);
      expect(text()).not.toContain('Descartar borrador');
      fixture.componentRef.setInput('hasDraft', true);
      await settle();
      expect(text()).toContain('Descartar borrador');
      const discarded = vi.fn();
      fixture.componentInstance.discarded.subscribe(discarded);
      await click('Descartar borrador');
      expect(discarded).toHaveBeenCalledTimes(1);
    });

    it('una lista recién cargada no cuenta como cambio', async () => {
      await render([catalog(1, 'Creatina 300 g')]);
      expect(dirty).not.toContain(true);
    });

    it('sin renglones muestra «Nada que resurtir» y deja «Agregar producto» y «Escribir un producto»', async () => {
      await render([]);
      expect(text()).toContain('Nada que resurtir');
      expect(text()).toContain('Todos los productos tienen piezas en bodega.');
      expect(text()).toContain('Agregar producto');
      expect(button('Escribir un producto')).toBeDefined();
    });

    it('quitar un renglón lo saca de la lista y marca cambios; quitar el último deja el estado vacío', async () => {
      await render([catalog(1, 'Creatina 300 g'), catalog(2, 'Proteína 2 kg')]);
      await click('Quitar');
      expect(lineCount()).toBe(1);
      expect(dirty).toContain(true);
      await click('Quitar');
      expect(lineCount()).toBe(0);
      expect(text()).toContain('Nada que resurtir');
    });
  });

  describe('agregar producto', () => {
    const choose = async (label: string) => {
      root().querySelector<HTMLElement>('p-select')!.click();
      await settle();
      Array.from(root().querySelectorAll<HTMLElement>('li.p-select-option'))
        .find((li) => li.textContent!.includes(label))!.click();
      await settle();
    };

    it('ofrece los productos que no están en la lista, con «Nombre · N piezas en bodega»', async () => {
      await render([catalog(1, 'Creatina 300 g')]);
      root().querySelector<HTMLElement>('p-select')!.click();
      await settle();
      const options = Array.from(root().querySelectorAll('li.p-select-option')).map((li) => li.textContent!.trim());
      expect(options).toEqual(['Proteína 2 kg · 2 piezas en bodega', 'Barra de avena · 40 piezas en bodega']);
    });

    it('elegir uno lo agrega al final con piezas vacías y su costo actual, y marca cambios', async () => {
      await render([catalog(1, 'Creatina 300 g')]);
      await choose('Barra de avena');
      expect(lineCount()).toBe(2);
      expect(root().querySelectorAll<HTMLInputElement>('input.restock-qty')[1]!.value).toBe('');
      expect(root().querySelectorAll<HTMLInputElement>('input.restock-cost')[1]!.value).toBe('10.0000');
      expect(dirty).toContain(true);
    });
  });

  describe('escribir un producto', () => {
    it('agrega un renglón «Escrito a mano» al final con piezas vacías y marca cambios', async () => {
      await render([catalog(1, 'Creatina 300 g')]);
      await addCustom('Shaker', '35.5');
      expect(lineCount()).toBe(2);
      expect(text()).toContain('Escrito a mano');
      expect(root().querySelector<HTMLInputElement>('input.restock-name')!.value).toBe('Shaker');
      expect(root().querySelectorAll<HTMLInputElement>('input.restock-qty')[1]!.value).toBe('');
      expect(root().querySelectorAll<HTMLInputElement>('input.restock-cost')[1]!.value).toBe('35.5');
      expect(dirty).toContain(true);
    });

    it('sin nombre no agrega nada', async () => {
      await render([]);
      await addCustom('   ');
      expect(lineCount()).toBe(0);
    });

    it('un nombre igual al de un producto del catálogo avisa «Ya existe en el catálogo»', async () => {
      await render([]);
      await addCustom('proteina 2 KG');
      expect(text()).toContain('Ya existe en el catálogo: elígelo de la lista');
    });
  });

  describe('agregar sugeridos', () => {
    it('muestra «Agregar sugeridos (N)» con las sugerencias que faltan y las agrega en orden', async () => {
      await render([catalog(1, 'Creatina 300 g')], { suggestions: SUGGESTIONS });
      expect(button('Agregar sugeridos (1)')).toBeDefined();
      await click('Agregar sugeridos (1)');
      expect(lineCount()).toBe(2);
      expect(root().querySelectorAll<HTMLInputElement>('input.restock-cost')[1]!.value).toBe('450.5000');
      expect(dirty).toContain(true);
    });

    it('sin sugerencias pendientes el botón no aparece', async () => {
      await render([catalog(1, 'Creatina 300 g'), catalog(2, 'Proteína 2 kg')], { suggestions: SUGGESTIONS });
      expect(text()).not.toContain('Agregar sugeridos');
      await render([], { suggestions: [] });
      expect(text()).not.toContain('Agregar sugeridos');
    });
  });

  describe('total estimado', () => {
    it('se actualiza al escribir piezas y costo: 2 × 10.5000 + 1 × 10.0000 = $31.00', async () => {
      await render([catalog(1, 'Creatina 300 g', '', '10.5000'), catalog(2, 'Proteína 2 kg', '', '10.0000')]);
      expect(text()).toContain('$0.00');
      typeQty(0, '2');
      typeQty(1, '1');
      expect(text()).toContain('$31.00');
    });

    it('redondea una sola vez sobre la suma: 15.5025 + 15.5025 = $31.01', async () => {
      await render([catalog(1, 'Creatina 300 g', '1', '15.5025'), catalog(2, 'Proteína 2 kg', '1', '15.5025')]);
      expect(text()).toContain('$31.01');
    });

    it('avisa «N sin costo» por los renglones escritos sin costo', async () => {
      await render([]);
      await addCustom('Shaker');
      typeQty(0, '2');
      expect(text()).toContain('1 sin costo');
    });

    it('un renglón con piezas inválidas no suma', async () => {
      await render([catalog(1, 'Creatina 300 g', '1.5', '10.0000')]);
      expect(text()).toContain('$0.00');
    });
  });

  describe('errores al enviar', () => {
    it('no se muestran al escribir ni al salir del campo, solo al enviar', async () => {
      await render([catalog(1, 'Creatina 300 g')]);
      const qty = root().querySelector<HTMLInputElement>('input.restock-qty')!;
      qty.dispatchEvent(new Event('focus'));
      qty.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      expect(text()).not.toContain('Escribe cuántas piezas');
      await click('Guardar pedido');
      expect(text()).toContain('Escribe cuántas piezas');
      expect(saved).toEqual([]);
    });

    it('escribir en el campo borra su error', async () => {
      await render([catalog(1, 'Creatina 300 g')]);
      await click('Guardar pedido');
      expect(text()).toContain('Escribe cuántas piezas');
      typeQty(0, '3');
      expect(text()).not.toContain('Escribe cuántas piezas');
    });

    it('piezas decimales → «Debe ser un número entero mayor a 0» y costo inválido → mensaje de costo', async () => {
      await render([catalog(1, 'Creatina 300 g', '1.5', '1.23456')]);
      await click('Guardar pedido');
      expect(text()).toContain('Debe ser un número entero mayor a 0');
      expect(text()).toContain('Escribe un costo válido (hasta 4 decimales)');
      expect(saved).toEqual([]);
    });

    it('un renglón de catálogo sin costo no se envía', async () => {
      await render([catalog(1, 'Creatina 300 g', '2', '')]);
      await click('Guardar pedido');
      expect(saved).toEqual([]);
      expect(text()).toContain('Escribe un costo válido (hasta 4 decimales)');
    });

    it('dos renglones escritos con el mismo nombre (sin mayúsculas ni acentos) → «Ya escribiste este producto»', async () => {
      await render([]);
      await addCustom('Cinturón');
      await addCustom('CINTURON');
      typeQty(0, '1');
      typeQty(1, '1');
      await click('Guardar pedido');
      expect(text()).toContain('Ya escribiste este producto');
      expect(saved).toEqual([]);
    });

    it('una nota de más de 500 caracteres da error al enviar', async () => {
      await render([catalog(1, 'Creatina 300 g', '1')]);
      type('.restock-note', 0, 'x'.repeat(501));
      await click('Guardar pedido');
      expect(saved).toEqual([]);
      expect(text()).toContain('501');
    });

    it('más de 200 renglones → «Un pedido lleva hasta 200 productos» y no emite', async () => {
      const lines = Array.from({ length: 201 }, (_, i) => catalog(i + 1000, `Producto ${i}`, '1'));
      await render(lines, { products: lines.map((l) => ({
        productId: l.productId!, name: l.name, image: null, units: 1, stockLevel: 'ok' as const, unitCost: '1.0000',
      })) });
      await click('Guardar pedido');
      expect(text()).toContain('Un pedido lleva hasta 200 productos');
      expect(saved).toEqual([]);
    });
  });

  describe('renglones que ya no se pueden pedir', () => {
    it('se marcan y bloquean guardar y cerrar con «Quita los productos que ya no se pueden pedir»', async () => {
      await render([catalog(1, 'Creatina 300 g', '2'), catalog(99, 'Bolsita vieja', '1')]);
      expect(text()).toContain('Ya no se puede pedir');
      await click('Guardar pedido');
      expect(text()).toContain('Quita los productos que ya no se pueden pedir');
      await click('Cerrar pedido');
      expect(saved).toEqual([]);
      expect(closed).toEqual([]);
    });

    it('no suman en el total y quitarlo desbloquea el envío', async () => {
      await render([catalog(1, 'Creatina 300 g', '2', '10.0000'), catalog(99, 'Bolsita vieja', '5', '100.0000')]);
      expect(text()).toContain('$20.00');
      const removeButtons = Array.from(root().querySelectorAll('button')).filter((b) => b.textContent!.trim() === 'Quitar');
      removeButtons[1]!.click();
      await settle();
      await click('Guardar pedido');
      expect(saved).toHaveLength(1);
    });
  });

  describe('lista vacía', () => {
    it('se puede guardar como borrador con una lista vacía', async () => {
      await render([]);
      await click('Guardar pedido');
      expect(saved).toEqual([{ payload: { note: null, lines: [] }, total: '0.00', lineCount: 0 }]);
    });

    it('no se puede cerrar: «Agrega al menos un producto para cerrar el pedido»', async () => {
      await render([]);
      await click('Cerrar pedido');
      expect(text()).toContain('Agrega al menos un producto para cerrar el pedido');
      expect(closed).toEqual([]);
    });
  });

  describe('salida con el payload', () => {
    it('guardar emite note, un renglón de catálogo con unitCost y uno escrito con nombre y unitCost null', async () => {
      await render([catalog(1, 'Creatina 300 g', '', '12.5000')], { initialNote: '  Pedido de noviembre  ' });
      await addCustom('  Shaker  ');
      typeQty(0, '2');
      typeQty(1, '1');
      await click('Guardar pedido');
      expect(saved).toEqual([{
        payload: {
          note: 'Pedido de noviembre',
          lines: [
            { productId: 1, qty: 2, unitCost: '12.5000' },
            { name: 'Shaker', qty: 1, unitCost: null },
          ],
        },
        total: '25.00',
        lineCount: 2,
      }]);
    });

    it('un costo editado viaja tal cual y una nota vacía se manda null', async () => {
      await render([catalog(1, 'Creatina 300 g', '3', '120.0000')]);
      typeCost(0, '99.9999');
      await click('Guardar pedido');
      expect(saved[0]!.payload).toEqual({ note: null, lines: [{ productId: 1, qty: 3, unitCost: '99.9999' }] });
      expect(saved[0]!.total).toBe('300.00');
    });

    it('cerrar emite closed con el mismo payload, el total y la cuenta de renglones', async () => {
      await render([catalog(1, 'Creatina 300 g', '2', '10.5000'), catalog(2, 'Proteína 2 kg', '1', '10.0000')]);
      await click('Cerrar pedido');
      expect(closed).toEqual([{
        payload: {
          note: null,
          lines: [{ productId: 1, qty: 2, unitCost: '10.5000' }, { productId: 2, qty: 1, unitCost: '10.0000' }],
        },
        total: '31.00',
        lineCount: 2,
      }]);
      expect(saved).toEqual([]);
    });

    it('un pedido con solo renglones escritos sí se cierra', async () => {
      await render([]);
      await addCustom('Shaker');
      typeQty(0, '4');
      await click('Cerrar pedido');
      expect(closed).toHaveLength(1);
    });
  });

  describe('estados del envío y del aviso', () => {
    it('con busy los tres botones quedan deshabilitados', async () => {
      await render([catalog(1, 'Creatina 300 g', '2')]);
      fixture.componentRef.setInput('hasDraft', true);
      fixture.componentRef.setInput('busy', 'save');
      await settle();
      for (const label of ['Guardar pedido', 'Cerrar pedido', 'Descartar borrador']) {
        expect(button(label).disabled).toBe(true);
      }
    });

    it('muestra el aviso en alert-danger y su acción emite noticeActionClicked', async () => {
      await render([catalog(1, 'Creatina 300 g', '2')]);
      fixture.componentRef.setInput('notice', 'No pudimos guardar el pedido. Inténtalo de nuevo.');
      fixture.componentRef.setInput('noticeAction', 'retry');
      await settle();
      expect(root().querySelector('.alert-danger')!.textContent).toContain('No pudimos guardar el pedido. Inténtalo de nuevo.');
      const action = vi.fn();
      fixture.componentInstance.noticeActionClicked.subscribe(action);
      await click('Reintentar');
      expect(action).toHaveBeenCalledWith('retry');
    });

    it('con la acción reload el aviso ofrece «Volver a cargar»', async () => {
      await render([catalog(1, 'Creatina 300 g', '2')]);
      fixture.componentRef.setInput('notice', 'Este pedido ya está cerrado.');
      fixture.componentRef.setInput('noticeAction', 'reload');
      await settle();
      const action = vi.fn();
      fixture.componentInstance.noticeActionClicked.subscribe(action);
      await click('Volver a cargar');
      expect(action).toHaveBeenCalledWith('reload');
    });
  });
});
