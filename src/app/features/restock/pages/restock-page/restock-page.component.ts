import { Component, signal } from '@angular/core';

@Component({
  imports: [],
  selector: 'app-restock-page',
  templateUrl: './restock-page.component.html',
})
export class RestockPageComponent {
  readonly saving = signal(false);

  hasUnsavedChanges(): boolean {
    return false;
  }
}
