import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { EditSellerBusy } from '../../../../models/edit-seller-page.models';
import { SellerStatusActionsComponent } from './seller-status-actions.component';
import type { SellerStatusNotice } from './seller-status-actions.models';

const DEACTIVATE_HELP =
  'Si ya no trabaja contigo: no podrá entrar a la app, sus ventas y cortes se conservan y le llegará un aviso por correo.';
const REACTIVATE_HELP =
  'Vuelve a «Mis vendedores», «Viendo» y «Dejar», entra con su contraseña y le llegará un aviso por correo.';
const REMOVE_HELP = 'Solo si lo diste de alta por error y nunca tuvo movimientos.';

describe('SellerStatusActionsComponent', () => {
  let fixture: ComponentFixture<SellerStatusActionsComponent>;

  async function setup(inputs: { active: boolean; busy?: EditSellerBusy; notice?: SellerStatusNotice }) {
    await TestBed.configureTestingModule({ imports: [SellerStatusActionsComponent] }).compileComponents();
    fixture = TestBed.createComponent(SellerStatusActionsComponent);
    fixture.componentRef.setInput('active', inputs.active);
    fixture.componentRef.setInput('busy', inputs.busy ?? null);
    fixture.componentRef.setInput('notice', inputs.notice ?? null);
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  const button = (label: string) => buttons().find((b) => b.textContent!.trim() === label);

  describe('con un vendedor activo', () => {
    beforeEach(() => setup({ active: true }));

    it('muestra el título, «Desactivar vendedor» y «Eliminar vendedor» con su ayuda', () => {
      expect(text()).toContain('Estado del vendedor');
      expect(button('Desactivar vendedor')).toBeDefined();
      expect(button('Eliminar vendedor')).toBeDefined();
      expect(text()).toContain(DEACTIVATE_HELP);
      expect(text()).toContain(REMOVE_HELP);
    });

    it('no ofrece «Reactivar vendedor»', () => {
      expect(button('Reactivar vendedor')).toBeUndefined();
      expect(text()).not.toContain(REACTIVATE_HELP);
    });

    it('«Desactivar vendedor» es secundario con borde y «Eliminar vendedor» es de peligro con borde', () => {
      expect(button('Desactivar vendedor')!.className).toContain('p-button-secondary');
      expect(button('Desactivar vendedor')!.className).toContain('p-button-outlined');
      expect(button('Eliminar vendedor')!.className).toContain('p-button-danger');
      expect(button('Eliminar vendedor')!.className).toContain('p-button-outlined');
    });

    it('emite deactivate y remove al tocar cada botón', () => {
      const deactivate = vi.fn();
      const remove = vi.fn();
      fixture.componentInstance.deactivate.subscribe(deactivate);
      fixture.componentInstance.remove.subscribe(remove);
      button('Desactivar vendedor')!.click();
      expect(deactivate).toHaveBeenCalledTimes(1);
      expect(remove).not.toHaveBeenCalled();
      button('Eliminar vendedor')!.click();
      expect(remove).toHaveBeenCalledTimes(1);
    });
  });

  describe('con un vendedor desactivado', () => {
    beforeEach(() => setup({ active: false }));

    it('muestra «Reactivar vendedor» y «Eliminar vendedor» con su ayuda, sin «Desactivar vendedor»', () => {
      expect(button('Reactivar vendedor')).toBeDefined();
      expect(button('Eliminar vendedor')).toBeDefined();
      expect(button('Desactivar vendedor')).toBeUndefined();
      expect(text()).toContain(REACTIVATE_HELP);
      expect(text()).toContain(REMOVE_HELP);
      expect(text()).not.toContain(DEACTIVATE_HELP);
    });

    it('«Reactivar vendedor» es secundario y emite reactivate', () => {
      const reactivate = vi.fn();
      fixture.componentInstance.reactivate.subscribe(reactivate);
      expect(button('Reactivar vendedor')!.className).toContain('p-button-secondary');
      button('Reactivar vendedor')!.click();
      expect(reactivate).toHaveBeenCalledTimes(1);
    });
  });

  describe('mientras corre una acción', () => {
    it.each<[EditSellerBusy, boolean, string]>([
      ['deactivate', true, 'Desactivando…'],
      ['reactivate', false, 'Reactivando…'],
      ['remove', true, 'Eliminando…'],
    ])('con busy «%s» el botón en curso dice «%s» y todos quedan deshabilitados', async (busy, active, label) => {
      await setup({ active, busy });
      expect(button(label)).toBeDefined();
      expect(buttons().length).toBeGreaterThan(0);
      expect(buttons().every((b) => b.disabled)).toBe(true);
    });

    it('con busy «saving» (guarda el formulario) deshabilita todos sin cambiar los textos', async () => {
      await setup({ active: true, busy: 'saving' });
      expect(button('Desactivar vendedor')!.disabled).toBe(true);
      expect(button('Eliminar vendedor')!.disabled).toBe(true);
    });

    it('sin acción en curso los botones están habilitados', async () => {
      await setup({ active: true });
      expect(buttons().every((b) => !b.disabled)).toBe(true);
    });
  });

  describe('alerta', () => {
    it('sin alerta no hay role=alert', async () => {
      await setup({ active: true });
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
    });

    it('con piezas a su cargo muestra el texto, «Retirar producto» y lo emite', async () => {
      await setup({ active: true, notice: { message: 'Retírale sus piezas antes de desactivarlo', showReturn: true } });
      const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
      expect(alert.textContent).toContain('Retírale sus piezas antes de desactivarlo');
      expect(alert.className).toContain('alert-warning');
      const returnUnits = vi.fn();
      fixture.componentInstance.returnUnits.subscribe(returnUnits);
      button('Retirar producto')!.click();
      expect(returnUnits).toHaveBeenCalledTimes(1);
    });

    it('ya no existe la alerta de historial: un aviso de piezas no la menciona', async () => {
      await setup({ active: true, notice: { message: 'Retírale sus piezas antes de desactivarlo', showReturn: true } });
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).not.toContain('Tiene historial');
    });
  });
});
