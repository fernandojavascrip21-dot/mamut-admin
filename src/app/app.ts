import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { TOAST_BREAKPOINTS } from '@core/toast/constants/toast.constants';

@Component({
  imports: [RouterOutlet, Toast],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('mamut-admin');
  protected readonly toastBreakpoints = TOAST_BREAKPOINTS;
}
