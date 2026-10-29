import { Pipe, PipeTransform } from '@angular/core';
import { formatPhone } from '../phone';

// `{{ seller.phone | phone }}` → «55 2468 1357». Es la forma de mostrar cualquier teléfono ya
// registrado en el frontend (vendedores hoy; clientes u otros después), para que todas las
// pantallas lo lean igual. No se usa en inputs: ahí se respeta lo que escribe la persona.
@Pipe({
  name: 'phone',
})
export class PhonePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatPhone(value);
  }
}
