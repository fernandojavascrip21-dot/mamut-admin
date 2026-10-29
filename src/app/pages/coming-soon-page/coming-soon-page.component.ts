import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { DEFAULT_TITLE } from './coming-soon-page.constants';

// Pantalla genérica para cada ítem del menú cuya funcionalidad real llega en un milestone
// posterior (M1-M7). La ruta la usa pasando `data: { title: '...' }`.
@Component({
  imports: [],
  selector: 'app-coming-soon-page',
  templateUrl: './coming-soon-page.component.html',
})
export class ComingSoonPageComponent {
  private readonly route = inject(ActivatedRoute);

  readonly title = toSignal(
    this.route.data.pipe(map((data) => (data['title'] as string) ?? DEFAULT_TITLE)),
    { initialValue: (this.route.snapshot.data['title'] as string) ?? DEFAULT_TITLE },
  );
}
