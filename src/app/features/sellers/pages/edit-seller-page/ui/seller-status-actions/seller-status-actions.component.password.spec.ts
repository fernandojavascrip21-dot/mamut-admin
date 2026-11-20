import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { EditSellerBusy } from '../../../../models/edit-seller-page.models';
import { SellerStatusActionsComponent } from './seller-status-actions.component';

describe('SellerStatusActionsComponent: «Cambiar contraseña» (HU-45)', () => {
  let fixture: ComponentFixture<SellerStatusActionsComponent>;

  async function setup(active: boolean, busy: EditSellerBusy = null) {
    await TestBed.configureTestingModule({ imports: [SellerStatusActionsComponent] }).compileComponents();
    fixture = TestBed.createComponent(SellerStatusActionsComponent);
    fixture.componentRef.setInput('active', active);
    fixture.componentRef.setInput('busy', busy);
    fixture.detectChanges();
  }

  const button = (label: string) =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(
      (b) => b.textContent!.trim() === label,
    );

  it('un activo muestra «Cambiar contraseña» secundario con la clase change-password', async () => {
    await setup(true);
    const change = button('Cambiar contraseña');
    expect(change).toBeDefined();
    expect(change!.className).toContain('p-button-secondary');
    expect(change!.classList).toContain('change-password');
  });

  it('un desactivado no muestra «Cambiar contraseña»', async () => {
    await setup(false);
    expect(button('Cambiar contraseña')).toBeUndefined();
    expect(fixture.nativeElement.querySelector('.change-password')).toBeNull();
  });

  it('emite changePassword al pulsarlo y no emite las otras acciones', async () => {
    await setup(true);
    const changePassword = vi.fn();
    const deactivate = vi.fn();
    const remove = vi.fn();
    fixture.componentInstance.changePassword.subscribe(changePassword);
    fixture.componentInstance.deactivate.subscribe(deactivate);
    fixture.componentInstance.remove.subscribe(remove);
    button('Cambiar contraseña')!.click();
    expect(changePassword).toHaveBeenCalledTimes(1);
    expect(deactivate).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it.each<EditSellerBusy>(['deactivate', 'remove', 'saving'])(
    'con busy «%s» «Cambiar contraseña» está deshabilitado',
    async (busy) => {
      await setup(true, busy);
      expect(button('Cambiar contraseña')!.disabled).toBe(true);
    },
  );

  it('sin acción en curso está habilitado', async () => {
    await setup(true);
    expect(button('Cambiar contraseña')!.disabled).toBe(false);
  });
});
