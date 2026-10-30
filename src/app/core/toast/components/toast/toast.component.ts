import { Component, inject } from '@angular/core';
import { ToastService } from '../../toast.service';

// Pinta el aviso actual de ToastService, flotando arriba a la derecha (a todo lo ancho en celular), sobre la barra de navegación. La región aria-live existe
// siempre (aunque esté vacía) para que los lectores de pantalla anuncien cada aviso nuevo.
@Component({
  imports: [],
  selector: 'app-toast',
  templateUrl: './toast.component.html',
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);
}
