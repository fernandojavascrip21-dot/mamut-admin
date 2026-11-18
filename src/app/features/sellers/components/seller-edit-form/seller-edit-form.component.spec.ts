import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SellerEditFormComponent } from './seller-edit-form.component';
import type { Seller, UpdateSellerInput } from '../../interfaces/seller.models';

const SELLER: Seller = {
  id: 'v-1',
  fullName: 'Víctor Vendedor',
  businessName: 'Gimnasio Fuerza Norte',
  email: 'victor@mammut.local',
  phone: '5512345678',
  active: true,
  createdAt: '2026-11-12T18:00:00.000Z',
};

describe('SellerEditFormComponent', () => {
  let fixture: ComponentFixture<SellerEditFormComponent>;
  let saved: UpdateSellerInput[];
  let cancelled: number;

  async function render(seller: Seller = SELLER) {
    await TestBed.configureTestingModule({ imports: [SellerEditFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(SellerEditFormComponent);
    document.body.appendChild(fixture.nativeElement);
    saved = [];
    cancelled = 0;
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.componentInstance.cancel.subscribe(() => cancelled++);
    fixture.componentRef.setInput('seller', seller);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => fixture.nativeElement.remove());

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent!.replace(/\s+/g, ' ');

  // El campo se busca por su etiqueta visible, no por una clase ni un id.
  function field(label: string): HTMLInputElement {
    const labelEl = Array.from(root().querySelectorAll('label')).find((l) => l.textContent?.trim() === label);
    return root().querySelector(`#${labelEl!.htmlFor}`) as HTMLInputElement;
  }
  function type(label: string, value: string) {
    const input = field(label);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
  async function submit() {
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const button = (label: string) =>
    Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement;

  it('precarga nombre, negocio, teléfono con espacios y correo, en ese orden', async () => {
    await render();
    const labels = Array.from(root().querySelectorAll('label'), (l) => l.textContent?.trim());
    expect(labels).toEqual(['Nombre', 'Nombre del negocio', 'Teléfono', 'Correo para entrar']);
    expect(field('Nombre').value).toBe('Víctor Vendedor');
    expect(field('Nombre del negocio').value).toBe('Gimnasio Fuerza Norte');
    expect(field('Teléfono').value).toBe('55 1234 5678');
    expect(field('Correo para entrar').value).toBe('victor@mammut.local');
  });

  it('un vendedor sin negocio deja el campo vacío', async () => {
    await render({ ...SELLER, businessName: null });
    expect(field('Nombre del negocio').value).toBe('');
  });

  it('muestra las ayudas de negocio, teléfono y correo', async () => {
    await render();
    expect(text()).toContain('Opcional: gimnasio, café, tienda…');
    expect(text()).toContain('10 dígitos; puedes escribirlo con espacios.');
    expect(text()).toContain('Es su usuario para entrar. Si lo cambias, entrará con el nuevo.');
  });

  it('los errores de campo no se ven al escribir, solo al enviar', async () => {
    await render();
    type('Nombre', '');
    type('Teléfono', '123');
    field('Nombre').dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(text()).not.toContain('Escribe el nombre del vendedor');
    expect(text()).not.toContain('El teléfono debe tener 10 dígitos');

    await submit();
    expect(text()).toContain('Escribe el nombre del vendedor');
    expect(text()).toContain('El teléfono debe tener 10 dígitos');
  });

  it('con campos inválidos no emite, pinta todos los errores y enfoca el primero', async () => {
    await render();
    type('Nombre', '   ');
    type('Teléfono', '');
    type('Correo para entrar', 'no-es-correo');
    await submit();

    expect(saved).toEqual([]);
    expect(text()).toContain('Escribe el nombre del vendedor');
    expect(text()).toContain('Escribe el teléfono del vendedor');
    expect(text()).toContain('El correo no es válido');
    expect(document.activeElement).toBe(field('Nombre'));
  });

  it('un correo vacío pide escribir el correo para entrar', async () => {
    await render();
    type('Correo para entrar', '');
    await submit();
    expect(text()).toContain('Escribe el correo para entrar');
    expect(saved).toEqual([]);
  });

  it('un negocio de 81 caracteres muestra su mensaje al enviar y no emite', async () => {
    await render();
    type('Nombre del negocio', 'a'.repeat(81));
    expect(text()).not.toContain('El nombre del negocio debe tener como máximo 80 caracteres');
    await submit();
    expect(text()).toContain('El nombre del negocio debe tener como máximo 80 caracteres');
    expect(saved).toEqual([]);
  });

  it('un negocio de 80 caracteres es válido', async () => {
    await render();
    type('Nombre del negocio', 'a'.repeat(80));
    await submit();
    expect(saved).toHaveLength(1);
    expect(saved[0]!.businessName).toBe('a'.repeat(80));
  });

  it('emite los cuatro datos recortados: negocio vacío es null y el teléfono va solo con dígitos', async () => {
    await render();
    type('Nombre', '  Víctor Pérez ');
    type('Nombre del negocio', '    ');
    type('Teléfono', '55 9876 5432');
    type('Correo para entrar', ' nuevo@mammut.local ');
    await submit();

    expect(saved).toEqual([
      { fullName: 'Víctor Pérez', businessName: null, phone: '5598765432', email: 'nuevo@mammut.local' },
    ]);
  });

  it('sin cambios emite igual los cuatro datos del vendedor', async () => {
    await render();
    await submit();
    expect(saved).toEqual([
      {
        fullName: 'Víctor Vendedor',
        businessName: 'Gimnasio Fuerza Norte',
        phone: '5512345678',
        email: 'victor@mammut.local',
      },
    ]);
  });

  it('un negocio con espacios en los extremos se emite recortado', async () => {
    await render();
    type('Nombre del negocio', '  Café Centro  ');
    await submit();
    expect(saved[0]!.businessName).toBe('Café Centro');
  });

  it('«Cancelar» emite el cierre', async () => {
    await render();
    button('Cancelar').click();
    expect(cancelled).toBe(1);
  });

  it('mientras guarda, el botón dice «Guardando…» y los campos quedan deshabilitados', async () => {
    await render();
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(button('Guardando…').disabled).toBe(true);
    expect(field('Nombre').disabled).toBe(true);
    expect(field('Correo para entrar').disabled).toBe(true);
  });

  it('sin guardar el botón principal dice «Guardar cambios»', async () => {
    await render();
    expect(button('Guardar cambios').disabled).toBe(false);
  });

  it('un error del backend en el correo se pinta bajo el campo y lo enfoca', async () => {
    await render();
    fixture.componentRef.setInput('serverErrors', { email: 'Ya existe un acceso con ese correo' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Ya existe un acceso con ese correo');
    expect(document.activeElement).toBe(field('Correo para entrar'));
  });
});
