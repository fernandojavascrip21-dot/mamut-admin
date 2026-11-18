import { vi } from 'vitest';
import { MessageService } from 'primeng/api';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { CreateSellerPageComponent } from './create-seller-page.component';
import { SellerSaveService } from '../../services/seller-save.service';
import { ToastService } from '@core/toast/toast.service';
import type { CreateSellerResult, Seller } from '../../interfaces/seller.models';

const SELLER: Seller = {
  id: 'u1',
  fullName: 'Luis Vendedor',
  businessName: 'Café Centro',
  email: 'luis@mammut.mx',
  phone: '5524681357',
  active: true,
  createdAt: '2026-11-12T18:00:00.000Z',
};
const TOO_LONG = 'El nombre del negocio debe tener como máximo 80 caracteres';

describe('CreateSellerPageComponent · nombre del negocio (HU-43)', () => {
  let fixture: ComponentFixture<CreateSellerPageComponent>;
  let pending: Subject<CreateSellerResult>;
  let saveService: { create: ReturnType<typeof vi.fn> };
  let toast: ToastService;

  beforeEach(async () => {
    saveService = { create: vi.fn(() => (pending = new Subject<CreateSellerResult>())) };
    await TestBed.configureTestingModule({
      imports: [CreateSellerPageComponent],
      providers: [MessageService, provideRouter([])],
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

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent!.replace(/\s+/g, ' ');
  function field(label: string): HTMLInputElement {
    const labelEl = Array.from(root().querySelectorAll('label')).find((l) => l.textContent?.trim() === label);
    return root().querySelector(`#${labelEl!.htmlFor}`) as HTMLInputElement;
  }
  function type(label: string, value: string) {
    const input = field(label);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  function fillValid(business: string) {
    type('Nombre', 'Luis Vendedor');
    type('Nombre del negocio', business);
    type('Teléfono', '55 2468 1357');
    type('Correo para entrar', 'luis@mammut.mx');
    type('Contraseña temporal', 'temporal123');
  }
  async function submit() {
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  }
  function respond(result: CreateSellerResult) {
    pending.next(result);
    pending.complete();
    fixture.detectChanges();
  }

  it('«Nombre del negocio» va entre «Nombre» y «Teléfono», con su ayuda', () => {
    const labels = Array.from(root().querySelectorAll('label'), (l) => l.textContent?.trim());
    expect(labels.slice(0, 3)).toEqual(['Nombre', 'Nombre del negocio', 'Teléfono']);
    expect(text()).toContain('Opcional: gimnasio, café, tienda…');
  });

  it('con «  Café Centro  » se manda «Café Centro»', async () => {
    fillValid('  Café Centro  ');
    await submit();
    expect(saveService.create).toHaveBeenCalledWith(expect.objectContaining({ businessName: 'Café Centro' }));
  });

  it('vacío o de solo espacios se manda null y no bloquea el alta', async () => {
    fillValid('   ');
    await submit();
    expect(saveService.create).toHaveBeenCalledWith(expect.objectContaining({ businessName: null }));
  });

  it('con 81 caracteres muestra el mensaje bajo el campo al enviar y no llama al servicio', async () => {
    fillValid('a'.repeat(81));
    expect(text()).not.toContain(TOO_LONG);
    await submit();
    expect(text()).toContain(TOO_LONG);
    expect(saveService.create).not.toHaveBeenCalled();
  });

  it('un 422 con el mensaje de 80 caracteres se pinta bajo «Nombre del negocio»', async () => {
    fillValid('Café Centro');
    await submit();
    respond({ ok: false, reason: 'invalid', message: TOO_LONG });
    await fixture.whenStable();
    expect(text()).toContain(TOO_LONG);
    expect(toast.error).toHaveBeenCalledWith(TOO_LONG);
  });

  it('el resumen «Vendedor dado de alta» suma la fila «Negocio» solo cuando lo tiene', async () => {
    fillValid('Café Centro');
    await submit();
    respond({ ok: true, seller: SELLER });
    expect(text()).toContain('Vendedor dado de alta');
    expect(text()).toContain('Negocio');
    expect(text()).toContain('Café Centro');
  });

  it('sin negocio el resumen no trae la fila «Negocio»', async () => {
    fillValid('');
    await submit();
    respond({ ok: true, seller: { ...SELLER, businessName: null } });
    expect(text()).toContain('Vendedor dado de alta');
    expect(text()).not.toContain('Negocio');
  });
});
