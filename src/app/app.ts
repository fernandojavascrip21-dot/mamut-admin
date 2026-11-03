import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmHostComponent } from '@core/confirm/confirm-host/confirm-host.component';
import { ToastHostComponent } from '@core/toast/toast-host/toast-host.component';

@Component({
  imports: [RouterOutlet, ToastHostComponent, ConfirmHostComponent],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('mamut-admin');
}
