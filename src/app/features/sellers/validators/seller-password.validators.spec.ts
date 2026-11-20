import { FormControl, FormGroup } from '@angular/forms';
import { passwordsMatchValidator } from './seller-password.validators';

describe('passwordsMatchValidator', () => {
  function build(password: string, confirmation: string) {
    const group = new FormGroup({
      password: new FormControl(password, { nonNullable: true }),
      confirmation: new FormControl(confirmation, { nonNullable: true, validators: [passwordsMatchValidator()] }),
    });
    return group.controls.confirmation;
  }

  it('contraseñas iguales: la confirmación es válida', () => {
    expect(build('Clave-Nueva-1', 'Clave-Nueva-1').errors).toBeNull();
  });

  it('contraseñas distintas: la confirmación da el error «mismatch»', () => {
    expect(build('Clave-Nueva-1', 'Clave-Nueva-2').errors).toEqual({ mismatch: true });
  });

  it('confirmación vacía: no da «mismatch» (de eso se encarga el mensaje de campo vacío)', () => {
    expect(build('Clave-Nueva-1', '').hasError('mismatch')).toBe(false);
  });

  it('las dos vacías: no da «mismatch»', () => {
    expect(build('', '').hasError('mismatch')).toBe(false);
  });
});
