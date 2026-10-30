import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { CreateSellerPageComponent } from './create-seller-page.component';
import { SellerSaveService } from '../../services/seller-save.service';
import { ToastService } from '@core/toast/toast.service';
import type { CreateSellerResult, Seller } from '../../interfaces/seller.models';

const SELLER: Seller = { id: 'u1', fullName: 'Luis Vendedor', email: 'luis@mammut.mx', phone: '5524681357', active: true };

// Cableado de la página con un doble de SellerSaveService: el mapeo de errores HTTP se prueba en
// seller-save.service.spec.ts.
describe('CreateSellerPageComponent', () => {
  let fixture: ComponentFixture<CreateSellerPageComponent>;
  let pending: Subject<CreateSellerResult>;
  let saveService: { create: ReturnType<typeof vi.fn> };
  let toast: ToastService;

  beforeEach(async () => {
    saveService = { create: vi.fn(() => (pending = new Subject<CreateSellerResult>())) };
    await TestBed.configureTestingModule({
      imports: [CreateSellerPageComponent],
      providers: [provideRouter([])],
    })
      .overrideComponent(CreateSellerPageComponent, {
        set: { providers: [{ provide: SellerSaveService, useValue: saveService }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CreateSellerPageComponent);
    document.body.appendChild(fixture.nativeElement);
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'success');
    vi.spyOn(toast, 'error');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    toast.dismiss();
    fixture.nativeElement.remove();
  });

  function el<T extends Element>(selector: string): T {
    return fixture.nativeElement.querySelector(selector) as T;
  }

  function text(): string {
    return fixture.nativeElement.textContent as string;
  }

  function fill(values: Partial<Record<'full-name' | 'phone' | 'email' | 'password', string>>) {
    for (const [id, value] of Object.entries(values)) {
      el<HTMLInputElement>(`#${id}`).value = value;
      el<HTMLInputElement>(`#${id}`).dispatchEvent(new Event('input'));
    }
  }

  function submit() {
    el<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  function fillValid() {
    fill({ 'full-name': '  Luis Vendedor ', phone: '55 2468 1357', email: ' luis@mammut.mx ', password: 'temporal123' });
  }

  function respond(result: CreateSellerResult) {
    pending.next(result);
    pending.complete();
    fixture.detectChanges();
  }

  it('muestra el formulario con nombre, teléfono, correo para entrar y contraseña temporal', () => {
    expect(text()).toContain('Nuevo vendedor');
    expect(text()).toContain('Correo para entrar');
    expect(el('#full-name')).toBeTruthy();
    expect(el<HTMLInputElement>('#phone').type).toBe('tel');
    expect(el<HTMLInputElement>('#email').type).toBe('email');
    expect(el<HTMLInputElement>('#password').type).toBe('password');
  });

  it('con campos vacíos marca cada uno, enfoca el primero y no llama al servicio', async () => {
    submit();
    await fixture.whenStable();
    expect(saveService.create).not.toHaveBeenCalled();
    const errors = Array.from(fixture.nativeElement.querySelectorAll('.field-error'), (p: Element) => p.textContent?.trim());
    expect(errors).toEqual([
      'Escribe el nombre del vendedor',
      'Escribe el teléfono del vendedor',
      'Escribe el correo para entrar',
      'Escribe una contraseña temporal',
    ]);
    expect(document.activeElement).toBe(el('#full-name'));
  });

  it('teléfono sin 10 dígitos, correo inválido y contraseña corta tienen su propio mensaje', () => {
    fill({ 'full-name': 'Luis', phone: '+52 55 2468 1357', email: 'sin-arroba', password: 'corta' });
    submit();
    expect(text()).toContain('El teléfono debe tener 10 dígitos');
    expect(text()).toContain('El correo no es válido');
    expect(text()).toContain('La contraseña debe tener al menos 8 caracteres');
    expect(saveService.create).not.toHaveBeenCalled();
  });

  it('manda nombre y correo sin espacios y el teléfono solo con dígitos; mientras guarda se deshabilita', () => {
    fillValid();
    submit();
    expect(saveService.create).toHaveBeenCalledWith({
      fullName: 'Luis Vendedor', phone: '5524681357', email: 'luis@mammut.mx', password: 'temporal123',
    });
    expect(text()).toContain('Guardando…');
    expect(el<HTMLInputElement>('#full-name').disabled).toBe(true);

    fixture.componentInstance.onSubmit();
    expect(saveService.create).toHaveBeenCalledTimes(1);
    respond({ ok: true, seller: SELLER });
  });

  it('al guardar muestra «Vendedor dado de alta» con su resumen y el aviso flotante', () => {
    fillValid();
    submit();
    respond({ ok: true, seller: SELLER });
    expect(text()).toContain('Vendedor dado de alta');
    expect(text()).toContain('luis@mammut.mx');
    expect(text()).toContain('55 2468 1357');
    expect(toast.success).toHaveBeenCalledWith('Vendedor «Luis Vendedor» dado de alta');
    expect(el<HTMLAnchorElement>('a[href="/admin/vendedores"]')).toBeTruthy();
  });

  it('«Dar de alta otro vendedor» vuelve a un formulario vacío', () => {
    fillValid();
    submit();
    respond({ ok: true, seller: SELLER });
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find((button) => button.textContent?.trim() === 'Dar de alta otro vendedor')!.click();
    fixture.detectChanges();
    expect(el<HTMLInputElement>('#full-name').value).toBe('');
    expect(el<HTMLInputElement>('#email').value).toBe('');
  });

  it('correo repetido: error bajo el correo, foco ahí y aviso flotante', async () => {
    fillValid();
    submit();
    respond({ ok: false, reason: 'duplicate-email' });
    await fixture.whenStable();
    expect(el('#email-error').textContent).toContain('Ya existe un acceso con ese correo');
    expect(document.activeElement).toBe(el('#email'));
    expect(toast.error).toHaveBeenCalledWith('Ya existe un acceso con ese correo');
    expect(text()).not.toContain('Vendedor dado de alta');
  });

  it('un 422 con mensaje conocido se pinta bajo su campo', async () => {
    fillValid();
    submit();
    respond({ ok: false, reason: 'invalid', message: 'El teléfono debe tener 10 dígitos' });
    await fixture.whenStable();
    expect(el('#phone-error').textContent).toContain('El teléfono debe tener 10 dígitos');
  });

  it('sin conexión: avisa, conserva lo escrito y Reintentar reenvía lo mismo', () => {
    fillValid();
    submit();
    const firstInput = saveService.create.mock.calls[0][0];
    respond({ ok: false, reason: 'offline' });
    expect(text()).toContain('No se pudo guardar');
    expect(toast.error).toHaveBeenCalledWith('No se pudo guardar. Revisa tu conexión.');
    expect(el<HTMLInputElement>('#full-name').value).toBe('  Luis Vendedor ');

    el<HTMLButtonElement>('.retry').click();
    fixture.detectChanges();
    expect(saveService.create).toHaveBeenCalledTimes(2);
    expect(saveService.create.mock.calls[1][0]).toBe(firstInput);
    respond({ ok: true, seller: SELLER });
    expect(text()).toContain('Vendedor dado de alta');
  });

  it('«Mostrar» enseña la contraseña temporal y «Ocultar» la vuelve a tapar', () => {
    el<HTMLButtonElement>('.toggle-password').click();
    fixture.detectChanges();
    expect(el<HTMLInputElement>('#password').type).toBe('text');
    el<HTMLButtonElement>('.toggle-password').click();
    fixture.detectChanges();
    expect(el<HTMLInputElement>('#password').type).toBe('password');
  });
});
