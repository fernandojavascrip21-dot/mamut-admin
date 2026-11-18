import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SellerPasswordFormComponent } from './seller-password-form.component';
import type { SetSellerPasswordInput } from '../../interfaces/seller.models';

describe('SellerPasswordFormComponent', () => {
  let fixture: ComponentFixture<SellerPasswordFormComponent>;
  let saved: SetSellerPasswordInput[];
  let cancelled: number;

  async function render(inputs: { saving?: boolean; serverError?: string | null } = {}) {
    await TestBed.configureTestingModule({ imports: [SellerPasswordFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(SellerPasswordFormComponent);
    document.body.appendChild(fixture.nativeElement);
    saved = [];
    cancelled = 0;
    fixture.componentInstance.save.subscribe((value) => saved.push(value));
    fixture.componentInstance.cancel.subscribe(() => cancelled++);
    if (inputs.saving !== undefined) fixture.componentRef.setInput('saving', inputs.saving);
    if (inputs.serverError !== undefined) fixture.componentRef.setInput('serverError', inputs.serverError);
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

  it('muestra «Contraseña temporal», «Confirmar contraseña» y la pista bajo el primer campo', async () => {
    await render();
    const labels = Array.from(root().querySelectorAll('label'), (l) => l.textContent?.trim());
    expect(labels).toEqual(['Contraseña temporal', 'Confirmar contraseña']);
    expect(text()).toContain('Mínimo 8 caracteres. Dísela en persona al vendedor.');
  });

  it('los dos campos llevan autocomplete="new-password"', async () => {
    await render();
    expect(field('Contraseña temporal').getAttribute('autocomplete')).toBe('new-password');
    expect(field('Confirmar contraseña').getAttribute('autocomplete')).toBe('new-password');
  });

  it('cada campo tiene su ojo, que lo muestra y lo oculta por separado', async () => {
    await render();
    const eyes = root().querySelectorAll<SVGElement>('.p-password-toggle-mask-icon');
    expect(eyes).toHaveLength(2);
    expect(field('Contraseña temporal').type).toBe('password');
    expect(field('Confirmar contraseña').type).toBe('password');
    eyes[0]!.dispatchEvent(new Event('click', { bubbles: true }));
    fixture.detectChanges();
    expect(field('Contraseña temporal').type).toBe('text');
    expect(field('Confirmar contraseña').type).toBe('password');
  });

  it('los errores no se ven al escribir ni al tocar, solo al enviar', async () => {
    await render();
    type('Contraseña temporal', '123');
    field('Contraseña temporal').dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(text()).not.toContain('Usa al menos 8 caracteres');
    await submit();
    expect(text()).toContain('Usa al menos 8 caracteres');
  });

  it('contraseña vacía: «Escribe la contraseña temporal»', async () => {
    await render();
    await submit();
    expect(text()).toContain('Escribe la contraseña temporal');
  });

  it('menos de 8 caracteres: «Usa al menos 8 caracteres»', async () => {
    await render();
    type('Contraseña temporal', '1234567');
    type('Confirmar contraseña', '1234567');
    await submit();
    expect(text()).toContain('Usa al menos 8 caracteres');
  });

  it('confirmación vacía: «Confirma la contraseña»', async () => {
    await render();
    type('Contraseña temporal', 'Clave-Nueva-1');
    await submit();
    expect(text()).toContain('Confirma la contraseña');
  });

  it('contraseñas distintas: «Las contraseñas no coinciden» en la confirmación', async () => {
    await render();
    type('Contraseña temporal', 'Clave-Nueva-1');
    type('Confirmar contraseña', 'Clave-Nueva-2');
    await submit();
    expect(text()).toContain('Las contraseñas no coinciden');
    expect(field('Confirmar contraseña').getAttribute('aria-invalid')).toBe('true');
  });

  it('un formulario inválido no emite', async () => {
    await render();
    await submit();
    expect(saved).toEqual([]);
  });

  it('un formulario válido emite solo { password }, sin la confirmación', async () => {
    await render();
    type('Contraseña temporal', 'Clave-Nueva-1');
    type('Confirmar contraseña', 'Clave-Nueva-1');
    await submit();
    expect(saved).toEqual([{ password: 'Clave-Nueva-1' }]);
  });

  it('con saving el botón dice «Cambiando…» y está deshabilitado; sin saving dice «Cambiar contraseña»', async () => {
    await render();
    expect(button('Cambiar contraseña').disabled).toBe(false);
    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    expect(button('Cambiando…').disabled).toBe(true);
  });

  it('un error del backend (serverError) se ve en «Contraseña temporal»', async () => {
    await render({ serverError: 'Usa al menos 8 caracteres' });
    expect(text()).toContain('Usa al menos 8 caracteres');
    expect(field('Contraseña temporal').getAttribute('aria-invalid')).toBe('true');
  });

  it('«Cancelar» emite cancel sin preguntar', async () => {
    await render();
    type('Contraseña temporal', 'algo');
    button('Cancelar').click();
    expect(cancelled).toBe(1);
  });
});
