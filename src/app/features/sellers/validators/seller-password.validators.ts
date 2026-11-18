import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Va sobre el control de confirmación y lo compara con `password` de su grupo. Si alguna está vacía
// no marca nada: el mensaje de «campo vacío» ya cubre ese caso.
export function passwordsMatchValidator(): ValidatorFn {
  let watching = false;
  return (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    if (!parent) {
      // Al construir el control aún no tiene grupo y no hay con qué comparar: se revalida una sola
      // vez cuando el grupo lo adopta, para que el error no dependa de que alguien edite el valor.
      if (!watching) {
        watching = true;
        const adopt = control.setParent.bind(control);
        control.setParent = (group) => {
          adopt(group);
          control.updateValueAndValidity({ emitEvent: false });
        };
      }
      return null;
    }
    const password = parent.get('password')?.value as string | undefined;
    const confirmation = control.value as string;
    if (!password || !confirmation) return null;
    return password === confirmation ? null : { mismatch: true };
  };
}
