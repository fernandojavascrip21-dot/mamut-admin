import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { CONFIRM_DIALOG_BREAKPOINTS, CONFIRM_DIALOG_STYLE } from '@core/confirm/confirm.constants';
import { TOAST_BREAKPOINTS } from '@core/toast/constants/toast.constants';

@Component({
  imports: [RouterOutlet, Toast, ConfirmDialog],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('mamut-admin');
  protected readonly toastBreakpoints = TOAST_BREAKPOINTS;
  protected readonly confirmStyle = CONFIRM_DIALOG_STYLE;
  protected readonly confirmBreakpoints = CONFIRM_DIALOG_BREAKPOINTS;
}
