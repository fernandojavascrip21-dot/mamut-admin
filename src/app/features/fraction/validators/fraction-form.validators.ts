import type { ValidatorFn } from '@angular/forms';

// Esqueleto de HU-23: entero de MIN_PORTIONS a MAX_PORTIONS. Sin implementar.
export function portionsInRange(): ValidatorFn {
  return () => null;
}

// Esqueleto de HU-23: dinero obligatorio, mayor que 0, con hasta `scale` decimales y tope `max`. Sin implementar.
export function requiredMoney(scale: number, max: string): ValidatorFn {
  void scale;
  void max;
  return () => null;
}
