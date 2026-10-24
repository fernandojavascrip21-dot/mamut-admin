import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

const DEFAULT_TITLE = 'Próximamente';

// Pantalla genérica para cada ítem del menú cuya funcionalidad real llega en un milestone
// posterior (M1-M7). La ruta la usa pasando `data: { title: '...' }`.
@Component({
  imports: [],
  selector: 'app-coming-soon',
  templateUrl: './coming-soon.component.html',
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);

  readonly title = toSignal(
    this.route.data.pipe(map((data) => (data['title'] as string) ?? DEFAULT_TITLE)),
    { initialValue: (this.route.snapshot.data['title'] as string) ?? DEFAULT_TITLE },
  );
}
